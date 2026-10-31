const assert = require('node:assert/strict');
const vm = require('node:vm');
const {load, source} = require('./harness.cjs');
// Full mode removes ads only: run the whole userscript and check it leaves every other page behaviour alone.
function run(mode, extra={}) {
    const storage = new Map(mode ? [['douyu-safari-clean-mode', mode]] : []), writes = [], listeners = [];
    const timers = new Map(); let nextTimer = 0;
    class Node {appendChild(node){return node;} insertBefore(node){return node;} replaceChild(node){return node;}}
    class Element extends Node {append(){} prepend(){}}
    const fetch = () => {}, pushState = () => {}, replaceState = () => {};
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
    return {api:window.__douyuSafariGuard, window, context, writes, listeners, fetch, pushState};
}
{
    const full = run('off'), status = full.api.status();
    assert.equal(status.mode, 'full');
    assert.deepEqual(full.writes, [], 'no player/quality/danmaku preference writes');
    assert.equal(full.window.fetch, full.fetch, 'first-stream request untouched');
    assert.equal(full.context.history.pushState, full.pushState, 'no navigation boundary');
    assert.equal(full.window.__douyuRoomNavigation, undefined);
    assert.ok(!full.listeners.includes('pagehide'), 'no exit disposal');
    assert.equal(status.startupQuality, null);
    assert.equal(status.qualityRecovery, undefined);
    assert.equal(status.livePreloadGuardEnabled, false);
    assert.equal(status.analyticsSinks.length, 0);
    assert.equal(full.window._hmt, undefined);
    assert.equal(status.clean.enabled, false);
    full.api.disable();
}
{
    const clean = run(null), status = clean.api.status();
    assert.equal(status.mode, 'clean', 'clean mode is the default');
    assert.ok(clean.writes.includes('realRateModel2_h5p_room'), 'clean mode applies startup defaults');
    assert.notEqual(clean.window.fetch, clean.fetch);
    assert.ok(clean.listeners.includes('pagehide'));
    assert.equal(status.livePreloadGuardEnabled, true);
    clean.api.disable();
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
console.log('Clean/full modes: full mode removes ads only and leaves quality, navigation, lifecycle and preferences alone: passed');
