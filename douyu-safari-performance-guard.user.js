// ==UserScript==
// @name         Douyu Safari Performance Guard
// @namespace    local.codex.douyu
// @version      3.7.0
// @description  Lean native Douyu player for Safari and Chromium: retain video, danmaku and controls; unload auxiliary modules; default highest quality, effects off and 1/4-screen danmaku; guard Safari FLV preloads.
// @author       noahhhi
// @license      MIT
// @homepageURL  https://github.com/noahhhi/douyu-safari-performance-guard
// @supportURL   https://github.com/noahhhi/douyu-safari-performance-guard/issues
// @updateURL    https://github.com/noahhhi/douyu-safari-performance-guard/releases/latest/download/douyu-safari-performance-guard.meta.js
// @downloadURL  https://github.com/noahhhi/douyu-safari-performance-guard/releases/latest/download/douyu-safari-performance-guard.user.js
// @match        https://www.douyu.com/*
// @match        https://douyu.com/*
// @run-at       document-start
// @noframes
// @grant        none
// @sandbox      raw
// ==/UserScript==

(() => {
    'use strict';
    // Injection timing: Safari and non-dynamic Chromium TM modes may inject late.
    const readyStateAtInstall = document.readyState, installedAtMs = Math.round(performance.now());

    // DOUYU ADAPTER CONTRACTS — 网站更新时先维护此区；算法与浏览器挂钩在下面。
    // 查找方法见 docs/maintenance.md。规则只列已经验证的独立业务，默认集合不扩张。
    // 自定义 rules: {host: 字符串或 RegExp, pkg?: 包目录, fileRegex?: 文件名正则,
    // pathnameRegex?: 路径正则, kinds?: ['script','link' 或 'iframe'], when?: () => 布尔}。
    // host 必填；省略 pkg 表示不要求 front-publish 路径；默认 kinds 为 script/link。
    const DOUYU = {
        roomPath: /^\/\d+\/?$/, // 地址栏：仅数字房间路径；别名房间仍不纳入。
        resourceHost: /(?:^|\.)douyucdn\.cn$/, // Network：独立静态分包的 CDN 主机后缀。
        packageSegment: 'front-publish', // Network：URL 中包目录的上一层。
        // 独立业务包：Network 中 front-publish/<包名>/ 的包名；确认与播放、登录、聊天无关后整包阻断。
        // 分类默认只在简洁模式生效；fullMode:true 的分类（仅广告）在完整模式同样生效。
        resourceCategories: {
            // 广告：sign 是 SHARK 广告位启动器（不是登录/签到），asideTopSuspension 是侧边悬浮广告（含优量汇竞价）。
            ads: {enabled:true, fullMode:true, rules:[
                {host:/(?:^|\.)douyucdn\.cn$/, pkg:'live-next-master', fileRegex:/^(?:sign|asideTopSuspension)_/},
            ]},
            activity: {enabled:true, packages:[
                'live-act-diamond-carnival-master',
                'live-activity-common-pendant-master',
                'live-activity-modules-master',
                'live-anchor-collect-task-master',
                'live-coconut-fantasy-island-master',
                'live-crazy-interstellar-master',
                'live-desert-relic-master',
                'live-duel-peak-master',
                'live-magic-awakening-master',
                'live-new-anchor-support-master',
                'live-pandora-box-master',
                'live-super-fans-master',
                'live-the-great-voyage-master',
                'live-water-friends-festival-master',
                'live-diamond-fans-match-master',
                'live-tiger-envelope-master',
                'live-skit-master',
                'live-task-master',
            ]},
            gifts: {enabled:true, packages:[
                'live-activity-gift-hall-master',
                'live-activity-gift-naming-master',
                'live-advanced-gift-master',
                'live-random-effect-gift-master',
                'live-random-effect-gift-v3-master',
                'live-random-effect-gift-v4-master',
                'live-wishing-gift-master',
                'new-revenue-web-front-master',
                'live-business-component-master',
                'live-confession-gift-master',
                'live-recharge-feedback-master',
            ]},
            games: {enabled:true, packages:[
                'live-pubg-game-prop-shop-master',
                'live-game-guess-master',
                'live-pk-progress-master',
            ]},
            community: {enabled:true, packages:[
                'audio-social-web-front-master',
                'yuba-hot-topic-master',
            ]},
            admin: {enabled:true, packages:[
                'live-test-get-anchor-master',
                'room-admin-menu-master',
                'live-account-transactions-master',
                'live-anchor-interactive-tool-master',
            ]},
            aside: {enabled:true, packages:[]}, // 侧栏视觉分包；名称来自 Network/webpack chunk 映射。
            // 房间页独立挂件：live-next-master/js/room/<名称>_<hash>.js，由 SHARK 加载器插入；
            // 加载器 onerror 继续队列。chatInteration 是投票互动
            // （原生发送器在 live-next-player-aside 主包），superFans 渲染 #js-room-activity。
            // 播放器 React.lazy 子模块（WarGame、SvgaPlayer 等）失败会拒绝 Suspense，不可加入。
            roomWidgets: {enabled:true, rules:[
                {host:/(?:^|\.)douyucdn\.cn$/, pkg:'live-next-master',
                    fileRegex:/^(?:chatInteration|lotteryDraw|superFans)_/},
            ]},
            // 主播/超管工具：menu 仅在 uid===owner_uid 或 groupId===5 时渲染；普通观众不需要。
            anchorTools: {enabled:true, rules:[
                {host:/(?:^|\.)douyucdn\.cn$/, pkg:'live-next-master', fileRegex:/^(?:menu|superMenu)_/},
            ]},
            // 页面外围（简洁模式不显示这些区域）。各自失去的功能见 docs/maintenance.md。
            // pageHeader：header-master 1.39 MB 页头；独占 shark.header.BaseConfigService（私信、至尊/公共面板），
            // 登录另有 room common LoginService。
            pageHeader: {enabled:true, packages:['header-master']},
            // followGroups：关注后的分组设置与特别关注（Next 标题栏关注成功后会调用）。
            followGroups: {enabled:true, rules:[
                {host:/(?:^|\.)douyucdn\.cn$/, pkg:'live-next-master', fileRegex:/^customGroup_/},
            ]},
            // videoAssets：底部视频合集（BottomApp videoAsset 区域），未见包外消费者。
            videoAssets: {enabled:true, packages:['live-video-assets-master']},
            // 统计 SDK：配合 installAnalyticsSinks()；页面 inline 只在全局不存在时创建队列。
            analytics: {enabled:true, rules:[
                {host:'hm.baidu.com', pathnameRegex:/^\/hm\.js$/},
                {host:'www.googletagmanager.com', pathnameRegex:/^\/gtag\/js$/},
                // 业务代码直接等待 collectEvent('getToken'|'getAllVars'|'getVar') 回调；
                // 只有本脚本的回调替身先就位时才阻断，晚注入时保留真实 SDK。
                {host:'lf3-data.volccdn.com', fileRegex:/^collect-rangers-v[\d.]+\.js$/,
                    when:() => window.collectEvent?.douyuGuardSink === true},
            ]},
        },
        asidePackage: 'live-next-player-aside-master', // Network：保留主入口，只阻断下列独立 chunk。
        asideChunks: [ // Network/webpack：侧栏独立 chunk 名；匹配名称后紧跟 `_`，不匹配主入口。
            'NobleReminder',
            'ChatRankAll',
            'FansRankAll',
            'DiamondsFansRankBottom',
            'BarrageGroup',
            'SvgaConfigEffectContainer',
            'YBCommunity',
            'DiamondsFansEffect',
            'TbActPopup',
            'ChatEffect',
            'AnchorLevelUp',
            'FollowTips',
            'WishGiftMsg',
            'PrivilegeGift',
            'HighEnergyTips',
            'FansFeedback',
            'StarVoteTips',
            'MatchSystemV2Card',
            'ProgramBookletTips',
            'PopularBarrage',
            'MedalDialog',
            'MedalPanel',
            'MedalDroppingPanel',
            'UserGuide',
            'UpgradeEffect',
            'GuideBarrage',
            'HotBarrage',
            'BarrageCounter',
            'UserGameDataPanel',
        ],
        resourceRules: [
            {category:'games', host:'game.weixin.qq.com', pathnameRegex:/\/wxgamesdk\.js$/}, // Network：小游戏 SDK；保留原路径末尾匹配。
        ],
        iframes: [
            {category:'activity', host:'www.douyu.com', pathnameRegex:/^\/pages\/ord-task-center$/, kinds:['iframe']}, // Elements/Network：任务中心。
            {category:'community', host:'msg.douyu.com', pathnameRegex:/^\/web\/index\.html$/, kinds:['iframe']}, // Elements/Network：站内信。
            {category:'games', host:'game.weixin.qq.com', pathnameRegex:/\/wxgamesdkframe\.html$/, kinds:['iframe']}, // Elements/Network：小游戏子页。
        ],
        playerModules: [
            'videoEnhanced',
            'PKView',
            'ActivePK',
            'gameHotArea',
            'broadcast',
            'customBroadcast',
            'noticeBarrage',
            'yzPkHours',
            'warGameUserPanel',
            'voiceActUpgrade',
            'hitSong',
            'voiceActProgress',
            'commentRoleHelp',
            'gameLightDanmuCheer',
            'userPK',
            'videoAd', // 插播/关播广告，同时转发关播 room_data_state；完整模式保留。
            'shelterAd', // 名称含 Ad，实为遮挡矩形，不是广告；只在简洁模式卸载。
            'anchorMaiMai',
            'conMicroPhone',
        ], // React player fiber 的 memoizedProps.id；确认只卸载视觉/业务模块，保留原生控制与通信。仅简洁模式。
        // 同上，播放器广告素材模块；两种模式都卸载：无操作广告、关播推荐广告、品牌/竞价中插、游戏下载推广。
        adPlayerModules: ['userNoHandleAd', 'recommendAD', 'hyad', 'gameQRCode'],
        removeIds: [
            'js-header',
            'js-player-asideMain',
            'js-player-toolbar',
            'js-bottom-left',
            'js-room-activity',
            'js-room-top-banner',
            'js-player-asideTopSuspension',
            'js-custom-group',
            'js-player-video-above',
            'js-player-guessgame',
            'js-pk-progress',
            'js-player-dialog',
            'js-player-for-audio',
        ], // Elements：独立 React 根容器 ID；不要添加播放器、登录或聊天通信根。
        ids: {
            player: 'room-html5-player', // Elements + React root：播放器模块连接器树。
            owner: 'js-player-video-widgets', // React fiber stateNode.player：原生 destroy() 所有者。
            aside: 'js-player-asideMain', // Elements：侧栏宿主，发送服务重建前清理其静态 HTML。
            videoCase: 'js-player-video-case', // Elements：视频壳，parentElement 为纯净布局根。
        },
        selectors: {
            videoCase: '#js-player-video-case', // Elements：视频壳；也用于首次视频元数据归属判断。
            controlbar: '#js-player-controlbar', // Elements：原生控制条。
            shieldItem: '[class^="shieldSettingItem-"]', // Elements：特效屏蔽菜单项（CSS module 前缀）。
            checked: '[class^="checked-"]', // Elements：菜单选中标志。
            iconLabel: '[class^="iconLabel-"]', // Elements：弹幕区域菜单标签。
            senderInput: '#js-player-controlbar [class^="fullScreenSendor-"] input', // Elements：原生发送输入框。
            media: '#js-player-video-case video,#js-player-video-case audio', // Elements：退出时需释放的媒体。
        },
        cleanOnlySelectors: ['shieldItem','checked','iconLabel','senderInput'], // Diagnostics：完整模式不使用原生菜单/发送替代服务。
        storageKeys: {
            // 本脚本拥有：'off' 为完整模式，其余（含未设置）为简洁模式；按站点 origin 记忆，与历史版本兼容。
            cleanMode: 'douyu-safari-clean-mode',
            // 本脚本拥有：逗号分隔的分类名，临时关闭这些阻断分类，用于斗鱼更新后二分排查或 A/B 测量，
            // 例如 localStorage['douyu-safari-disabled-categories'] = 'roomWidgets,analytics'。
            disabledCategories: 'douyu-safari-disabled-categories',
            // 同格式：启用代码中 enabled:false 的分类。关闭列表优先。
            enabledCategories: 'douyu-safari-enabled-categories',
            shield: 'chat-shield-config', // Storage：改一次原生屏蔽设置并对照 JSON envelope。
            preload: 'h5StreamPreload_h5p_room', // Storage/首流加载代码：自动档流缓存。
            // Storage：用户在清晰度菜单选择后写入的三个偏好（h5-plugin onChangeHandler）。
            ratePreferences: ['realRateModel2_h5p_room', 'realRateModel_h5p_room', 'player_storage_rate_h5p_room'],
        },
        storageDefaults: {
            player_storage_danmu_Model_h5p_room: 4, // Douyu's native 1/4-screen enum.
            player_storage_rate_h5p_room: 0,        // Native original/highest stream.
            realRateModel_h5p_room: 0, // Storage：切原画后比对的原生画质偏好。
            realRateModel2_h5p_room: 0, // Storage：另一播放器路径的原生画质偏好，同样对照切档。
        }, // Storage：更改原生画质/弹幕区域后对照 key 和枚举；值 0 不是固定码率。
        storageEnvelope: {expires:253402300799000, revision:1}, // Storage：c/e/v/r 原生缓存封装，v 为 JSON。
        shieldKeys: {'屏蔽全部礼物':'allGift','屏蔽消息通知':'message',
            '屏蔽视频广播':'videoBroadcast','屏蔽小礼物':'smallGift',
            '屏蔽进场特效':'userEnter','屏蔽礼物音效':'audioGift','屏蔽弹幕皮肤':'barrageSkin'}, // Elements 文案 → js_shieldEffects 参数；抓原生菜单调用复核。
        shieldStorageKeys: ['allGift','message','videoBroadcast','smallgift','userEnter','dianzan','audioGift','barrageSkin'], // Storage：注意 smallgift 与事件 smallGift 大小写不同。
        controls: {
            quarterText: '1/4屏', // Elements：弹幕区域文案。
            quarterSelected: 'quarterscreen_select', // Styles：选中区域的 background-image 名称。
            shieldCount: 7, // Elements：七项屏蔽菜单；不包含存储专用 dianzan。
            shieldEvent: 'js_shieldEffects', // 搜索播放器 acjCall 调用与事件订阅。
        },
        sender: {
            chatClass: 'layout-Player-chat', // PlayerAsideApp 的 render 元素描述：聊天容器 className。
            speakClass: 'Chat-speak', // 同上：原生发送服务父组件。
            componentKey: 'component', storeKey: 'store', // PlayerAsideApp.container：查 get() 注册项。
        },
        endpoints: {
            firstStream: /^\/(?:lapi\/live\/getH5PlayV1|gapi\/live\/web\/super\/stream\/v1)\/\d+$/, // Network：同源 POST 首流接口。
            rateField: /(?:^|&)rate=([^&]*)/, rateReplace: /(^|&)rate=[^&]*/, // Network：form body 的档位；原生自动档为 -1。
            originalRateBody: '$1rate=0', // Network/画质设置：原画/最高档为 0；只改首个请求，之后用户手动切档不受影响。
            liveMedia: /\.flv$/i, // Network：无尽直播 FLV；只阻止 fetch preload，不拦播放器请求。
        },
        runtime: {
            moduleCache: () => window._room_common_?.c, // 页面脚本/webpack runtime：React、ReactDOM、Redux exports 缓存。
            asideApp: () => window.PlayerAsideApp, // 页面脚本：侧栏 DI 容器及原生 ChatSend 组件。
            player: () => window.__player, // 页面脚本：原生 acjCall bridge；handleAcj 为新播放器业务桥。
            // 清晰度菜单最终调用 handleAcj('loadWithoutPerception','changeRate',[{rate}])；搜索 "loadWithoutPerception/changeRate"。
            rateChange: ['loadWithoutPerception', 'changeRate'],
            // 播放器插件 Immutable store：Connect 实例的 getStore()；字段见 h5-plugin mapStateToProps。
            playerStore: instance => typeof instance?.getStore === 'function' ? instance.getStore()?.getState?.() : null,
            moduleConnector: instance => !!instance?.unsubscribeListener, // React fiber：可选模块连接器持有原生 store 退订函数。
            nativeOwner: instance => instance?.player, // owner 根的 React fiber：stateNode.player 才是拥有 destroy() 的原生实例。
            senderElement: element => typeof element.type?.WrappedComponent?.prototype?.enterSend === 'function', // 侧栏 render 树：以原生 enterSend 方法识别发送组件。
            asideRenderContext: () => ({props:{}, getRoomSkinStyle:()=>({})}), // PlayerAsideApp render：只读取描述所需上下文，不调用构造/生命周期。
        },
        shieldPersistence: data => { // 原生 shield 事件 → Storage；从菜单事件与存储变化复核大小写和点赞字段。
            const persisted = {...data, smallgift:data.smallGift, dianzan:1};
            delete persisted.smallGift;
            return persisted;
        },
        cleanCSS: `
            html,body { margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important; }
            [data-dy-clean-path] { transform:none!important;filter:none!important;contain:none!important;min-width:0!important; }
            #js-player-main[data-dy-clean-path]::before { content:none!important;display:none!important; }
            [data-dy-clean-path]>:not([data-dy-clean-path]):not([data-dy-clean-core]):not(#douyu-clean-toggle) { display:none!important; }
            [data-dy-clean-core] { position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;background:#000!important;z-index:2147480000!important; }
            #js-player-dialog,#js-player-for-audio,#js-player-video-above,#js-player-guessgame,#js-pk-progress,
            [data-dy-clean-core]>[class^="pendant__"],.DanmuEffectDom,.EffectPlayerDom,.MatchSystemPlayerInteractive,
            [data-dy-clean-core] [class^="bg__"],
            [data-dy-clean-core] [class^="broadcastDiv-"],[data-dy-clean-core] [class^="customBc-"],
            [data-dy-clean-core] [class^="aiHighlightEntry-"] { display:none!important; }
            [data-dy-clean-core] .barrage-gradient.is-animation { animation:none!important;background-position:100% 50%!important; }
            [data-dy-clean-core] [class^="fullScreenSendor-"] { display:flex!important;align-items:center!important;width:clamp(160px,24vw,340px)!important;min-width:0!important;margin-left:12px!important; }
            [data-dy-clean-core] [class^="fullScreenSendor-"] input { flex:1!important;width:0!important;min-width:0!important; }
            [data-dy-clean-core] [class^="fullScreenSendor-"] button { flex:none!important; }
            [data-dy-clean-core] [class^="case__"]:has(#js-player-controlbar:focus-within) { transform:translateY(0)!important; }
            #js-player-controlbar:focus-within [class*="ControlBar-"] { opacity:1!important;visibility:visible!important;display:flex!important; }
        `, // Elements/Styles：所有站点类名前缀和布局关系集中在这里；data-dy-* 为本脚本标记。
        // 不要加入 .PIPAdLayer：网页全屏时斗鱼把真正的直播容器移进该层，隐藏会连直播一起隐藏。
        adCSS: `
            .SignBaseComponent-sign-ad,.SignBaseComponent-sign-text,
            .InteractABAd-signText,.DropMenuList-ad,.DropPane-ad,.layout-BottomAdvert,.XinghaiAd,.SignRoomAnchorAd,
            .ScreenBannerAd,#player_h5_adDom,
            #js-room-activity,.ActivityDiamondFansDiscountRankBanner,
            #js-toolbar-interact,.RechargeFeedbackActEntry,.RechargeFeedbackActTip,.DiamondCommonRoomPush { display:none!important; }
            .RoomText-wrap:has(.RoomText-item--link[data-dysign]) { display:none!important; }
            #js-player-main :is([class^="activeContainer__"],[class*=" activeContainer__"]) { display:none!important; }
        `, // Elements/Styles：两种模式都注入，不隐藏宿主。第一组是广告位；第二组是站内付费活动推广：
           // 右侧活动挂件列（兄弟 #js-room-snapbar 是功能按钮）、钻粉榜顶部横幅、标题栏活动卡片、
           // 礼物栏左侧活动入口（兄弟是礼物/充值/背包）、充值回馈与钻粉定时推送。
    };
    // Browser policy, not codec detection: Chromium also advertises AppleWebKit.
    // Preserve the existing Safari predicate; let Douyu choose its media backend.
    const BROWSER = (() => {
        const ua = navigator.userAgent;
        const isChromium = /Chrome|Chromium|Edg\//.test(ua);
        const isSafari = /AppleWebKit/.test(ua) && /Safari/.test(ua) && !isChromium;
        return Object.freeze({isSafari, isChromium, guardLivePreload:isSafari});
    })();
    // Mode — 简洁模式：只保留最高画质视频与弹幕观看/发送，其余一律不加载；
    // 完整模式：只去广告，不改页面、画质、弹幕设置和导航。工厂各自读取，切换按钮写入并重载。
    function isCleanMode() {
        try { return localStorage.getItem(DOUYU.storageKeys.cleanMode) !== 'off'; } catch { return true; }
    }
    const DISCOVERY_WINDOW_MS = 20000; // 共用现有 tick，不新增定时器/大子树观察器。

    if (window.top !== window.self || !(BROWSER.isSafari || BROWSER.isChromium)) return;
    const navigation = isCleanMode() ? installRoomNavigationBoundary() : {stop() {}};
    if (isCleanMode() && !DOUYU.roomPath.test(location.pathname)) return;
    if (window.__douyuSafariGuard) return;


    // Navigation boundary — 同源数字房间整页导航；依赖 roomPath，保留原生排除条件。
    function installRoomNavigationBoundary() {
        if (window.__douyuRoomNavigation) return window.__douyuRoomNavigation;
        const room = path => DOUYU.roomPath.test(path);
        const initialPath = location.pathname;
        const nativePush = history.pushState, nativeReplace = history.replaceState;
        const restorers = [];
        let stopped = false, routing = false;
        function targetURL(value) {
            try {
                const url = new URL(value, location.href);
                return url.origin === location.origin &&
                    (room(url.pathname) || room(location.pathname)) ? url : null;
            } catch { return null; }
        }
        function reloadTo(url, replace = false, state = null, title = '') {
            // Retain the history URL, but commit the next room as a Reload.
            // WebKit excludes the departing document from BFCache for Reload.
            // Chromium uses this boundary for fresh room setup, not a memory guarantee.
            // Other browser/extension references may still delay reclamation.
            routing = true;
            try {
                Reflect.apply(replace ? nativeReplace : nativePush, history, [state,title,url.href]);
                location.reload();
            } finally { routing = false; }
        }
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            const wrapped = function (...args) {
                const target = args.length > 2 && args[2] != null ? targetURL(args[2]) : null;
                // Query/hash bookkeeping remains a same-document operation.
                if (!stopped && !routing && target && target.pathname !== location.pathname) {
                    reloadTo(target, method === 'replaceState', args[0], args[1]);
                    return;
                }
                return Reflect.apply(original, this, args);
            };
            history[method] = wrapped;
            restorers.push(() => { if (history[method] === wrapped) history[method] = original; });
        }
        function navigate(event) {
            if (stopped || routing || !event.canIntercept || !event.cancelable || event.hashChange || event.destination?.sameDocument ||
                event.formData || event.downloadRequest != null || !['push','replace'].includes(event.navigationType)) return;
            const target = targetURL(event.destination.url);
            if (!target) return;
            event.preventDefault();
            if (target.href === location.href) location.reload();
            else reloadTo(target, event.navigationType === 'replace');
        }
        function click(event) {
            if (stopped || routing || event.defaultPrevented || event.button !== 0 ||
                event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
            const anchor = event.target?.closest?.('a[href]');
            if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
            const target = targetURL(anchor.href);
            if (!target || (target.pathname === location.pathname && target.search === location.search)) return;
            event.preventDefault(); event.stopImmediatePropagation();
            reloadTo(target);
        }
        function popstate() {
            if (!stopped && location.pathname !== initialPath && (room(initialPath) || room(location.pathname))) location.reload();
        }
        if (window.navigation) window.navigation.addEventListener('navigate', navigate);
        else window.addEventListener('click', click, true);
        window.addEventListener('popstate', popstate);
        const api = {stop() {
            stopped = true;
            window.navigation?.removeEventListener('navigate', navigate);
            window.removeEventListener('click', click, true);
            window.removeEventListener('popstate', popstate);
            for (const restore of restorers) restore();
            delete window.__douyuRoomNavigation;
        }};
        Object.defineProperty(window, '__douyuRoomNavigation', {configurable:true, value:api});
        return api;
    }

    // Page lifecycle — 离开销毁、历史恢复重建；无站点 DOM 依赖，后台播放不受影响。
    function installPageLifecycle(dispose) {
        let disposed = false, restoring = false;
        function hide(event) {
            if (disposed) return;
            disposed = true;
            dispose();
        }
        function show(event) {
            // A cached page now contains a disposed live player. Recreate it only
            // on history restoration, never on visibilitychange/background play.
            if (event.persisted && disposed && !restoring) {
                restoring = true;
                location.reload();
            }
        }
        window.addEventListener('pagehide', hide);
        window.addEventListener('pageshow', show);
        return {status:()=>({disposed,restoring}), stop() {
            window.removeEventListener('pagehide', hide);
            window.removeEventListener('pageshow', show);
        }};
    }

    // Category switch — 模式、代码里的 enabled 与本地开关列表合并；读不到存储时按代码默认。
    function categoryEnabled(name, clean = isCleanMode()) {
        const config = DOUYU.resourceCategories[name];
        if (!config || (!clean && !config.fullMode)) return false;
        const listed = key => {
            try { return (localStorage.getItem(key) || '').split(',').map(item => item.trim()).includes(name); }
            catch { return false; }
        };
        if (listed(DOUYU.storageKeys.disabledCategories)) return false;
        return !!config.enabled || listed(DOUYU.storageKeys.enabledCategories);
    }

    // Resource gate — 加载前拦截独立业务；依赖 resourceCategories/rules/iframes/asideChunks。
    function createOptionalResourceGate() {
        let enabled = true;
        const clean = isCleanMode();
        const blocked = new Map(), marked = new WeakSet();
        let late = 0;
        // Observed, independent business bundles. Shared bootstrap, sign-in,
        // streaming, codecs, chat transport and the native sender remain intact.
        // Compile categories once; a maintainer can add package/file rules without
        // touching the gate. Category flags are read when the factory is created.
        const rules = [], packages = new Set();
        for (const [category, config] of Object.entries(DOUYU.resourceCategories)) {
            if (!categoryEnabled(category, clean)) continue;
            for (const pkg of config.packages || []) packages.add(pkg);
            for (const rule of config.rules || []) rules.push(rule);
            if (category === 'aside' && DOUYU.asideChunks.length) {
                const names = DOUYU.asideChunks.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                rules.push({host:DOUYU.resourceHost, pkg:DOUYU.asidePackage,
                    fileRegex:new RegExp('^(?:' + names.join('|') + ')_')});
            }
        }
        for (const rule of [...DOUYU.resourceRules, ...DOUYU.iframes]) {
            if (categoryEnabled(rule.category, clean)) rules.push(rule);
        }
        function matches(pattern, value) {
            if (typeof pattern === 'string') return pattern === value;
            // Also make maintainer-provided global/sticky regexes deterministic.
            pattern.lastIndex = 0;
            return pattern.test(value);
        }
        function optionalURL(value, kind) {
            let u;
            try { u = new URL(value, location.href); } catch { return false; }
            const parts = u.pathname.split('/'), at = parts.indexOf(DOUYU.packageSegment);
            const pkg = at < 0 ? null : parts[at+1], file = parts.at(-1);
            if (kind !== 'iframe' && packages.has(pkg) && matches(DOUYU.resourceHost, u.hostname)) return true;
            for (const rule of rules) {
                if (rule.kinds ? !rule.kinds.includes(kind) : kind === 'iframe') continue;
                if (!matches(rule.host, u.hostname)) continue;
                if (rule.pkg != null && rule.pkg !== pkg) continue;
                if (rule.fileRegex && !matches(rule.fileRegex, file)) continue;
                if (rule.pathnameRegex && !matches(rule.pathnameRegex, u.pathname)) continue;
                if (rule.when && !rule.when()) continue;
                return true;
            }
            return false;
        }
        function prepare(node) {
            if (!enabled || !node || node.nodeType !== 1) return;
            const kind=node.localName;
            if (kind !== 'script' && kind !== 'iframe' && kind !== 'link') return;
            if (marked.has(node)) return;
            const attr=kind==='link'?'href':'src', value=node.getAttribute(attr);
            if (!value || !optionalURL(value,kind)) return;
            marked.add(node);
            // Connected/parser-created resources may already have started. Do
            // not claim them as prevented or alter a running script.
            if (node.isConnected) { late++; return; }
            const path = new URL(value, location.href).pathname;
            if (blocked.size < 128 || blocked.has(path)) blocked.set(path,(blocked.get(path)||0)+1);
            node.setAttribute('data-douyu-optional-blocked',path);
            if (kind==='script') node.type='application/x-douyu-disabled';
            node.removeAttribute(attr);
            if (kind==='iframe') node.src='about:blank';
            // Report the real cancellation to each independent loader so its
            // timeout/handlers are released; never fabricate a loaded module.
            if (kind!=='iframe') queueMicrotask(()=>node.dispatchEvent(new Event('error')));
        }
        return {prepare, status:()=>({enabled,late,count:[...blocked.values()].reduce((a,b)=>a+b,0),paths:[...blocked.keys()]}),stop:()=>{enabled=false;blocked.clear();}};
    }

    // Player module trim — 通过原生连接器卸载；依赖 ids.player、playerModules 和 React fiber 契约。
    function createPlayerModuleTrim(moduleIds) {
        // Optional visual/business modules only. Keep playback, chat, authentication,
        // moderation, error handling, media session and every native control.
        const optional = new Set(moduleIds);
        const hooks = new Map(), seen = new Set(), errors = new Set();
        let enabled = true, stopped = false, visits = 0;
        function visit() {
            const current = document.getElementById(DOUYU.ids.player)
                ?._reactRootContainer?._internalRoot?.current;
            if (!current) return false;
            const queue = [current], updates = [];
            let scanned = 0;
            while (queue.length && scanned++ < 2500) {
                const fiber = queue.pop(), props = fiber.memoizedProps;
                const instance = fiber.stateNode;
                // Native module connector: props.id selects the registered module,
                // unsubscribeListener belongs to its store subscription. Rendering
                // null lets React perform the children's real unmount lifecycle.
                if (optional.has(props?.id) && DOUYU.runtime.moduleConnector(instance) &&
                    typeof instance.forceUpdate === 'function') {
                    const proto = Object.getPrototypeOf(instance);
                    if (typeof proto.render === 'function') {
                        seen.add(props.id);
                        if (!hooks.has(proto)) {
                            const original = proto.render;
                            const wrapped = function () {
                                if (enabled && optional.has(this.props?.id)) return null;
                                return Reflect.apply(original, this, arguments);
                            };
                            proto.render = wrapped;
                            hooks.set(proto, {original, wrapped});
                        }
                        if (fiber.child) updates.push(instance);
                    }
                }
                if (fiber.sibling) queue.push(fiber.sibling);
                if (fiber.child) queue.push(fiber.child);
            }
            for (const instance of updates) {
                try { instance.forceUpdate(); } catch { errors.add(instance.props.id); }
            }
            visits++;
            return hooks.size > 0;
        }
        function refreshMounted() {
            const current = document.getElementById(DOUYU.ids.player)
                ?._reactRootContainer?._internalRoot?.current;
            const queue = current ? [current] : [];
            let scanned = 0;
            while (queue.length && scanned++ < 2500) {
                const fiber = queue.pop(), instance = fiber.stateNode;
                if (optional.has(fiber.memoizedProps?.id) && DOUYU.runtime.moduleConnector(instance)) {
                    try { instance.forceUpdate(); } catch { errors.add(instance.props.id); }
                }
                if (fiber.sibling) queue.push(fiber.sibling);
                if (fiber.child) queue.push(fiber.child);
            }
        }
        return {
            discover: () => !stopped && visit(),
            hookCount: () => hooks.size, // Cheap tick diagnostic; avoid materializing public status arrays.
            setEnabled: value => { enabled=!!value; refreshMounted(); },
            status: () => ({enabled, hooks:hooks.size, modules:[...seen], visits, errors:[...errors]}),
            stop: ({exiting=false}={}) => {
                stopped=true; enabled=false;
                for (const [proto, {original, wrapped}] of hooks) {
                    try { if (proto.render === wrapped) proto.render=original; } catch { errors.add('restore-render'); }
                }
                hooks.clear(); if (!exiting) refreshMounted();
            },
        };
    }

    // Diagnostics — 在已有 tick 内收集适配契约；依赖 selectors/ids/runtime。
    // “found” 表示启动窗口曾找到，不是持续 DOM 存活断言；不保留节点引用。
    function createAdapterHealth() {
        const contracts = {};
        const selectors = Object.entries(DOUYU.selectors), ids = Object.entries(DOUYU.ids);
        let started = performance.now(), observationClosed = false, stopped = false;
        function record(name, found, applicable = true, failed = false) {
            const previous = contracts[name];
            contracts[name] = {state:!applicable ? 'not-applicable' : failed ? 'failed' :
                found ? 'found' : performance.now() - started >= DISCOVERY_WINDOW_MS ? 'missing' : 'pending'};
            if (found) contracts[name].foundAtMs = previous?.foundAtMs ?? Math.round(performance.now() - started);
        }
        return {
            observe(enabled, clean) {
                if (stopped) return;
                if (!observationClosed) {
                    for (const [name, selector] of selectors) {
                        const applicable = enabled || !DOUYU.cleanOnlySelectors.includes(name);
                        const found = contracts['selector.' + name]?.state === 'found' ||
                            (applicable && !!document.querySelector(selector));
                        record('selector.' + name, found, applicable);
                    }
                    for (const [name, id] of ids) {
                        const found = contracts['id.' + name]?.state === 'found' || !!document.getElementById(id);
                        record('id.' + name, found);
                    }
                    observationClosed = performance.now() - started >= DISCOVERY_WINDOW_MS;
                }
                record('runtime.moduleCache', !!DOUYU.runtime.moduleCache(), enabled);
                record('runtime.asideApp', !!DOUYU.runtime.asideApp(), enabled);
                record('runtime.playerBridge', typeof DOUYU.runtime.player()?.acjCall === 'function', enabled);
                record('rendererHooks', clean.rendererHooks > 0, enabled);
                record('playerModuleHooks', clean.playerModuleHooks > 0);
                record('nativeSender', clean.nativeSender, enabled, clean.senderFailed);
            },
            restart() {
                if (stopped) return;
                started = performance.now(); observationClosed = false;
                for (const key of Object.keys(contracts)) delete contracts[key];
            },
            status: () => ({windowMs:DISCOVERY_WINDOW_MS, observationClosed, stopped,
                // Return copies: consumers must not mutate internal diagnostic state.
                contracts:Object.fromEntries(Object.entries(contracts).map(([key, value]) => [key, {...value}]))}),
            stop: () => { stopped = true; },
        };
    }

    // Public diagnostics — 保留历史字段，在顶层集中显示 adapter health；不访问 DOM。
    function createDiagnostics(snapshot) {
        return {status() {
            const result = snapshot();
            return {...result, adapterHealth:result.clean?.adapterHealth ||
                {state:'failed', reason:'clean-controller-initialization'}};
        }};
    }

    // Clean controller — 布局、原生控制与发送、退出释放；依赖 selectors/ids/storage/runtime/cleanCSS。
    function createCleanController() {
        const modeKey = DOUYU.storageKeys.cleanMode;
        const enabled = isCleanMode();
        const moduleTrim = createPlayerModuleTrim(enabled ?
            [...DOUYU.adPlayerModules, ...DOUYU.playerModules] : DOUYU.adPlayerModules);
        let discoveryStartedAt = performance.now(), lastPath = location.pathname;
        const health = createAdapterHealth();
        const removeIds = new Set(DOUYU.removeIds);
        const defaults = DOUYU.storageDefaults;
        function writeNative(key, value) {
            let record;
            try { record = JSON.parse(localStorage.getItem(key)); } catch {}
            if (!record || typeof record !== 'object') record = {};
            localStorage.setItem(key, JSON.stringify({...record, c: Date.now(),
                e: DOUYU.storageEnvelope.expires, v: JSON.stringify(value), r: DOUYU.storageEnvelope.revision}));
        }
        function setStartupDefaults() {
            try {
                for (const [key, value] of Object.entries(defaults)) writeNative(key, value);
                let config = {};
                try {
                    let value = JSON.parse(localStorage.getItem(DOUYU.storageKeys.shield)).v;
                    for (let i=0; i<3 && typeof value === 'string'; i++) value = JSON.parse(value);
                    if (value && typeof value === 'object') config = value;
                } catch {}
                for (const key of DOUYU.shieldStorageKeys) config[key] = 1;
                // The site's chat setting stores a JSON string inside its storage envelope.
                writeNative(DOUYU.storageKeys.shield, JSON.stringify(config));
            } catch {}
        }
        if (enabled) setStartupDefaults();
        let stopped = false, root, style, adStyle, button, timer, attempts = 0;
        let unmounted = 0, suppressedRenders = 0, defaultsApplied = false;
        let disposedRoots = 0, releasedMedia = 0;
        let senderHost, senderRenderer;
        const rendererRestorers = [], renderers = new Set();
        const failures = new Set();
        const css = DOUYU.cleanCSS;
        function targetIsAuxiliary(container) {
            return container?.nodeType === 1 && removeIds.has(container.id);
        }
        function installRendererHooks() {
            const cache = DOUYU.runtime.moduleCache();
            if (!cache) return;
            for (const module of Object.values(cache)) {
                const dom = module?.exports;
                if (!dom || typeof dom.unmountComponentAtNode !== 'function' || renderers.has(dom)) continue;
                renderers.add(dom);
                for (const method of ['render','hydrate']) {
                    const original = dom[method];
                    if (typeof original !== 'function') continue;
                    const wrapped = function (element, container, callback) {
                        if (enabled && targetIsAuxiliary(container)) {
                            suppressedRenders++;
                            if (container._reactRootContainer) dom.unmountComponentAtNode(container);
                            container.replaceChildren();
                            // Do not instantiate the irrelevant component tree. Preserve
                            // the public render completion callback when a caller uses one.
                            if (typeof callback === 'function') queueMicrotask(() => { try { callback.call(null); } catch { failures.add('callback:' + container.id); } });
                            return null;
                        }
                        return Reflect.apply(original, this, arguments);
                    };
                    try {
                        dom[method] = wrapped;
                        rendererRestorers.push(() => { if (dom[method] === wrapped) dom[method] = original; });
                    } catch {}
                }
            }
        }
        function onScriptLoad(event) {
            if (event.target?.tagName === 'SCRIPT' && !renderers.size) installRendererHooks();
            if (renderers.size) document.removeEventListener('load', onScriptLoad, true);
        }
        if (enabled) document.addEventListener('load', onScriptLoad, true);
        function unmountAuxiliary() {
            for (const id of removeIds) {
                const container = document.getElementById(id);
                if (!targetIsAuxiliary(container) || failures.has(id)) continue;
                if (!container._reactRootContainer) {
                    if (container.hasChildNodes()) container.replaceChildren();
                    continue;
                }
                for (const dom of renderers) {
                    try { if (dom.unmountComponentAtNode(container)) { unmounted++; break; } }
                    catch { failures.add(id); break; }
                }
            }
        }
        const shieldKeys = DOUYU.shieldKeys;
        function onShieldClick(event) {
            if (!enabled || typeof DOUYU.runtime.player()?.acjCall !== 'function') return;
            const item = event.target?.closest?.(DOUYU.selectors.shieldItem);
            if (!item?.closest(DOUYU.selectors.controlbar)) return;
            const items = [...item.parentElement.querySelectorAll(DOUYU.selectors.shieldItem)];
            if (!items.length || items.some(el => !shieldKeys[el.textContent.trim()])) return;
            const data = {};
            for (const el of items) {
                const selected = !!el.querySelector(DOUYU.selectors.checked);
                data[shieldKeys[el.textContent.trim()]] = +(el === item ? !selected : selected);
            }
            // Replace only the shield request/reply service owned by the removed
            // sidebar. Native subscribers still implement actual effect filtering.
            event.preventDefault(); event.stopPropagation();
            DOUYU.runtime.player().acjCall(DOUYU.controls.shieldEvent, data);
            const persisted = DOUYU.shieldPersistence(data);
            try { writeNative(DOUYU.storageKeys.shield, JSON.stringify(persisted)); } catch {}
        }
        document.addEventListener('click', onShieldClick, true);
        function applyNativeControls() {
            if (!enabled || defaultsApplied || !document.querySelector(DOUYU.selectors.controlbar)) return;
            const items = [...document.querySelectorAll(DOUYU.selectors.shieldItem)];
            const quarter = [...document.querySelectorAll(DOUYU.selectors.iconLabel)].find(e => e.textContent === DOUYU.controls.quarterText);
            if (items.length < DOUYU.controls.shieldCount || !quarter) return;
            const checked = items.every(item => item.querySelector(DOUYU.selectors.checked));
            const quarterSelected = quarter.parentElement.style.backgroundImage.includes(DOUYU.controls.quarterSelected);
            if (checked && quarterSelected) {
                defaultsApplied = true; return;
            }
            // Initialize the same native player event without mounting the sidebar.
            if (!quarterSelected) quarter.parentElement.click();
            if (typeof DOUYU.runtime.player()?.acjCall === 'function' && attempts % 8 === 0) {
                const config = Object.fromEntries(Object.values(shieldKeys).map(key => [key, 1]));
                DOUYU.runtime.player().acjCall(DOUYU.controls.shieldEvent, config);
            }
        }
        function findElement(element, predicate) {
            if (!element || typeof element !== 'object') return null;
            if (predicate(element)) return element;
            for (const child of [element.props?.children].flat(Infinity)) {
                const found = findElement(child, predicate);
                if (found) return found;
            }
            return null;
        }
        function setupNativeSender() {
            if (senderHost?.isConnected || !document.body || !DOUYU.runtime.asideApp()) return;
            try {
                const app = DOUYU.runtime.asideApp();
                const aside = document.getElementById(DOUYU.ids.aside);
                // The suppressed hydration leaves server HTML behind. Remove its
                // duplicate ChatSend fields before the native sender queries DOM.
                if (aside && !aside._reactRootContainer) aside.replaceChildren();
                const component = app.container.get(DOUYU.sender.componentKey)?.WrappedComponent;
                if (!component?.prototype?.render) return;
                // Read element descriptions only: do not mount the sidebar or run
                // its constructor/lifecycle. Select just the native send component.
                const tree = component.prototype.render.call(DOUYU.runtime.asideRenderContext());
                const chat = findElement(tree, e => e.props?.className === DOUYU.sender.chatClass)?.props.children;
                if (typeof chat?.type !== 'function') return;
                const speak = findElement(chat.type({}), e => e.props?.className === DOUYU.sender.speakClass);
                const speakClass = speak?.type?.WrappedComponent;
                if (!speakClass?.prototype?.render) return;
                const sendTree = speakClass.prototype.render.call({props:{},state:{}});
                const send = findElement(sendTree, DOUYU.runtime.senderElement);
                if (!send) return;
                const exports = Object.values(DOUYU.runtime.moduleCache() || {}).map(m => m.exports);
                const react = exports.find(e => e?.createElement && e?.useState);
                const redux = exports.find(e => e?.Provider && e?.ReactReduxContext && e?.connect);
                const dom = [...renderers][0];
                if (!react || !redux || !dom) return;
                senderHost = document.createElement('div'); senderHost.id='douyu-clean-send-service';
                senderHost.hidden=true; document.body.append(senderHost);
                dom.render(react.createElement(redux.Provider,{store:app.container.get(DOUYU.sender.storeKey)},
                    react.createElement(send.type)),senderHost);
                senderRenderer=dom;
            } catch { failures.add('native-sender'); senderHost?.remove(); senderHost=null; }
        }
        function onQuickSendKey(event) {
            if (!enabled || event.key !== 'Enter') return;
            const input = document.querySelector(DOUYU.selectors.senderInput);
            if (!input || input.disabled) return;
            if (event.isComposing || event.keyCode === 229) {
                if (event.target === input) event.stopPropagation();
                return;
            }
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            const target = event.target;
            if (target?.matches?.('input,textarea,select') || target?.isContentEditable) return;
            event.preventDefault(); event.stopPropagation(); input.focus();
        }
        document.addEventListener('keydown', onQuickSendKey, true);
        function setupLayout() {
            const candidate = document.getElementById(DOUYU.ids.videoCase)?.parentElement;
            if (!candidate || candidate === root) return;
            for (const el of document.querySelectorAll('[data-dy-clean-path],[data-dy-clean-core]')) {
                el.removeAttribute('data-dy-clean-path'); el.removeAttribute('data-dy-clean-core');
            }
            root = candidate;
            root.setAttribute('data-dy-clean-core','');
            for (let el=root.parentElement;el;el=el.parentElement) el.setAttribute('data-dy-clean-path','');
            if (!style) {
                style = document.createElement('style'); style.id='douyu-clean-layout';
                style.textContent=css; document.head.append(style);
            }
            window.dispatchEvent(new Event('resize'));
        }
        function setupAdStyle() {
            if (adStyle?.isConnected || !document.head) return;
            adStyle = document.createElement('style'); adStyle.id='douyu-ad-hide';
            adStyle.textContent=DOUYU.adCSS; document.head.append(adStyle);
        }
        function setupButton() {
            if (button?.isConnected || !document.body || !document.querySelector(DOUYU.selectors.videoCase)) return;
            button=document.createElement('button'); button.id='douyu-clean-toggle'; button.type='button';
            button.textContent = enabled ? '完整模式' : '简洁模式';
            button.title = enabled ? '切换到完整模式：只去广告，页面其余保持原样。切换后重新载入并记住选择。' :
                '切换到简洁模式：只保留最高画质视频与弹幕收发。切换后重新载入并记住选择。';
            button.style.cssText='position:fixed;right:12px;top:12px;z-index:2147483000;border:1px solid #ffffff44;border-radius:4px;padding:5px 8px;background:#222b;color:#ddd;font:12px system-ui;cursor:pointer;opacity:.5;';
            button.addEventListener('click', () => {
                try { localStorage.setItem(modeKey, enabled ? 'off' : 'on'); } catch {}
                location.reload();
            });
            document.body.append(button);
        }
        function tick() {
            if (stopped) return;
            if (location.pathname !== lastPath) {
                lastPath = location.pathname; discoveryStartedAt = performance.now();
                health.restart(); // 完整模式保留 SPA 导航，每次换路径重新发现。
            }
            if (enabled) {
                if (!renderers.size) installRendererHooks();
                unmountAuxiliary();
                setupLayout();
                setupNativeSender();
            }
            const discovering = performance.now() - discoveryStartedAt <= DISCOVERY_WINDOW_MS;
            if (discovering) moduleTrim.discover();
            applyNativeControls(); setupAdStyle(); setupButton();
            health.observe(enabled, {rendererHooks:renderers.size, playerModuleHooks:moduleTrim?.hookCount(),
                nativeSender:!!senderHost?.isConnected, senderFailed:failures.has('native-sender')});
            // 简洁模式保留 250 ms / 2 s；完整模式发现期 1 s，之后 2 s，不新增 timer。
            attempts++;
            timer=setTimeout(tick, enabled ? (attempts < 80 && (!renderers.size || !defaultsApplied) ? 250 : 2000) :
                discovering ? 1000 : 2000);
        }
        tick();
        return {
            status: () => ({enabled, attached:!!root?.isConnected, rendererHooks:renderers.size,
                unmounted, suppressedRenders, defaultsApplied, disposedRoots, releasedMedia, nativeSender:!!senderHost?.isConnected, playerModules:moduleTrim?.status(), failures:[...failures], adapterHealth:health.status()}),
            disposePlayer: () => {
                const media = [...document.querySelectorAll(DOUYU.selectors.media)];
                // Resolve the native owner rather than unmount its outer React
                // tree using the room's different ReactDOM version. The native
                // destroy API unmounts its own root with the matching renderer,
                // resets stream services and clears player event registries.
                const ownerRoot = document.getElementById(DOUYU.ids.owner)
                    ?._reactRootContainer?._internalRoot?.current;
                const queue = ownerRoot ? [ownerRoot] : [], destroyed = new Set();
                let scanned = 0;
                while (queue.length && scanned++ < 2500) {
                    const fiber = queue.pop(), owner = fiber.stateNode, player = DOUYU.runtime.nativeOwner(owner);
                    if (player && typeof player.destroy === 'function' &&
                        player.dom?.id === DOUYU.ids.player && !destroyed.has(player)) {
                        destroyed.add(player);
                        try { player.destroy(); disposedRoots++; } catch { failures.add('dispose:player'); }
                    }
                    if (fiber.sibling) queue.push(fiber.sibling);
                    if (fiber.child) queue.push(fiber.child);
                }
                for (const video of media) {
                    try {
                        video.pause(); video.srcObject=null;
                        video.removeAttribute('src');
                        for (const source of video.querySelectorAll('source')) source.removeAttribute('src');
                        video.load(); releasedMedia++;
                    } catch { failures.add('dispose:media'); }
                }
            },
            stop: ({exiting=false}={}) => {
                stopped=true; clearTimeout(timer); health.stop();
                document.removeEventListener('load', onScriptLoad, true);
                moduleTrim?.stop({exiting});
                for (const restore of rendererRestorers.reverse()) {
                    try { restore(); } catch { failures.add('restore-renderer'); }
                }
                document.removeEventListener('click', onShieldClick, true);
                document.removeEventListener('keydown', onQuickSendKey, true);
                if (senderHost) {
                    try { senderRenderer?.unmountComponentAtNode(senderHost); } catch { failures.add('dispose:sender'); }
                    senderHost.remove(); senderHost=null;
                }
                style?.remove(); adStyle?.remove(); button?.remove();
                for (const el of document.querySelectorAll('[data-dy-clean-path],[data-dy-clean-core]')) {
                    el.removeAttribute('data-dy-clean-path'); el.removeAttribute('data-dy-clean-core');
                }
                root=null; senderRenderer=null; style=null; adStyle=null; button=null;
                renderers.clear(); rendererRestorers.length=0;
                // Component unmounting is irreversible in-place; reload restores
                // the complete site. The visible mode button performs that reload.
            },
        };
    }

    // Startup quality — 首次自动档请求与视频诊断；依赖 endpoints、storageKeys.preload、selectors.videoCase。
    function installStartupQuality() {
        const nativeFetch = window.fetch;
        let handled = false, request = null, firstVideo = null, fetchHookReleased = false;
        // The first-stream loader can consume a cached automatic/4M response
        // before consulting any player preference. Request fresh original quality.
        try { localStorage.removeItem(DOUYU.storageKeys.preload); } catch {}
        const wrappedFetch = function (input, init) {
            let nextInit = init;
            if (!handled && typeof init?.body === 'string' &&
                String(init.method || 'GET').toUpperCase() === 'POST' &&
                (typeof input === 'string' || input instanceof URL)) {
                let url;
                try { url = new URL(input, location.href); } catch {}
                if (url?.origin === location.origin &&
                    DOUYU.endpoints.firstStream.test(url.pathname)) {
                    const match = init.body.match(DOUYU.endpoints.rateField);
                    if (match) {
                        handled = true;
                        const from = match[1];
                        // Clean mode always starts at original quality, whatever automatic
                        // rate or saved preference Douyu chose; later user changes are untouched.
                        if (from !== '0') nextInit = {...init,
                            body:init.body.replace(DOUYU.endpoints.rateReplace,DOUYU.endpoints.originalRateBody)};
                        request = {atMs:Math.round(performance.now()), path:url.pathname, fromRate:from, sentRate:'0'};
                        if (window.fetch === wrappedFetch) window.fetch = nativeFetch;
                        fetchHookReleased = true;
                    }
                }
            }
            return Reflect.apply(nativeFetch, this, nextInit === init ? arguments : [input,nextInit]);
        };
        window.fetch = wrappedFetch;
        function metadata(event) {
            const video = event.target;
            if (video?.tagName !== 'VIDEO' || !video.closest(DOUYU.selectors.videoCase) || !video.videoWidth) return;
            firstVideo = {atMs:Math.round(performance.now()), width:video.videoWidth,height:video.videoHeight};
            for (const type of ['loadedmetadata','loadeddata','resize']) document.removeEventListener(type, metadata, true);
        }
        for (const type of ['loadedmetadata','loadeddata','resize']) document.addEventListener(type, metadata, true);
        return {
            status:()=>({request,firstVideo,fetchHookReleased}),
            stop:()=>{handled=true;fetchHookReleased=true;if(window.fetch===wrappedFetch)window.fetch=nativeFetch;
                for (const type of ['loadedmetadata','loadeddata','resize']) document.removeEventListener(type,metadata,true);},
        };
    }

    // Preload guard — DOM 插入和 head fallback；依赖 endpoints.liveMedia 与 resource gate。
    function createPreloadGuard(optionalResources, guardLivePreload = BROWSER.guardLivePreload) {
        const restorers = [];
        const marked = new WeakSet();
        let blocked = 0;
        let late = 0;
        let active = true;
        let observer;

        // Douyu's web-encrypt first-stream loader appends an anonymous fetch preload
        // for an endless .flv response. WebKit retains that preload's accumulated
        // resource data. The player's separate streaming fetch does not need it.
        // Keep this workaround Safari-only; optional resource hooks serve both engines.
        function isLivePreload(node) {
            if (!node || node.nodeType !== 1 || node.localName !== 'link') return false;
            if (!/(?:^|\s)(?:preload|prefetch)(?:\s|$)/i.test(node.getAttribute('rel') || '')) return false;
            if ((node.getAttribute('as') || '').toLowerCase() !== 'fetch') return false;
            try {
                const url = new URL(node.getAttribute('href') || '', document.baseURI);
                return /^https?:$/.test(url.protocol) && DOUYU.endpoints.liveMedia.test(url.pathname);
            } catch { return false; }
        }

        function neutralize(node) {
            if (!active || !guardLivePreload || !isLivePreload(node)) return;
            // Keep the node and href for the site's bookkeeping; only suppress the
            // resource hint. Do this BEFORE insertion, not after download starts.
            if (!marked.has(node)) {
                marked.add(node);
                blocked++;
                if (node.isConnected) late++;
            }
            node.setAttribute('rel', '');
            node.setAttribute('data-douyu-safari-guard', 'live-preload-blocked');
        }

        function prepare(node) {
            if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) return;
            if (node.nodeType === 1) {
                const kind = node.localName;
                if (kind !== 'script' && kind !== 'iframe' && kind !== 'link') return;
                neutralize(node);
                optionalResources.prepare(node);
                return;
            }
            if (node.nodeType === 11) {
                for (const child of node.querySelectorAll('script[src],iframe[src],link[href]')) { neutralize(child); optionalResources.prepare(child); }
            }
        }

        function wrap(proto, name, allArguments = false) {
            const descriptor = Object.getOwnPropertyDescriptor(proto, name);
            if (!descriptor || typeof descriptor.value !== 'function') return;
            const original = descriptor.value;
            const wrapped = function () {
                const args = arguments;
                if (active) {
                    if (allArguments) { for (let i=0; i<args.length; i++) prepare(args[i]); }
                    else prepare(args[0]);
                }
                return Reflect.apply(original, this, args);
            };
            Object.defineProperty(proto, name, {...descriptor, value: wrapped});
            restorers.push(() => {
                // Never overwrite another extension's subsequently installed hook.
                if (proto[name] === wrapped) Object.defineProperty(proto, name, descriptor);
            });
        }

        wrap(Node.prototype, 'appendChild');
        wrap(Node.prototype, 'insertBefore');
        wrap(Node.prototype, 'replaceChild');
        wrap(Element.prototype, 'append', true);
        wrap(Element.prototype, 'prepend', true);

        // Fallback for markup or later attribute edits. A late hit is exposed in
        // diagnostics: removing an already started preload is not a proven cure.
        function watchHead() {
            if (!active || observer || !document.head) return;
            for (const link of document.head.querySelectorAll('link[as="fetch"]')) neutralize(link);
            observer = new MutationObserver(records => {
                for (const record of records) {
                    if (record.type === 'attributes') neutralize(record.target);
                    else for (const node of record.addedNodes) prepare(node);
                }
            });
            observer.observe(document.head, {childList: true, subtree: true,
                attributes: true, attributeFilter: ['href', 'rel', 'as']});
        }
        watchHead();
        document.addEventListener('DOMContentLoaded', watchHead, {once: true});
        return {
            status: () => ({active, livePreloadGuardEnabled:guardLivePreload, blockedLivePreloads:blocked, latePreloads:late}),
            deactivate: () => { active=false; }, // Stop interception before native/React teardown starts.
            stop(release) {
                active=false;
                release('observer', () => observer?.disconnect()); observer=null;
                document.removeEventListener('DOMContentLoaded', watchHead);
                for (const restore of restorers.reverse()) release('dom-hook', restore);
                restorers.length=0;
            },
        };
    }

    // Analytics sinks — 阻断统计 SDK 前先放置无增长的全局入口；依赖 resourceCategories.analytics。
    // 页面 inline 代码只在全局不存在时创建队列（collectEvent、dataLayer），所以必须早于它们；
    // 晚注入时不替换已有对象，collect-rangers 规则也随之失效，真实 SDK 照常加载。
    function installAnalyticsSinks() {
        const installed = [];
        if (!categoryEnabled('analytics')) return {installed};
        const sink = () => {
            const queue = [];
            Object.defineProperty(queue, 'push', {configurable:true, value:() => 0});
            return queue;
        };
        for (const name of ['_hmt', 'dataLayer']) {
            if (window[name] === undefined) { window[name] = sink(); installed.push(name); }
        }
        if (window.collectEvent === undefined) {
            // Only commands whose callers await a callback need an answer; the
            // values are the SDK's own "no data" results the callers already handle.
            const collectEvent = function (command, ...args) {
                let callback, value;
                if (command === 'getToken') { callback = args[0]; value = {ssid:'', web_id:''}; }
                else if (command === 'getAllVars') { callback = args[0]; value = {}; }
                else if (command === 'getVar') { callback = args[2]; value = args[1]; }
                if (typeof callback === 'function') queueMicrotask(() => callback(value));
            };
            collectEvent.q = sink();
            collectEvent.l = Date.now();
            collectEvent.douyuGuardSink = true;
            window.collectEvent = collectEvent;
            installed.push('collectEvent');
        }
        return {installed};
    }

    // Quality recovery — 晚注入错过首流改写时，播放器就绪后调用一次原生换流到原画；
    // 依赖 storageKeys.ratePreferences、runtime.rateChange/playerStore、ids.player。
    // 只在保存的偏好为原画(0)时行动；用户操作、偏好变化或原生换流出现即让步，不重试。
    function createQualityRecovery() {
        const keys = DOUYU.storageKeys.ratePreferences, [bridgeId, bridgeAction] = DOUYU.runtime.rateChange;
        const userEvents = ['pointerdown', 'keydown'];
        const deadline = performance.now() + 15000, path = location.pathname;
        let timer = null, phase = 'waiting', issued = false, owner = null, original = null, wrapper = null;
        let initial = null, last = null;
        const read = () => keys.map(key => { try { return localStorage.getItem(key); } catch { return null; } });
        function savedOriginal(raw) {
            try {
                const record = JSON.parse(raw);
                return record?.r === 1 && record.e > Date.now() && JSON.parse(record.v) === 0;
            } catch { return false; }
        }
        function finish(reason) {
            if (phase !== 'waiting') return;
            phase = reason;
            clearTimeout(timer); timer = null;
            for (const type of userEvents) document.removeEventListener(type, onUser, true);
            try { if (owner?.handleAcj === wrapper) owner.handleAcj = original; } catch {}
            owner = original = wrapper = null;
        }
        function onUser(event) {
            // Any trusted input yields: missing a recovery is better than
            // overriding a quality the viewer is about to choose.
            if (event.isTrusted) finish('user-input');
        }
        function attachBridge() {
            const player = DOUYU.runtime.player();
            if (owner) return owner === player && player.handleAcj === wrapper;
            if (typeof player?.handleAcj !== 'function') return false;
            owner = player; original = player.handleAcj;
            const native = original;
            wrapper = function (id, action) {
                // Yield to any native stream change (manual menu or the site's own
                // delayed preference restore) instead of issuing a duplicate.
                // finish() unhooks and clears `original`; always forward to `native`.
                if ((id === bridgeId && (action === bridgeAction || action === 'changeLine')) ||
                    (id === 'LoadVideoNet' && /^(?:load|reload|lianmaireload)Video$/.test(action))) finish('native-change');
                return Reflect.apply(native, this, arguments);
            };
            player.handleAcj = wrapper;
            return true;
        }
        function readState() {
            const root = document.getElementById(DOUYU.ids.player)?._reactRootContainer?._internalRoot?.current;
            const queue = root ? [root] : [];
            for (let scanned = 0; queue.length && scanned < 1500; scanned++) {
                const fiber = queue.pop();
                if (fiber.sibling) queue.push(fiber.sibling);
                if (fiber.child) queue.push(fiber.child);
                const state = DOUYU.runtime.playerStore(fiber.stateNode);
                const rates = typeof state?.getIn === 'function' && state.getIn(['app', 'multirates']);
                if (typeof rates?.toJS !== 'function') continue;
                const get = (...path) => state.getIn(path);
                return {rate:get('app','rate'), rates:rates.toJS(), rid:get('app','rid'),
                    ready:get('app','isAllReady'), manual:get('app','manualLoadVideo'),
                    login:get('app','isLogin'), autoplay:get('app','canAutoPlay'), vod:get('app','inVod'),
                    playing:get('videoModule','player','isPlay'), rtc:get('videoModule','player','isRtc')};
            }
            return null;
        }
        function tick() {
            timer = null;
            if (phase !== 'waiting') return;
            try {
                if (location.pathname !== path) return finish('navigation');
                if (performance.now() > deadline) return finish('timeout');
                if (read().some((value, i) => value !== initial[i])) return finish('preference-changed');
                const state = attachBridge() ? readState() : null;
                if (state) {
                    last = {rate:state.rate, ready:state.ready, manual:state.manual};
                    if (state.manual === true) return finish('manual-choice');
                    if (state.rate === 0) return finish('already-original');
                    // Unknown flags are not treated as safe: every gate must be explicit.
                    if (state.ready === true && state.playing === true && state.autoplay === true &&
                        state.login === true && state.manual === false && state.vod === false && state.rtc === false &&
                        typeof state.rate === 'number' && String(state.rid) === String(window.$ROOM?.room_id)) {
                        const target = Array.isArray(state.rates) && state.rates.find(item => item.rate === 0);
                        if (!target || Number(target.diamondFan) === 1) return finish('original-unavailable');
                        const native = original, player = owner;
                        issued = true; finish('issued');
                        // manual:true marks the switch so the site's 5 s restore does not repeat it.
                        Reflect.apply(native, player, [bridgeId, bridgeAction, [{rate:0, manual:true}]]);
                        return;
                    }
                }
            } catch { return finish(issued ? 'native-error' : 'unavailable'); }
            timer = setTimeout(tick, 100);
        }
        // createCleanController() writes the original-quality defaults first, so
        // this reads either that default or a choice the viewer made since.
        initial = read();
        if (!savedOriginal(initial[0])) finish('no-original-preference');
        else {
            for (const type of userEvents) document.addEventListener(type, onUser, true);
            timer = setTimeout(tick, 0);
        }
        return {status:() => ({phase, issued, last:last && {...last}}), stop:() => finish('stopped')};
    }

    // 完整模式只装广告相关部分：资源 gate（仅 ads 分类）、DOM 插入挂钩、广告模块卸载与 CSS。
    const cleanMode = isCleanMode();
    const analytics = installAnalyticsSinks();
    const optionalResources = createOptionalResourceGate();
    const startupQuality = cleanMode ? installStartupQuality() : null;
    let clean;
    try { clean = createCleanController(); } catch {}
    let quality;
    if (cleanMode) try { quality = createQualityRecovery(); } catch {}
    const version = '3.7.0';
    const startedAt = Date.now();
    const preload = createPreloadGuard(optionalResources, cleanMode && BROWSER.guardLivePreload);
    let active = true;
    const cleanupErrors = new Set();
    function stopGuard(exiting = false) {
        if (!active) return;
        active = false;
        preload.deactivate();
        const release = (stage, fn) => { try { fn(); } catch { cleanupErrors.add(stage); } };
        if (exiting) release('player', () => clean?.disposePlayer());
        release('resources', () => optionalResources.stop());
        release('startup', () => startupQuality?.stop());
        release('quality', () => quality?.stop());
        release('clean', () => clean?.stop({exiting}));
        preload.stop(release);
        release('navigation', () => navigation.stop());
    }
    // 离开即销毁播放器属于简洁模式的内存处理；完整模式不改页面生命周期。
    const lifecycle = cleanMode ? installPageLifecycle(() => stopGuard(true)) : {status:() => null, stop() {}};
    const diagnostics = createDiagnostics(() => ({version, mode:cleanMode ? 'clean' : 'full', ...preload.status(), active, startedAt,
        readyStateAtInstall, installedAtMs, browser:{...BROWSER}, lifecycle:lifecycle.status(), cleanupErrors:[...cleanupErrors],
        optionalResources:optionalResources.status(), startupQuality:startupQuality?.status() ?? null,
        qualityRecovery:quality?.status(), analyticsSinks:analytics.installed, clean:clean?.status()}));
    Object.defineProperty(window, '__douyuSafariGuard', {
        configurable: true,
        value: Object.freeze({
            status: diagnostics.status,
            disable: () => {
                lifecycle.stop();
                stopGuard();
                delete window.__douyuSafariGuard;
            },
        }),
    });
})();
