# 切片执行记录

| # | 切片 | 状态 | 验证 | 提交 |
|---|------|------|------|------|
| 0 | 交互原型（三变体 → 选定 A 收口） | ✅ 完成 | 人工对比 + tsc | d30798e |
| 1 | 真实视频按句播放 | ✅ 完成 | E2E 单用例通过（tests/slice1-video-playback.spec.ts，1 passed） | 036e8b5 |
| 2 | 爬取脚本 CLI | ✅ 完成 | E2E 单用例通过（tests/slice2-fetch-cli.spec.ts）+ 全量 2 passed | acd991c |
| 3 | 中文字幕 | ✅ 完成 | E2E 单用例通过（tests/slice3-chinese-subtitles.spec.ts）+ 全量 3 passed；4 个视频 480/480 句翻译覆盖 | b550dab |
| 3.5 | 跟读页精修（参考每日英语听力） | ✅ 完成 | E2E（tests/slice3_5-player-polish.spec.ts）+ 全量 4 passed | 见 git log |
| 4 | 生词标注真词表 | ✅ 完成 | 语料校准 top5000（标红率 9.2%）+ E2E（tests/slice4-vocabulary.spec.ts）+ 全量 5 passed | 见 git log |
| 5 | 播放位置记忆（2026-07-30 用户重定义：砍"学习进度"叙事，只做重进跟读页恢复句位） | ✅ 完成 | E2E（tests/slice5-resume-position.spec.ts）+ 全量 6 passed；顺带修复注册 500（弃用 passlib 直调 bcrypt） | 见 git log |
| 6 | 生词本跳回原句 | ✅ 完成 | E2E（tests/slice6-wordbook-jump.spec.ts）+ 全量 7 passed；顺带修复加生词 422（改 query 参数对齐后端契约） | 见 git log |
