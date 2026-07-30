import { test, expect } from "@playwright/test";

/** 跟读页精修片验收：每句▶单句播放、盲听模式、倍速切换、切句自动滚动 */
test("跟读页精修：单句播放/盲听/倍速/自动滚动", async ({ page }) => {
  await page.goto("/");
  await page.getByText("English Speaking Practice").first().click();
  const video = page.locator("video");
  await expect(video).toBeVisible();

  // 1. 点第 3 句的 ▶（aria-label=play-sentence-2）→ 播放该句，高亮跟随播放头移动到第 3 句
  await page.getByLabel("play-sentence-2", { exact: true }).click();
  await page.waitForFunction(
    () => { const v = document.querySelector("video"); return v && !v.paused && v.currentTime > 20; },
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () => { const el = document.getElementById("sent-2"); return el && getComputedStyle(el).borderColor === "rgb(255, 127, 80)"; },
    { timeout: 10_000 },
  );

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

  // 4. 点句气泡跳句：目标气泡自动滚入视口
  await page.locator("video").evaluate((v: HTMLVideoElement) => v.pause());
  await page.locator("#sent-5").click();
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
