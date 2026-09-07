const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const dir = __dirname; // 脚本所在目录，兼容任意克隆/部署路径
const input = process.argv[2] || 'cover-xhs.html';
const output = process.argv[3] || 'cover-xhs.png';
// 仅在本机存在 Chrome 时显式指定；否则交给 Playwright 用自带 chromium（跨机器可移植）
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const launchOpts = { args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'] };
if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;

(async () => {
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1440 },
    deviceScaleFactor: 2
  });
  await page.goto('file://' + path.join(dir, input));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(dir, output),
    clip: { x: 0, y: 0, width: 1080, height: 1440 }
  });
  await browser.close();
  console.log('OK -> ' + output);
})();
