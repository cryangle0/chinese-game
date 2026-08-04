# 阅读跳跳乐极致启动性能设计

## 目标

- 首页和开场不得因后台预加载出现卡顿、黑屏或资源争抢。
- 首屏关键资源与延迟资源分开计量，关键资源目标不超过 2MB。
- 保持现有高清 sprite-sheet 画质、摄像头姿态、答题反馈和五主题玩法不变。

## 已确认问题

当前 E2E 在 `gameReady` 后继续等待 `networkidle + 1.5s`，此时空闲任务已经加载：

- 玛丽三张高清 locomotion PNG：约 2.94MB；
- 已被 sprite sheet 替代的 `idle/run-left/run-right.webp`：约 2.09MB；
- 正负反馈 WebP、全主题计分道具及题库。

因此 8.32MB 不是纯首屏资源，而是“首屏 + 空闲预载”的合计；这些请求仍会与摄像头和首页交互竞争网络及解码资源。

## 加载层级

1. **启动关键层**：首页 UI、当前主题背景/题板/选项/HUD、当前主题 idle sprite sheet。
2. **进入游戏层**：当前主题 action 与即将需要的左右跑动 sprite sheet。
3. **首次使用层**：correct/wrong/result WebP 和当前主题计分道具按功能触发前预取。
4. **下一场景层**：当前场景稳定后，仅在空闲时预载下一主题关键层。

旧 locomotion WebP 只保留运行时失败回退，不主动预加载。

## 代码边界

- `ThemePreloader.ts`：显式区分 startup / play / feedback / next-theme 资源集合。
- `ReadingIntroCoordinator.ts`：首页只等待 startup 层；用户开始后等待 play 层。
- `ReadingStageCoordinator.ts`：不再一次 prefetch 全部 motion；按阶段加载。
- `ReadingScoreFeedback.ts`：支持只预载当前主题。
- `run-smoke.mjs`：分别统计 `gameReady` 关键资源与用户进入游戏后的延迟资源。

## 性能门禁

- `gameReady` 前关键资源 ≤ 2MB（题库按生产压缩体积计）。
- 首页稳定到点击开始前，不得加载旧 locomotion WebP、反馈 WebP、下一主题和全主题道具。
- 用户点击开始后可以加载当前主题 run/action，但不得阻塞首个可交互帧。
- 每个加载阶段需有单测和浏览器资源审计。

## 回滚

所有优化只改变预取时机，不删除运行时 URL 与 fallback。若弱网首次动作延迟异常，可单独恢复该资源到上一加载层。
