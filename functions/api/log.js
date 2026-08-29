// POST /api/log - 记录一次下载（KV 计数 + D1 下载记录）。
// 正常用户下载不受阻断；仅限制跨站 POST 和同一 IP 的短时间批量刷量。
import { consumeRateLimit, getIpHash, isSameOriginWrite, isValidModName, json } from '../_lib.js';

const LOG_WINDOW_SECONDS = 30;
const LOG_LIMIT_PER_WINDOW = 8;

export async function onRequestPost(context) {
    if (!isSameOriginWrite(context.request)) {
        return json({ error: '仅允许由本站页面提交下载记录' }, { status: 403 }, context.request);
    }

    const rate = await consumeRateLimit(context, 'download-log', LOG_WINDOW_SECONDS, LOG_LIMIT_PER_WINDOW);
    if (!rate.allowed) {
        return json(
            { error: '请求过于频繁，请稍后再试' },
            { status: 429, 'Retry-After': String(rate.retryAfter), 'Cache-Control': 'no-store' },
            context.request
        );
    }

    const { SFS, SFS_DB } = context.env;
    let body;
    try {
        body = await context.request.json();
    } catch (error) {
        return json({ error: '无效的 JSON' }, { status: 400 }, context.request);
    }

    const modName = String(body.mod || '').trim();
    if (!isValidModName(modName)) {
        return json({ error: '无效的模组名称' }, { status: 400 }, context.request);
    }

    const key = 'mod:' + modName;
    const current = await SFS.get(key);
    const newCount = (Number.parseInt(current, 10) || 0) + 1;
    await SFS.put(key, String(newCount));

    if (SFS_DB) {
        const ipHash = getIpHash(context.request);
        const ua = (context.request.headers.get('User-Agent') || '').slice(0, 200);
        try {
            await SFS_DB.prepare(
                'INSERT INTO downloads (mod_name, ip_hash, ua, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
            ).bind(modName, ipHash, ua).run();
        } catch (error) {
            // D1 不可用时不影响用户下载和 KV 计数。
        }
    }

    return json({ ok: true, count: newCount }, { 'Cache-Control': 'no-store' }, context.request);
}

export async function onRequestOptions(context) {
    return json({}, { status: 204 }, context.request);
}
