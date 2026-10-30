const assert=require('node:assert/strict');
const location={href:'https://www.douyu.com/93589'}, localStorage={getItem:()=>null};
const {createOptionalResourceGate, DOUYU}=require('./harness.cjs').load({location,localStorage,URL,queueMicrotask,Event});

function node(kind,url,connected=false){const attrs={[kind==='link'?'href':'src']:url};return {nodeType:1,localName:kind,isConnected:connected,getAttribute:k=>attrs[k],setAttribute:(k,v)=>{attrs[k]=v},removeAttribute:k=>{delete attrs[k]},dispatchEvent:()=>{},attrs};}
const gate=createOptionalResourceGate();
for(const url of ['https://shark2.douyucdn.cn/front-publish/live-activity-common-pendant-master/js/main.js','https://game.weixin.qq.com/cgi-bin/minigame/static/pc-gamesdk-alpha/wxgamesdk.js']) {const n=node('script',url);gate.prepare(n);assert.equal(n.attrs.src,undefined);assert.equal(n.type,'application/x-douyu-disabled');}
for(const url of ['https://shark2.douyucdn.cn/front-publish/live_player-master/js/h5-plugin_4ca00aa.js','https://shark2.douyucdn.cn/front-publish/live-next-master/js/room/player_88e215c.js','https://shark2.douyucdn.cn/front-publish/live-next-master/js/room/login_1177a0d.js','https://shark2.douyucdn.cn/front-publish/live-next-player-aside-master/js/live-next-player-aside_ca19b3a.js','https://example.com/front-publish/live-task-master/a.js']) {const n=node('script',url);gate.prepare(n);assert.equal(n.attrs.src,url);}
const loaded=node('script','https://shark2.douyucdn.cn/front-publish/live-task-master/a.js',true);gate.prepare(loaded);assert.ok(loaded.attrs.src);assert.equal(gate.status().late,1);
localStorage.getItem=()=> 'off';const full=createOptionalResourceGate(), n=node('script','https://shark2.douyucdn.cn/front-publish/live-task-master/a.js');full.prepare(n);assert.ok(n.attrs.src);assert.equal(full.status().count,0);
gate.stop();assert.equal(gate.status().enabled,false);assert.equal(gate.status().count,0);console.log('core resources, clean/full mode, late-load accounting and stop: passed');
