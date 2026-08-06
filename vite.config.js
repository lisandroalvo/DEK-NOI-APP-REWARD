import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      // functions/ is its own npm package with its own (older) firebase-admin copy. Under
      // Vitest, code under functions/ and code under test/ would otherwise each resolve
      // 'firebase-admin' to a different physical install — two different classes, so a
      // FieldValue sentinel made in one is rejected as foreign by a Firestore instance
      // made from the other. Force both to the single root copy for the test run only;
      // this has no effect on the deployed Cloud Function, which never runs through Vite.
      'firebase-admin/app': fileURLToPath(new URL('./node_modules/firebase-admin/lib/esm/app/index.js', import.meta.url)),
      'firebase-admin/firestore': fileURLToPath(new URL('./node_modules/firebase-admin/lib/esm/firestore/index.js', import.meta.url)),
    },
  },
  test: {
    // The Firestore emulator runs in singleProjectMode (firebase.json), so every test file's
    // "projectId" aliases to the same underlying data. redeemCore.test.js clears the entire
    // emulator between its own tests, which corrupts state for any other emulator-backed suite
    // running concurrently. Running test files one at a time keeps each suite's data isolated.
    fileParallelism: false,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves (src/lib/registerSW.js) to add periodic + on-focus
      // update checks, so a deploy reaches apps that are already open.
      injectRegister: false,
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'DEK NOI Rewards',
        short_name: 'DEK NOI',
        description: 'Earn points and redeem rewards at DEK NOI Minimart',
        theme_color: '#CC0000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-cache' },
          },
        ],
      },
    }),
  ],
})
