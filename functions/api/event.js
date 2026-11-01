// 赞助入口的点击统计：POST 记一次，GET 读回数字，只存计数不存用户信息。
import { consumeRateLimit, isSameOriginWrite, json } from '../_lib.js';

// 只允许这几个事件名，防止有人往 KV 里乱写 key
const ALLOWED_EVENTS = new Set(['sponsor_open', 'sponsor_click', 'sponsor_qr', 'banner_click']);

// summary: 记录一次点击事件
export async function onRequestPost(context) {
    if (!isSameOriginWrite(context.request)) {
        return json({ error: '仅允许由本站页面上报' }, { status: 403 }, context.request);
    }

    const rate = await consumeRateLimit(context, 'event', 60, 30);
    if (!rate.allowed) return json({ ok: false }, { status: 429 }, context.request);

    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        return json({ error: '无效的 JSON' }, { status: 400 }, context.request);
    }

    const name = String(body && body.name || '');
    if (!ALLOWED_EVENTS.has(name)) {
        return json({ error: '未知事件' }, { status: 400 }, context.request);
    }

    const { SFS } = context.env;
    if (!SFS) return json({ ok: false }, { status: 503 }, context.request);

    try {
        const key = 'evt:' + name;
        const current = Number.parseInt(await SFS.get(key), 10) || 0;
        await SFS.put(key, String(current + 1));
    } catch (e) {
        // 统计失败不影响页面
        return json({ ok: false }, { status: 200 }, context.request);
    }

    return json({ ok: true }, { 'Cache-Control': 'no-store' }, context.request);
}

// summary: 读回各事件的累计次数，方便判断赞助入口有没有人点
export async function onRequestGet(context) {
    const { SFS } = context.env;
    if (!SFS) return json({ error: 'KV 未绑定（SFS）' }, { status: 503 }, context.request);

    const list = await SFS.list({ prefix: 'evt:' });
    const counts = {};
    for (const key of list.keys) {
        counts[key.name.slice(4)] = Number.parseInt(await SFS.get(key.name), 10) || 0;
    }
    return json({ counts }, { 'Cache-Control': 'no-store' }, context.request);
}

export async function onRequestOptions(context) {
    return json({}, { status: 204 }, context.request);
}
