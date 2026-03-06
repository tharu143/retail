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

// 1. Global Axios Configuration
const BACKEND_URL = 'http://75.119.130.59';
const IS_PROD = window.location.protocol === 'file:';

axios.defaults.withCredentials = true;

const handleGlobalAuthError = () => {
  // In Production (Electron), we often hit 403 due to cookie restrictions.
  // We MUST NOT force logout if we are already logged in locally, as we use X-Frappe-SID headers.
  if (IS_PROD) {
    console.warn("403 Forbidden skipped in production to prevent logout loops.");
    return;
  }

  if (window.location.hash === '#/' || window.location.hash === '') {
    return; // Already on login page
  }

  console.error("Session expired or missing credentials (403). Forcing logout.");
  store.dispatch(logout());
  localStorage.clear();
  window.location.hash = '#/';
};

console.log(`[APP] Mode: ${IS_PROD ? 'Production (Electron)' : 'Development (Vite)'}`);

axios.interceptors.request.use((config) => {
  if (!config.url) return config;

  const session = localStorage.getItem('session');

  // Always inject Session Token if available to prevent CSRF errors in both Web and Electron
  if (session) {
    if (config.url.startsWith('/api')) {
      // In Production (Electron/file:), we need context prefix
      if (IS_PROD && !config.url.startsWith('http')) {
        config.url = `${BACKEND_URL}${config.url}`;
      }

      // Add standard session headers
      config.headers['X-Frappe-SID'] = session;

      // CRITICAL: Inject CSRF Token from cookies if present (Required for Web POSTs)
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('X-Frappe-CSRF-Token='))
        ?.split('=')[1];

      if (csrfToken) {
        config.headers['X-Frappe-CSRF-Token'] = decodeURIComponent(csrfToken);
      }

      // Inject sid into URL query because Frappe is more likely to accept it
      const separator = config.url.includes('?') ? '&' : '?';
      if (!config.url.includes('sid=')) {
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
      handleGlobalAuthError();
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

  // Force credentials inclusion for all standard fetch requests
  if (config.credentials === undefined) {
    config.credentials = 'include';
  }

  // Handle Session Token for both Web and Electron
  const session = localStorage.getItem('session');
  if (session) {
    // Notify Main Process for Cookie Injection (Electron only)
    if (IS_PROD && window.electronAPI?.setSession) {
      window.electronAPI.setSession(session);
    }

    // Ensure headers object exists and handle both plain objects and Headers instances
    if (!config.headers) config.headers = {};

    const setHeader = (name, value) => {
      if (config.headers instanceof Headers) {
        config.headers.set(name, value);
      } else {
        config.headers[name] = value;
      }
    };

    setHeader('X-Frappe-SID', session);

    // CRITICAL: Inject CSRF Token from cookies if present
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('X-Frappe-CSRF-Token='))
      ?.split('=')[1];

    if (csrfToken) {
      setHeader('X-Frappe-CSRF-Token', decodeURIComponent(csrfToken));
    }

    // Inject sid into URL for fetch as well (Reliable bypass for many Frappe CSRF checks)
    if (typeof resource === 'string' && resource.includes('/api') && !resource.includes('sid=')) {
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
