const assert = require('node:assert/strict');
const {load} = require('./harness.cjs');
function harness(nativeResult = () => Promise.resolve({json:()=>Promise.resolve({error:0,data:{p2p:1,h265_p2p:1}})})) {
    const calls=[], removed=[], listeners=new Map();
    const fetch=function(){
        const call={receiver:this,args:[...arguments]};calls.push(call);
        return call.result=nativeResult();
    };
    const c=load({URL,performance:{now:()=>123},location:{href:'https://www.douyu.com/93589',origin:'https://www.douyu.com'},
        localStorage:{removeItem:k=>removed.push(k)},window:{fetch},
        document:{addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)}});
    const quality=c.installStartupQuality();
    assert.deepEqual(removed,['h5StreamPreload_h5p_room']);
    return {c,quality,calls,fetch,listeners};
}
(async () => {
for (const path of ['/lapi/live/getH5PlayV1/93589','/gapi/live/web/super/stream/v1/93589']) {
    const {c,quality,calls,fetch,listeners}=harness();
    const wrappedFetch=c.window.fetch;
    for (const [url,init] of [['https://other.invalid'+path,{method:'POST',body:'rate=-1'}],['/other/path',{method:'POST',body:'rate=-1'}],[path,{method:'GET',body:'rate=-1'}],[path,{body:'rate=-1'}],[path,{method:'POST',body:new URLSearchParams('rate=-1')}],[{url:path},{method:'POST',body:'rate=-1'}]]) {
        const receiver={}, extra={};
        const result=c.window.fetch.call(receiver,url,init,extra), call=calls.at(-1);
        assert.equal(result,call.result,'non-matching requests keep the native promise');
        assert.deepEqual(call.args,[url,init,extra]);assert.equal(call.args[1],init);assert.equal(call.receiver,receiver);
        const response=await result, json=response.json;await response.json();
        assert.equal(response.json,json);assert.equal(quality.status().p2pCleared,0);
        assert.equal(quality.status().request,null);
    }
    const noRate={method:'POST',body:'other=1'};
    const noRateResponse=await c.window.fetch(path,noRate);
    assert.equal(calls.at(-1).args[1],noRate);assert.equal(quality.status().request,null);
    await noRateResponse.json();assert.equal(quality.status().p2pCleared,1,'stream responses without rate are also cleared');
    const init={method:'POST',body:'first=1&rate=-1&last=2',credentials:'include'};
    await c.window.fetch(path,init);
    assert.equal(init.body,'first=1&rate=-1&last=2');
    assert.equal(calls.at(-1).args[1].body,'first=1&rate=0&last=2');
    assert.equal(calls.at(-1).args[1].credentials,'include');assert.equal(calls.at(-1).receiver,c.window);
    assert.equal(c.window.fetch,wrappedFetch);assert.equal(quality.status().fetchHookReleased,false);
    assert.equal(quality.status().request.sentRate,'0');
    assert.equal(quality.status().request.fromRate,'-1');
    assert.equal(quality.status().request.path,path);
    await c.window.fetch(path,init);assert.equal(calls.at(-1).args[1],init,'later automatic requests are untouched');
    const manual={method:'POST',body:'rate=4&cdn=manual'};
    const response=await c.window.fetch(path,manual);
    assert.equal(calls.at(-1).args[1],manual,'later manual requests retain the chosen rate and line');
    assert.deepEqual(await response.json(),{error:0,data:{p2p:0,h265_p2p:0}});
    assert.equal(quality.status().p2pCleared,2);assert.equal(quality.status().request.fromRate,'-1');
    listeners.get('loadedmetadata')({target:{tagName:'VIDEO',closest:()=>null,videoWidth:2560}});
    assert.equal(quality.status().firstVideo,null);
    listeners.get('loadedmetadata')({target:{tagName:'VIDEO',closest:selector=>{assert.equal(selector,'#js-player-video-case');return {};},videoWidth:2560,videoHeight:1440}});
    assert.equal(quality.status().firstVideo.width,2560);assert.equal(listeners.size,0);
    quality.stop();assert.equal(c.window.fetch,fetch);assert.equal(quality.status().fetchHookReleased,true);
    const stoppedResponse=await c.window.fetch(path,manual);
    assert.deepEqual(await stoppedResponse.json(),{error:0,data:{p2p:1,h265_p2p:1}});
    assert.equal(quality.status().p2pCleared,2);
}
const path='/lapi/live/getH5PlayV1/93589';
for (const rate of ['4','0']) {
    // A saved lower preference is overridden only once; an original request keeps init identity.
    const {c,quality,calls,fetch}=harness(), init={method:'post',body:`cdn=x&rate=${rate}&ver=1`};
    await c.window.fetch(new URL('https://www.douyu.com'+path),init);
    assert.equal(calls.at(-1).args[1].body,'cdn=x&rate=0&ver=1');assert.equal(quality.status().request.fromRate,rate);
    if (rate==='0') assert.equal(calls.at(-1).args[1],init);
    assert.equal(quality.status().request.sentRate,'0');assert.notEqual(c.window.fetch,fetch);
    const original={method:'post',body:'rate=0'};await c.window.fetch(new URL('https://www.douyu.com'+path),original);
    assert.equal(calls.at(-1).args[1],original,'later requests pass through untouched');
    quality.stop();assert.equal(c.window.fetch,fetch);
}
for (const error of [0,'0']) {
    const body={error,data:{p2p:'1',h265_p2p:2,player_1:'h265',rate:4,hevc:1,rtmp_url:'https://media.invalid',rtmp_live:'stream',nested:{keep:true}},extra:'keep'};
    const expected=structuredClone(body);expected.data.p2p=0;expected.data.h265_p2p=0;
    const data=body.data, nested=data.nested, jsonCalls=[];
    const response={status:200,text:()=>Promise.resolve('native text'),json:function(){jsonCalls.push({receiver:this,args:[...arguments]});return Promise.resolve(body);}};
    const nativeJson=response.json, nativeText=response.text;
    const {c,quality}=harness(()=>Promise.resolve(response));
    assert.equal(await c.window.fetch(path,{method:'POST',body:'rate=-1'}),response);
    assert.equal(quality.status().p2pCleared,0,'count only consumed successful JSON responses');
    assert.notEqual(response.json,nativeJson);assert.equal(response.text,nativeText);assert.equal(response.status,200);
    const marker={};assert.equal(await response.json(marker),body);
    assert.equal(jsonCalls[0].receiver,response);assert.deepEqual(jsonCalls[0].args,[marker]);
    assert.deepEqual(body,expected);assert.equal(body.data,data);assert.equal(body.data.nested,nested);
    assert.equal(quality.status().p2pCleared,1);
}
for (const body of [{error:1,data:{p2p:1,h265_p2p:2}},{error:0,data:null},{error:0},{error:0,data:[]},{error:0,data:'value'},{error:0,data:1},{error:0,data:false},null]) {
    const before=structuredClone(body), response={json:()=>Promise.resolve(body)};
    const {c,quality}=harness(()=>Promise.resolve(response));
    assert.equal(await (await c.window.fetch(path,{method:'POST',body:'rate=0'})).json(),body);
    assert.deepEqual(body,before);assert.equal(quality.status().p2pCleared,0);
}
{
    const failure=new Error('fetch rejected'), {c,quality}=harness(()=>Promise.reject(failure));
    await assert.rejects(c.window.fetch(path,{method:'POST',body:'rate=4'}),error=>error===failure);
    assert.equal(quality.status().p2pCleared,0);
}
{
    const failure=new Error('fetch threw'), {c}=harness(()=>{throw failure;});
    assert.throws(()=>c.window.fetch(path,{method:'POST',body:'rate=4'}),error=>error===failure);
}
for (const sync of [false,true]) {
    const failure=new Error('json failed'), response={json:()=>{if(sync)throw failure;return Promise.reject(failure);}};
    const {c,quality}=harness(()=>Promise.resolve(response));
    await c.window.fetch(path,{method:'POST',body:'rate=0'});
    if(sync) assert.throws(()=>response.json(),error=>error===failure);
    else await assert.rejects(response.json(),error=>error===failure);
    assert.equal(quality.status().p2pCleared,0);
}
{
    const {c,quality,listeners}=harness();
    const later=()=>{};c.window.fetch=later;quality.stop();
    assert.equal(c.window.fetch,later,'do not overwrite a subsequently installed fetch hook');assert.equal(listeners.size,0);
    assert.equal(quality.status().fetchHookReleased,false,'stop cannot remove a hook owned by another wrapper');
}
console.log('Config-driven first-stream quality, persistent P2P clearing, native passthrough and first-video diagnostics: passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
