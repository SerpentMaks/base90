import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Имя репозитория на GitHub Pages → базовый путь сайта.
const REPO = "base90";
const BASE = `/${REPO}/`;

const sha = (process.env.GITHUB_SHA ?? "local").slice(0, 7);
const builtAt = new Date().toISOString();

export default defineConfig({
  base: BASE,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              debugName: "learning-content",
              name: (id: string) =>
                id.includes("words.json")
                  ? "word-content"
                  : id.includes("course.json")
                    ? "lesson-content"
                    : id.includes("forms.json")
                      ? "forms-content"
                      : "audio-content",
              test: /src\/content\/.*\.json$/,
            },
          ],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(
      `${process.env.npm_package_version ?? "0.0.0"}+${sha}`,
    ),
    __BUILT_AT__: JSON.stringify(builtAt),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json,webmanifest,m4a}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        id: BASE,
        name: "Base90 — английский за 90 дней",
        short_name: "Base90",
        description:
          "Английский с нуля: слова, аудио, грамматика и повторения. Работает офлайн.",
        lang: "ru",
        dir: "ltr",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait",
        background_color: "#f7f7f5",
        theme_color: "#f7f7f5",
        categories: ["education"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: { enabled: false, type: "module" },
    }),
  ],
});
