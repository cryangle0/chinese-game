# 埋点字典

| 事件 | 触发时机 | 关键字段 |
|---|---|---|
| `app_enter` | 题库初始化完成 | activityId、channel、host、sessionId |
| `game_start` | 点击开场按钮 | game |
| `scene_enter` | 每阶段主题挂载 | game、scene、stage |
| `answer` | 判题完成 | game、scene、questionId、correct |
| `game_end` | 完成、超时或题库为空 | game、reason、score |
| `result_view` | 结算页展示 | game、score、stars |
| `exit` | 页面关闭或宿主回收 | game |

客户端每 5 秒或累计 20 条尝试上传，失败事件保存在 `localStorage`，下次继续发送。队列最多 200 条，避免长期离线无限占用空间。

禁止上传题干全文、用户姓名、手机号等明文个人数据。用户标识由宿主提供时应先在服务端完成不可逆哈希。
