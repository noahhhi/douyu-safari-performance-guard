# Douyu Safari Performance Guard

斗鱼 Safari 直播纯净模式与内存优化用户脚本。保留**视频播放、弹幕（含发送）和视频控制**，减少非核心业务的加载和运行。

Safari userscript for lean Douyu live playback. Keeps video, danmaku and native controls while preventing unnecessary resource loading.

[安装最新版本](https://github.com/noahhhi/douyu-safari-performance-guard/releases/latest/download/douyu-safari-performance-guard.user.js) · [版本发布](https://github.com/noahhhi/douyu-safari-performance-guard/releases) · [问题反馈](https://github.com/noahhhi/douyu-safari-performance-guard/issues)

## 功能

- 加载前拦截独立的活动、礼物、游戏、商城等资源，卸载非核心 React 组件及监听；不只用 CSS 隐藏。
- 阻止直播 FLV 被当作无限预加载资源持续缓存。
- 默认请求原画/最高档画质，避免先自动选择较低画质再切换。
- 默认七项特效屏蔽、1/4 屏弹幕；保留播放器原生控件和设置。
- 全屏与非全屏均提供左下角原生弹幕输入框，回车聚焦，输入后使用原生发送流程；保留中文输入法组合键处理。
- 切房及从直播间退出到目录时销毁原生播放器、释放媒体源与监听；同源房间导航保留历史 URL，并按整页加载，避免旧直播文档进入 Safari 的前进/后退缓存。
- 可通过页面右上角“恢复完整页面”退出纯净模式。

不通过定时刷新、强制垃圾回收、杀进程或降低画质维持占用。共享的播放器、账号和通信基础库仍需保留。

## 安装

1. 在 Safari 中安装并启用 [Tampermonkey](https://www.tampermonkey.net/)，允许扩展在斗鱼网站运行。已验证的管理器版本为 5.6.6240。
2. 打开上方安装链接，确认脚本名称和来源后，在 Tampermonkey 中安装。
3. 若 Safari 只下载了文件，在 Tampermonkey 控制台新建脚本，粘贴 `.user.js` 的完整内容并保存。也可打开 [v3.6.1 原始脚本](https://raw.githubusercontent.com/noahhhi/douyu-safari-performance-guard/v3.6.1/douyu-safari-performance-guard.user.js)。
4. 重新加载斗鱼直播间。只启用一份本脚本，避免多个净化脚本同时修改播放器。

生效范围是 `https://www.douyu.com/数字房间号` 或 `https://douyu.com/数字房间号`。在斗鱼其他路径只安装切房导航监听，以覆盖从目录进入直播间的单页路由；不在 iframe 中运行。Chrome、Edge 和其他 Chromium 浏览器不执行本脚本。其他脚本管理器、手机 Safari 及别名房间路径未经验证。

发布文件包含更新地址，后续版本可由 Tampermonkey 检查更新；是否自动安装取决于管理器设置。旧的本地版本如没有更新地址，需要手动安装公开版。保留原脚本名称与 namespace 便于识别已有安装，安装后请检查是否出现重复副本。

脚本使用 `@grant none`，不引入远程脚本依赖，不新增遥测或向项目作者上传数据。原网站自身的网络请求仍由播放器和站点负责。[Tampermonkey 元数据说明](https://www.tampermonkey.net/documentation.php)。

## 已测效果与边界

一组 Safari 新进程顺序对照，均为最高档 2560×1440/60 fps、HEVC、1/4 屏弹幕：

| 条件 | 采样时长 | 平均进程内存 | 新增掉帧 |
|---|---:|---:|---:|
| v3.5.0 | 120 秒 | 797 MiB | 0 |
| v3.6.0 资源拦截阶段 | 120 秒 | 463 MiB | 0 |
| v3.6.0 最终版 | 300 秒 | 434 MiB | 0 |

时长匹配的对照降低约 **42%**。最终版隐藏 iframe 为 0，非核心播放器模块卸载数为 22。HEVC 是本次测试的原生播放器设置，脚本不会强制锁定编码格式。

这是单台机器、一个房间的短时测量，不代表所有房间或整夜播放的固定结果，也不证明 WebKit 的全部内存泄漏已根治。此次没有证明系统功耗按相同比例下降。详细方法与限制见 [v3.6.0 验证说明](docs/validation.md)；切房修复见 [v3.6.1 验证说明](docs/navigation-validation.md)。

v3.6.1 已验证切房、前进/后退及目录退出时的清理，但连续导航后的进程内存仍有增长及旧对象残留；这是尚未解决的边界，不能把“退出时清理成功”理解为全部内存已回收。

斗鱼内部模块、React 结构与资源路径可能变化。付费、密码、特殊活动和音频房间没有完整覆盖；脚本不绕过访问限制。如果控制或弹幕异常，先恢复完整页面，或禁用脚本后重载。

## 设置、恢复与诊断

- “恢复完整页面”会保存模式并重载；仍保留最高画质、特效屏蔽和 1/4 弹幕的默认设置。
- 切换到后台不会触发播放器销毁；已销毁的历史页面如被浏览器恢复，会重新载入。没有周期性刷新、强制 GC 或自动杀进程。
- 要完全停止脚本作用，在 Tampermonkey 中禁用/删除后重载。先前写入的播放器偏好不会自动回滚，可在原生设置中自行调整。
- 开发者可在网页控制台查看 `window.__douyuSafariGuard?.status()`，检查版本、预加载拦截、资源拦截、组件卸载及异常计数。
- 报告问题时附 Safari/Tampermonkey 版本、公开房间 URL 和可复现步骤即可；不要上传 Cookie、直播鉴权链接、账号数据或未经检查的堆快照。

## 开发

无需安装依赖，使用 Node.js 22：

```sh
npm test
```

测试覆盖脚本语法、发布元数据一致性、关键资源放行、纯净/完整模式、已开始加载的计数、原生播放器销毁、后台播放、导航排除条件与停止逻辑；另有配置规则、分类开关、适配健康诊断、启动窗口内模块发现和 DOM 插入快路径回归。自动测试不能替代真实 Safari 播放验证。

网站更新时，先检查脚本顶部的 `DOUYU` 契约区和 `status().adapterHealth`。[维护指南](docs/maintenance.md) 说明如何找 chunk 名、修改规则、解读诊断和运行测试。

## 许可

[MIT](LICENSE)。项目与斗鱼、Apple、Tampermonkey 无隶属关系，不包含其网页源代码或媒体资源。
