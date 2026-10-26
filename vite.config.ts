import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";
const base = process.env.GITHUB_PAGES === "true" ? "/gain-train-pwa/" : "/";
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        // A stable identity keeps installs linked if start_url ever changes.
        id: base,
        name: "Gain Train — Workout Log",
        short_name: "Gain Train",
        description: "Log your sets. See your progress. Works offline.",
        lang: "en",
        categories: ["health", "fitness", "sports"],
        start_url: base,
        scope: base,
        display: "standalone",
        // Match the dark app background so the splash and title bar don't flash.
        background_color: "#0d1016",
        theme_color: "#0d1016",
        shortcuts: [
          {
            name: "Start or resume workout",
            short_name: "Workout",
            url: base + "?start=workout",
            icons: [{ src: base + "icon-192.png", sizes: "192x192" }],
          },
          {
            name: "History",
            url: base + "history",
            icons: [{ src: base + "icon-192.png", sizes: "192x192" }],
          },
        ],
        screenshots: [
          {
            src: base + "screenshots/workout.png",
            sizes: "780x1688",
            type: "image/png",
            form_factor: "narrow",
            label: "Log sets with your previous results alongside",
          },
          {
            src: base + "screenshots/progress.png",
            sizes: "780x1688",
            type: "image/png",
            form_factor: "narrow",
            label: "Track progress for every exercise",
          },
          {
            src: base + "screenshots/home.png",
            sizes: "780x1688",
            type: "image/png",
            form_factor: "narrow",
            label: "Start a workout or a saved routine",
          },
        ],
        icons: [
          { src: base + "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: base + "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: base + "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        // Install-sheet screenshots are only fetched by the browser's install UI.
        globIgnores: ["screenshots/**"],
        navigateFallback: base + "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(recharts|d3-|react-smooth)/.test(id))
            return "charts";
          if (id.includes("node_modules/@supabase/")) return "cloud";
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react";
        },
      },
    },
  },
  server: { host: "127.0.0.1", port: 8082 },
});
