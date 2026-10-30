const assert = require('node:assert/strict');
const {load} = require('./harness.cjs');

const win = {};
const c = load({URL, window:win, location:{href:'https://www.douyu.com/93589', pathname:'/93589'},
    localStorage:{getItem:()=>null}, queueMicrotask:fn=>fn(), Event:class{}, Date});
const {createOptionalResourceGate, installAnalyticsSinks} = c;
function blocked(gate, url, kind='script') {
    const attrs = {src:url};
    gate.prepare({nodeType:1, localName:kind, getAttribute:k=>attrs[k], setAttribute:(k,v)=>attrs[k]=v,
        removeAttribute:k=>delete attrs[k], dispatchEvent(){}});
    return attrs.src === undefined;
}
const room = 'https://shark2.douyucdn.cn/front-publish/live-next-master/js/room/';

// Room widgets and anchor tools: SHARK-loaded entries only, never player lazy chunks or core files.
let gate = createOptionalResourceGate();
for (const name of ['sign_090f81c','asideTopSuspension_7ab34cd','chatInteration_8c7d585','lotteryDraw_3be65d4',
    'superFans_92491e4','menu_247b2ff','superMenu_ca1d447']) assert.equal(blocked(gate, room+name+'.js'), true, name);
for (const name of ['WarGame_c7355d1_059fff8','SvgaPlayer_e9a849f_38c0030','login_1177a0d','userCard_ee995c5',
    'toolbar_cbe2364','player_798fe57','common_6a22e8b','page_2b646e2','signal_abc','mfRegisterCenter_91742df'])
    assert.equal(blocked(gate, room+name+'.js'), false, name);
assert.equal(blocked(gate, 'https://shark2.douyucdn.cn/front-publish/live-next-player-aside-master/js/live-next-player-aside_1a3c46f.js'), false);
assert.equal(blocked(gate, 'https://evil.test/front-publish/live-next-master/js/room/sign_1.js'), false);

// Analytics: hm/gtag always; collect-rangers only once this script's callback sink owns collectEvent.
assert.equal(blocked(gate, 'https://hm.baidu.com/hm.js?e99aee90ec1b2106afe7ec3b199020a7'), true);
assert.equal(blocked(gate, 'https://www.googletagmanager.com/gtag/js?id=G-5JKQ7DTEXC'), true);
const rangers = 'https://lf3-data.volccdn.com/obj/data-static/log-sdk/collect/5.0/collect-rangers-v5.1.10.js';
assert.equal(blocked(gate, rangers), false, 'late injection keeps the real SDK');
win.collectEvent = function () {}; // page's own queue stub
assert.equal(installAnalyticsSinks().installed.includes('collectEvent'), false, 'never replace an existing object');
assert.equal(blocked(createOptionalResourceGate(), rangers), false);
delete win.collectEvent; delete win._hmt; delete win.dataLayer;
assert.deepEqual(Array.from(installAnalyticsSinks().installed), ['_hmt','dataLayer','collectEvent']);
assert.equal(blocked(createOptionalResourceGate(), rangers), true);
assert.equal(win.dataLayer.push({}), 0); assert.equal(win.dataLayer.length, 0, 'sinks never grow');
const answers = [];
win.collectEvent('init', {}); win.collectEvent('start');
win.collectEvent('getToken', v => answers.push(v));
win.collectEvent('getAllVars', v => answers.push(v));
win.collectEvent('getVar', 'webAAzbj', 'fallback', v => answers.push(v));
assert.deepEqual(JSON.parse(JSON.stringify(answers)), [{ssid:'', web_id:''}, {}, 'fallback']);

// Clean mode off: no sinks, no new rules.
const off = load({URL, window:{}, location:{href:'https://www.douyu.com/93589'},
    localStorage:{getItem:k=>k==="douyu-safari-clean-mode"?"off":null}, queueMicrotask:fn=>fn(), Event:class{}});
assert.equal(off.installAnalyticsSinks().installed.length, 0);
assert.equal(blocked(off.createOptionalResourceGate(), room+'sign_1.js'), false);
// Runtime category switch (maintenance bisect / A-B): listed categories are off, others keep code defaults.
const ab = load({URL, window:{}, location:{href:'https://www.douyu.com/93589'}, queueMicrotask:fn=>fn(), Event:class{},
    localStorage:{getItem:k=>k==='douyu-safari-disabled-categories'?' roomWidgets , analytics':null}});
gate = ab.createOptionalResourceGate();
assert.equal(blocked(gate, room+'sign_1.js'), false);
assert.equal(blocked(gate, 'https://hm.baidu.com/hm.js'), false);
assert.equal(blocked(gate, room+'menu_1.js'), true);
assert.equal(blocked(gate, 'https://shark2.douyucdn.cn/front-publish/live-task-master/a.js'), true);
assert.equal(ab.installAnalyticsSinks().installed.length, 0);
// Experimental pageChrome: off by default, opt-in via the enabled list, and the disabled list wins.
const chrome = ['https://shark2.douyucdn.cn/front-publish/header-master/js/header_d00953c.js',
    'https://shark2.douyucdn.cn/front-publish/live-video-assets-master/js/live-video-assets_e614fbe.js', room+'customGroup_465cdfc.js'];
gate = createOptionalResourceGate();
for (const url of chrome) assert.equal(blocked(gate, url), false, 'experimental off by default: '+url);
function withLists(on, off) {
    return load({URL, window:{}, location:{href:'https://www.douyu.com/93589'}, queueMicrotask:fn=>fn(), Event:class{},
        localStorage:{getItem:k=>({'douyu-safari-enabled-categories':on,'douyu-safari-disabled-categories':off})[k] ?? null}});
}
gate = withLists('pageChrome', null).createOptionalResourceGate();
for (const url of chrome) assert.equal(blocked(gate, url), true, url);
assert.equal(blocked(gate, room+'customGroupX_1.js'), false);
assert.equal(blocked(gate, 'https://shark2.douyucdn.cn/front-publish/live-video-module-master/js/live-video-module_ebde0cb.js'), false);
assert.equal(blocked(withLists('pageChrome', 'pageChrome').createOptionalResourceGate(), chrome[0]), false);
assert.equal(blocked(withLists('noSuchCategory', null).createOptionalResourceGate(), chrome[0]), false);
console.log('v3.7 room widget, anchor tool and analytics rules: passed');
