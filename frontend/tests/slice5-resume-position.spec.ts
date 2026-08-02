import { test, expect } from "@playwright/test";

/** Slice 5 验收：重新进入跟读页统一从第 1 句开始，浮条显示"从头开始" */
test("跟读位置记忆：重进视频从第 1 句开始", async ({ page, request }) => {
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

  // 视频播放后暂停以便确定性断言
  const freeze = async () => {
    await page.waitForFunction(
      () => { const v = document.querySelector("video"); return v && v.currentTime > 0; },
      undefined,
      { timeout: 8000 },
    ).catch(() => {});
    await page.locator("video").evaluate((v: HTMLVideoElement) => v.pause());
  };

  await page.goto("/app");
  await page.evaluate((t) => localStorage.setItem("token", t), access_token);
  await page.reload();

  // 打开第一个视频，此时应从第 1 句开始并显示"从头开始"浮条
  await page.locator(".video-card").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("从头开始")).toBeVisible();
  await page.getByText("从头开始").click();
  await freeze();
  const first = await page.locator("#sent-0").evaluate((el) => getComputedStyle(el).borderColor);
  expect(first).toBe("rgb(255, 127, 80)");

  // 点第 3 句并等防抖上报落库
  await page.locator("#sent-2").click();
  await freeze();
  await page.waitForTimeout(1200);

  // 返回列表再重新进入 → 仍从第 1 句开始（不再恢复上次句位）
  await page.goto("/app");
  await page.locator(".video-card").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("从头开始")).toBeVisible();
  await page.getByText("从头开始").click();
  await freeze();
  const restarted = await page.locator("#sent-0").evaluate((el) => getComputedStyle(el).borderColor);
  expect(restarted).toBe("rgb(255, 127, 80)");

  // 游客（无 token）进入 → 也从第 1 句开始
  await page.evaluate(() => localStorage.removeItem("token"));
  await page.goto("/app");
  await page.reload();
  await page.locator(".video-card").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("从头开始")).toBeVisible();
  await page.getByText("从头开始").click();
  await freeze();
  const guestFirst = await page.locator("#sent-0").evaluate((el) => getComputedStyle(el).borderColor);
  expect(guestFirst).toBe("rgb(255, 127, 80)");
});
