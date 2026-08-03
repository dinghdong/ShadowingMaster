import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// 注入一个本地 token，跳过前端登录门（列表接口本身无需登录）
await page.addInitScript(() => {
  localStorage.setItem("token", "local-dev-bypass");
});
await page.goto("http://localhost:5173/app", { waitUntil: "networkidle", timeout: 30000 });
// 等封面图有机会从 OSS/ytimg 加载
await page.waitForTimeout(4000);
await page.screenshot({ path: "/tmp/app-list.png", fullPage: false });
// 单独截「继续学习」卡区域
const cont = await page.$(".continue-card");
if (cont) await cont.screenshot({ path: "/tmp/continue-card.png" });
const thumbs = await page.$$eval(".continue-card__thumb img, .video-card__thumb img", (els) =>
  els.map((e) => ({ src: e.currentSrc || e.src, ok: e.complete && e.naturalWidth > 0 }))
);
console.log("THUMBS:", JSON.stringify(thumbs, null, 2));
await browser.close();
