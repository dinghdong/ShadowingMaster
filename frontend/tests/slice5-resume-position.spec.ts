import { test, expect } from "@playwright/test";

/** Slice 5 验收：重新进入跟读页时恢复到上次句位（登录用户）；游客从头开始 */
test("跟读位置记忆：重进视频回到上次句位", async ({ page, request }) => {
  const base = "http://localhost:8000";
  const email = `slice5_${Date.now()}@test.com`;
  const password = "pass1234";

  // 直接走后端 API 注册+登录，拿到 token 注入页面
  const reg = await request.post(`${base}/api/auth/register`, { data: { email, password } });
  expect(reg.ok()).toBeTruthy();
  const loginRes = await request.post(`${base}/api/auth/login`, {
    form: { username: email, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { access_token } = await loginRes.json();

  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("token", t), access_token);
  await page.reload();

  // 打开视频，切两句 → 当前句 = 第 3 句（index 2）
  await page.getByText("English Speaking Practice").first().click();
  await expect(page.locator("video")).toBeVisible();
  await page.getByLabel("next-sentence").click();
  await page.getByLabel("next-sentence").click();
  const curBorder = await page.locator("#sent-2").evaluate((el) => getComputedStyle(el).borderColor);
  expect(curBorder).toBe("rgb(255, 127, 80)");

  // 等防抖上报落库，返回列表
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "←" }).click();
  await expect(page.getByText("English Speaking Practice").first()).toBeVisible();

  // 重新进入 → 自动恢复到第 3 句
  await page.getByText("English Speaking Practice").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("#sent-2")).toBeVisible();
  const restored = await page.locator("#sent-2").evaluate((el) => getComputedStyle(el).borderColor);
  expect(restored).toBe("rgb(255, 127, 80)");

  // 游客（无 token）进入 → 从第 1 句开始
  await page.evaluate(() => localStorage.removeItem("token"));
  await page.reload();
  await page.getByText("English Speaking Practice").first().click();
  await expect(page.locator("video")).toBeVisible();
  const first = await page.locator("#sent-0").evaluate((el) => getComputedStyle(el).borderColor);
  expect(first).toBe("rgb(255, 127, 80)");
});
