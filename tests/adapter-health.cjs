const assert = require('node:assert/strict');
const vm = require('node:vm');
const {load, source} = require('./harness.cjs');
function environment() {
    let now = 0, nextTimer = 0;
    const timers = new Map(), elements = new Map(), selectors = new Map(), storage = new Map();
    const document = {body:null, head:null, readyState:'loading', baseURI:'https://www.douyu.com/93589',
        getElementById:id=>elements.get(id), querySelector:s=>selectors.get(s), querySelectorAll:()=>[],
        addEventListener(){}, removeEventListener(){}};
    const context = {URL, document, window:{addEventListener(){},removeEventListener(){}},
        performance:{now:()=>now}, localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
        setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),queueMicrotask:()=>{}};
    return {context, timers, elements, selectors, storage, time:value=>now=value,
        tick(time) {now=time;
            // The controller's 250 ms / 2 s timer; quality recovery may own one bounded 100 ms poll.
            const controller=[...timers].filter(([,t])=>t.delay>=250);
            assert.equal(controller.length,1,'only the existing controller timer');
            assert.ok(timers.size<=2,'at most one extra bounded poll');
            const [[id,{fn}]]=controller;timers.delete(id);fn();}};
}
{
    const h=environment(), c=load(h.context), health=c.createAdapterHealth();
    const state={rendererHooks:0,playerModuleHooks:0,nativeSender:false,senderFailed:false};
    h.selectors.set(c.DOUYU.selectors.videoCase, {});
    health.observe(true,state);
    let out=health.status();
    assert.equal(out.contracts['selector.videoCase'].state,'found');
    assert.equal(out.contracts['selector.controlbar'].state,'pending');
    assert.equal(out.contracts.playerModuleHooks.state,'pending');
    out.contracts['selector.videoCase'].state='mutated';
    assert.equal(health.status().contracts['selector.videoCase'].state,'found','snapshot must be detached');
    h.time(20000);health.observe(true,state);out=health.status();
    assert.equal(out.observationClosed,true);
    for(const key of ['selector.controlbar','rendererHooks','playerModuleHooks','nativeSender','runtime.moduleCache']) assert.equal(out.contracts[key].state,'missing', key);
    h.context.document.querySelector=()=>{throw Error('selector observations must end at deadline');};
    h.context.document.getElementById=()=>{throw Error('ID observations must end at deadline');};
    health.observe(true,{...state,senderFailed:true});
    assert.equal(health.status().contracts.nativeSender.state,'failed');
    health.observe(true,{...state,rendererHooks:1,playerModuleHooks:2,nativeSender:true});
    assert.equal(health.status().contracts.rendererHooks.state,'found','late runtime health can recover');
    health.stop();health.observe(true,state);
    assert.equal(health.status().stopped,true);
    assert.equal(health.status().contracts.nativeSender.state,'found');
    assert.equal(c.createDiagnostics(()=>({version:'fixture',clean:{adapterHealth:health.status()}})).status().adapterHealth.stopped,true);
    assert.equal(c.createDiagnostics(()=>({})).status().adapterHealth.reason,'clean-controller-initialization');
}
{
    const h=environment(),c=load(h.context),health=c.createAdapterHealth();
    h.time(21000);health.observe(false,{});
    for (const key of ['nativeSender','playerModuleHooks','rendererHooks','runtime.moduleCache','selector.senderInput']) assert.equal(health.status().contracts[key].state,'not-applicable');
    assert.equal(health.status().contracts['selector.controlbar'].state,'missing','native controls still apply in full mode');
}
{
    const h=environment(), c=load(h.context);
    function module(id) {
        class Connector {constructor(){this.props={id};this.unsubscribeListener=()=>{};} render(){return 'native';} forceUpdate(){fiber.child=null;}}
        const original=Connector.prototype.render, instance=new Connector();
        const fiber={memoizedProps:{id},stateNode:instance,child:{}};
        return {fiber,instance,original};
    }
    const first=module('videoAd'),second=module('anchorMaiMai'),tooLate=module('hitSong');
    h.elements.set(c.DOUYU.ids.player,{_reactRootContainer:{_internalRoot:{current:first.fiber}}});
    const clean=c.createCleanController();
    assert.equal(first.instance.render(),null);
    assert.equal(clean.status().playerModules.hooks,1);
    first.fiber.sibling=second.fiber;
    h.tick(2000);
    assert.equal(second.instance.render(),null,'success on the first tick must not stop discovery of another connector prototype');
    assert.equal(clean.status().playerModules.hooks,2);
    h.tick(20000);
    const visits=clean.status().playerModules.visits;
    second.fiber.sibling=tooLate.fiber;
    h.tick(22000);
    assert.equal(tooLate.instance.render(),'native','discovery must be bounded');
    assert.equal(clean.status().playerModules.visits,visits);
    assert.equal(clean.status().adapterHealth.contracts.playerModuleHooks.state,'found');
    h.context.document.body={};
    h.context.window.PlayerAsideApp={container:{get(){throw Error('changed sender contract');}}};
    h.tick(24000);
    assert.equal(clean.status().adapterHealth.contracts.nativeSender.state,'failed');
    assert.ok(clean.status().failures.includes('native-sender'));
    clean.stop();
    assert.equal(h.timers.size,0);
    assert.equal(first.instance.render,first.original);
    assert.equal(second.instance.render,second.original);
    assert.equal(clean.status().adapterHealth.stopped,true);
}
// Execute the whole userscript (not just extracted factories): catch bootstrap and public API regressions.
{
    const h=environment(), c=h.context;
    class Node {appendChild(node){return node;} insertBefore(node){return node;} replaceChild(node){return node;}}
    class Element extends Node {append(){} prepend(){}}
    Object.assign(c,{Node,Element,navigator:{userAgent:'AppleWebKit Safari'},history:{pushState(){},replaceState(){}},
        location:{href:'https://www.douyu.com/93589',pathname:'/93589',origin:'https://www.douyu.com',reload(){}}});
    c.window.top=c.window.self=c.window;c.window.fetch=()=>{};
    const original=Node.prototype.appendChild;
    vm.runInNewContext(source,c);
    const api=c.window.__douyuSafariGuard;
    assert.ok(api);
    const status=api.status();
    for (const key of ['version','active','blockedLivePreloads','latePreloads','startedAt','readyStateAtInstall','lifecycle','cleanupErrors','optionalResources','startupQuality','clean','adapterHealth']) assert.ok(key in status,key);
    for (const key of ['enabled','attached','rendererHooks','unmounted','suppressedRenders','defaultsApplied','disposedRoots','releasedMedia','nativeSender','playerModules','failures']) assert.ok(key in status.clean,key);
    assert.equal(status.adapterHealth.contracts.nativeSender.state,'pending');
    h.tick(21000);
    assert.equal(api.status().adapterHealth.contracts.nativeSender.state,'missing');
    api.disable();
    assert.equal(Node.prototype.appendChild,original);
    assert.equal(c.window.__douyuSafariGuard,undefined);
    assert.equal(h.timers.size,0);
    assert.equal(api.status().active,false);
}
console.log('Adapter health, bounded repeated discovery, native sender failure and public status compatibility: passed');
