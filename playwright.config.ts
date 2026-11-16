import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4173/base90/",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/base90/",
    reuseExistingServer: true,
  },
});
