import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// The report widget (bug reports / feature requests -> an A.O.S agent) is configured from the
// environment so no endpoint or token is ever written into the repo. Anything left blank simply
// disables sending — the button still renders, and the widget tells the user plainly if it cannot
// send. See strat-edge-workflows/bug-report/README.md.
const REPORT_INGEST = process.env.VITE_REPORT_INGEST || ''
const REPORT_TOKEN = process.env.VITE_REPORT_TOKEN || ''
const REPORT_VERSION = process.env.VITE_REPORT_VERSION || process.env.VITE_APP_VERSION || ''
const reportConfig = {
  name: 'report-widget-config',
  transformIndexHtml(html: string) {
    return html
      .replace(/__REPORT_INGEST__/g, REPORT_INGEST)
      .replace(/__REPORT_TOKEN__/g, REPORT_TOKEN)
      .replace(/__REPORT_VERSION__/g, REPORT_VERSION)
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    reportConfig,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Strat Edge Portal Pro',
        short_name: 'StratEdge',
        description: 'Strategic Project Performance & Intelligence Intelligence Network',
        theme_color: '#0ea5e9',
        background_color: '#0a0a0c',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
