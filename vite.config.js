import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://75.119.130.59',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Remove problematic headers
            proxyReq.removeHeader('Expect');     // FIX 417
            proxyReq.removeHeader('Origin');

            // Forward cookies
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
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
    },
  },
});