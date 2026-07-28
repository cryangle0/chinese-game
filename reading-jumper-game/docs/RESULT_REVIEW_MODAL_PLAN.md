# Result Review Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在阅读和写作结算页中，点击单道答题回顾即可通过游戏化弹框查看完整内容，并修复阅读反馈阶段的分数与角色复位问题。

**Architecture:** 两个项目各自在 `DomResultReview` 内维护回顾条目和弹框 DOM，调用方提供结构化题目数据。弹框与结算节点共用生命周期，场景销毁时统一清理。阅读控制器延迟 HUD 分数刷新并在下一题前复位小鹿。

**Tech Stack:** Cocos Creator 3.8、TypeScript、DOM/CSS。

## Global Constraints

- 弹框只显示被点击的单道题。
- 显示题号、完整题干、我的答案、正确答案和对错状态。
- 支持关闭按钮、点击遮罩和 Escape 关闭。
- 长内容允许纵向滚动。
- 不增加第三方依赖或新图片素材。
- 按用户要求，本轮不运行自动化或人工验收测试。

---

### Task 1: 结构化答题回顾数据

**Files:**
- Modify: `reading-jumper-game/assets/scripts/ui/results/DomResultReview.ts`
- Modify: `reading-jumper-game/assets/scripts/ui/results/ThemedResultReview.ts`
- Modify: `writing-treasure-game/assets/scripts/ui/results/DomResultReview.ts`
- Modify: `writing-treasure-game/assets/scripts/ui/results/CustomerResultView.ts`
- Modify: `writing-treasure-game/assets/scripts/ui/results/TreasureResultContent.ts`

**Interfaces:**
- Consumes: `AnswerRecord` 中的 `question.stem`、`question.options`、`selectedIndex`、`correctIndex`。
- Produces: `DomReviewRow` 的 `index`、`question`、`selectedAnswer`、`correctAnswer`、`correct` 字段。

- [ ] 扩展 `DomReviewRow`，保留摘要 `text` 并增加弹框所需结构化字段。
- [ ] 阅读结算构造每道题的完整回顾数据。
- [ ] 写作两种结算视图构造同样的数据。

### Task 2: 游戏化完整内容弹框

**Files:**
- Modify: `reading-jumper-game/assets/scripts/ui/results/DomResultReview.ts`
- Modify: `writing-treasure-game/assets/scripts/ui/results/DomResultReview.ts`

**Interfaces:**
- Consumes: Task 1 产生的 `DomReviewRow`。
- Produces: 点击条目时创建、关闭时销毁的 `.dom-result-review-modal`。

- [ ] 将回顾条目改为按钮语义并绑定点击与键盘 Enter/Space。
- [ ] 创建橙金色游戏面板，渲染题号、题干、我的答案、正确答案和对错徽标。
- [ ] 增加关闭按钮、遮罩点击、Escape 和纵向滚动。
- [ ] 在宿主节点销毁时移除弹框、条目和所有全局监听。

### Task 3: 阅读反馈视觉解耦与角色复位

**Files:**
- Modify: `reading-jumper-game/assets/scripts/core/ReadingAnswerController.ts`
- Modify: `reading-jumper-game/assets/scripts/core/ReadingGameController.ts`

**Interfaces:**
- Consumes: 当前答题完成事件和小鹿视图的 `moveTo(index)`。
- Produces: 反馈播放期间旧分数保持可见，下一题开始前小鹿位于中间列。

- [ ] 从反馈开始阶段移除提前的 HUD 分数刷新。
- [ ] 在反馈完成、进入下一题时刷新 HUD。
- [ ] 在新题启用体感输入前调用 `deer.moveTo(1)`。

### Task 4: 构建交付

**Files:**
- Output: `reading-jumper-game/build/web-mobile-product-feedback-0728`
- Output: `writing-treasure-game/build/web-mobile-product-feedback-0728`

- [ ] 构建阅读游戏。
- [ ] 构建写作游戏。
- [ ] 保留现有本地服务地址供用户自行验收，不运行测试命令。
