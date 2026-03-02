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

// Route Axios requests through local Vite Proxy to bypass CORS/SameSite cookie failures
axios.interceptors.request.use((config) => {
  if (!config.url) return config;

  const session = localStorage.getItem('session');

  // In Production (Electron), we need the full URL and Manual Sid Forwarding
  if (IS_PROD) {
    if (config.url.startsWith('/api')) {
      config.url = `${BACKEND_URL}${config.url}`;
    }
    // Force Session Token if available
    if (session) {
      config.headers['X-Frappe-SID'] = session;

      // Also inject sid into URL query because Frappe is more likely to accept it
      const separator = config.url.includes('?') ? '&' : '?';
      if (!config.url.includes('sid=')) {
        config.url = `${config.url}${separator}sid=${session}`;
      }
    }
  } else {
    // In Development (Vite Proxy), we strip the URL
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

  // Handle Production Session Token
  const session = localStorage.getItem('session');
  if (IS_PROD && session) {
    if (!config.headers) config.headers = {};
    config.headers['X-Frappe-SID'] = session;

    // Inject sid into URL for fetch as well
    if (typeof resource === 'string' && !resource.includes('sid=')) {
      const separator = resource.includes('?') ? '&' : '?';
      resource = `${resource}${separator}sid=${session}`;
    }
  }

  try {
    const response = await originalFetch(resource, config);
    if (response.status === 403 && typeof resource === 'string' && !resource.includes('user_login')) {
      handleGlobalAuthError();
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
