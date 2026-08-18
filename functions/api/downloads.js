// GET /api/downloads?mod=模组名&limit=20 -> 最近下载记录
// GET /api/downloads?limit=20 -> 全站最近下载
import { json } from '../_lib.js';

export async function onRequestGet(context) {
    const { SFS_DB } = context.env;
    const url = new URL(context.request.url);
    const mod = url.searchParams.get('mod');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 50);

    let rows;
    if (mod) {
        rows = await SFS_DB.prepare(
            'SELECT mod_name, created_at FROM downloads WHERE mod_name = ? ORDER BY id DESC LIMIT ?'
        ).bind(mod, limit).all();
    } else {
        rows = await SFS_DB.prepare(
            'SELECT mod_name, created_at FROM downloads ORDER BY id DESC LIMIT ?'
        ).bind(limit).all();
    }

    return json({ records: rows.results || [] });
}

export async function onRequestOptions() {
    return json({});
}
