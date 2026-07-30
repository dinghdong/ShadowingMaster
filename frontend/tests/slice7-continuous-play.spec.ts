import { test, expect } from "@playwright/test";

/** 交互调整验收（2026-07-30）：默认连续自动播放 + 暂停/播放按钮，无 ⏮⏭ 切句按钮 */
test("连续播放与暂停/播放按钮", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Easy English Listening Practice").click();
  const video = page.locator("video");
  await expect(video).toBeVisible();

  // 1. 进页默认自动播放
  await page.waitForFunction(
    () => { const v = document.querySelector("video"); return v && !v.paused && v.currentTime > 0.3; },
    { timeout: 10_000 },
  );
  await expect(page.getByLabel("play-pause")).toHaveText("⏸");

  // 2. ⏮⏭ 已移除
  await expect(page.getByLabel("next-sentence")).toHaveCount(0);
  await expect(page.getByLabel("prev-sentence")).toHaveCount(0);

  // 3. 暂停/播放按钮切换视频状态与按钮文案
  await page.getByLabel("play-pause").click();
  await page.waitForFunction(() => document.querySelector("video")?.paused === true, { timeout: 5000 });
  await expect(page.getByLabel("play-pause")).toHaveText("▶");
  await page.getByLabel("play-pause").click();
  await page.waitForFunction(() => document.querySelector("video")?.paused === false, { timeout: 5000 });
  await expect(page.getByLabel("play-pause")).toHaveText("⏸");

  // 4. 连续播放跨句不停、高亮跟随（第 1 句约 13.7s 结束，seek 到附近验证）
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 13.2; });
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video");
      const el = document.getElementById("sent-1");
      return v && !v.paused && el && getComputedStyle(el).borderColor === "rgb(255, 127, 80)";
    },
    { timeout: 10_000 },
  );

  // 5. 播放器吸顶：跳到第 11 句、页面滚动后，video 仍钉在视口顶部
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  await page.locator("#sent-10").click();
  await page.waitForTimeout(600); // 等 smooth 滚动
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(0); // 页面确实滚了
  const box = await page.locator("video").boundingBox();
  expect(box).toBeTruthy();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(120); // 钉在顶部（头部栏高度以内）
});
