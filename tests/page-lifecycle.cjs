const assert = require('node:assert/strict');
const {source, load} = require('./harness.cjs');
const {DOUYU} = load();
function harness(path='/93589') {
    const listeners = new Map(), log = [], originalCalls = [];
    const context = {URL, Object, Reflect, window:{}, history:{}, location:{pathname:path, origin:'https://www.douyu.com', href:'https://www.douyu.com'+path,
        assign:u=>log.push(['assign',u]), replace:u=>log.push(['replace',u]), reload:()=>log.push(['reload'])}};
    context.window.addEventListener=(k,fn)=>{if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn);};
    context.window.removeEventListener=(k,fn)=>listeners.get(k)?.delete(fn);
    for(const method of ['pushState','replaceState']) context.history[method]=(...args)=>originalCalls.push([method,...args]);
    load(context);
    return {context,log,originalCalls,fire:(k,event={})=>{for(const fn of [...listeners.get(k)||[]])fn(event);}};
}
{
    const h=harness(); let disposals=0;
    const lifecycle=h.context.installPageLifecycle(()=>disposals++);
    h.fire('visibilitychange',{hidden:true}); assert.equal(disposals,0,'background playback must remain active');
    h.fire('pageshow',{persisted:false}); assert.equal(h.log.length,0);
    h.fire('pagehide',{persisted:true}); h.fire('pagehide',{persisted:true});
    assert.equal(disposals,1,'dispose exactly once after a committed departure');
    h.fire('pageshow',{persisted:true}); h.fire('pageshow',{persisted:true});
    assert.equal(h.log.length,1,'cached disposed player rebuilds once');
    assert.equal(h.log[0][0],'reload');
    lifecycle.stop(); h.fire('pagehide'); assert.equal(disposals,1);
}
{
    const h=harness(), c=h.context, original=c.history.pushState;
    const nav=c.installRoomNavigationBoundary();
    assert.equal(c.installRoomNavigationBoundary(),nav,'avoid duplicate hooks');
    c.history.pushState({},'', '/93589?source=menu#chat'); assert.equal(h.originalCalls.length,1);
    c.history.pushState({},'', '/12345'); assert.equal(h.log.pop()[0],'reload');assert.equal(h.originalCalls.at(-1)[3],'https://www.douyu.com/12345');
    c.history.replaceState({},'', '/67890'); assert.equal(h.log.pop()[0],'reload');assert.equal(h.originalCalls.at(-1)[0],'replaceState');
    c.history.pushState({},'', 'https://example.com/12345'); assert.equal(h.originalCalls.length,4,'foreign URL must use native validation');
    c.location.pathname='/12345';h.fire('popstate');assert.equal(h.log.pop()[0],'reload');
    nav.stop();assert.equal(c.history.pushState,original);
}
{
    const h=harness('/directory'),c=h.context;c.installRoomNavigationBoundary();
    c.history.pushState({},'', '/directory/game');assert.equal(h.originalCalls.length,1);
    c.history.pushState({},'', '/93589');assert.equal(h.log[0][0],'reload','entering room through SPA must run document-start guard');
}
console.log('Navigation, background playback, one-time disposal and history restore: passed');

{
    const h=harness(),c=h.context;c.installRoomNavigationBoundary();
    c.history.pushState({},'', '/directory');
    assert.equal(h.originalCalls.at(-1)[3],'https://www.douyu.com/directory');
    assert.equal(h.log.at(-1)[0],'reload','leaving a room through SPA must dispose the old document');
}

{
    const start=source.indexOf('            disposePlayer: () => {')+'            disposePlayer: () => {'.length;
    const body=source.slice(start,source.indexOf('\n            },\n            stop: ({exiting',start));
    const dispose=new Function('DOUYU', 'document', 'let failures=new Set(),disposedRoots=0,releasedMedia=0;'+body+';return {disposedRoots,releasedMedia,failures:[...failures]};').bind(null, DOUYU);
    let destroyed=0,paused=0,loaded=0,sourceRemoved=0;
    const media={srcObject:{},pause(){paused++;},removeAttribute(k){assert.equal(k,'src');sourceRemoved++;},querySelectorAll(){return [];},load(){loaded++;}};
    const player={dom:{id:'room-html5-player'},destroy(){destroyed++;}};
    const fiber={stateNode:{player},child:{stateNode:{player}},sibling:{stateNode:{player:{dom:{id:'other-player'},destroy(){throw Error('unrelated player');}}}}};
    const doc={getElementById(){return {_reactRootContainer:{_internalRoot:{current:fiber}}};},querySelectorAll(){return [media];}};
    const result=dispose(doc);
    assert.deepEqual(result,{disposedRoots:1,releasedMedia:1,failures:[]});
    assert.equal(destroyed,1);assert.equal(paused,1);assert.equal(loaded,1);assert.equal(sourceRemoved,1);assert.equal(media.srcObject,null);
    player.destroy=()=>{throw Error('native failure');};
    assert.deepEqual(dispose(doc),{disposedRoots:0,releasedMedia:1,failures:['dispose:player']});
}
console.log('Native owner destruction, duplicate ownership and media fallback: passed');

{
    const h=harness(),c=h.context,navListeners=new Map();
    c.window.navigation={addEventListener:(k,f)=>navListeners.set(k,f),removeEventListener:k=>navListeners.delete(k)};
    c.installRoomNavigationBoundary();
    const go=navListeners.get('navigate');let prevented=0;
    const event={canIntercept:true,cancelable:true,navigationType:'push',destination:{url:'https://www.douyu.com/12345',sameDocument:false},preventDefault(){prevented++;}};
    for(const variant of [{formData:{}},{downloadRequest:'file'},{hashChange:true},{navigationType:'traverse'},{navigationType:'reload'},{destination:{...event.destination,sameDocument:true}}])go({...event,...variant});
    assert.equal(prevented,0,'leave form, download, history traversal and URL bookkeeping alone');
    go(event);assert.equal(prevented,1);assert.equal(h.originalCalls.at(-1)[3],event.destination.url);assert.equal(h.log.at(-1)[0],'reload');
    const count=h.originalCalls.length;go({...event,destination:{url:c.location.href,sameDocument:false}});assert.equal(h.originalCalls.length,count,'same-URL navigation must not add a duplicate history entry');
}
console.log('Navigation API exclusions, room navigation and history preservation: passed');
