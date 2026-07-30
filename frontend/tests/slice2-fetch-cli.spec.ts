import { test, expect } from "@playwright/test";

/** Slice 2 验收：fetch_video.py 爬取的新视频出现在列表页且可播放 */
test("爬取的新视频可浏览可播放", async ({ page }) => {
  await page.goto("/");
  // 新爬取的视频出现在列表页
  const card = page.getByText("English Speaking Practice", { exact: false }).first();
  await expect(card).toBeVisible();
  await card.click();

  // 跟读页加载真实媒体文件
  const video = page.locator("video");
  await expect(video).toHaveAttribute("src", /\/media\/caieIZfl3Ew\.mp4$/);
  // 字幕气泡已渲染（含入库句子的文本）
  await expect(page.getByText("Lesson one where are you from")).toBeVisible();

  // 切句后播放头跳转
  await page.getByText("⏭ 下一句").click();
  await page.waitForFunction(
    () => { const v = document.querySelector("video"); return v && v.currentTime > 15; },
    { timeout: 10_000 },
  );
});
