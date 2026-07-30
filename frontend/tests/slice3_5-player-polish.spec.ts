import { test, expect } from "@playwright/test";

/** 跟读页精修片验收：每句▶单句播放、盲听模式、倍速切换、切句自动滚动 */
test("跟读页精修：单句播放/盲听/倍速/自动滚动", async ({ page }) => {
  await page.goto("/");
  await page.getByText("English Speaking Practice").first().click();
  const video = page.locator("video");
  await expect(video).toBeVisible();

  // 1. 点第 3 句的 ▶（aria-label=play-sentence-2）→ 播放该句但不切换当前句高亮
  await page.getByLabel("play-sentence-2", { exact: true }).click();
  await page.waitForFunction(
    () => { const v = document.querySelector("video"); return v && !v.paused && v.currentTime > 20; },
    { timeout: 10_000 },
  );
  // 当前句仍是第 1 句（边框高亮未移动）
  const currentBorder = await page.locator("#sent-0").evaluate((el) => getComputedStyle(el).borderColor);
  expect(currentBorder).toBe("rgb(255, 127, 80)"); // color.primary

  // 2. 盲听模式：英文句隐藏，当前气泡显示"盲听中"
  await page.getByText("盲听").click();
  await expect(page.getByText("Lesson one where are you from")).toBeHidden();
  await expect(page.getByText("🎧 盲听中…")).toBeVisible();
  await page.getByText("英中").click(); // 恢复

  // 3. 倍速按钮循环：1x → 0.75x → 同步到 video.playbackRate
  await page.getByLabel("rate-toggle").click();
  await expect(page.getByLabel("rate-toggle")).toHaveText("0.75x");
  const rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
  expect(rate).toBe(0.75);

  // 4. 连续切句：当前气泡自动滚入视口
  for (let i = 0; i < 5; i++) await page.getByLabel("next-sentence").click();
  await page.waitForTimeout(600); // 等 smooth 滚动
  const inViewport = await page.locator("#sent-5").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  });
  expect(inViewport).toBe(true);

  // 5. 单句循环开关可切换（开启后按钮高亮为主色）
  await page.getByLabel("loop-single").click();
  const loopBg = await page.getByLabel("loop-single").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(loopBg).toBe("rgb(255, 127, 80)");
});
