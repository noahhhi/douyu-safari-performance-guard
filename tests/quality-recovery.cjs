const assert = require('node:assert/strict');
const {load} = require('./harness.cjs');

const original = JSON.stringify({c:1, e:Date.now()+1e9, v:'0', r:1});
function setup({rate=-1, manual=false, ready=true, saved=original, rid=93589} = {}) {
    const timers = [], listeners = {}, calls = [], storage = {
        realRateModel2_h5p_room:saved, realRateModel_h5p_room:saved, player_storage_rate_h5p_room:saved};
    const app = {rate, multirates:{toJS:()=>[{rate:0, diamondFan:0}, {rate:2}]}, rid, isAllReady:ready,
        manualLoadVideo:manual, isLogin:true, canAutoPlay:true, inVod:false};
    const state = {getIn:([scope, ...rest]) => scope === 'app' ? app[rest[0]] :
        ({isPlay:true, isRtc:false})[rest[1]]};
    const fiber = {stateNode:{getStore:()=>({getState:()=>state})}};
    const player = {handleAcj(...args) { calls.push(args); }};
    const win = {__player:player, $ROOM:{room_id:93589}};
    const c = load({window:win, location:{pathname:'/93589'}, performance:{now:()=>0}, Date, JSON,
        localStorage:{getItem:k=>storage[k] ?? null},
        setTimeout:fn=>{timers.push(fn); return timers.length;}, clearTimeout(){},
        document:{getElementById:()=>({_reactRootContainer:{_internalRoot:{current:fiber}}}),
            addEventListener:(t,fn)=>{listeners[t]=fn;}, removeEventListener:t=>{delete listeners[t];}}});
    const recovery = c.createQualityRecovery();
    // Run up to `steps` polls; a waiting recovery reschedules itself every time.
    const run = (steps = 5) => { for (let i = 0; i < steps && timers.length; i++) timers.shift()(); };
    return {recovery, run, calls, player, app, storage, listeners};
}

let t = setup();
t.run();
assert.equal(t.recovery.status().phase, 'issued');
assert.equal(JSON.stringify(t.calls), JSON.stringify([['loadWithoutPerception','changeRate',[{rate:0, manual:true}]]]));
assert.equal(typeof t.player.handleAcj, 'function'); assert.equal(t.player.handleAcj.name, 'handleAcj', 'bridge restored');

t = setup({rate:0}); t.run();
assert.equal(t.recovery.status().phase, 'already-original'); assert.equal(t.calls.length, 0);

t = setup({manual:true}); t.run();
assert.equal(t.recovery.status().phase, 'manual-choice'); assert.equal(t.calls.length, 0);

t = setup({saved:JSON.stringify({c:1, e:Date.now()+1e9, v:'2', r:1})}); t.run();
assert.equal(t.recovery.status().phase, 'no-original-preference'); assert.equal(t.calls.length, 0);

// Not ready yet: a native switch arriving first wins and the guard never issues its own.
t = setup({ready:false});
t.run(); // attaches the bridge and keeps waiting
t.player.handleAcj('loadWithoutPerception', 'changeRate', [{rate:0, manual:false}]);
assert.equal(t.recovery.status().phase, 'native-change');
assert.equal(t.calls.length, 1);

// Trusted input yields; synthetic events do not.
t = setup({ready:false});
t.listeners.pointerdown({isTrusted:false});
assert.equal(t.recovery.status().phase, 'waiting');
t.listeners.keydown({isTrusted:true});
assert.equal(t.recovery.status().phase, 'user-input');
t.app.isAllReady = true; t.run();
assert.equal(t.calls.length, 0);

// Preference changed by the viewer (e.g. another tab) before readiness.
t = setup({ready:false});
t.storage.realRateModel2_h5p_room = JSON.stringify({c:2, e:Date.now()+1e9, v:'3', r:1});
t.run();
assert.equal(t.recovery.status().phase, 'preference-changed'); assert.equal(t.calls.length, 0);
console.log('Late-injection quality recovery: one native switch, yields to user and native changes: passed');
