import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();

async function openVideo(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("先逛逛")');
  await page.waitForSelector('.video-card', { timeout: 10000 });
  await page.click('.video-card');
  await page.waitForSelector('.sentence', { timeout: 10000 });
  await page.waitForTimeout(800);
  return await page.evaluate(() => document.querySelectorAll('.sentence').length);
}

async function check(viewport, label, idx) {
  const page = await browser.newPage({ viewport });
  const total = await openVideo(page);
  const N = Math.min(idx, total - 1);
  const cards = await page.$$('.sentence');
  await cards[N].click();
  await page.waitForTimeout(1200); // 等 smooth 滚动稳定
  const r = await page.evaluate((i) => {
    const bar = document.querySelector('.player-bar');
    const el = document.getElementById('sent-' + i);
    const rb = bar.getBoundingClientRect();
    const sr = el.getBoundingClientRect();
    // 真正的矩形相交（同时水平+垂直重叠）才构成遮挡；
    // 桌面端视频栏在左栏、句子在右栏，仅垂直坐标相近不算遮挡。
    const overlap = !(sr.right <= rb.left || sr.left >= rb.right || sr.bottom <= rb.top || sr.top >= rb.bottom);
    const barInView = rb.bottom > 0 && rb.top < window.innerHeight;
    return {
      vh: window.innerHeight,
      barInView,
      barBottom: Math.round(rb.bottom),
      sentTop: Math.round(sr.top),
      sentBottom: Math.round(sr.bottom),
      fullyVisible: sr.top >= 0 && sr.bottom <= window.innerHeight + 1,
      hiddenByBar: barInView && overlap,
    };
  }, N);
  const pass = r.fullyVisible && !r.hiddenByBar;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label} idx=${N} | fullyVisible=${r.fullyVisible} hiddenByBar=${r.hiddenByBar} (sentTop=${r.sentTop} sentBottom=${r.sentBottom} barBottom=${r.barBottom} vh=${r.vh})`);
  await page.close();
  return pass;
}

let ok = true;
ok &= await check({ width: 390, height: 780 }, 'MOBILE ', 0);    // 视频栏在视口内，句子应紧贴其下、不被遮挡
ok &= await check({ width: 390, height: 780 }, 'MOBILE ', 11);   // 用户截图场景
ok &= await check({ width: 390, height: 780 }, 'MOBILE ', 260);  // 靠近末尾（短视口可能裁切）
ok &= await check({ width: 1366, height: 900 }, 'DESKTOP', 11);  // 桌面左栏吸顶
ok &= await check({ width: 1366, height: 900 }, 'DESKTOP', 200);

await browser.close();
console.log(ok ? '\nALL PASS: 当前句始终完整可见' : '\nFAIL: 存在裁切/遮挡');
process.exit(ok ? 0 : 1);
