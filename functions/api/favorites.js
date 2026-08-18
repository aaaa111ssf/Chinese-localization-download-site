// GET /api/favorites -> 所有模组收藏统计 { mod: count }
// POST /api/favorites { mod, action: 'add'|'remove' } -> 更新收藏计数
import { json } from '../_lib.js';

export async function onRequestGet(context) {
    const { SFS } = context.env;
    const list = await SFS.list({ prefix: 'fav:' });
    const stats = {};
    for (const key of list.keys) {
        const name = key.name.slice(4);
        const val = await SFS.get(key.name);
        const n = parseInt(val, 10) || 0;
        if (n > 0) stats[name] = n;
    }
    return json(stats, { 'Cache-Control': 'public, max-age=60, s-maxage=60' });
}

export async function onRequestPost(context) {
    const { SFS } = context.env;
    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        return json({ error: '无效的 JSON' }, { status: 400 });
    }
    const mod = (body.mod || '').trim();
    const action = body.action === 'remove' ? 'remove' : 'add';
    if (!mod) return json({ error: '缺少 mod 参数' }, { status: 400 });

    const key = 'fav:' + mod;
    const current = parseInt(await SFS.get(key) || '0', 10);
    const next = action === 'add' ? current + 1 : Math.max(0, current - 1);
    await SFS.put(key, String(next));

    return json({ ok: true, mod, count: next });
}

export async function onRequestOptions() {
    return json({});
}
