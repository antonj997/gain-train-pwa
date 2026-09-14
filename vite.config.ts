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
        name: "Gain Train — Workout Log",
        short_name: "Gain Train",
        description: "Log your sets. See your progress. Works offline.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0d111c",
        theme_color: "#365de9",
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
        navigateFallback: base + "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { host: "127.0.0.1", port: 8082 },
});
