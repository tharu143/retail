import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('Host', 'retailpos');
            // Remove problematic headers
            proxyReq.removeHeader('Expect');     // FIX 417

            // Forward cookies manually or via X-Frappe-SID injected fallback 
            let cookieStr = req.headers.cookie || '';

            if (req.headers['x-frappe-sid']) {
              if (!cookieStr.includes('sid=')) {
                cookieStr += (cookieStr ? '; ' : '') + 'sid=' + req.headers['x-frappe-sid'];
              }
            }

            if (cookieStr) {
              proxyReq.setHeader('Cookie', cookieStr);
            }
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`Proxied: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);

            // Handle set-cookie
            if (proxyRes.headers['set-cookie']) {
              const cookies = proxyRes.headers['set-cookie'].map(cookie =>
                cookie
                  .replace(/;?\s*Domain=[^;]+/gi, '')
                  .replace(/;?\s*Path=[^;]+/gi, '; Path=/')
              );
              res.setHeader('set-cookie', cookies);
            }
          });

          proxy.on('error', (err) => {
            console.error('Proxy error:', err);
          });
        },
      },
      '/files': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Host', 'retailpos');
          });
        }
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'dexie', 'axios', 'react-redux', '@reduxjs/toolkit']
        }
      }
    }
  }
});