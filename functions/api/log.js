// POST /api/log - 记录一次下载（KV 计数 + D1 下载记录）
import { json } from '../_lib.js';

export async function onRequestPost(context) {
    const { SFS, SFS_DB } = context.env;
    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        return json({ error: '无效的 JSON' }, { status: 400 });
    }
    const modName = (body.mod || '').trim();
    if (!modName) return json({ error: '缺少 mod 参数' }, { status: 400 });

    // KV 计数
    const key = 'mod:' + modName;
    const current = await SFS.get(key);
    const newCount = (parseInt(current) || 0) + 1;
    await SFS.put(key, String(newCount));

    // D1 下载记录（用于最近下载榜）
    if (SFS_DB) {
        const ip = context.request.headers.get('CF-Connecting-IP') || '';
        let ipHash = '';
        if (ip) {
            let h = 0;
            for (let i = 0; i < ip.length; i++) h = ((h << 5) - h + ip.charCodeAt(i)) | 0;
            ipHash = (h >>> 0).toString(36);
        }
        const ua = (context.request.headers.get('User-Agent') || '').slice(0, 200);
        try {
            await SFS_DB.prepare(
                'INSERT INTO downloads (mod_name, ip_hash, ua, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
            ).bind(modName, ipHash, ua).run();
        } catch (e) {
            // D1 不可用时不影响计数
        }
    }

    return json({ ok: true, count: newCount }, { 'Cache-Control': 'no-store' });
}

export async function onRequestOptions() {
    return json({});
}
