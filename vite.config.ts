import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import tokens from './design/tokens.json' with { type: 'json' }

// GitHub Pages liegt unter https://josepuerco.github.io/kcalm/
const base = '/kcalm/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Neue Version wird im Hintergrund geladen und beim nächsten Öffnen aktiv
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        // Feste Kennung der App, unabhängig von start_url
        id: base,
        name: 'Kcalm',
        short_name: 'Kcalm',
        description: 'Kalorien ruhig tracken. Alle Daten bleiben auf dem Gerät.',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: tokens.color.light.bg,
        theme_color: tokens.color.light.bg,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles für den Offline-Betrieb vorab in den Cache legen
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,wasm}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
