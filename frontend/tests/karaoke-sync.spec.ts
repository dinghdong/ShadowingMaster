import { test, expect } from "@playwright/test";

/**
 * 卡拉OK高亮与语音的对齐精度。
 *
 * 回归背景：词级时间戳回填后高亮反而更飘。根因不在数据，而在采样率——播放头原先只由
 * <video> 的 timeupdate 驱动，浏览器实测约 266ms 触发一次(≈4Hz)，而真实词长中位数仅
 * 240ms，超过一半的词存活时间短于一个采样间隔，高亮只能整词整词地跳过去。
 * 修法是播放期间改用 rAF(~16.7ms) 驱动，timeupdate 保留为隐藏页/seek 时的兜底。
 *
 * 本用例直接量对齐误差：逐帧记录 (播放头, 高亮词下标)，与该句 word_timings 推出的
 * 期望下标逐帧比对。
 */
const API = "http://localhost:8000";
const VIDEO_ID = 24; // a-Jmcp_hdJs，全句已回填词级时间戳

test("卡拉OK高亮逐帧对齐词级时间戳", async ({ page }) => {
  // 1) 登录拿 token，直接塞进 localStorage（避开表单，测的是播放不是登录）
  const token = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=slice5_probe%40test.com&password=pass1234",
  }).then((r) => r.json()).then((d) => d.access_token);

  await page.addInitScript((t) => localStorage.setItem("token", t), token);
  await page.goto(`http://localhost:5173/video/${VIDEO_ID}`);

  const video = page.locator("video");
  await expect(video).toBeVisible();
  await page.waitForFunction(() => {
    const v = document.querySelector("video");
    return v && v.readyState >= 2;
  });

  // 页面必须处于可见态，否则 rAF 被挂起，测的就不是真实路径
  expect(await page.evaluate(() => document.visibilityState)).toBe("visible");

  // 2) 采样：逐帧记录播放头与当前高亮词的下标
  const probe = await page.evaluate(async () => {
    const v = document.querySelector("video")!;
    const rows: { t: number; wi: number | null }[] = [];
    const tu: number[] = [];
    const rafAt: number[] = [];
    v.addEventListener("timeupdate", () => tu.push(performance.now()));

    // 当前句的词 span 集合。桌面布局下高亮同时出现在左练习台(.sentence__subtitle)与
    // 右列表当前行(.sentence-row--current)，两处一致；精听模式左栏被遮罩盖住，故优先取右列表。
    // 只有非空白 token 带 .word-token 类，所以下标即词序。
    const wordsOf = () => {
      const row = document.querySelectorAll(".sentence-row--current .word-token");
      const src = row.length ? row : document.querySelectorAll(".sentence__subtitle .word-token");
      return Array.from(src) as HTMLElement[];
    };

    let id = 0;
    const tick = () => {
      const ws = wordsOf();
      // 高亮词由内联 textDecoration: underline 标记（见 SentenceCard/SentenceRow）
      const wi = ws.findIndex((w) => w.style.textDecoration === "underline");
      rows.push({ t: +v.currentTime.toFixed(3), wi: wi >= 0 ? wi : null });
      rafAt.push(performance.now());
      id = requestAnimationFrame(tick);
    };

    v.currentTime = 0;
    await v.play();
    id = requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 8000));
    cancelAnimationFrame(id);
    v.pause();
    return { rows, tu, rafAt };
  });

  const gapStats = (a: number[]) => {
    const g = a.slice(1).map((x, i) => x - a[i]).sort((x, y) => x - y);
    return g.length ? Math.round(g[Math.floor(g.length / 2)]) : NaN;
  };
  const rafGap = gapStats(probe.rafAt);
  const tuGap = gapStats(probe.tu);

  console.log(`rAF 中位间隔: ${rafGap}ms   timeupdate 中位间隔: ${tuGap}ms`);
  console.log(`采样帧数: ${probe.rows.length}（timeupdate 仅 ${probe.tu.length} 次）`);

  // rAF 必须真的在跑，且远密于 timeupdate
  expect(rafGap).toBeLessThan(40);
  expect(probe.rows.length).toBeGreaterThan(probe.tu.length * 5);

  // 3) 用后端的 word_timings 算每一帧的期望高亮词，比对实际
  const detail = await fetch(`${API}/api/videos/${VIDEO_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const list: any[] = detail.sentences;

  const expectedAt = (t: number): number | null => {
    const s = list.find((x) => t >= x.start_time && t < x.end_time);
    if (!s || !s.word_timings) return null;
    const wt: number[][] = s.word_timings;
    if (t < wt[0][0]) return 0;
    let lo = 0, hi = wt.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (wt[mid][0] <= t) lo = mid; else hi = mid - 1;
    }
    return lo;
  };

  let checked = 0, mismatch = 0;
  for (const r of probe.rows) {
    const want = expectedAt(r.t);
    if (want === null || r.wi === null) continue;
    checked++;
    if (want !== r.wi) mismatch++;
  }

  const rate = checked ? (mismatch / checked) * 100 : 100;
  console.log(`比对帧数: ${checked}   错位帧: ${mismatch} (${rate.toFixed(2)}%)`);

  expect(checked).toBeGreaterThan(100);
  // 允许极少数帧落在 React 提交与 rAF 读数之间的一帧延迟上
  expect(rate).toBeLessThan(5);
});
