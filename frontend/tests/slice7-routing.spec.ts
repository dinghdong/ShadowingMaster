import { test, expect } from "@playwright/test";

/** Slice 7 验收：hash 路由 — 点卡片 URL 变化、刷新保持、浏览器前进/后退、直达链接 */
test("页面路由：#/video/:id 直达与前进后退", async ({ page }) => {
  await page.goto("/");

  // 点卡片 → URL 变为 #/video/:id
  await page.getByText("English Speaking Practice").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page).toHaveURL(/#\/video\/\d+$/);
  const playerHash = new URL(page.url()).hash;

  // 刷新 → 仍在同一跟读页
  await page.reload();
  await expect(page.locator("video")).toBeVisible();
  expect(new URL(page.url()).hash).toBe(playerHash);

  // 浏览器后退 → 回列表页
  await page.goBack();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByText("English Speaking Practice").first()).toBeVisible();

  // 浏览器前进 → 回跟读页
  await page.goForward();
  await expect(page.locator("video")).toBeVisible();

  // 直达链接：hash 直接打开生词本页 / 跟读页
  await page.goto("/#/wordbook");
  await expect(page.getByText("我的生词本")).toBeVisible();
  await page.goto(`/${playerHash}`);
  await expect(page.locator("video")).toBeVisible();
});
