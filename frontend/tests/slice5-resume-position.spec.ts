import { test, expect } from "@playwright/test";

/**
 * Slice 5 验收：进入跟读页默认定位到上次学到的位置，同时浮条展示"从头开始"，
 * 点击"从头开始"跳回第 1 句从头播放；游客/无进度用户不显示该浮条。
 */
test("跟读位置记忆：重进视频定位到上次学到的位置", async ({ page, request }) => {
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
  // 当前句高亮边框 = 品牌橙（toHaveCSS 会自动重试，跳过 border-color 过渡动画的中间帧）
  const expectCurrent = (sel: string, opts?: { timeout?: number }) =>
    expect(page.locator(sel)).toHaveCSS("border-color", "rgb(255, 127, 80)", opts);

  await page.goto("/app");
  await page.evaluate((t) => localStorage.setItem("token", t), access_token);
  await page.reload();

  // 首次进入（无进度）→ 从第 1 句开始，不显示"从头开始"
  await page.locator(".video-card").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("从头开始")).toHaveCount(0);
  await freeze();
  await expectCurrent("#sent-0");

  // 点第 3 句并等防抖上报落库
  await page.locator("#sent-2").click();
  await freeze();
  await page.waitForTimeout(1200);

  // 返回列表再重新进入 → 定位到第 3 句（上次学到的位置），浮条显示"从头开始"
  await page.goto("/app");
  await page.locator(".video-card").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("从头开始")).toBeVisible();
  await expectCurrent("#sent-2");
  // 进页从「上次学到的位置」连续自动播放：播放头推进过第 3 句且未自停
  // （回归：此前会播放完该句后句末自停，属 bug）
  await expectCurrent("#sent-3", { timeout: 20000 });
  await expect(page.locator("video")).toHaveJSProperty("paused", false);
  await page.getByText("从头开始").click();
  // 点击后跳回第 1 句并连续播放，浮条消失
  await expectCurrent("#sent-0");
  await expect(page.getByText("从头开始")).toHaveCount(0);
  // 连续播放：播放头推进到第 2 句且未自动暂停（验证不句末自停）
  await expectCurrent("#sent-1", { timeout: 20000 });
  await expect(page.locator("video")).toHaveJSProperty("paused", false);

  // 游客（无 token）进入 → 从第 1 句开始，不显示"从头开始"
  await page.evaluate(() => localStorage.removeItem("token"));
  await page.goto("/app");
  await page.reload();
  await page.locator(".video-card").first().click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("从头开始")).toHaveCount(0);
  await freeze();
  await expectCurrent("#sent-0");
});
