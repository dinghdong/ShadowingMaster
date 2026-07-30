import { test, expect } from "@playwright/test";

/** Slice 6 验收：生词本点词条 → 跳回原视频原句（按 sentence_id 定位句序） */
test("生词本跳回原句", async ({ page, request }) => {
  const base = "http://localhost:8000";
  const email = `slice6_${Date.now()}@test.com`;
  const password = "pass1234";

  // 注册 + 登录
  const reg = await request.post(`${base}/api/auth/register`, { data: { email, password } });
  expect(reg.ok()).toBeTruthy();
  const loginRes = await request.post(`${base}/api/auth/login`, {
    form: { username: email, password },
  });
  const { access_token } = await loginRes.json();
  const auth = { Authorization: `Bearer ${access_token}` };

  // 找到目标视频的第 6 句（index 5），把其中一个词加入生词本（带来源）
  const videos = await (await request.get(`${base}/api/videos`)).json();
  const video = videos.find((v: any) => v.title.includes("English Speaking Practice"));
  const detail = await (await request.get(`${base}/api/videos/${video.id}`)).json();
  const target = detail.sentences[5];
  const word = target.english_text.replace(/[^a-zA-Z'\s]/g, "").split(/\s+/).filter(Boolean)[0];
  const add = await request.post(
    `${base}/api/wordbook?word=${encodeURIComponent(word)}&definition=probe&video_id=${video.id}&sentence_id=${target.id}`,
    { headers: auth },
  );
  expect(add.ok()).toBeTruthy();

  // 进页面注入 token，打开生词本，点击词条
  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("token", t), access_token);
  await page.reload();
  await page.getByText("📖").click();
  await expect(page.getByText("我的生词本")).toBeVisible();
  await page.getByText("↩ 回到原句").click();

  // 落在跟读页，当前句 = 第 6 句（index 5，主色边框）
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("#sent-5")).toBeVisible();
  const border = await page.locator("#sent-5").evaluate((el) => getComputedStyle(el).borderColor);
  expect(border).toBe("rgb(255, 127, 80)");
  // 当前句文本与目标句一致
  await expect(page.locator("#sent-5")).toContainText(target.english_text.slice(0, 20));
});
