# H5 嵌入微信小程序

## 架构

```text
微信小程序 mp-shell
  -> web-view
  -> HTTPS/CDN 上的 Cocos Web Mobile H5
  -> 独立题库、埋点服务
```

`assets/scripts/platform/host` 是 H5 宿主适配层：

- `LaunchContext.ts`：解析活动、年级、学期、场景和宿主参数。
- `HostBridge.ts`：封装作业帮容器、微信小程序和普通浏览器能力。
- `HostMessenger.ts`：统一发送 ready、result、exit、error 事件。
- `WebHostAdapter.ts`：负责宿主检测、横屏、分享和关闭行为。

`mp-shell` 是独立微信小程序工程，只保留一个 `web-view` 页面。

## 发布

1. 执行 `npm run check:release` 构建并验证 H5。
2. 执行 `npm run release:create`，发布包会同时包含 `web` 和 `mp-shell`。
3. 将 `web` 部署到固定 HTTPS 版本目录并预热 CDN。
4. 配置 `environments.js` 中每个环境的 `h5Url`、`bankUrl`、`trackEndpoint`。
5. 使用微信开发者工具导入 `mp-shell`，替换 AppID 后上传。

外部活动参数只允许透传白名单字段，禁止通过入口参数加载任意 H5 地址。
壳会逐条处理 `web-view` 的累积消息，结算和分享配置不会因批量回传而丢失。
