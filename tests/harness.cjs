// Read-only factory extraction: the single-file userscript needs no test/build exports.
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('douyu-safari-performance-guard.user.js', 'utf8');
const config = source.slice(source.indexOf('    const DOUYU = {'), source.indexOf('    if (window.top'));
const functions = source.slice(source.indexOf('    function installRoomNavigationBoundary()'), source.indexOf('    const analytics = installAnalyticsSinks();'));
const names = ['installRoomNavigationBoundary', 'installPageLifecycle', 'createOptionalResourceGate',
    'createPlayerModuleTrim', 'createAdapterHealth', 'createDiagnostics', 'createCleanController',
    'installStartupQuality', 'createPreloadGuard', 'installAnalyticsSinks', 'createQualityRecovery'];
function load(context = {}) {
    vm.createContext(context);
    vm.runInContext(config + functions + '\nObject.assign(globalThis, {DOUYU, DISCOVERY_WINDOW_MS, ' + names.join(',') + '});', context);
    return context;
}
module.exports = {source, config, load};
