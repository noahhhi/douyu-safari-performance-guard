// ==UserScript==
// @name         Douyu Safari Performance Guard
// @namespace    local.codex.douyu
// @version      3.6.1
// @description  Lean native Douyu player: retain video, danmaku and controls; unload auxiliary modules; default highest quality, all effects off and 1/4-screen danmaku; prevent FLV preload buffering.
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

    // DOUYU ADAPTER CONTRACTS — 网站更新时先维护此区；算法与浏览器挂钩在下面。
    // 查找方法见 docs/maintenance.md。规则只列已经验证的独立业务，默认集合不扩张。
    // 自定义 rules: {host: 字符串或 RegExp, pkg?: 包目录, fileRegex?: 文件名正则,
    // pathnameRegex?: 路径正则, kinds?: ['script','link' 或 'iframe']}。
    // host 必填；省略 pkg 表示不要求 front-publish 路径；默认 kinds 为 script/link。
    const DOUYU = {
        roomPath: /^\/\d+\/?$/, // 地址栏：仅数字房间路径；别名房间仍不纳入。
        resourceHost: /(?:^|\.)douyucdn\.cn$/, // Network：独立静态分包的 CDN 主机后缀。
        packageSegment: 'front-publish', // Network：URL 中包目录的上一层。
        resourceCategories: {
            activity: {enabled:true, packages:[
                'live-act-diamond-carnival-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-activity-common-pendant-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-activity-modules-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-anchor-collect-task-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-coconut-fantasy-island-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-crazy-interstellar-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-desert-relic-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-duel-peak-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-magic-awakening-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-new-anchor-support-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-pandora-box-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-super-fans-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-the-great-voyage-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-water-friends-festival-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-diamond-fans-match-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-tiger-envelope-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-skit-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-task-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
            ]},
            gifts: {enabled:true, packages:[
                'live-activity-gift-hall-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-activity-gift-naming-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-advanced-gift-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-random-effect-gift-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-random-effect-gift-v3-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-random-effect-gift-v4-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-wishing-gift-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'new-revenue-web-front-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-business-component-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-confession-gift-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-recharge-feedback-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
            ]},
            games: {enabled:true, packages:[
                'live-pubg-game-prop-shop-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-game-guess-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-pk-progress-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
            ]},
            community: {enabled:true, packages:[
                'audio-social-web-front-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'yuba-hot-topic-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
            ]},
            admin: {enabled:true, packages:[
                'live-test-get-anchor-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'room-admin-menu-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-account-transactions-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
                'live-anchor-interactive-tool-master', // Network → front-publish 包目录；确认独立业务后按原名维护。
            ]},
            aside: {enabled:true, packages:[]}, // 侧栏视觉分包；名称来自 Network/webpack chunk 映射。
            analytics: {enabled:true, packages:[], rules:[]}, // 预留分类；未验证前不加拦截项。
        },
        asidePackage: 'live-next-player-aside-master', // Network：保留主入口，只阻断下列独立 chunk。
        asideChunks: [ // Network/webpack：侧栏独立 chunk 名；匹配名称后紧跟 `_`，不匹配主入口。
            'NobleReminder', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'ChatRankAll', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'FansRankAll', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'DiamondsFansRankBottom', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'BarrageGroup', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'SvgaConfigEffectContainer', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'YBCommunity', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'DiamondsFansEffect', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'TbActPopup', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'ChatEffect', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'AnchorLevelUp', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'FollowTips', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'WishGiftMsg', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'PrivilegeGift', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'HighEnergyTips', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'FansFeedback', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'StarVoteTips', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'MatchSystemV2Card', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'ProgramBookletTips', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'PopularBarrage', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'MedalDialog', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'MedalPanel', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'MedalDroppingPanel', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'UserGuide', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'UpgradeEffect', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'GuideBarrage', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'HotBarrage', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'BarrageCounter', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
            'UserGameDataPanel', // 侧栏视觉/业务模块；在该包 chunk 映射中复核名称。
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
            'videoEnhanced', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'gameQRCode', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'PKView', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'ActivePK', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'gameHotArea', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'broadcast', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'customBroadcast', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'noticeBarrage', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'yzPkHours', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'warGameUserPanel', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'voiceActUpgrade', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'hitSong', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'voiceActProgress', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'commentRoleHelp', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'gameLightDanmuCheer', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'userPK', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'videoAd', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'userNoHandleAd', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'shelterAd', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'hyad', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'anchorMaiMai', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
            'conMicroPhone', // 原生可选模块；React fiber memoizedProps.id + 连接器订阅确认。
        ], // React player fiber 的 memoizedProps.id；确认只卸载视觉/业务模块，保留原生控制与通信。
        removeIds: [
            'js-header', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-asideMain', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-toolbar', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-bottom-left', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-room-activity', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-room-top-banner', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-asideTopSuspension', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-custom-group', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-video-above', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-guessgame', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-pk-progress', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-dialog', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
            'js-player-for-audio', // 辅助根；Elements 对照独立容器与 React 根，不包含核心播放/通信。
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
        storageKeys: {
            cleanMode: 'douyu-safari-clean-mode', // 本脚本拥有；on/off 与历史版本兼容。
            shield: 'chat-shield-config', // Storage：改一次原生屏蔽设置并对照 JSON envelope。
            preload: 'h5StreamPreload_h5p_room', // Storage/首流加载代码：自动档流缓存。
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
            rateField: /(?:^|&)rate=([^&]*)/, autoRateField: /(^|&)rate=-1(?=&|$)/, // Network：form body 的原生自动档 -1。
            originalRateBody: '$1rate=0', // Network/画质设置：原画/最高档为 0；仅改首个自动档请求。
            liveMedia: /\.flv$/i, // Network：无尽直播 FLV；只阻止 fetch preload，不拦播放器请求。
        },
        runtime: {
            moduleCache: () => window._room_common_?.c, // 页面脚本/webpack runtime：React、ReactDOM、Redux exports 缓存。
            asideApp: () => window.PlayerAsideApp, // 页面脚本：侧栏 DI 容器及原生 ChatSend 组件。
            player: () => window.__player, // 页面脚本：原生 acjCall bridge。
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
            [data-dy-clean-core]>[class^="pendant__"],.DanmuEffectDom,.EffectPlayerDom,.MatchSystemPlayerInteractive,.XinghaiAd,
            #player_h5_adDom,.PIPAdLayer,[data-dy-clean-core] [class^="bg__"],
            [data-dy-clean-core] [class^="broadcastDiv-"],[data-dy-clean-core] [class^="customBc-"],
            [data-dy-clean-core] [class^="aiHighlightEntry-"] { display:none!important; }
            [data-dy-clean-core] [class^="fullScreenSendor-"] { display:flex!important;align-items:center!important;width:clamp(160px,24vw,340px)!important;min-width:0!important;margin-left:12px!important; }
            [data-dy-clean-core] [class^="fullScreenSendor-"] input { flex:1!important;width:0!important;min-width:0!important; }
            [data-dy-clean-core] [class^="fullScreenSendor-"] button { flex:none!important; }
            [data-dy-clean-core] [class^="case__"]:has(#js-player-controlbar:focus-within) { transform:translateY(0)!important; }
            #js-player-controlbar:focus-within [class*="ControlBar-"] { opacity:1!important;visibility:visible!important;display:flex!important; }
        `, // Elements/Styles：所有站点类名前缀和布局关系集中在这里；data-dy-* 为本脚本标记。
    };
    const DISCOVERY_WINDOW_MS = 20000; // 共用现有 tick，不新增定时器/大子树观察器。

    if (window.top !== window.self || !/AppleWebKit/.test(navigator.userAgent) ||
        !/Safari/.test(navigator.userAgent) || /Chrome|Chromium|Edg\//.test(navigator.userAgent)) return;
    const navigation = installRoomNavigationBoundary();
    if (!DOUYU.roomPath.test(location.pathname)) return;
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

    // Resource gate — 加载前拦截独立业务；依赖 resourceCategories/rules/iframes/asideChunks。
    function createOptionalResourceGate() {
        let enabled = true;
        try { enabled = localStorage.getItem(DOUYU.storageKeys.cleanMode) !== 'off'; } catch {}
        const blocked = new Map(), marked = new WeakSet();
        let late = 0;
        // Observed, independent business bundles. Shared bootstrap, sign-in,
        // streaming, codecs, chat transport and the native sender remain intact.
        // Compile categories once; a maintainer can add package/file rules without
        // touching the gate. Category flags are read when the factory is created.
        const rules = [], packages = new Set();
        for (const [category, config] of Object.entries(DOUYU.resourceCategories)) {
            if (!config.enabled) continue;
            for (const pkg of config.packages || []) packages.add(pkg);
            for (const rule of config.rules || []) rules.push(rule);
            if (category === 'aside' && DOUYU.asideChunks.length) {
                const names = DOUYU.asideChunks.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                rules.push({host:DOUYU.resourceHost, pkg:DOUYU.asidePackage,
                    fileRegex:new RegExp('^(?:' + names.join('|') + ')_')});
            }
        }
        for (const rule of [...DOUYU.resourceRules, ...DOUYU.iframes]) {
            if (DOUYU.resourceCategories[rule.category]?.enabled) rules.push(rule);
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
    function createPlayerModuleTrim() {
        // Optional visual/business modules only. Keep playback, chat, authentication,
        // moderation, error handling, media session and every native control.
        const optional = new Set(DOUYU.playerModules);
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
        const started = performance.now(), contracts = {};
        const selectors = Object.entries(DOUYU.selectors), ids = Object.entries(DOUYU.ids);
        let observationClosed = false, stopped = false;
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
                        // The native sender is a clean-mode replacement service.
                        const applicable = enabled || name !== 'senderInput';
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
                record('playerModuleHooks', clean.playerModuleHooks > 0, enabled);
                record('nativeSender', clean.nativeSender, enabled, clean.senderFailed);
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
        let enabled = true;
        try { enabled = localStorage.getItem(modeKey) !== 'off'; } catch {}
        const moduleTrim = enabled ? createPlayerModuleTrim() : null;
        const discoveryStartedAt = performance.now();
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
        setStartupDefaults();
        let stopped = false, root, style, button, timer, attempts = 0;
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
            if (defaultsApplied || !document.querySelector(DOUYU.selectors.controlbar)) return;
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
            if (enabled && typeof DOUYU.runtime.player()?.acjCall === 'function' && attempts % 8 === 0) {
                const config = Object.fromEntries(Object.values(shieldKeys).map(key => [key, 1]));
                DOUYU.runtime.player().acjCall(DOUYU.controls.shieldEvent, config);
            } else if (!enabled && attempts > 12 && attempts % 8 === 0) {
                const unchecked = items.find(item => !item.querySelector(DOUYU.selectors.checked));
                if (unchecked) unchecked.click();
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
        function setupButton() {
            if (button?.isConnected || !document.body || !document.querySelector(DOUYU.selectors.videoCase)) return;
            button=document.createElement('button'); button.id='douyu-clean-toggle'; button.type='button';
            button.textContent = enabled ? '恢复完整页面' : '开启纯净模式';
            button.title = '切换后重新载入；最高画质、特效屏蔽和 1/4 屏弹幕为默认设置。';
            button.style.cssText='position:fixed;right:12px;top:12px;z-index:2147483000;border:1px solid #ffffff44;border-radius:4px;padding:5px 8px;background:#222b;color:#ddd;font:12px system-ui;cursor:pointer;opacity:.5;';
            button.addEventListener('click', () => {
                try { localStorage.setItem(modeKey, enabled ? 'off' : 'on'); } catch {}
                location.reload();
            });
            document.body.append(button);
        }
        function tick() {
            if (stopped) return;
            if (enabled) {
                if (!renderers.size) installRendererHooks();
                unmountAuxiliary();
                setupLayout();
                setupNativeSender();
                if (performance.now() - discoveryStartedAt <= DISCOVERY_WINDOW_MS) moduleTrim?.discover();
            }
            applyNativeControls(); setupButton();
            health.observe(enabled, {rendererHooks:renderers.size, playerModuleHooks:moduleTrim?.hookCount(),
                nativeSender:!!senderHost?.isConnected, senderFailed:failures.has('native-sender')});
            // Preserve the existing 250 ms / 2 s cadence. Module discovery ends
            // after the startup window; layout, controls and sender checks continue
            // without video-frame polling or additional mutation observers.
            attempts++;
            timer=setTimeout(tick, attempts < 80 && (!renderers.size || !defaultsApplied) ? 250 : 2000);
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
                style?.remove(); button?.remove();
                for (const el of document.querySelectorAll('[data-dy-clean-path],[data-dy-clean-core]')) {
                    el.removeAttribute('data-dy-clean-path'); el.removeAttribute('data-dy-clean-core');
                }
                root=null; senderRenderer=null; style=null; button=null;
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
                        // Only the automatic first request needs rewriting. Respect
                        // explicitly selected rates and all subsequent user changes.
                        if (from === '-1') nextInit = {...init,
                            body:init.body.replace(DOUYU.endpoints.autoRateField,DOUYU.endpoints.originalRateBody)};
                        request = {atMs:Math.round(performance.now()), path:url.pathname,
                            fromRate:from, sentRate:from === '-1' ? '0' : from};
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
    function createPreloadGuard(optionalResources) {
        const restorers = [];
        const marked = new WeakSet();
        let blocked = 0;
        let late = 0;
        let active = true;
        let observer;

        // Douyu's web-encrypt first-stream loader appends an anonymous fetch preload
        // for an endless .flv response. WebKit retains that preload's accumulated
        // resource data. The player's separate streaming fetch does not need it.
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
            if (!active || !isLivePreload(node)) return;
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
            status: () => ({active, blockedLivePreloads:blocked, latePreloads:late}),
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

    const optionalResources = createOptionalResourceGate();
    const startupQuality = installStartupQuality();
    let clean;
    try { clean = createCleanController(); } catch {}
    const version = '3.6.1';
    const startedAt = Date.now();
    const preload = createPreloadGuard(optionalResources);
    let active = true;
    const cleanupErrors = new Set();
    function stopGuard(exiting = false) {
        if (!active) return;
        active = false;
        preload.deactivate();
        const release = (stage, fn) => { try { fn(); } catch { cleanupErrors.add(stage); } };
        if (exiting) release('player', () => clean?.disposePlayer());
        release('resources', () => optionalResources.stop());
        release('startup', () => startupQuality.stop());
        release('clean', () => clean?.stop({exiting}));
        preload.stop(release);
        release('navigation', () => navigation.stop());
    }
    const lifecycle = installPageLifecycle(() => stopGuard(true));
    const diagnostics = createDiagnostics(() => ({version, ...preload.status(), active, startedAt,
        readyStateAtInstall, lifecycle:lifecycle.status(), cleanupErrors:[...cleanupErrors],
        optionalResources:optionalResources.status(), startupQuality:startupQuality.status(), clean:clean?.status()}));
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
    const readyStateAtInstall = document.readyState;
})();
