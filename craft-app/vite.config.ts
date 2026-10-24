import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Adds the push notification handlers (public/push-sw.js) to the
      // service worker.
      workbox: {
        importScripts: ["/push-sw.js"],
      },
      manifest: {
        name: "Polly",
        short_name: "Polly",
        description: "Your personal life organizer",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pollyicondots.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pollyicondots.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});