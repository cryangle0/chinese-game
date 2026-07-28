# 部署与回滚

## 构建

1. 安装 Node.js 18+ 和 Cocos Creator 3.8.8。
2. 执行 `npm ci && npm run check`。
3. 填写正式微信 AppID、预发/生产 H5 域名、题库接口和埋点接口。
4. 执行 `npm run check:release`；占位 AppID 或 `example.com` 会被拒绝。
5. 设置 `COCOS_CREATOR` 后执行 `npm run build:web` 和 `npm run release:create`。
6. 只将发布包的 `web/` 上传到 H5 CDN；`mp-shell/` 由微信开发者工具发布。

## 生产配置

```text
PUBLIC_ROOT=/srv/reading-jumper/web-mobile
BANK_FILE=/srv/reading-jumper/config/question-bank.json
ANALYTICS_FILE=/srv/reading-jumper/data/analytics/events.jsonl
PORT=8081
CORS_ORIGINS=https://activity.example.com,https://staging.example.com
TRUST_PROXY=1
ANALYTICS_MAX_BYTES=20971520
ANALYTICS_MAX_FILES=7
```

建议由 Nginx/OSS/CDN 托管 H5 静态文件；Node 服务只承载健康检查、题库和埋点。HTML 不缓存，带 hash 的资源缓存一年。

## 灰度门禁

- `/health` 返回 `ok=true`。
- 微信、Safari、Chrome、作业帮 WebView 可进入跳跳乐。
- 摄像头允许时可启动本地 MoveNet 体感；拒权或不兼容时可继续触屏完成全流程。
- 完成五阶段，埋点中可核对 `app_enter` 至 `game_end`。
- 4G 首屏不超过 5 秒，主流程不低于 45fps。
- 24 小时无新增 P0/P1 后切换正式入口。

## 回滚

1. 将 CDN 活动入口切回上一版本目录。
2. 将 `BANK_FILE` 或 `bankUrl` 切回上一题库版本。
3. 清理 CDN 的 `index.html`，不要清理带 hash 的旧资源。
4. 验证健康检查、两游戏入口和一条完整埋点链路。
5. 保留故障版本日志与埋点，完成根因记录后再重新灰度。
