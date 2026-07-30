import { test, expect } from "@playwright/test";

/** Slice 1 验收（2026-07-30 连续播放模型）：真实视频加载 + 进页默认连续自动播放 + 高亮跟随 */
test("跟读页真实视频加载与连续播放", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Easy English Listening Practice").click();

  // 1. <video> 加载本地媒体文件
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("src", /\/media\/.+\.mp4$/);

  // 2. 进页默认自动播放（无需再点）
  await page.waitForFunction(
    () => { const v = document.querySelector("video"); return v && !v.paused && v.currentTime > 0.3; },
    { timeout: 10_000 },
  );

  // 3. 连续播放：跨过第 1 句末尾（≈13.7s）不自动暂停，高亮跟随到第 2 句
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 13.0; });
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video");
      const el = document.getElementById("sent-1");
      return v && !v.paused && v.currentTime > 14.2 && el && getComputedStyle(el).borderColor === "rgb(255, 127, 80)";
    },
    { timeout: 10_000 },
  );
});
