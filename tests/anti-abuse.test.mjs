import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestPost as logDownload } from '../functions/api/log.js';
import { onRequestPost as submitRating } from '../functions/api/ratings.js';

function createKv() {
    const values = new Map();
    return {
        async get(key) {
            return values.get(key) ?? null;
        },
        async put(key, value) {
            values.set(key, String(value));
        }
    };
}

function createRequest(path, body, origin = 'https://sfszhmod.pages.dev') {
    return new Request(`https://sfszhmod.pages.dev${path}`, {
        method: 'POST',
        headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.8',
            'User-Agent': 'anti-abuse-test'
        },
        body: JSON.stringify(body)
    });
}

function createRefererOnlyRequest(path, body) {
    return new Request(`https://sfszhmod.pages.dev${path}`, {
        method: 'POST',
        headers: {
            Referer: 'https://sfszhmod.pages.dev/',
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.8',
            'User-Agent': 'anti-abuse-test'
        },
        body: JSON.stringify(body)
    });
}

function createRatingsDb() {
    let score = null;
    return {
        prepare(query) {
            return {
                bind(...params) {
                    return {
                        async first() {
                            if (query.includes('SELECT score')) return score == null ? null : { score };
                            if (query.includes('COUNT(*)')) return { count: score == null ? 0 : 1, avg: score };
                            return null;
                        },
                        async run() {
                            score = params[2];
                            return { success: true };
                        }
                    };
                }
            };
        }
    };
}

// 同源下载统计正常计数，跨站脚本被拒绝。
const downloadKv = createKv();
const allowedDownload = await logDownload({
    request: createRequest('/api/log', { mod: '测试模组' }),
    env: { SFS: downloadKv }
});
assert.equal(allowedDownload.status, 200);
assert.equal((await allowedDownload.json()).count, 1);

const refererOnlyDownload = await logDownload({
    request: createRefererOnlyRequest('/api/log', { mod: 'Referer 回退测试' }),
    env: { SFS: downloadKv }
});
assert.equal(refererOnlyDownload.status, 200);

const blockedDownload = await logDownload({
    request: createRequest('/api/log', { mod: '测试模组' }, 'https://example.invalid'),
    env: { SFS: downloadKv }
});
assert.equal(blockedDownload.status, 403);

// 同一 IP 的第 9 个下载统计写入在 30 秒窗口内应被节流。
const limitKv = createKv();
for (let index = 0; index < 8; index++) {
    const response = await logDownload({
        request: createRequest('/api/log', { mod: `限流测试-${index}` }),
        env: { SFS: limitKv }
    });
    assert.equal(response.status, 200);
}
const throttledDownload = await logDownload({
    request: createRequest('/api/log', { mod: '限流测试-9' }),
    env: { SFS: limitKv }
});
assert.equal(throttledDownload.status, 429);
assert.ok(throttledDownload.headers.get('Retry-After'));

// 评分仅允许同源写入，合法用户仍可完成评分。
const ratingDb = createRatingsDb();
const blockedRating = await submitRating({
    request: createRequest('/api/ratings', { mod: '测试模组', score: 5 }, 'https://example.invalid'),
    env: { SFS: createKv(), SFS_DB: ratingDb }
});
assert.equal(blockedRating.status, 403);

const allowedRating = await submitRating({
    request: createRequest('/api/ratings', { mod: '测试模组', score: 5 }),
    env: { SFS: createKv(), SFS_DB: ratingDb }
});
assert.equal(allowedRating.status, 200);
assert.equal((await allowedRating.json()).myScore, 5);

const robots = await readFile(new URL('../robots.txt', import.meta.url), 'utf8');
assert.match(robots, /Content-signal: search=yes, ai-input=no, ai-train=no/);
assert.match(robots, /User-agent: GPTBot\s+Disallow: \//s);
assert.match(robots, /User-agent: ClaudeBot\s+Disallow: \//s);

console.log('Anti-abuse tests passed.');
