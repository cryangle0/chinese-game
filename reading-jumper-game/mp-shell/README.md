# 跳跳乐微信小程序壳

该目录只负责微信小程序入口和 `web-view` 宿主能力，游戏本体仍由
`build/web-mobile` 独立部署到 HTTPS/CDN。

上线前必须完成：

1. 在 `project.config.json` 中替换正式小程序 `appid`。
2. 在 `miniprogram/config/environments.js` 中替换预发、体验版和正式 H5 地址。
3. 在微信公众平台配置上述 H5 域名为业务域名，并保证全链路 HTTPS。
4. 分别发布 H5 与小程序壳；H5 内容更新通常不需要重新提交小程序审核。
5. 使用真机验证横屏、返回、分享、前后台切换和弱网重连。
6. 将微信 CI 私钥存放在工程目录外，并通过 `MP_PRIVATE_KEY_PATH` 指定。

不要把 Cocos 构建产物复制进小程序包。两者通过查询参数和结构化
`postMessage` 协议通信。

```powershell
$env:MP_PRIVATE_KEY_PATH='E:\secure\private.wx....key'
$env:MP_VERSION='1.0.2'
$env:MP_DESC='技术修复'
npm run upload:mp
```
