// GET /api/ratings?mod=模组名 -> { average, count, myScore }
// POST /api/ratings { mod, score } -> 提交/更新评分
import { getUserKey, ensureUserCookie, json } from '../_lib.js';

export async function onRequestGet(context) {
    const { SFS_DB } = context.env;
    const url = new URL(context.request.url);
    const mod = url.searchParams.get('mod');
    if (!mod) return json({ error: '缺少 mod 参数' }, { status: 400 });

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
    });
}

export async function onRequestPost(context) {
    const { SFS_DB } = context.env;
    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        return json({ error: '无效的 JSON' }, { status: 400 });
    }
    const mod = (body.mod || '').trim();
    const score = parseInt(body.score, 10);
    if (!mod) return json({ error: '缺少 mod 参数' }, { status: 400 });
    if (!score || score < 1 || score > 5) return json({ error: '评分需在 1-5 之间' }, { status: 400 });

    const userKey = getUserKey(context.request);
    const cookie = ensureUserCookie(context.request);

    await SFS_DB.prepare(
        `INSERT INTO ratings (mod_name, user_key, score, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(mod_name, user_key)
         DO UPDATE SET score = excluded.score, updated_at = datetime('now')`
    ).bind(mod, userKey, score).run();

    const summary = await SFS_DB.prepare(
        'SELECT COUNT(*) as count, AVG(score) as avg FROM ratings WHERE mod_name = ?'
    ).bind(mod).first();

    const headers = {};
    if (cookie) headers['Set-Cookie'] = cookie;

    return json({
        ok: true,
        count: summary.count || 0,
        average: summary.avg ? Math.round(summary.avg * 10) / 10 : 0,
        myScore: score
    }, headers);
}

export async function onRequestOptions() {
    return json({});
}
