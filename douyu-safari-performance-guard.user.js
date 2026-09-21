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
    if (window.top !== window.self || !/AppleWebKit/.test(navigator.userAgent) ||
        !/Safari/.test(navigator.userAgent) || /Chrome|Chromium|Edg\//.test(navigator.userAgent)) return;
    const navigation = installRoomNavigationBoundary();
    if (!/^\/\d+\/?$/.test(location.pathname)) return;
    if (window.__douyuSafariGuard) return;


    function installRoomNavigationBoundary() {
        if (window.__douyuRoomNavigation) return window.__douyuRoomNavigation;
        const room = path => /^\/\d+\/?$/.test(path);
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

    function createOptionalResourceGate() {
        let enabled = true;
        try { enabled = localStorage.getItem('douyu-safari-clean-mode') !== 'off'; } catch {}
        const blocked = new Map(), marked = new WeakSet();
        let late = 0;
        // Observed, independent business bundles. Shared bootstrap, sign-in,
        // streaming, codecs, chat transport and the native sender remain intact.
        const packages = new Set([
            'audio-social-web-front-master', 'yuba-hot-topic-master',
            'live-act-diamond-carnival-master', 'live-activity-common-pendant-master',
            'live-activity-gift-hall-master', 'live-activity-gift-naming-master',
            'live-activity-modules-master', 'live-advanced-gift-master',
            'live-anchor-collect-task-master', 'live-coconut-fantasy-island-master',
            'live-crazy-interstellar-master', 'live-desert-relic-master',
            'live-duel-peak-master', 'live-magic-awakening-master',
            'live-new-anchor-support-master', 'live-pandora-box-master',
            'live-pubg-game-prop-shop-master', 'live-random-effect-gift-master',
            'live-random-effect-gift-v3-master', 'live-random-effect-gift-v4-master',
            'live-super-fans-master', 'live-the-great-voyage-master',
            'live-water-friends-festival-master', 'live-wishing-gift-master',
            'new-revenue-web-front-master', 'live-business-component-master',
            'live-confession-gift-master', 'live-diamond-fans-match-master',
            'live-test-get-anchor-master', 'live-tiger-envelope-master',
            'room-admin-menu-master', 'live-game-guess-master', 'live-pk-progress-master',
            'live-recharge-feedback-master', 'live-skit-master', 'live-task-master',
            'live-account-transactions-master', 'live-anchor-interactive-tool-master',
        ]);
        const asideChunks = /^(?:NobleReminder|ChatRankAll|FansRankAll|DiamondsFansRankBottom|BarrageGroup|SvgaConfigEffectContainer|YBCommunity|DiamondsFansEffect|TbActPopup|ChatEffect|AnchorLevelUp|FollowTips|WishGiftMsg|PrivilegeGift|HighEnergyTips|FansFeedback|StarVoteTips|MatchSystemV2Card|ProgramBookletTips|PopularBarrage|MedalDialog|MedalPanel|MedalDroppingPanel|UserGuide|UpgradeEffect|GuideBarrage|HotBarrage|BarrageCounter|UserGameDataPanel)_/;
        function optionalURL(value, kind) {
            let u;
            try { u = new URL(value, location.href); } catch { return false; }
            if (kind === 'iframe') return (u.hostname === 'www.douyu.com' && u.pathname === '/pages/ord-task-center') ||
                (u.hostname === 'msg.douyu.com' && u.pathname === '/web/index.html') ||
                (u.hostname === 'game.weixin.qq.com' && u.pathname.endsWith('/wxgamesdkframe.html'));
            if (u.hostname === 'game.weixin.qq.com' && u.pathname.endsWith('/wxgamesdk.js')) return true;
            if (!/(?:^|\.)douyucdn\.cn$/.test(u.hostname)) return false;
            const parts = u.pathname.split('/'), at = parts.indexOf('front-publish');
            if (at < 0) return false;
            const pkg = parts[at+1], file = parts.at(-1);
            return packages.has(pkg) || (pkg === 'live-next-player-aside-master' && asideChunks.test(file));
        }
        function prepare(node) {
            if (!enabled || !node || node.nodeType !== 1 || marked.has(node)) return;
            const kind=node.localName, attr=kind==='link'?'href':'src';
            if (!['script','iframe','link'].includes(kind)) return;
            const value=node.getAttribute(attr);
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

    function createPlayerModuleTrim() {
        // Optional visual/business modules only. Keep playback, chat, authentication,
        // moderation, error handling, media session and every native control.
        const optional = new Set([
            'videoEnhanced', 'gameQRCode', 'PKView', 'ActivePK', 'gameHotArea',
            'broadcast', 'customBroadcast', 'noticeBarrage', 'yzPkHours',
            'warGameUserPanel', 'voiceActUpgrade', 'hitSong', 'voiceActProgress',
            'commentRoleHelp', 'gameLightDanmuCheer', 'userPK',
            'videoAd', 'userNoHandleAd', 'shelterAd', 'hyad',
            'anchorMaiMai', 'conMicroPhone',
        ]);
        const hooks = new Map(), seen = new Set(), errors = new Set();
        let enabled = true, stopped = false, visits = 0;
        function visit() {
            const current = document.getElementById('room-html5-player')
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
                if (optional.has(props?.id) && instance?.unsubscribeListener &&
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
            const current = document.getElementById('room-html5-player')
                ?._reactRootContainer?._internalRoot?.current;
            const queue = current ? [current] : [];
            let scanned = 0;
            while (queue.length && scanned++ < 2500) {
                const fiber = queue.pop(), instance = fiber.stateNode;
                if (optional.has(fiber.memoizedProps?.id) && instance?.unsubscribeListener) {
                    try { instance.forceUpdate(); } catch { errors.add(instance.props.id); }
                }
                if (fiber.sibling) queue.push(fiber.sibling);
                if (fiber.child) queue.push(fiber.child);
            }
        }
        return {
            discover: () => !stopped && visit(),
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

    function createCleanController() {
        const modeKey = 'douyu-safari-clean-mode';
        let enabled = true;
        try { enabled = localStorage.getItem(modeKey) !== 'off'; } catch {}
        const moduleTrim = enabled ? createPlayerModuleTrim() : null;
        let moduleTrimReady = false;
        const removeIds = new Set([
            'js-header', 'js-player-asideMain', 'js-player-toolbar', 'js-bottom-left',
            'js-room-activity', 'js-room-top-banner', 'js-player-asideTopSuspension',
            'js-custom-group', 'js-player-video-above', 'js-player-guessgame',
            'js-pk-progress', 'js-player-dialog', 'js-player-for-audio',
        ]);
        const defaults = {
            player_storage_danmu_Model_h5p_room: 4, // Douyu's native 1/4-screen enum.
            player_storage_rate_h5p_room: 0,        // Native original/highest stream.
            realRateModel_h5p_room: 0,
            realRateModel2_h5p_room: 0,
        };
        function writeNative(key, value) {
            let record;
            try { record = JSON.parse(localStorage.getItem(key)); } catch {}
            if (!record || typeof record !== 'object') record = {};
            localStorage.setItem(key, JSON.stringify({...record, c: Date.now(),
                e: 253402300799000, v: JSON.stringify(value), r: 1}));
        }
        function setStartupDefaults() {
            try {
                for (const [key, value] of Object.entries(defaults)) writeNative(key, value);
                let config = {};
                try {
                    let value = JSON.parse(localStorage.getItem('chat-shield-config')).v;
                    for (let i=0; i<3 && typeof value === 'string'; i++) value = JSON.parse(value);
                    if (value && typeof value === 'object') config = value;
                } catch {}
                for (const key of ['allGift','message','videoBroadcast','smallgift',
                    'userEnter','dianzan','audioGift','barrageSkin']) config[key] = 1;
                // The site's chat setting stores a JSON string inside its storage envelope.
                writeNative('chat-shield-config', JSON.stringify(config));
            } catch {}
        }
        setStartupDefaults();
        let stopped = false, root, style, button, timer, attempts = 0;
        let unmounted = 0, suppressedRenders = 0, defaultsApplied = false;
        let disposedRoots = 0, releasedMedia = 0;
        let senderHost, senderRenderer;
        const rendererRestorers = [], renderers = new Set();
        const failures = new Set();
        const css = `
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
        `;
        function targetIsAuxiliary(container) {
            return container?.nodeType === 1 && removeIds.has(container.id);
        }
        function installRendererHooks() {
            const cache = window._room_common_?.c;
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
        const shieldKeys = {'屏蔽全部礼物':'allGift','屏蔽消息通知':'message',
            '屏蔽视频广播':'videoBroadcast','屏蔽小礼物':'smallGift',
            '屏蔽进场特效':'userEnter','屏蔽礼物音效':'audioGift','屏蔽弹幕皮肤':'barrageSkin'};
        function onShieldClick(event) {
            if (!enabled || typeof window.__player?.acjCall !== 'function') return;
            const item = event.target?.closest?.('[class^="shieldSettingItem-"]');
            if (!item?.closest('#js-player-controlbar')) return;
            const items = [...item.parentElement.querySelectorAll('[class^="shieldSettingItem-"]')];
            if (!items.length || items.some(el => !shieldKeys[el.textContent.trim()])) return;
            const data = {};
            for (const el of items) {
                const selected = !!el.querySelector('[class^="checked-"]');
                data[shieldKeys[el.textContent.trim()]] = +(el === item ? !selected : selected);
            }
            // Replace only the shield request/reply service owned by the removed
            // sidebar. Native subscribers still implement actual effect filtering.
            event.preventDefault(); event.stopPropagation();
            window.__player.acjCall('js_shieldEffects', data);
            const persisted = {...data, smallgift: data.smallGift, dianzan: 1};
            delete persisted.smallGift;
            try { writeNative('chat-shield-config', JSON.stringify(persisted)); } catch {}
        }
        document.addEventListener('click', onShieldClick, true);
        function applyNativeControls() {
            if (defaultsApplied || !document.querySelector('#js-player-controlbar')) return;
            const items = [...document.querySelectorAll('[class^="shieldSettingItem-"]')];
            const quarter = [...document.querySelectorAll('[class^="iconLabel-"]')].find(e => e.textContent === '1/4屏');
            if (items.length < 7 || !quarter) return;
            const checked = items.every(item => item.querySelector('[class^="checked-"]'));
            const quarterSelected = quarter.parentElement.style.backgroundImage.includes('quarterscreen_select');
            if (checked && quarterSelected) {
                defaultsApplied = true; return;
            }
            // Initialize the same native player event without mounting the sidebar.
            if (!quarterSelected) quarter.parentElement.click();
            if (enabled && typeof window.__player?.acjCall === 'function' && attempts % 8 === 0) {
                const config = Object.fromEntries(Object.values(shieldKeys).map(key => [key, 1]));
                window.__player.acjCall('js_shieldEffects', config);
            } else if (!enabled && attempts > 12 && attempts % 8 === 0) {
                const unchecked = items.find(item => !item.querySelector('[class^="checked-"]'));
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
            if (senderHost?.isConnected || !document.body || !window.PlayerAsideApp) return;
            try {
                const app = window.PlayerAsideApp;
                const aside = document.getElementById('js-player-asideMain');
                // The suppressed hydration leaves server HTML behind. Remove its
                // duplicate ChatSend fields before the native sender queries DOM.
                if (aside && !aside._reactRootContainer) aside.replaceChildren();
                const component = app.container.get('component')?.WrappedComponent;
                if (!component?.prototype?.render) return;
                // Read element descriptions only: do not mount the sidebar or run
                // its constructor/lifecycle. Select just the native send component.
                const tree = component.prototype.render.call({props:{}, getRoomSkinStyle:()=>({})});
                const chat = findElement(tree, e => e.props?.className === 'layout-Player-chat')?.props.children;
                if (typeof chat?.type !== 'function') return;
                const speak = findElement(chat.type({}), e => e.props?.className === 'Chat-speak');
                const speakClass = speak?.type?.WrappedComponent;
                if (!speakClass?.prototype?.render) return;
                const sendTree = speakClass.prototype.render.call({props:{},state:{}});
                const send = findElement(sendTree, e => typeof e.type?.WrappedComponent?.prototype?.enterSend === 'function');
                if (!send) return;
                const exports = Object.values(window._room_common_?.c || {}).map(m => m.exports);
                const react = exports.find(e => e?.createElement && e?.useState);
                const redux = exports.find(e => e?.Provider && e?.ReactReduxContext && e?.connect);
                const dom = [...renderers][0];
                if (!react || !redux || !dom) return;
                senderHost = document.createElement('div'); senderHost.id='douyu-clean-send-service';
                senderHost.hidden=true; document.body.append(senderHost);
                dom.render(react.createElement(redux.Provider,{store:app.container.get('store')},
                    react.createElement(send.type)),senderHost);
                senderRenderer=dom;
            } catch { failures.add('native-sender'); senderHost?.remove(); senderHost=null; }
        }
        function onQuickSendKey(event) {
            if (!enabled || event.key !== 'Enter') return;
            const input = document.querySelector('#js-player-controlbar [class^="fullScreenSendor-"] input');
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
            const candidate = document.getElementById('js-player-video-case')?.parentElement;
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
            if (button?.isConnected || !document.body || !document.querySelector('#js-player-video-case')) return;
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
                if (!moduleTrimReady) moduleTrimReady = !!moduleTrim?.discover();
            }
            applyNativeControls(); setupButton();
            // Fast, bounded startup discovery; once ready, no video-frame or DOM
            // mutation polling. A 2 s check handles native modules arriving later
            // and room navigation while keeping only the current root reference.
            attempts++;
            timer=setTimeout(tick, attempts < 80 && (!renderers.size || !defaultsApplied) ? 250 : 2000);
        }
        tick();
        return {
            status: () => ({enabled, attached:!!root?.isConnected, rendererHooks:renderers.size,
                unmounted, suppressedRenders, defaultsApplied, disposedRoots, releasedMedia, nativeSender:!!senderHost?.isConnected, playerModules:moduleTrim?.status(), failures:[...failures]}),
            disposePlayer: () => {
                const media = [...document.querySelectorAll('#js-player-video-case video,#js-player-video-case audio')];
                // Resolve the native owner rather than unmount its outer React
                // tree using the room's different ReactDOM version. The native
                // destroy API unmounts its own root with the matching renderer,
                // resets stream services and clears player event registries.
                const ownerRoot = document.getElementById('js-player-video-widgets')
                    ?._reactRootContainer?._internalRoot?.current;
                const queue = ownerRoot ? [ownerRoot] : [], destroyed = new Set();
                let scanned = 0;
                while (queue.length && scanned++ < 2500) {
                    const fiber = queue.pop(), owner = fiber.stateNode, player = owner?.player;
                    if (player && typeof player.destroy === 'function' &&
                        player.dom?.id === 'room-html5-player' && !destroyed.has(player)) {
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
                stopped=true; clearTimeout(timer);
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

    function installStartupQuality() {
        const nativeFetch = window.fetch;
        let handled = false, request = null, firstVideo = null, fetchHookReleased = false;
        // The first-stream loader can consume a cached automatic/4M response
        // before consulting any player preference. Request fresh original quality.
        try { localStorage.removeItem('h5StreamPreload_h5p_room'); } catch {}
        const wrappedFetch = function (input, init) {
            let nextInit = init;
            if (!handled && typeof init?.body === 'string' &&
                String(init.method || 'GET').toUpperCase() === 'POST' &&
                (typeof input === 'string' || input instanceof URL)) {
                let url;
                try { url = new URL(input, location.href); } catch {}
                if (url?.origin === location.origin &&
                    /^\/(?:lapi\/live\/getH5PlayV1|gapi\/live\/web\/super\/stream\/v1)\/\d+$/.test(url.pathname)) {
                    const match = init.body.match(/(?:^|&)rate=([^&]*)/);
                    if (match) {
                        handled = true;
                        const from = match[1];
                        // Only the automatic first request needs rewriting. Respect
                        // explicitly selected rates and all subsequent user changes.
                        if (from === '-1') nextInit = {...init,
                            body:init.body.replace(/(^|&)rate=-1(?=&|$)/,'$1rate=0')};
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
            if (video?.tagName !== 'VIDEO' || !video.closest('#js-player-video-case') || !video.videoWidth) return;
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

    const optionalResources = createOptionalResourceGate();
    const startupQuality = installStartupQuality();
    let clean;
    try { clean = createCleanController(); } catch {}
    const version = '3.6.1';
    const startedAt = Date.now();
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
            return /^https?:$/.test(url.protocol) && /\.flv$/i.test(url.pathname);
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
        if (!node || typeof node !== 'object') return;
        neutralize(node);
        optionalResources.prepare(node);
        if (node.nodeType === 11) {
            for (const child of node.querySelectorAll('script[src],iframe[src],link[href]')) { neutralize(child); optionalResources.prepare(child); }
        }
    }

    function wrap(proto, name, positions) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (!descriptor || typeof descriptor.value !== 'function') return;
        const original = descriptor.value;
        const wrapped = function (...args) {
            if (active) {
                for (const index of positions(args)) prepare(args[index]);
            }
            return Reflect.apply(original, this, args);
        };
        Object.defineProperty(proto, name, {...descriptor, value: wrapped});
        restorers.push(() => {
            // Never overwrite another extension's subsequently installed hook.
            if (proto[name] === wrapped) Object.defineProperty(proto, name, descriptor);
        });
    }

    wrap(Node.prototype, 'appendChild', () => [0]);
    wrap(Node.prototype, 'insertBefore', () => [0]);
    wrap(Node.prototype, 'replaceChild', () => [0]);
    wrap(Element.prototype, 'append', args => args.map((_, i) => i));
    wrap(Element.prototype, 'prepend', args => args.map((_, i) => i));

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

    const cleanupErrors = new Set();
    function stopGuard(exiting = false) {
        if (!active) return;
        active = false;
        const release = (stage, fn) => { try { fn(); } catch { cleanupErrors.add(stage); } };
        if (exiting) release('player', () => clean?.disposePlayer());
        release('resources', () => optionalResources.stop());
        release('startup', () => startupQuality.stop());
        release('clean', () => clean?.stop({exiting}));
        release('observer', () => observer?.disconnect()); observer=null;
        document.removeEventListener('DOMContentLoaded', watchHead);
        for (const restore of restorers.reverse()) release('dom-hook', restore);
        restorers.length=0;
        release('navigation', () => navigation.stop());
    }
    const lifecycle = installPageLifecycle(() => stopGuard(true));
    Object.defineProperty(window, '__douyuSafariGuard', {
        configurable: true,
        value: Object.freeze({
            status: () => ({version, active, blockedLivePreloads: blocked,
                latePreloads: late, startedAt, readyStateAtInstall, lifecycle:lifecycle.status(), cleanupErrors:[...cleanupErrors], optionalResources:optionalResources.status(), startupQuality:startupQuality.status(), clean: clean?.status()}),
            disable: () => {
                lifecycle.stop();
                stopGuard();
                delete window.__douyuSafariGuard;
            },
        }),
    });
    const readyStateAtInstall = document.readyState;
})();
