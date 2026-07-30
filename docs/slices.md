# 切片执行记录

| # | 切片 | 状态 | 验证 | 提交 |
|---|------|------|------|------|
| 0 | 交互原型（三变体 → 选定 A 收口） | ✅ 完成 | 人工对比 + tsc | d30798e |
| 1 | 真实视频按句播放 | ✅ 完成 | E2E 单用例通过（tests/slice1-video-playback.spec.ts，1 passed） | 036e8b5 |
| 2 | 爬取脚本 CLI | ✅ 完成 | E2E 单用例通过（tests/slice2-fetch-cli.spec.ts）+ 全量 2 passed | acd991c |
| 3 | 中文字幕 | ✅ 完成 | E2E 单用例通过（tests/slice3-chinese-subtitles.spec.ts）+ 全量 3 passed；4 个视频 480/480 句翻译覆盖 | 见 git log |
| 4 | 生词标注真词表 | ⬜ 未开始 | | |
| 5 | 学习进度接通 | ⬜ 未开始 | | |
| 6 | 生词本跳回原句 | ⬜ 未开始 | | |
