const assert = require('node:assert/strict');
const vm = require('node:vm');
const {source, load} = require('./harness.cjs');
const cases = [
    ['Safari', 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', true, false],
    ['Chrome', 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36', false, true],
    ['Edge', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', false, true],
    ['Chromium', 'Mozilla/5.0 AppleWebKit/537.36 Chromium/142.0.0.0 Safari/537.36', false, true],
    ['Firefox', 'Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/144.0', false, false],
];
const prefix = source.slice(0, source.indexOf('    const navigation = installRoomNavigationBoundary();'));
for (const [name, userAgent, safari, chromium] of cases) {
    const {BROWSER} = load({navigator:{userAgent}});
    assert.equal(BROWSER.isSafari,safari,name);
    assert.equal(BROWSER.isChromium,chromium,name);
    assert.equal(BROWSER.guardLivePreload,safari,name);
    for (const frame of [false,true]) {
        const window = {};
        window.self=window; window.top=frame?{}:window;
        vm.runInNewContext(prefix+'window.admitted=true;})();', {
            window,navigator:{userAgent},document:{readyState:'loading'},performance:{now:()=>0},
        });
        assert.equal(!!window.admitted,!frame&&(safari||chromium),name+' frame='+frame);
    }
}
console.log('Safari/Chromium policy, unsupported browser and iframe admission: passed');
