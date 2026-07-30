import { test, expect } from "@playwright/test";

/** Slice 1 验收：真实视频按句播放 —— 加载本地视频、切句 seek、播到句末自动暂停 */
test("跟读页真实视频按句播放", async ({ page }) => {
  await page.goto("/");
  // 列表页点击真实视频卡片
  await page.getByText("Easy English Listening Practice").click();

  // 1. <video> 加载本地媒体文件
  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("src", /\/media\/.+\.mp4$/);

  // 2. 点"下一句"（用户手势）→ 播放头跳到第 2 句起点并开始播放
  const t0 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.getByLabel("next-sentence").click();
  await page.waitForFunction(
    (t) => { const v = document.querySelector("video"); return v && !v.paused && v.currentTime > t + 0.3; },
    t0, { timeout: 10_000 },
  );
  const t1 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  expect(t1).toBeGreaterThan(10); // 第 2 句 start_time ≈ 13.7s，明显不是从头播放

  // 3. 播放到句末自动暂停（不等整句：seek 到距句末 0.5s 内观察暂停）
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = v.currentTime; });
  await page.waitForFunction(
    () => { const v = document.querySelector("video"); return v && v.paused && v.currentTime > 15; },
    { timeout: 20_000 },
  );
});
