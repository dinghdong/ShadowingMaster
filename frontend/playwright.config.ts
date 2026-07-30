import { defineConfig } from "@playwright/test";

/**
 * E2E 基建：测试运行期间由 Playwright 拉起前后端，跑完即停。
 * 后端需要 managed python 环境里的 uvicorn（requirements.txt 已含）。
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  webServer: [
    {
      command: "uvicorn main:app --port 8000",
      cwd: "../backend",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run dev -- --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
