# 挖宝

独立的 Cocos Creator 3.8.8 + TypeScript 横屏 H5 项目。工程只包含挖宝，可单独打开、安装、测试、构建和部署。

## 核心能力

- 五阶段三选一闯关；答对后解锁并执行三次交互，答错立即进入失败反馈。
- 挖宝、沙漠探险、恐龙世界、敦煌壁画、魔法学院五个主题。
- 选项石块、宝箱/魔法书、角色待机/动作、HUD 和反馈均按主题绑定。
- 严格题库校验、Excel 导入、远程题库确定性初始化、缓存和同场景难度降级。
- 主题预加载、并发纹理请求合并、软缓存回收、Tween 与异步任务统一清理。
- 作业帮 WebView、微信和浏览器参数适配，埋点重试与本地死信队列。
- 安全区适配、页面隐藏暂停、桌面和移动横屏 E2E。

## 目录边界

```text
assets/scripts/
├── boot/                       单游戏入口与生命周期
├── core/                       资源、状态、UI 和任务作用域
├── games/writing-treasure/     挖宝专属实现
├── platform/                   宿主适配
├── services/                   题库、会话、计时、音频和埋点
├── shared/                     类型、配置和内置题
└── ui/                         HUD、开场、题板、反馈和结算
```

架构门禁禁止混入其他游戏实现，检查分层依赖、循环依赖、函数复杂度，并限制生产 TypeScript 单文件不超过 180 行。

## 开发与发布

```powershell
npm ci
npm run check
npm run check:release:technical
npm run check:release
npm run build:bank -- --input ..\语文小游戏题库生产表.xlsx --out config\question-bank.json
npm run build:web
npm run serve
```

默认地址为 `http://localhost:8082`，健康检查为 `/health`。

启动参数无需 `game`：

```text
?grade=L1..L6
&term=first|second|ALL
&difficulty=basic,advanced,challenge
&scene=treasure|desert|dinosaur|dunhuang|magic
&activityId=...
&channel=...
&bankUrl=/api/bank
&trackEndpoint=/api/track
&skipIntro=1
```

`scene` 表示首个主题，之后环绕完成全部五关。`check:release:technical`
验证程序、构建、性能和双视口 E2E；`check:release` 在此基础上额外要求正式题库
已审批、内容不重复且包含年级内容。正式审批必须包含批准人、批准时间、审批依据和
稳定内容指纹；使用 `npm run bank:fingerprint` 查看待审批内容，收到可追溯批准后才可
设置 `BANK_APPROVAL_CONFIRM=APPROVED` 等审批变量并执行 `npm run approve:bank`。
