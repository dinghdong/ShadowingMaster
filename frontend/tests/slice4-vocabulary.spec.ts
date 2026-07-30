import { test, expect } from "@playwright/test";

/** Slice 4 验收：生词标注真词表——常见词不标红、真生词标红 */
test("生词高亮基于 SUBTLEXus top5000", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Hyperframes: Edit and Create").first().click();
  // 第 1 句：This video will be your one-stop shop on how to use HyperFrames alongside Claude code.
  const sent = page.locator("#sent-0");
  await expect(sent).toBeVisible();

  // "video" 是常见词 → 正文色 rgb(45,45,45)，且不可点击标红样式
  const videoColor = await sent.getByText("video", { exact: true }).first().evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(videoColor).toBe("rgb(45, 45, 45)");

  // "HyperFrames" 是专有名词（不在 top5000）→ 生词红 rgb(231,76,60)
  const hardColor = await sent.getByText("HyperFrames", { exact: true }).first().evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(hardColor).toBe("rgb(231, 76, 60)");

  // "use"（动词原形，常见）不标红；"opened"（变形还原为 open）在后面的句子也不标红
  const useColor = await sent.getByText("use", { exact: true }).first().evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(useColor).toBe("rgb(45, 45, 45)");
  const opened = page.locator("#sent-2").getByText("opened", { exact: true });
  const openedColor = await opened.evaluate((el) => getComputedStyle(el).color);
  expect(openedColor).toBe("rgb(45, 45, 45)"); // opened → open 归一命中
});
