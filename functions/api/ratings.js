// GET /api/ratings?mod=模组名 -> { average, count, myScore }
// POST /api/ratings { mod, score } -> 提交/更新评分
import { consumeRateLimit, getUserKey, ensureUserCookie, isSameOriginWrite, isValidModName, json } from '../_lib.js';

const RATING_WINDOW_SECONDS = 60;
const RATING_LIMIT_PER_WINDOW = 5;

export async function onRequestGet(context) {
    const { SFS_DB } = context.env;
    const url = new URL(context.request.url);
    const mod = (url.searchParams.get('mod') || '').trim();
    if (!isValidModName(mod)) return json({ error: '无效的模组名称' }, { status: 400 }, context.request);

    const userKey = getUserKey(context.request);
    const [summary, mine] = await Promise.all([
        SFS_DB.prepare(
            'SELECT COUNT(*) as count, AVG(score) as avg FROM ratings WHERE mod_name = ?'
        ).bind(mod).first(),
        SFS_DB.prepare(
            'SELECT score FROM ratings WHERE mod_name = ? AND user_key = ?'
        ).bind(mod, userKey).first()
    ]);

    return json({
        count: summary.count || 0,
        average: summary.avg ? Math.round(summary.avg * 10) / 10 : 0,
        myScore: mine ? mine.score : 0
    }, { 'Cache-Control': 'no-store' }, context.request);
}

export async function onRequestPost(context) {
    if (!isSameOriginWrite(context.request)) {
        return json({ error: '仅允许由本站页面提交评分' }, { status: 403 }, context.request);
    }

    const rate = await consumeRateLimit(context, 'ratings', RATING_WINDOW_SECONDS, RATING_LIMIT_PER_WINDOW);
    if (!rate.allowed) {
        return json(
            { error: '评分操作过于频繁，请稍后再试' },
            { status: 429, 'Retry-After': String(rate.retryAfter), 'Cache-Control': 'no-store' },
            context.request
        );
    }

    const { SFS_DB } = context.env;
    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        return json({ error: '无效的 JSON' }, { status: 400 }, context.request);
    }
    const mod = String(body.mod || '').trim();
    const score = Number.parseInt(body.score, 10);
    if (!isValidModName(mod)) return json({ error: '无效的模组名称' }, { status: 400 }, context.request);
    if (!score || score < 1 || score > 5) return json({ error: '评分需在 1-5 之间' }, { status: 400 }, context.request);

    // 首次评分即使用即将写入的 cookie，避免首次按 IP、后续按 cookie 产生重复记录。
    const cookie = ensureUserCookie(context.request);
    const userKey = getUserKey(context.request, cookie || '');

    await SFS_DB.prepare(
        `INSERT INTO ratings (mod_name, user_key, score, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(mod_name, user_key)
         DO UPDATE SET score = excluded.score, updated_at = datetime('now')`
    ).bind(mod, userKey, score).run();

    const summary = await SFS_DB.prepare(
        'SELECT COUNT(*) as count, AVG(score) as avg FROM ratings WHERE mod_name = ?'
    ).bind(mod).first();

    const headers = { 'Cache-Control': 'no-store' };
    if (cookie) headers['Set-Cookie'] = cookie;

    return json({
        ok: true,
        count: summary.count || 0,
        average: summary.avg ? Math.round(summary.avg * 10) / 10 : 0,
        myScore: score
    }, headers, context.request);
}

export async function onRequestOptions(context) {
    return json({}, { status: 204 }, context.request);
}
