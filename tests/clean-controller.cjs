const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('douyu-safari-performance-guard.user.js', 'utf8');
const functions = source.slice(source.indexOf('    function createPlayerModuleTrim()'), source.indexOf('    function installStartupQuality()'));

function element(props = {}) {
    return {parentElement:null, style:{backgroundImage:''}, textContent:'', clicks:0,
        click() { this.clicks++; }, matches:() => false, querySelector:() => null,
        closest(sel) { return sel === '#js-player-controlbar' ? this.bar : null; }, ...props};
}
function harness({mode = null, checked = false, quarterSelected = false, controls = true} = {}) {
    const listeners = new Map(), timers = [], storage = new Map(mode ? [['douyu-safari-clean-mode', mode]] : []);
    const bar = element({id:'js-player-controlbar'});
    const items = ['屏蔽全部礼物','屏蔽消息通知','屏蔽视频广播','屏蔽小礼物','屏蔽进场特效','屏蔽礼物音效','屏蔽弹幕皮肤']
        .map(textContent => element({textContent, bar, checked,
            querySelector(sel) { return sel.includes('checked-') && this.checked ? {} : null; },
            closest(sel) { return sel.includes('shieldSettingItem-') ? this : sel === '#js-player-controlbar' ? bar : null; }}));
    const list = element({querySelectorAll:() => items});
    for (const item of items) item.parentElement = list;
    const option = element({bar, style:{backgroundImage: quarterSelected ? 'url(quarterscreen_select.png)' : 'url(quarterscreen.png)'},
        querySelector:sel => sel.includes('iconLabel-') ? label : null});
    const label = element({textContent:'1/4屏', parentElement:option, bar, matches:sel => sel.includes('iconLabel-')});
    const input = element({disabled:false, focused:0, focus() { this.focused++; }, matches:sel => sel.includes('input'),
        closest(sel) { return sel.includes('input') ? this : null; }});
    const document = {
        body:{append() {}}, head:{append() {}},
        addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
        removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
        getElementById:() => null,
        querySelector(sel) {
            if (sel === '#js-player-controlbar') return controls ? bar : null;
            if (sel.includes('fullScreenSendor-')) return input;
            return null;
        },
        querySelectorAll(sel) {
            if (!controls) return [];
            if (sel.includes('shieldSettingItem-')) return items;
            if (sel.includes('iconLabel-')) return [label];
            return [];
        },
        createElement:() => ({remove() {}, isConnected:true}),
    };
    const acj = [];
    const window = {__player:{acjCall:(name, data) => acj.push([name, data])},
        _room_common_:{c:{dom:{exports:{render() {}, unmountComponentAtNode:() => false}}}}};
    const context = {window, document, queueMicrotask, JSON, Date,
        localStorage:{getItem:k => storage.get(k) ?? null, setItem:(k, v) => storage.set(k, String(v)), removeItem:k => storage.delete(k)},
        setTimeout:fn => { timers.push(fn); return timers.length; }, clearTimeout() {}};
    vm.createContext(context);
    const clean = vm.runInContext(functions + ';createCleanController()', context);
    const run = n => { for (let i = 0; i < n; i++) timers.at(-1)(); };
    const fire = (type, event) => { for (const fn of [...listeners.get(type) || []]) fn(event); return event; };
    return {clean, run, fire, window, items, option, label, input, acj, storage};
}
const userClick = target => ({isTrusted:true, target, preventDefault() {}, stopPropagation() {}});

{
    // 1. Native sender: a changed sidebar is retried briefly, never once per tick forever.
    const h = harness();
    let renders = 0;
    h.run(20);
    assert.equal(renders, 0);
    h.window.PlayerAsideApp = {container:{get:k => k === 'component' ? {WrappedComponent:{prototype:{render() { renders++; throw Error('changed'); }}}} : null}};
    h.run(200);
    assert.equal(renders, 3, 'structural sender failures stop after the retry budget');
    assert.ok(h.clean.status().failures.includes('native-sender'));
    const miss = harness();
    let calls = 0;
    miss.window.PlayerAsideApp = {container:{get:k => k === 'component' ? {WrappedComponent:{prototype:{render() { calls++; return null; }}}} : null}};
    miss.run(200);
    assert.equal(calls, 3, 'a sidebar tree without the chat sender also exhausts the budget');
}
console.log('Native sender retry budget: passed');

{
    // 2a. Defaults latch once native state matches; no further clicks.
    const h = harness({checked:true, quarterSelected:true});
    h.run(5);
    assert.equal(h.clean.status().defaults, 'applied');
    assert.equal(h.option.clicks, 0); assert.equal(h.acj.length, 0);
}
{
    // 2b. A real user choice stops enforcement; synthetic clicks do not.
    const h = harness();
    h.run(3);
    assert.ok(h.option.clicks > 0); assert.equal(h.acj.length, 1);
    h.fire('click', {isTrusted:false, target:h.label});
    assert.equal(h.clean.status().defaults, 'pending', 'script-issued clicks are not user choices');
    h.fire('click', userClick(h.label));
    assert.equal(h.clean.status().defaults, 'user');
    const clicks = h.option.clicks, sent = h.acj.length;
    h.run(100);
    assert.equal(h.option.clicks, clicks, 'danmaku mode no longer re-selected');
    assert.equal(h.acj.length, sent, 'shield effects no longer re-sent');
}
{
    // 2c. Toggling a shield item in clean mode also counts as the user's choice.
    const h = harness();
    h.run(1);
    h.fire('click', userClick(h.items[2]));
    assert.equal(h.clean.status().defaults, 'user');
    assert.equal(h.acj.at(-1)[1].videoBroadcast, 1, 'native shield service still receives the toggle');
}
{
    // 2d. Unrecognised native state: bounded attempts, then a diagnostic.
    const h = harness();
    h.run(500);
    assert.equal(h.clean.status().defaults, 'timeout');
    assert.equal(h.option.clicks, 40);
    assert.equal(h.acj.length, 5);
    assert.ok(h.clean.status().failures.includes('native-defaults'));
}
{
    // 2e. Full mode: unchecked items are clicked on a slow cadence and stop on user choice.
    const h = harness({mode:'off', quarterSelected:true});
    h.run(15); // the constructor's first tick is attempt 1
    assert.equal(h.items[0].clicks, 0, 'native sidebar gets time to apply its own config');
    h.run(1);
    assert.equal(h.items[0].clicks, 1);
    h.fire('click', userClick(h.items[0]));
    h.run(100);
    assert.equal(h.items[0].clicks, 1);
    assert.equal(h.clean.status().defaults, 'user');
}
{
    // 2f. Controls not yet rendered do not consume the attempt budget.
    const h = harness({controls:false});
    h.run(300);
    assert.equal(h.clean.status().defaults, 'pending');
}
console.log('Native defaults latch, user choice and bounded retries: passed');

{
    // 6. Enter focuses the danmaku input only from non-interactive focus.
    const h = harness();
    const key = target => {
        let prevented = 0;
        h.fire('keydown', {key:'Enter', target, isComposing:false, keyCode:13,
            preventDefault() { prevented++; }, stopPropagation() {}});
        return prevented;
    };
    const body = {closest:() => null, isContentEditable:false};
    assert.equal(key(body), 1); assert.equal(h.input.focused, 1);
    for (const sel of ['button', 'a[href]', '[role="button"]', 'input']) {
        const target = {closest:s => s.split(',').includes(sel) ? target : null, isContentEditable:false};
        assert.equal(key(target), 0, sel + ' keeps its own Enter activation');
    }
    const insideButton = {closest:s => s.includes('button') ? {} : null, isContentEditable:false};
    assert.equal(key(insideButton), 0);
    assert.equal(key({closest:() => null, isContentEditable:true}), 0);
    assert.equal(h.input.focused, 1);
    let stopped = 0;
    h.fire('keydown', {key:'Enter', target:h.input, isComposing:true, keyCode:229, preventDefault() {}, stopPropagation() { stopped++; }});
    assert.equal(stopped, 1, 'IME composition Enter stays with the input method');
    h.clean.stop();
    assert.equal(key(body), 0, 'listeners released on stop');
}
console.log('Quick-send Enter key routing: passed');
