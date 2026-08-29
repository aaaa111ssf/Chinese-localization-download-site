// Functions 共享安全工具：同源写入校验、轻量 IP 限流、评分身份与 JSON 响应。

function hashValue(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return (hash >>> 0).toString(36);
}

export function getIpHash(request) {
    return hashValue(request.headers.get('CF-Connecting-IP') || 'unknown');
}

// 共享工具：生成用户唯一标识（cookie + IP 哈希）。
export function getUserKey(request, cookieOverride = '') {
    const cookieHeader = cookieOverride || request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/sfs_uid=([^;]+)/);
    if (match) return 'ck:' + match[1];
    return 'ip:' + getIpHash(request);
}

// 设置/刷新用户 cookie（用于评分防重复）。
export function ensureUserCookie(request) {
    const cookieHeader = request.headers.get('Cookie') || '';
    if (/sfs_uid=/.test(cookieHeader)) return null;
    const uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return `sfs_uid=${uid}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
}

// 写入接口仅接受由本站同源页面或下列受信域名发起的 POST。
// 公开 GET 接口不受此规则影响。
const ALLOWED_ORIGINS = new Set([
    'https://sfszhmod.pages.dev',
    'https://sfs-cn-mod.pages.dev',
    'https://sfscnmod.7813.cc.cd',
    'https://sfs-mod.izako.cc'
]);

function isAllowedOrigin(origin) {
    return Boolean(origin && ALLOWED_ORIGINS.has(origin));
}

export function isSameOriginWrite(request) {
    const origin = request.headers.get('Origin') || request.headers.get('Referer');
    if (!origin) return false;
    try {
        const requestOrigin = new URL(request.url).origin;
        const sourceOrigin = new URL(origin).origin;
        return sourceOrigin === requestOrigin || isAllowedOrigin(sourceOrigin);
    } catch (error) {
        return false;
    }
}

// 限制模组名长度及控制字符，避免任意请求制造异常 KV/D1 记录。
export function isValidModName(value) {
    return typeof value === 'string'
        && value.length >= 1
        && value.length <= 160
        && !/[\u0000-\u001f\u007f]/.test(value);
}

// Cloudflare KV 的固定时间窗节流。KV 具有最终一致性，因此它是防刷减速层，
// 不是替代 Cloudflare Bot Fight Mode、WAF 或 Turnstile 的精确安全计数器。
export async function consumeRateLimit(context, bucket, windowSeconds, maxRequests) {
    const store = context.env.SFS;
    if (!store) return { allowed: true, retryAfter: 0 };

    const currentWindow = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rl:${bucket}:${getIpHash(context.request)}:${currentWindow}`;
    const used = Number.parseInt(await store.get(key), 10) || 0;
    const retryAfter = Math.max(1, windowSeconds - Math.floor((Date.now() / 1000) % windowSeconds));

    if (used >= maxRequests) return { allowed: false, retryAfter };

    await store.put(key, String(used + 1), { expirationTtl: windowSeconds + 10 });
    return { allowed: true, retryAfter };
}

export function corsHeaders(request) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
        'Content-Type': 'application/json; charset=utf-8'
    };

    const origin = request?.headers.get('Origin');
    if (isAllowedOrigin(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}

export function json(data, options = {}, request) {
    const { status = 200, ...headers } = options;
    const body = status === 204 ? null : JSON.stringify(data);
    return new Response(body, {
        status,
        headers: { ...corsHeaders(request), ...headers }
    });
}
