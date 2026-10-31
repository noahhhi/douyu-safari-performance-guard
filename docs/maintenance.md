# 网站更新后的维护指南

本脚本始终是一个可直接安装的 `.user.js`，无需构建、依赖安装或外部 `@require`。站点契约集中在文件顶部的 `DOUYU`，通用挂钩与控制流程在下面的工厂模块。修改配置后重新加载页面才生效；它不是可在运行中热更新的公开 API。

## 先定位哪一层失效

在直播间加载约 20 秒后，由维护者在网页控制台查看：

```js
const s = window.__douyuSafariGuard?.status();
console.table(s?.adapterHealth?.contracts);
```

`adapterHealth` 也出现在 `clean.adapterHealth`，包含 `windowMs`、`observationClosed`、`stopped` 和 `contracts`。

- `pending`：启动窗口尚未结束，不能立即判断适配损坏。
- `found`：找到契约，`foundAtMs` 为首次记录它的相对时间。选择器和 ID 表示启动窗口内**曾经找到**，不是节点持续存活的保证。
- `missing`：约 20 秒后的既有 tick 仍未找到。懒加载菜单、离线/受限房间、网络慢、房间本身没有某项模块也可能造成 missing，不能单凭此状态断言网站改版。
- `failed`：原生发送服务初始化曾抛出异常；结合 `clean.failures` 排查。失败记录保留到本次页面结束，即使后来重试成功。
- `not-applicable`：完整模式不启用的简洁模式服务，不应当作缺失。

选择器和容器 ID 的检查在启动窗口结束后的首次 tick 关闭，不再持续扫描；路径改变时重开 20 秒观察窗口。运行时全局、renderer/module hook 数量和发送服务状态仍随既有 tick 更新。诊断不新增轮询定时器，不增加大子树 MutationObserver，也不保留诊断节点引用。`stopped: true` 表示控制器已停止，保留最后观测；控制器整体初始化失败时顶层返回 `state: 'failed'`、`reason: 'clean-controller-initialization'`。

常见检查顺序：

| 诊断项 | 回到顶部检查的契约 | 如何重新发现 |
| --- | --- | --- |
| `selector.*` / `id.*` | `selectors`、`ids`、`cleanCSS` | Elements 对照播放器、控制条、发送输入和菜单；CSS module 通常只有后缀 hash 改变，应优先匹配稳定前缀 |
| `runtime.moduleCache`、`rendererHooks` | `runtime.moduleCache` | 在加载的页面脚本中找 webpack runtime/模块缓存，确认其中 ReactDOM exports 与 render/hydrate/unmount API |
| `playerModuleHooks` | `ids.player`、`playerModules`、`runtime.moduleConnector` | 在播放器 React fiber 查 `memoizedProps.id`、`stateNode` 和原生订阅函数；不同连接器可能有不同 render 原型 |
| `runtime.asideApp`、`nativeSender` | `runtime.asideApp`、`sender`、`runtime.senderElement`、`runtime.asideRenderContext` | 查侧栏 DI 容器的 component/store、包装组件 render 树和原生 enterSend；不要为了找发送服务直接挂载整个侧栏 |
| `runtime.playerBridge` | `runtime.player`、`controls.shieldEvent` | 查原生 `acjCall` 和屏蔽事件订阅；对照菜单文案与参数 |

旧诊断字段全部保留：`blockedLivePreloads` / `latePreloads`、`optionalResources`、`startupQuality`、`clean`、`lifecycle`、`cleanupErrors` 等。特别注意：

- `optionalResources.late` 代表节点可能已开始加载，不能宣称已阻止；`count` / `paths` 仅记录加载前命中，路径计数仍有 128 项上限。
- `startupQuality.request` 的路径、`fromRate`、`sentRate` 用来核实首流接口。无记录时检查 `endpoints.firstStream`、POST form body 和 `storageKeys.preload`，不要改写后续用户主动切档。
- `clean.playerModules.modules` 是实际见过的模块，`hooks` 是连接器原型数，二者不必相等。`visits` 在初始 20 秒内继续增长是预期行为，首次发现成功不再提前终止。
- `clean.disposedRoots` / `releasedMedia` 与 `cleanupErrors` 用来验证离开页面时的释放；清理成功不等于 WebKit 已回收全部内存。

## 如何找新的 chunk 名

1. 在开发者工具 Network 中比较完整模式和简洁模式，筛选 JS/CSS、`front-publish` 和相关业务名，查看 URL 的主机、包目录、最后一个文件名及 Initiator。
2. 在已经加载的主入口中搜索 webpack chunk 名与 URL 映射。记录稳定名称前缀，例如 `SomeOptionalWidget_`，而不是发布时变化的 hash。
3. 查清 chunk 的用途、依赖和启动时机。与播放器控制、登录、弹幕通信、发送、鉴权、编解码共享的入口不能因为体积大就拦截。
4. 对独立业务先做单项验证：播放/画质切换、弹幕收发、菜单/全屏、同源切房、返回目录、前进后退都应保持。不能把“CSS 隐藏了”当作资源或服务已卸载。
5. 给候选规则添加测试，复核放行边界，再考虑默认启用。不要把待研究的 chunk 或 analytics URL 当成已证实安全的默认阻断项。

不要提交站点源码副本、鉴权媒体地址、Cookie、账号数据或未经检查的堆快照。测试用虚构 URL 和本地 mock。

## 添加规则，只改配置

默认集合与重构前一致：没有新增拦截包、chunk 或 analytics 请求。`resourceCategories` 分为 activity、gifts、games、community、admin、aside、analytics；analytics 目前是空预留。

### 整个独立包

在相应分类的 `packages` 中添加一行包名并注释证据。它只匹配 `resourceHost` CDN 主机上 `front-publish/<包名>/...` 的 script/link，不扩展到 iframe 或任意同名第三方路径。

将分类的 `enabled` 改为 `false` 可停止该分类的资源拦截，包括标记为同分类的 SDK/iframe；此开关**不是**卸载模块或 CSS 布局开关，也不恢复已取消的加载。分类默认只在简洁模式生效；只有标记 `fullMode:true` 的分类（目前仅 `ads`）在完整模式也生效。完整模式只去广告，不要给非广告分类加 `fullMode`。

### 指定主机、包和文件

在分类中增加 `rules` 数组，一条候选一行。下面只是虚构格式示例，不是建议新增的线上阻断项：

```js
analytics: {enabled:true, packages:[], rules:[
    {host:'static.example.invalid', pkg:'example-optional-master', fileRegex:/^OptionalWidget_[a-f0-9]+\.js$/},
]},
```

规则字段：

- `host`：必填；字符串表示 hostname 完全相等，或使用有明确边界的正则。不要用无界的 `/douyucdn/`。
- `pkg`：可选；有值时要求 URL 的 `front-publish` 后一个路径片段完全相等。不能通过省略主机约束只按包名拦截。
- `fileRegex`：可选；匹配 URL pathname 的**最后一段文件名**，不含 query/hash。通常同时约束包名，避免拦到另一个包的同名 chunk。
- `pathnameRegex`：可选；匹配完整 pathname，适用于不在 `front-publish` 下的独立 SDK。若要限制 `js/room/` 等子目录，应使用它而非在 `fileRegex` 中写路径。
- `kinds`：可选；默认 script/link，iframe 必须显式写 `['iframe']`。所有配置条件为 AND，各条规则为 OR。省略 pkg/file/path 条件会扩大匹配范围，必须审慎。

`resourceRules` 是带 `category` 的通用规则；`iframes` 使用相同结构并显式指定 iframe 类型。优先在分类下写 `rules`，避免 category 拼写错误导致规则不启用。iframe 规则单独保留，因为其加载/取消语义与 script/link 不同。

只针对现有侧栏包时，直接向 `asideChunks` 添加稳定名称一行。gate 会转义名称并匹配 `<名称>_` 前缀，不能误拦侧栏主入口。若包目录变化，检查 `asidePackage`，不要扩大为整个侧栏包阻断。

**资源 gate 只处理 DOM script/link/iframe 插入，不拦截通用 fetch、XHR 或 sendBeacon。** 因此把采集 URL 放进规则不会自动阻止 beacon/XHR 上报；需要单独评估机制，不能声称配置已经覆盖所有 analytics。

## 临时关闭分类（二分排查与 A/B）

不改代码即可关闭部分阻断分类：在斗鱼页面控制台执行

```js
localStorage.setItem('douyu-safari-disabled-categories', 'roomWidgets,analytics');
```

再重新载入。启用代码中 `enabled:false` 的分类用 `douyu-safari-enabled-categories`，两个列表同时包含时以关闭为准。分类名即 `DOUYU.resourceCategories` 的键（如 `activity`、`gifts`、`games`、`roomWidgets`、`anchorTools`、`analytics`）。斗鱼更新后若某功能失效，可逐个关闭分类定位；测量某分类的内存收益时，用全新标签页分别载入开启/关闭两种状态。排查完成后执行 `localStorage.removeItem('douyu-safari-disabled-categories')`。

关闭 `analytics` 时也不会安装统计替身。`collect-rangers` 规则另有 `when` 条件：只有本脚本的 `collectEvent` 回调替身先于页面 inline 代码就位才会阻断，晚注入时保留真实 SDK。

### 页面外围分类失去的功能

`pageHeader`、`followGroups`、`videoAssets` 在简洁模式默认开启（简洁模式本来就不显示这些区域）。静态审查（2026-10-31）结论，斗鱼改版后按此回归：

- `videoAssets`（live-video-assets）：只向 `BottomApp` 的 `videoAsset` 区域推送底部视频合集，未见包外消费者。风险低。
- `followGroups`（live-next `customGroup_`）：普通关注接口不受影响，但 Next 标题栏在关注成功后会请求分组提示、发送 `cutomGroup_showGroupSetting` 并监听特别关注状态，这些后续操作随之失效。共享 `Modal_` chunk 不在阻断范围内。
- `pageHeader`（header-master）：独占 `shark.header.BaseConfigService`（私信、用户等级/至尊权益/公共面板），阻断后房间公共包和聊天栏对这些服务的调用会静默挂起；页头的关注列表、历史、搜索和退出入口一并消失。登录检查与弹幕发送走 room common 和聊天栏各自的 LoginService，不依赖页头，但服务端会话失效后的恢复未实测。
- SHARK loader 在 `error` 时推进队列，阻断不会卡住主队列；被阻断包注册的服务没有提供者，调用方会一直等待而不报错。

## 注入时机与画质补救

Safari 版 Tampermonkey 不保证 `document-start` 先于页面脚本；Chromium 版只有 **UserScripts API Dynamic** 注入模式能保证。`status().readyStateAtInstall` / `installedAtMs` 记录实际注入时刻，`startupQuality.request` 为空时说明首流已错过改写（脚本注入前请求已发出）。此时 `createQualityRecovery()` 在播放器 store 就绪后调用一次原生 `handleAcj('loadWithoutPerception','changeRate',[{rate:0, manual:true}])`；`status().qualityRecovery.phase` 说明结果（`issued`、`already-original`、`native-change`、`user-input`、`timeout` 等）。斗鱼改版后若长期为 `timeout` 且 `last` 为空，先检查 `runtime.playerStore` 与 h5-plugin 的 `mapStateToProps` 字段。

简洁模式还会持续包装同源首流接口（`endpoints.firstStream`）的 POST 响应 `json()`：成功且 `data` 为非数组对象时，将 `data.p2p` / `data.h265_p2p` 同时置为数字 `0`（契约 `endpoints.p2pFields`），其余流参数不变。只清 `p2p` 会让播放器降为 H.264；两项一起清除也会取消首流约 5 秒后的 preload 替换重启，避免加载约 10 秒后因 `dyp2pxp2p` SDK 被内容拦截器阻断、`P2PInitError` 销毁播放器而黑屏约 4 秒。后续手动切档、切线路和回退响应仍需清除 P2P，但只有首个带档位的请求改写 `rate=0`；hook 保留到 `stop()`，`startupQuality.p2pCleared` 记录处理数，`fetchHookReleased` 仅在停止时实际恢复 fetch 后为真。完整模式不安装这个 hook，不清除 P2P，也不改写画质。

## 其他契约的维护边界

- `storageDefaults`、`storageKeys`、`storageEnvelope`：在原生 UI 更改一次设置，再对照 Storage 中的 key、枚举及 c/e/v/r 封装。`shieldKeys` 是事件参数，`shieldStorageKeys` / `shieldPersistence` 是存储参数，注意 `smallGift` 与 `smallgift` 的区别。
- `removeIds`：只允许独立辅助 React 根。不要把播放器或发送/登录/聊天通信根加入列表。切换模式依靠重新加载，不尝试在原地恢复已卸载业务。
- 广告判定看商业素材来源（广告位 id、`/japi/sign`、`dyadx`、竞价/星海素材），不看名字：`shelterAd` 名称含 Ad 但只是遮挡矩形；`InteractABAd`、`live-business-component` 混有充值/背包/主播商店，只能去其中的广告叶子节点。静态证据见 2026-10-31 调研。
- `playerModules` 只在简洁模式卸载；`adPlayerModules` 是播放器广告，两种模式都卸载。`adCSS` 两种模式都注入，`cleanCSS` 只用于简洁模式布局。
- 非房间路径：简洁模式只安装切房导航边界；完整模式安装广告层且保留原生 SPA 导航，发现期每秒检查一次，之后每两秒一次。
- `playerModules`：通过 React 自身更新触发真实子树卸载，不直接删 React DOM。初始或路径改变后的 20 秒内每次既有 tick 都可发现不同原型，之后停止发现；极慢加载或 20 秒后才出现的新原型可能不被覆盖。
- `cleanCSS`：集中保存站点 CSS 前缀和布局关系；`data-dy-*`、`douyu-clean-*` 是本脚本拥有的标记，不是待猜测的站点选择器。
- 导航、页面退出与 FLV preload 的浏览器语义不应与站点选择器一起盲改。继续保留修改键、下载、表单、跨域、query/hash 记账和历史遍历的排除条件。

## 文件内模块索引

按函数名搜索比长期依赖行号可靠：

1. `DOUYU`：站点适配契约；`DISCOVERY_WINDOW_MS`：有界发现时间。
2. `installRoomNavigationBoundary`：同源数字房间导航边界。
3. `installPageLifecycle`：离开清理与已销毁历史文档恢复。
4. `createOptionalResourceGate`：分类和配置驱动资源 gate。
5. `createPlayerModuleTrim`：原生可选模块发现与卸载。
6. `createAdapterHealth` / `createDiagnostics`：轻量契约观测与兼容公开状态。
7. `createCleanController`：原生设置、React 根清理、发送服务、布局和 tick。
8. `installStartupQuality`：简洁模式把首个播放请求改为原画（无论原档位），并记录首次视频元数据。
9. `createPreloadGuard`：DOM 插入快路径、FLV preload 与原有 head fallback。
10. `categoryEnabled` / `installAnalyticsSinks` / `createQualityRecovery`：分类临时开关、统计替身、晚注入画质补救。
11. 文件末尾：模块装配、停止顺序、公开 `window.__douyuSafariGuard`。

## 运行回归

使用 Node.js 22 或更高版本，在仓库根目录执行，无需 `npm install`：

```sh
npm test
```

测试包括语法、发布元数据、既有资源放行与计数、默认阻断集合快照、分类开关、配置规则边界、导航/生命周期、原生播放器销毁、健康状态、有界重复发现、DOM 插入快路径和整份脚本的 mock 启动/公开字段兼容性。`tests/harness.cjs` 只为 Node 测试读取同一份文件的配置和工厂；不会生成发布产物。

自动测试不证明真实 Safari、React 私有接口、特殊房间或真实弹幕发送一定正常。改动契约后仍应在获得授权的真实环境做上述功能回归；本次结构重构的自动测试没有启动浏览器。不要单凭单元测试宣称新的内存或功耗收益。
