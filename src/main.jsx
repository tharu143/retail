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
axios.defaults.withCredentials = true;

const handleGlobalAuthError = () => {
  console.error("Session expired or missing credentials (403). Forcing logout.");
  store.dispatch(logout());
  localStorage.clear();
  window.location.href = '/';
};

// Route Axios requests through local Vite Proxy to bypass CORS/SameSite cookie failures
axios.interceptors.request.use((config) => {
  if (config.url && config.url.includes('http://75.119.130.59')) {
    config.url = config.url.replace('http://75.119.130.59', '');
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

  // Route Fetch requests through local Vite Proxy to bypass CORS/SameSite cookie failures
  if (typeof resource === 'string' && resource.includes('http://75.119.130.59')) {
    resource = resource.replace('http://75.119.130.59', '');
  }

  // Ensure config object exists
  if (!config) {
    config = {};
  }

  // Force credentials inclusion for all standard fetch requests
  if (config.credentials === undefined) {
    config.credentials = 'include';
  }

  try {
    const response = await originalFetch(resource, config);
    if (response.status === 403 && typeof resource === 'string' && !resource.includes('user_login')) {
      handleGlobalAuthError();
    }
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
