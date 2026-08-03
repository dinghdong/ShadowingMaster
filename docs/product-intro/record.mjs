import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';

const require = createRequire(import.meta.url);
const PW = '/Users/dingdongdong/Workspace/AI-APP/ShadowingMaster/frontend/node_modules/playwright';
const { chromium } = require(PW);

const WIDTH = 1080, HEIGHT = 1920;
const HTML = 'file:///Users/dingdongdong/Workspace/AI-APP/ShadowingMaster/docs/product-intro/intro.html';
const OUT_DIR = '/Users/dingdongdong/Workspace/AI-APP/ShadowingMaster/docs/product-intro/video';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await ctx.newPage();
  await page.goto(HTML, { waitUntil: 'load' });
  await page.waitForFunction('window.__READY__ === true', { timeout: 5000 });
  const total = await page.evaluate('window.__TOTAL__');
  console.log('Animating for', total + 0.8, 's ...');
  await page.waitForTimeout((total + 0.8) * 1000);

  const video = page.video();
  await ctx.close();
  await browser.close();

  const webm = await video.path();
  console.log('WEBM:', webm);

  const mp4 = OUT_DIR + '/shadowingmaster-intro.mp4';
  execFileSync(FFMPEG, [
    '-y', '-i', webm,
    '-vf', `scale=${WIDTH}:${HEIGHT},fps=30`,
    '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', mp4,
  ], { stdio: 'inherit' });
  console.log('MP4:', mp4);
})().catch((e) => { console.error(e); process.exit(1); });
