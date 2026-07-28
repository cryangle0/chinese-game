# 脱敏语音诊断日志设计

## 目标

为写作宝藏的生产语音链路增加可关联、可落盘的诊断数据，区分：

1. 不支持或拒绝麦克风权限；
2. 按压过短；
3. 录音为空或过小；
4. ASR HTTP、超时、FFmpeg 或腾讯云错误；
5. ASR 返回文本但未匹配选项；
6. 已匹配但题目状态守卫拒绝答案；
7. 完整成功。

同时用 Chrome DevTools 和模拟麦克风验证 Web 端从录音到 ASR、匹配及日志上报的完整链路。

## 隐私边界

不得记录或上传：

- 原始录音；
- ASR 识别原文；
- 题干、选项内容；
- 用户姓名、手机号、OpenID 或其他直接身份标识。

允许记录：

- 匿名 `sessionId` 与随机 `attemptId`；
- 主机类型、浏览器能力与错误名称；
- 按压/录音/请求耗时；
- 音频字节数与 MIME；
- HTTP 状态、腾讯云 `requestId`；
- 识别文本是否为空及字符数；
- 匹配索引、最终结果和状态守卫结果。

## 架构

### 客户端

`SpeechSelectionService` 为一次语音尝试生成 `attemptId`，在关键边界发出结构化诊断事件：

- `started`
- `microphone_ready`
- `capture_empty` / `capture_ready`
- `asr_response` / `asr_error`
- `match_success` / `match_failed`

`VoiceAnswerController` 补充最终守卫事件：

- `accepted`
- `guard_rejected`

所有事件通过已有 `GameServices.analytics.track()` 上报为 `voice_diagnostic`。属性只允许基础类型，并经过专用白名单构造函数，避免未来误传文本。

### 上报地址

生产 `game.xyouxing.com` 默认使用：

`https://agent.onnsa.cn/writing-treasure/api/track`

启动参数只允许同源地址或上述固定可信地址，拒绝任意第三方上报地址。小程序 develop/trial/release 配置同步使用该地址。

### 服务端

复用现有 `/api/track` 和 `ANALYTICS_FILE`：

`/srv/writing-treasure/data/analytics/events.jsonl`

不新增存储服务，不保存音频。现有按大小轮转规则继续生效。

## 错误处理

- 诊断上报失败不得阻塞游戏或语音识别；
- `Analytics` 保持本地队列、指数退避和 dead-letter；
- ASR 服务完全不可用时，诊断请求也可能失败，但客户端错误名称会先写入本地队列；
- 事件属性不得包含异常 message 全文，只记录白名单错误名称、阶段与 HTTP 状态。

## 测试

### 自动化

1. 先写失败测试，验证生产环境自动选择可信 `/api/track`；
2. 验证任意第三方 `trackEndpoint` 被拒绝；
3. 验证诊断事件不包含 transcript、options、audio；
4. 验证空录音、HTTP 错误、无匹配、匹配成功和守卫拒绝均生成正确事件；
5. 运行语音、HostAdapter 和服务端 analytics 测试；
6. TypeScript typecheck 与 Web 构建。

### Chrome DevTools

1. 打开生产 Web；
2. 确认 `getUserMedia`、`MediaRecorder` 和安全上下文可用；
3. 用模拟麦克风音频完成一次真实 `/api/asr` 请求；
4. 确认 ASR 200、匹配成功；
5. 在 Network 中确认 `/api/track` 返回 202；
6. 检查事件 payload 无录音、题目、选项和识别原文。

## 发布

验证通过后：

1. 构建并部署写作宝藏 H5；
2. 刷新 CDN；
3. 上传新的写作宝藏小程序开发版；
4. 用户在微信后台设为体验版；
5. 客户复现后，按 `sessionId`、`attemptId`、`requestId` 查询日志确定根因。
