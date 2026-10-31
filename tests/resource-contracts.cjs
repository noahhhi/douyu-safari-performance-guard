const assert = require('node:assert/strict');
const {load} = require('./harness.cjs');
const c = load({URL, location:{href:'https://www.douyu.com/93589'}, localStorage:{getItem:()=>null}, queueMicrotask:()=>{}});
const {DOUYU, createOptionalResourceGate} = c;
// Frozen pre-refactor contracts: changing config must not accidentally expand the default gate.
const legacyPackages = [
    'audio-social-web-front-master', 'yuba-hot-topic-master',
    'live-act-diamond-carnival-master', 'live-activity-common-pendant-master',
    'live-activity-gift-hall-master', 'live-activity-gift-naming-master',
    'live-activity-modules-master', 'live-advanced-gift-master',
    'live-anchor-collect-task-master', 'live-coconut-fantasy-island-master',
    'live-crazy-interstellar-master', 'live-desert-relic-master',
    'live-duel-peak-master', 'live-magic-awakening-master',
    'live-new-anchor-support-master', 'live-pandora-box-master',
    'live-pubg-game-prop-shop-master', 'live-random-effect-gift-master',
    'live-random-effect-gift-v3-master', 'live-random-effect-gift-v4-master',
    'live-super-fans-master', 'live-the-great-voyage-master',
    'live-water-friends-festival-master', 'live-wishing-gift-master',
    'new-revenue-web-front-master', 'live-business-component-master',
    'live-confession-gift-master', 'live-diamond-fans-match-master',
    'live-test-get-anchor-master', 'live-tiger-envelope-master',
    'room-admin-menu-master', 'live-game-guess-master', 'live-pk-progress-master',
    'live-recharge-feedback-master', 'live-skit-master', 'live-task-master',
    'live-account-transactions-master', 'live-anchor-interactive-tool-master',
];
const legacyAside = 'NobleReminder|ChatRankAll|FansRankAll|DiamondsFansRankBottom|BarrageGroup|SvgaConfigEffectContainer|YBCommunity|DiamondsFansEffect|TbActPopup|ChatEffect|AnchorLevelUp|FollowTips|WishGiftMsg|PrivilegeGift|HighEnergyTips|FansFeedback|StarVoteTips|MatchSystemV2Card|ProgramBookletTips|PopularBarrage|MedalDialog|MedalPanel|MedalDroppingPanel|UserGuide|UpgradeEffect|GuideBarrage|HotBarrage|BarrageCounter|UserGameDataPanel'.split('|');
// v3.7.0 adds the clean-mode page categories (pageHeader, videoAssets); tests/v37-rules.cjs covers them.
const pagePackages = ['header-master', 'live-video-assets-master'];
assert.deepEqual(Object.values(DOUYU.resourceCategories).flatMap(c=>Array.from(c.packages||[])).sort(), [...legacyPackages, ...pagePackages].sort());
assert.deepEqual(Array.from(DOUYU.asideChunks), legacyAside);
assert.equal(DOUYU.resourceRules.length,1);
assert.equal(DOUYU.iframes.length,3);
// v3.7.0 rule categories are covered in tests/v37-rules.cjs; nothing else may add rules.
for (const [name, category] of Object.entries(DOUYU.resourceCategories)) {
    if (!['ads','roomWidgets','anchorTools','analytics','followGroups'].includes(name)) assert.equal(category.rules?.length || 0,0,name);
}
function blocked(gate, url, kind='script') {
    const attr = kind === 'link' ? 'href' : 'src', attrs = {[attr]:url};
    gate.prepare({nodeType:1, localName:kind, getAttribute:k=>attrs[k], setAttribute:(k,v)=>attrs[k]=v,
        removeAttribute:k=>delete attrs[k], dispatchEvent(){}});
    return attrs[attr] === undefined;
}
const gate = createOptionalResourceGate();
for (const pkg of legacyPackages) {
    for (const kind of ['script','link','iframe']) {
        assert.equal(blocked(gate, `https://shark2.douyucdn.cn/front-publish/${pkg}/js/main.js`, kind), kind !== 'iframe');
        assert.equal(blocked(gate, `https://douyucdn.cn/front-publish/${pkg}/style.css?x=1`, kind), kind !== 'iframe');
        for (const host of ['douyucdn.cn.evil.test','evildouyucdn.cn','www.douyu.com']) {
            assert.equal(blocked(gate, `https://${host}/front-publish/${pkg}/main.js`, kind), false);
        }
    }
    assert.equal(blocked(gate, `https://shark2.douyucdn.cn/other/${pkg}/main.js`), false);
}
for (const name of legacyAside) {
    const base = 'https://shark2.douyucdn.cn/front-publish/live-next-player-aside-master/js/';
    assert.equal(blocked(gate, base + name + '_abc.js'), true);
    for (const file of [name+'.js', name+'Extra_abc.js', 'prefix'+name+'_abc.js']) assert.equal(blocked(gate, base+file), false);
    assert.equal(blocked(gate, base.replace('aside-master','master')+name+'_abc.js'), false);
}
for (const url of ['https://www.douyu.com/pages/ord-task-center','https://msg.douyu.com/web/index.html','https://game.weixin.qq.com/sdk/wxgamesdkframe.html']) {
    assert.equal(blocked(gate, url, 'iframe'), true);
    assert.equal(blocked(gate, url, 'script'), false);
    assert.equal(blocked(gate, url+'/extra', 'iframe'), false);
}
assert.equal(blocked(gate, 'https://game.weixin.qq.com/sdk/wxgamesdk.js'), true);
assert.equal(blocked(gate, 'https://game.weixin.qq.com/sdk/wxgamesdk.js', 'iframe'), false);
// Synthetic fixtures only: no new production blocking candidates.
DOUYU.resourceCategories.games.enabled = false;
let changed = createOptionalResourceGate();
assert.equal(blocked(changed, 'https://shark2.douyucdn.cn/front-publish/live-game-guess-master/a.js'), false);
assert.equal(blocked(changed, 'https://game.weixin.qq.com/sdk/wxgamesdk.js'), false);
assert.equal(blocked(changed, 'https://game.weixin.qq.com/sdk/wxgamesdkframe.html', 'iframe'), false);
assert.equal(blocked(changed, 'https://shark2.douyucdn.cn/front-publish/live-task-master/a.js'), true);
DOUYU.resourceCategories.analytics.rules.push({host:'fixture.invalid', pkg:'fixture-package', fileRegex:/^Optional_[a-f0-9]+\.js$/g});
DOUYU.resourceCategories.analytics.rules.push({host:/^stats\.fixture\.invalid$/, pathnameRegex:/^\/example\.js$/});
changed = createOptionalResourceGate();
for (let i=0;i<2;i++) assert.equal(blocked(changed, 'https://fixture.invalid/front-publish/fixture-package/js/Optional_abc.js'), true, 'regex lastIndex must reset');
for (const url of ['https://other.invalid/front-publish/fixture-package/Optional_abc.js', 'https://fixture.invalid/front-publish/other/Optional_abc.js', 'https://fixture.invalid/front-publish/fixture-package/Core_abc.js', 'https://fixture.invalid/fixture-package/Optional_abc.js']) assert.equal(blocked(changed,url), false);
assert.equal(blocked(changed, 'https://stats.fixture.invalid/example.js', 'link'), true);
assert.equal(blocked(changed, 'https://stats.fixture.invalid/example.js', 'iframe'), false);
DOUYU.resourceCategories.analytics.enabled = false;
assert.equal(blocked(createOptionalResourceGate(), 'https://fixture.invalid/front-publish/fixture-package/Optional_abc.js'), false);
DOUYU.resourceCategories.aside.enabled = false;
assert.equal(blocked(createOptionalResourceGate(), 'https://shark2.douyucdn.cn/front-publish/live-next-player-aside-master/NobleReminder_abc.js'), false);
console.log('Frozen resource contracts, category flags and config-only host/package/file rules: passed');
