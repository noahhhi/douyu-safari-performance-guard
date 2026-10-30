const assert = require('node:assert/strict');
const {load} = require('./harness.cjs');
class Node {
    appendChild(node){this.last=[...arguments];return node;}
    insertBefore(node){this.last=[...arguments];return node;}
    replaceChild(node){this.last=[...arguments];return node;}
}
class Element extends Node {append(){this.last=[...arguments];} prepend(){this.last=[...arguments];}}
let prepared=0, observations=0, disconnected=0, observerCallback;
const listeners=new Map();
const c=load({URL,Node,Element,document:{baseURI:'https://www.douyu.com/93589',head:{querySelectorAll:()=>[]},
    addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)},
    MutationObserver:class {constructor(fn){observerCallback=fn;} observe(target,options){observations++;assert.equal(options.subtree,true);} disconnect(){disconnected++;}}});
const original=Node.prototype.appendChild, host=new Element();
const guard=c.createPreloadGuard({prepare(){prepared++;}});
function resource(kind, attributes, connected=false) {
    return {nodeType:1,localName:kind,isConnected:connected,getAttribute:k=>attributes[k],setAttribute:(k,v)=>attributes[k]=v,attributes};
}
for (const node of [null,undefined,'danmaku',{nodeType:3},{nodeType:8},{nodeType:1,localName:'div',getAttribute(){throw Error('unrelated element fast-path');},querySelectorAll(){throw Error('must not walk ordinary subtrees');}}]) {
    assert.equal(host.appendChild(node),node);
}
assert.equal(prepared,0);
const flv=resource('link',{href:'https://media.invalid/live.flv?token=fixture',as:'fetch',rel:'preload'});
assert.equal(host.appendChild(flv),flv);
assert.equal(flv.attributes.rel,'');
assert.equal(guard.status().blockedLivePreloads,1);
assert.equal(guard.status().latePreloads,0);
assert.equal(prepared,1);
const normal=resource('link',{href:'https://media.invalid/file.js',as:'fetch',rel:'preload'});
const late=resource('link',{href:'https://media.invalid/live.flv',as:'fetch',rel:'prefetch'},true);
const iframe=resource('iframe',{src:'https://fixture.invalid/'});
const fragment={nodeType:11,querySelectorAll(selector){assert.equal(selector,'script[src],iframe[src],link[href]');return [normal,late,iframe];}};
host.prepend('label',fragment,resource('script',{src:'https://fixture.invalid/a.js'}));
assert.equal(prepared,5);
assert.equal(normal.attributes.rel,'preload');
assert.equal(late.attributes.rel,'');
assert.equal(guard.status().blockedLivePreloads,2);
assert.equal(guard.status().latePreloads,1);
const reference={nodeType:1,localName:'link',getAttribute(){throw Error('reference node must not be prepared');}};
assert.equal(host.insertBefore(normal,reference),normal);
assert.equal(host.replaceChild(normal,reference),normal);
assert.equal(prepared,7);
host.append('a',normal,'b');assert.equal(prepared,8);
observerCallback([{type:'childList',addedNodes:[{nodeType:1,localName:'span'}]},{type:'attributes',target:normal}]);
assert.equal(prepared,8);
assert.equal(observations,1,'only the existing head fallback observer');
guard.deactivate();
const duringTeardown=resource('link',{href:'https://media.invalid/teardown.flv',as:'fetch',rel:'preload'});
host.appendChild(duringTeardown);
assert.equal(duringTeardown.attributes.rel,'preload','teardown must disable interception before restoring hooks');
assert.equal(prepared,8);
const errors=[];guard.stop((stage,fn)=>{try{fn();}catch{errors.push(stage);}});
assert.deepEqual(errors,[]);assert.equal(Node.prototype.appendChild,original);
assert.equal(disconnected,1);assert.equal(listeners.size,0);assert.equal(guard.status().active,false);
console.log('DOM insertion fast paths, fragment resources, preload accounting and hook restoration: passed');
{
    let resources = 0;
    const chromium = load({URL, Node, Element,
        navigator:{userAgent:'Mozilla/5.0 AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36'},
        document:{baseURI:'https://www.douyu.com/93589', head:{querySelectorAll:()=>[]},
            addEventListener(){}, removeEventListener(){}},
        MutationObserver:class {observe(){} disconnect(){}}});
    const guard = chromium.createPreloadGuard({prepare(){resources++;}});
    const link = resource('link',{href:'https://media.invalid/live.flv',as:'fetch',rel:'preload'});
    host.appendChild(link);
    host.appendChild(resource('script',{src:'https://fixture.invalid/optional.js'}));
    assert.equal(link.attributes.rel,'preload','Chromium keeps native live-stream preload');
    assert.equal(guard.status().livePreloadGuardEnabled,false);
    assert.equal(guard.status().blockedLivePreloads,0);
    assert.equal(resources,2,'shared DOM interception must still feed the resource gate');
    guard.stop((stage,fn)=>fn());
    assert.equal(Node.prototype.appendChild,original);
}
console.log('Chromium preserves FLV preload while retaining optional-resource interception: passed');
