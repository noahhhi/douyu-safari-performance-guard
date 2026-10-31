const assert = require('node:assert/strict');
const vm = require('node:vm');
const {load, source} = require('./harness.cjs');
// Full mode removes ads and P2P: quality, preferences and normal navigation remain native.
function run(mode, extra={}) {
    const storage = new Map(mode ? [['douyu-safari-clean-mode', mode]] : []), writes = [], listeners = [];
    const timers = new Map(), calls = []; let nextTimer = 0;
    class Node {appendChild(node){return node;} insertBefore(node){return node;} replaceChild(node){return node;}}
    class Element extends Node {append(){} prepend(){}}
    const appendChild = Node.prototype.appendChild;
    const fetch = (...args) => {calls.push(args);return Promise.resolve({json:()=>Promise.resolve({error:0,data:{p2p:1,h265_p2p:1}})});}, pushState = () => {}, replaceState = () => {};
    const window = {addEventListener:type=>listeners.push(type), removeEventListener(){}, fetch};
    window.top = window.self = window;
    const context = {URL, Node, Element, window, navigator:{userAgent:'AppleWebKit Safari'},
        history:{pushState, replaceState}, performance:{now:()=>0},
        location:{href:'https://www.douyu.com/93589', pathname:'/93589', origin:'https://www.douyu.com', reload(){}},
        document:{body:null, head:null, readyState:'loading', baseURI:'https://www.douyu.com/93589',
            getElementById:()=>null, querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){}, removeEventListener(){}},
        localStorage:{getItem:k=>storage.get(k) ?? null, setItem:(k,v)=>{writes.push(k);storage.set(k,v);}, removeItem:k=>writes.push('-'+k)},
        setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;}, clearTimeout:id=>timers.delete(id),
        queueMicrotask:()=>{}, ...extra};
    vm.runInNewContext(source, context);
    return {api:window.__douyuSafariGuard, window, context, writes, listeners, fetch, pushState, replaceState, appendChild, calls, timers};
}
(async () => {
{
    const full = run('off'), status = full.api.status();
    assert.equal(status.mode, 'full');
    assert.deepEqual(full.writes, [], 'no player/quality/danmaku preference writes');
    assert.notEqual(full.window.fetch, full.fetch, 'full mode installs P2P response clearing');
    for (const body of ['rate=4&cdn=manual', 'rate=-1', 'other=1']) {
        const init={method:'POST',body};
        const response=await full.window.fetch('/lapi/live/getH5PlayV1/93589',init);
        assert.equal(full.calls.at(-1)[1],init,'full mode passes the original init through');
        assert.equal(init.body,body,'no rate rewrite');
        assert.deepEqual(await response.json(),{error:0,data:{p2p:0,h265_p2p:0}},'full mode clears P2P fields');
    }
    const other=await full.window.fetch('/other/path',{method:'POST',body:'rate=4'});
    assert.deepEqual(await other.json(),{error:0,data:{p2p:1,h265_p2p:1}},'non-stream responses stay native');
    assert.deepEqual(full.writes, [], 'full mode never writes or removes localStorage while handling streams');
    assert.equal(full.api.status().startupQuality.request,null);
    assert.equal(full.api.status().startupQuality.p2pCleared,3);
    assert.equal(full.context.history.pushState, full.pushState, 'no navigation boundary');
    assert.equal(full.window.__douyuRoomNavigation, undefined);
    assert.ok(!full.listeners.includes('pagehide'), 'no exit disposal');
    assert.equal(status.startupQuality.request, null);
    assert.equal(status.startupQuality.p2pCleared, 0);
    assert.equal(status.qualityRecovery, undefined);
    assert.equal(status.livePreloadGuardEnabled, true, 'full mode also neutralises Safari live FLV preloads');
    assert.equal(status.analyticsSinks.length, 0);
    assert.equal(full.window._hmt, undefined);
    assert.equal(status.clean.enabled, false);
    full.api.disable();
}
{
    const clean = run(null), status = clean.api.status();
    assert.equal(status.mode, 'clean', 'clean mode is the default');
    assert.ok(clean.writes.includes('realRateModel2_h5p_room'), 'clean mode applies startup defaults');
    assert.ok(clean.writes.includes('-h5StreamPreload_h5p_room'), 'clean mode removes the stream preload cache');
    assert.notEqual(clean.window.fetch, clean.fetch);
    assert.ok(clean.listeners.includes('pagehide'));
    assert.equal(status.livePreloadGuardEnabled, true);
    clean.api.disable();
}
// Chromium keeps its native FLV preload in both modes.
for (const mode of ['off', null]) {
    const h = run(mode, {navigator:{userAgent:'Mozilla/5.0 AppleWebKit/537.36 Chrome/156.0.0.0 Safari/537.36'}});
    assert.equal(h.api.status().livePreloadGuardEnabled, false);
    h.api.disable();
}
// Directory entry: full mode follows native SPA routing; clean mode keeps the reload boundary.
for (const mode of ['off', null]) {
    const h = run(mode, {location:{href:'https://www.douyu.com/directory', pathname:'/directory', origin:'https://www.douyu.com', reload(){}}});
    if (mode === 'off') {
        assert.equal(h.api.status().mode, 'full');
        assert.equal(h.context.history.pushState, h.pushState);
        assert.equal(h.context.history.replaceState, h.replaceState);
        assert.equal(h.window.__douyuRoomNavigation, undefined);
        assert.deepEqual(h.listeners, [], 'no navigation or lifecycle listeners');
        assert.deepEqual(h.writes, []);
        assert.notEqual(h.window.fetch, h.fetch, 'P2P hook covers later SPA room entry');
        assert.notEqual(h.context.Node.prototype.appendChild, h.appendChild, 'ads and Safari preload DOM insertion hook installed');
        assert.equal(h.api.status().livePreloadGuardEnabled, true);
        const append = h.context.Node.prototype.appendChild, timerCount = h.timers.size;
        vm.runInNewContext(source, h.context);
        assert.equal(h.window.__douyuSafariGuard, h.api, 'SPA guard remains a single instance');
        assert.equal(h.context.Node.prototype.appendChild, append);
        assert.equal(h.timers.size, timerCount);
        h.api.disable();
    } else {
        assert.equal(h.api, undefined);
        assert.notEqual(h.context.history.pushState, h.pushState);
        assert.notEqual(h.context.history.replaceState, h.replaceState);
        assert.ok(h.listeners.includes('popstate'));
        assert.ok(h.window.__douyuRoomNavigation);
        assert.deepEqual(h.writes, []);
        assert.equal(h.context.Node.prototype.appendChild, h.appendChild);
        h.window.__douyuRoomNavigation.stop();
    }
}
// First-stream rewrite: preserve an already-original init and never match bitrate as rate.
for (const body of ['rate=0', 'bitrate=4&rate=2']) {
    const h = run(null), init = {method:'POST', body, credentials:'include'};
    const response=await h.window.fetch('/lapi/live/getH5PlayV1/93589', init);
    assert.deepEqual(await response.json(),{error:0,data:{p2p:0,h265_p2p:0}});
    const sent = h.calls.at(-1)[1];
    if (body === 'rate=0') assert.equal(sent, init, 'first original request passes through the same init');
    else {
        assert.notEqual(sent, init);
        assert.equal(sent.body, 'bitrate=4&rate=0');
        assert.equal(sent.credentials, 'include');
    }
    assert.equal(init.body, body);
    assert.notEqual(h.window.fetch, h.fetch, 'fetch hook stays installed for later stream responses');
    assert.equal(h.api.status().startupQuality.fetchHookReleased, false);
    assert.equal(h.api.status().startupQuality.p2pCleared, 1);
    h.api.disable();
    assert.equal(h.window.fetch, h.fetch, 'disable restores the native fetch');
    assert.equal(h.api.status().startupQuality.fetchHookReleased, true);
}
// Unsupported functional selectors must not invalidate the simple ads rule.
{
    const {DOUYU} = load(), rules = DOUYU.adCSS.trim().split('}').filter(rule=>rule.trim());
    assert.equal(rules.length, 3);
    assert.ok(!/:has\(|:is\(/.test(rules[0]));
    assert.ok(rules[0].includes('.SignBaseComponent-sign-ad') && rules[0].includes('.DiamondCommonRoomPush'));
    assert.ok(rules[1].includes('.RoomText-wrap:has(.RoomText-item--link[data-dysign])'));
    assert.ok(rules[2].includes('#js-player-main :is([class^="activeContainer__"],[class*=" activeContainer__"])'));
    assert.ok(!DOUYU.adCSS.includes('.PIPAdLayer'));
}
// Module sets: ads in both modes, every other optional module only in clean mode.
{
    function trimmed(mode) {
        const ids = ['hyad','recommendAD','videoAd','shelterAd','hitSong','comment','controller'];
        let fiber = null;
        const instances = ids.map(id => {
            class Connector {constructor(){this.props={id};this.unsubscribeListener=()=>{};} render(){return 'native';} forceUpdate(){}}
            const instance = new Connector();
            fiber = {memoizedProps:{id}, stateNode:instance, sibling:fiber};
            return instance;
        });
        const storage = new Map(mode ? [['douyu-safari-clean-mode', mode]] : []);
        const c = load({URL, window:{addEventListener(){},removeEventListener(){}}, performance:{now:()=>0},
            document:{body:null, head:null, getElementById:id=>id==='room-html5-player'?{_reactRootContainer:{_internalRoot:{current:fiber}}}:null,
                querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){}, removeEventListener(){}},
            localStorage:{getItem:k=>storage.get(k) ?? null, setItem(){}}, setTimeout:()=>1, clearTimeout(){}, queueMicrotask(){}});
        const controller = c.createCleanController();
        const result = Object.fromEntries(ids.map((id, i) => [id, instances[i].render() === null]));
        controller.stop();
        return result;
    }
    assert.deepEqual(trimmed('off'), {hyad:true, recommendAD:true, videoAd:false, shelterAd:false, hitSong:false, comment:false, controller:false});
    assert.deepEqual(trimmed(null), {hyad:true, recommendAD:true, videoAd:true, shelterAd:true, hitSong:true, comment:false, controller:false});
}
console.log('Clean/full modes: both clear P2P; full mode leaves quality, navigation, lifecycle and preferences alone: passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
