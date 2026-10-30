# Changelog

## 3.7.0 — 未发布

- 代码按站点契约重组：`DOUYU` 配置区集中选择器、接口、存储键和分组阻断规则，新增 `adapterHealth` 诊断与 `docs/maintenance.md`，斗鱼更新后可按配置快速适配。
- 新增阻断：房间独立挂件（广告位 sign、顶部悬浮、投票互动、抽奖、超级粉丝）、仅主播/超管使用的 menu/superMenu、百度/Google/火山统计 SDK。统计 SDK 先放置无增长替身；`collect-rangers` 仅在替身先就位时阻断，晚注入时保留真实 SDK。
- Safari Tampermonkey 晚注入时错过首流改写，播放器就绪后调用一次原生换流恢复原画；遇到用户操作、偏好变化或原生换流即让步。
- 播放器模块发现改为启动后 20 秒内持续进行；DOM 插入挂钩跳过无关节点，减少每条弹幕的固定开销。
- 冻结炫彩弹幕的背景动画（保留渐变与移动）。
- localStorage 分类开关：`douyu-safari-disabled-categories` 临时关闭分类，`douyu-safari-enabled-categories` 启用默认关闭的实验分类（`pageHeader` 页头、`followGroups` 关注分组、`videoAssets` 底部视频合集，可单独开启），用于排查与 A/B。
- Chromium（Chrome / Edge + Tampermonkey MV3）放行执行：FLV preload 中和仅在 Safari 生效，其余机制共用；诊断新增 `browser` 与 `livePreloadGuardEnabled`。Chromium 尚待真实浏览器回归。
- 验证见 [v3.7.0 验证说明](docs/validation-3.7.md)。

## 3.6.1 — 2026-09-21

- 修复离开直播间时没有主动销毁原生播放器的问题；释放媒体源、发送服务、观察器与脚本监听。
- 同源数字直播间导航及退出到目录保留历史 URL 后整页加载，避免 WebKit 把旧直播文档放入前进/后退缓存；后台播放保持。
- 保留 hash、查询参数记账、表单、下载、修改键、新标签与历史遍历的默认行为；适配 Navigation API，并提供普通链接/History API 回退。
- 增加生命周期与导航回归测试，以及真实 Safari 连续切房验证。
- 明确记录仍观察到的进程内存增长与旧对象残留，不宣称全部泄漏已修复。


## 3.6.0 — 2026-09-21

首次公开发布，源自已在Safari实测的本地版本。

- 加载前取消独立业务资源，卸载22个非核心播放器模块。
- 辅助React根提前阻止渲染，清除静态残留节点；移除任务、站内信、小游戏子页面。
- 保留视频、弹幕、原生控制与发送；默认最高档、七项屏蔽及1/4屏弹幕。
- 阻止无限FLV preload；修复启动画质延迟与网页全屏布局。
- 增加公开安装/更新地址、MIT许可、验证说明和CI。

发布版与本机验证脚本的执行代码一致，仅发布元数据不同。完整模式与纯净模式可以切换；卸载行为需重载恢复。
