const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function context(file, globals = {}) {
  const ctx = vm.createContext({ setTimeout, ...globals });
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return ctx;
}
test('download works without Blob or createObjectURL and propagates rejection', async () => {
  let request;
  const ctx = context('utils/export.js', { chrome: { downloads: { download: async opts => { request = opts; return 42; } } } });
  assert.equal(await ctx.downloadFile('中文\n#?', 'test.json', 'application/json'), 42);
  assert.equal(decodeURIComponent(request.url.split(',')[1]), '中文\n#?');
  ctx.chrome.downloads.download = async () => { throw new Error('cancelled'); };
  await assert.rejects(ctx.exportData({ platform: 'x', category: 'likes', items: [] }, 'json'), /cancelled/);
});
test('429 exhaustion is explicit', async () => {
  let calls = 0;
  const ctx = context('utils/api.js', { setTimeout: fn => fn(), fetch: async () => { calls++; return { status: 429, headers: { get: () => '0' } }; } });
  await assert.rejects(ctx.fetchWithCookies('test'), /429/);
  assert.equal(calls, 3);
});
test('pagination starts with default cursor, deduplicates and detects loops', async () => {
  const ctx = context('utils/api.js');
  const items = await ctx.fetchAllPages(async ({ cursor = 0 }) => cursor === 0 ? { items: [{ id: '1' }], nextCursor: 'next' } : { items: [{ id: '1' }, { id: '2' }], nextCursor: null });
  assert.equal(items.length, 2);
  await assert.rejects(ctx.fetchAllPages(async () => ({ items: [{ id: '1' }], nextCursor: 'same' })), /repeated/);
  await assert.rejects(ctx.fetchAllPages(async () => undefined), /Invalid/);
});
test('bridge targets an active platform tab and preserves errors', async () => {
  let target;
  const ctx = context('utils/api.js', { chrome: { tabs: {
    query: async () => [{ id: 1 }, { id: 2, active: true }],
    sendMessage: async id => { target = id; return { data: { ok: true } }; }
  } } });
  assert.equal((await ctx.sendToPlatformTab('www.douyin.com', {})).data.ok, true);
  assert.equal(target, 2);
  ctx.chrome.tabs.sendMessage = async () => ({ error: 'API rejected' });
  await assert.rejects(ctx.sendToPlatformTab('www.douyin.com', {}), /API rejected/);
  ctx.chrome.tabs.query = async () => [];
  await assert.rejects(ctx.sendToPlatformTab('www.douyin.com', {}), /Open/);
});
test('YouTube parses localized shelf channels and direct continuation', () => {
  const ctx = context('platforms/youtube.js');
  const data = { contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { selected: true, title: '频道', content: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [{ shelfRenderer: { content: { expandedShelfContentsRenderer: { items: [{ channelRenderer: { channelId: 'abc', title: { runs: [{ text: '频道' }] } } }, { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'next' } } } }] } } } }] } }] } } } }] } } };
  ctx.input = JSON.stringify(data);
  const result = vm.runInContext('PlatformYouTube.parseSubscriptionsData(input)', ctx);
  assert.equal(result.items[0].id, 'abc');
  assert.equal(result.nextCursor, 'next');
  assert.throws(() => vm.runInContext('PlatformYouTube.parseSubscriptionsData("invalid")', ctx), /Cannot parse/);
});
test('switching platforms selects a valid category', () => {
  let click;
  const button = { dataset: { platform: 'youtube' }, classList: { add() {} }, addEventListener: (_, fn) => { click = fn; } };
  const container = { innerHTML: '', querySelectorAll: () => [] };
  const ctx = context('popup/popup.js', { document: { addEventListener() {}, querySelectorAll: () => [button], querySelector: () => null, getElementById: () => container } });
  vm.runInContext('initPlatformButtons()', ctx);
  click();
  assert.equal(vm.runInContext('selectedCategories[0]', ctx), 'subscriptions');
});
test('X likes uses max_id pagination without losing 64-bit precision', async () => {
  const urls = [];
  const ctx = context('utils/api.js');
  ctx.getCookieForDomain = async () => [];
  ctx.fetchWithCookies = async url => {
    urls.push(url);
    if (url.includes('verify_credentials')) return { id_str: 'me' };
    if (urls.length === 2) return Array.from({ length: 200 }, (_, i) => ({ id_str: String(9007199254741999n - BigInt(i)), user: { screen_name: 'user', name: 'User' } }));
    return [];
  };
  vm.runInContext(fs.readFileSync('platforms/x.js', 'utf8'), ctx);
  const result = await vm.runInContext('PlatformX.fetch("likes")', ctx);
  assert.equal(result.length, 200);
  assert.match(urls[2], /max_id=9007199254741799/);
});
test('export validates categories and waits for download errors', async () => {
  const globals = { importScripts() {}, chrome: { runtime: { onMessage: { addListener() {} } } } };
  for (const name of ['X', 'Instagram', 'TikTok', 'Bilibili', 'YouTube', 'Weibo', 'Xiaohongshu', 'Douyin']) globals[`Platform${name}`] = { categories: ['following'], fetch: async () => [{ id: '1' }] };
  globals.exportData = async () => { throw new Error('Download failed'); };
  const ctx = context('background/service-worker.js', globals);
  await assert.rejects(ctx.handleExport({ platform: 'x', categories: ['invalid'], format: 'json', maxItems: 10 }), /valid categories/);
  await assert.rejects(ctx.handleExport({ platform: 'x', categories: ['following'], format: 'json', maxItems: 10 }), /Download failed/);
});
