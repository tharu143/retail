import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { persistor, store } from './Redux/store.js';
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import axios from 'axios';
import { logout } from './Redux/Slices/userSlice';

// === GLOBAL API AND AUTHENTICATION CONFIGURATION ===

// 0. Globally Disable Mouse Wheel / Scroll Value Changes on ALL Number Inputs Across the Entire App
if (typeof window !== 'undefined') {
  document.addEventListener(
    'wheel',
    function (e) {
      if (
        document.activeElement &&
        document.activeElement.tagName === 'INPUT' &&
        document.activeElement.type === 'number'
      ) {
        document.activeElement.blur();
      }
    },
    { passive: true }
  );
}

// 1. Global Axios Configuration
const BACKEND_URL = 'http://75.119.130.59:8089';
const IS_ELECTRON = window.location.protocol === 'file:';
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_PROD = IS_ELECTRON;

// Only use credentials (cookies) in Electron. For Web, we use X-Frappe-SID headers to bypass CSRF.
axios.defaults.withCredentials = IS_PROD;

let _authCheckPending = false; // Prevent multiple concurrent session checks

const handleGlobalAuthError = () => {
  // In Production (Electron), we often hit 403 due to cookie restrictions.
  // We MUST NOT force logout if we are already logged in locally, as we use X-Frappe-SID headers.
  if (IS_PROD) {
    console.warn("403 Forbidden skipped in production/electron to prevent logout loops.");
    return;
  }

  if (window.location.hash === '#/' || window.location.hash === '') {
    return; // Already on login page — nothing to do
  }

  // Prevent duplicate concurrent checks
  if (_authCheckPending) return;
  _authCheckPending = true;

  const session = localStorage.getItem('session');

  // If there's no session at all, logout is valid
  if (!session) {
    _authCheckPending = false;
    console.error("No session found. Forcing logout.");
    store.dispatch(logout());
    window.location.hash = '#/';
    return;
  }

  // ── Smart session ping: verify if session is ACTUALLY expired ──────────
  // Use the raw originalFetch with X-Frappe-SID header
  const pingUrl = `/api/method/frappe.auth.get_logged_user?sid=${session}`;
  originalFetch(pingUrl, {
    credentials: 'omit',
    headers: { 'X-Frappe-SID': session }
  })
    .then(async (res) => {
      let body = {};
      try { body = await res.json(); } catch (_) {}
      const loggedUser = body?.message || '';

      if (res.ok && loggedUser && loggedUser !== 'Guest') {
        // Session is still VALID — the 403 was a CSRF/transient issue, NOT expiry
        console.warn(`[Auth] 403 received but session is still valid (user: ${loggedUser}). Skipping logout.`);
      } else {
        // Session is truly dead — force logout cleanly (don't nuke ALL of localStorage)
        console.error(`[Auth] Session confirmed expired (response: ${loggedUser || res.status}). Logging out.`);
        localStorage.removeItem('session');
        store.dispatch(logout());
        window.location.hash = '#/';
      }
    })
    .catch(() => {
      // Network error during ping — don't logout, user might just be offline
      console.warn('[Auth] Session ping failed (network error). Staying logged in.');
    })
    .finally(() => {
      _authCheckPending = false;
    });
};

console.log(`[APP] Mode: ${IS_PROD ? 'Production (Electron)' : (IS_LOCAL ? 'Development (Local)' : 'Web (Server)')}`);

// Helper to get cookie value
const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Route Axios requests through local Vite Proxy to bypass CORS/SameSite cookie failures
axios.interceptors.request.use((config) => {
  if (!config.url) return config;

  const csrfToken = getCookie('csrf_token');
  if (csrfToken) {
    config.headers['X-Frappe-CSRF-Token'] = csrfToken;
  }

  const session = localStorage.getItem('session');

  // Always inject Session Token if available for Token-based Auth (Bypasses CSRF)
  if (session) {
    if (config.url.startsWith('/api')) {
      // In Production (Electron/file:), we need context prefix
      if (IS_PROD && !config.url.startsWith('http')) {
        config.url = `${BACKEND_URL}${config.url}`;
      }

      // Add standard session headers
      if (!config.url.includes('user_login')) {
        config.headers['X-Frappe-SID'] = session;
      }

      // Inject sid into URL query because it's a reliable fallback for Frappe
      const separator = config.url.includes('?') ? '&' : '?';
      if (!config.url.includes('sid=') && !config.url.includes('user_login')) {
        config.url = `${config.url}${separator}sid=${session}`;
      }
    }
  } else if (!IS_PROD) {
    // In Development (Vite Proxy), we strip the URL if no session (e.g. login)
    if (config.url.includes(BACKEND_URL)) {
      config.url = config.url.replace(BACKEND_URL, '');
    }
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response &&
      error.response.status === 403 &&
      error.config &&
      error.config.url &&
      !error.config.url.includes('user_login')
    ) {
      if (localStorage.getItem('session')) {
        console.warn("[Axios] 403 received, but keeping active local session intact.");
      } else {
        handleGlobalAuthError();
      }
    }
    return Promise.reject(error);
  }
);

// 2. Global Fetch Override
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let [resource, config] = args;

  // Route Fetch requests through local Vite Proxy or add base URL for Production
  if (typeof resource === 'string') {
    if (IS_PROD) {
      if (resource.startsWith('/api')) {
        resource = `${BACKEND_URL}${resource}`;
      }
    } else {
      if (resource.includes(BACKEND_URL)) {
        resource = resource.replace(BACKEND_URL, '');
      }
    }
  }

  // Ensure config object exists
  if (!config) {
    config = {};
  }

  // Use cookies in Electron, but omit them on Web to bypass CSRF
  if (config.credentials === undefined) {
    config.credentials = IS_PROD ? 'include' : 'omit';
  }

  // Handle Session Token for both Web and Electron
  const session = localStorage.getItem('session');
  if (session) {
    // Notify Main Process for Cookie Injection (Electron only)
    if (IS_PROD && window.electronAPI?.setSession) {
      window.electronAPI.setSession(session);
    }

    // Ensure headers object exists
    if (!config.headers) config.headers = {};

    const setHeader = (name, value) => {
      if (config.headers instanceof Headers) {
        config.headers.set(name, value);
      } else {
        config.headers[name] = value;
      }
    };

    const urlStr = typeof resource === 'string' ? resource : (resource?.url || '');
    if (!urlStr.includes('user_login')) {
      setHeader('X-Frappe-SID', session);
    }

    // Inject sid into URL for fetch as well, but NOT for login
    if (typeof resource === 'string' && resource.includes('/api') && !resource.includes('sid=') && !resource.includes('user_login')) {
      const separator = resource.includes('?') ? '&' : '?';
      resource = `${resource}${separator}sid=${session}`;
    }
  }

  try {
    const response = await originalFetch(resource, config);

    // Handle 403 but don't force logout immediately if we are on Web and might just have a CSRF issue
    if (response.status === 403 && typeof resource === 'string' && !resource.includes('user_login')) {
      if (!IS_PROD) {
        console.warn("403 detected - likely CSRF or Session expiry. Attempting to stay logged in.");
        // If we have a session but get 403, we don't logout immediately to allow retries
      } else {
        handleGlobalAuthError();
      }
    }

    // Safely wrap response.json() to prevent HTML/proxy errors from crashing the app
    const originalJson = response.json.bind(response);
    response.json = async () => {
      try {
        return await originalJson();
      } catch (err) {
        if (!navigator.onLine || !response.ok) {
          throw new Error(`Server is currently unreachable or offline (HTTP ${response.status})`);
        }
        throw new Error("Unable to parse server response.");
      }
    };

    return response;
  } catch (error) {
    throw error;
  }
};

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
      <App />
    </PersistGate>
  </Provider>
);
