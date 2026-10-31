const assert = require('node:assert/strict');
const {load} = require('./harness.cjs');
function harness() {
    const calls=[], removed=[], listeners=new Map();
    const fetch=function(){calls.push({receiver:this,args:[...arguments]});return 'native-result';};
    const c=load({URL,performance:{now:()=>123},location:{href:'https://www.douyu.com/93589',origin:'https://www.douyu.com'},
        localStorage:{removeItem:k=>removed.push(k)},window:{fetch},
        document:{addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)}});
    const quality=c.installStartupQuality();
    assert.deepEqual(removed,['h5StreamPreload_h5p_room']);
    return {c,quality,calls,fetch,listeners};
}
for (const path of ['/lapi/live/getH5PlayV1/93589','/gapi/live/web/super/stream/v1/93589']) {
    const {c,quality,calls,fetch,listeners}=harness();
    for (const [url,init] of [['https://other.invalid'+path,{method:'POST',body:'rate=-1'}],['/other/path',{method:'POST',body:'rate=-1'}],[path,{method:'GET',body:'rate=-1'}],[path,{method:'POST',body:'other=1'}]]) {
        c.window.fetch(url,init);assert.equal(calls.at(-1).args[1],init);
        assert.equal(quality.status().request,null);
    }
    const init={method:'POST',body:'first=1&rate=-1&last=2',credentials:'include'};
    assert.equal(c.window.fetch(path,init),'native-result');
    assert.equal(init.body,'first=1&rate=-1&last=2');
    assert.equal(calls.at(-1).args[1].body,'first=1&rate=0&last=2');
    assert.equal(calls.at(-1).args[1].credentials,'include');
    assert.equal(c.window.fetch,fetch);
    assert.equal(quality.status().request.sentRate,'0');
    assert.equal(quality.status().request.fromRate,'-1');
    assert.equal(quality.status().request.path,path);
    c.window.fetch(path,init);assert.equal(calls.at(-1).args[1],init,'later automatic requests are untouched');
    listeners.get('loadedmetadata')({target:{tagName:'VIDEO',closest:()=>null,videoWidth:2560}});
    assert.equal(quality.status().firstVideo,null);
    listeners.get('loadedmetadata')({target:{tagName:'VIDEO',closest:selector=>{assert.equal(selector,'#js-player-video-case');return {};},videoWidth:2560,videoHeight:1440}});
    assert.equal(quality.status().firstVideo.width,2560);assert.equal(listeners.size,0);
    quality.stop();assert.equal(c.window.fetch,fetch);
}
{
    // A saved lower preference is also overridden on the first request only.
    const {c,quality,calls,fetch}=harness(), init={method:'post',body:'cdn=x&rate=4&ver=1'};
    c.window.fetch(new URL('https://www.douyu.com/lapi/live/getH5PlayV1/93589'),init);
    assert.equal(calls.at(-1).args[1].body,'cdn=x&rate=0&ver=1');assert.equal(quality.status().request.fromRate,'4');
    assert.equal(quality.status().request.sentRate,'0');assert.equal(c.window.fetch,fetch);
    const original={method:'post',body:'rate=0'};c.window.fetch(new URL('https://www.douyu.com/lapi/live/getH5PlayV1/93589'),original);
    assert.equal(calls.at(-1).args[1],original,'later requests pass through untouched');
}
{
    const {c,quality,listeners}=harness();
    const later=()=>{};c.window.fetch=later;quality.stop();
    assert.equal(c.window.fetch,later,'do not overwrite a subsequently installed fetch hook');assert.equal(listeners.size,0);
}
console.log('Config-driven first-stream endpoints, native request preservation and first-video diagnostics: passed');
