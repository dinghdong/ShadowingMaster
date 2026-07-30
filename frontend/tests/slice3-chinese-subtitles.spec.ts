import { test, expect } from "@playwright/test";

/** Slice 3 验收：中文字幕——跟读页出现中文译文，切"仅中文"后仍有内容、英文隐藏 */
test("中文字幕显示与切换", async ({ page }) => {
  await page.goto("/");
  await page.getByText("English Speaking Practice").first().click();

  // 双语模式下能看到中文译文（匹配任意 CJK 字符）
  const zhBubble = page.getByText(/[一-鿿]/).first();
  await expect(zhBubble).toBeVisible();

  // 切到"仅中文"：中文仍在，英文句隐藏
  await page.getByText("仅中文").click();
  await expect(zhBubble).toBeVisible();
  await expect(page.getByText("Lesson one where are you from")).toBeHidden();

  // 切回"仅英文"：英文回来，中文隐藏
  await page.getByText("仅英文").click();
  await expect(page.getByText("Lesson one where are you from")).toBeVisible();
});
