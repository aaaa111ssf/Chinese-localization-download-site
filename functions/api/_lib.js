// 共享工具：生成用户唯一标识（cookie + IP 哈希）
export function getUserKey(request, cookieOverride = '') {
    const cookieHeader = cookieOverride || request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/sfs_uid=([^;]+)/);
    if (match) return 'ck:' + match[1];
    // 无 cookie 时用 IP 哈希
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
        hash = ((hash << 5) - hash + ip.charCodeAt(i)) | 0;
    }
    return 'ip:' + (hash >>> 0).toString(36);
}

// 设置/刷新用户 cookie（用于评分防重复）
export function ensureUserCookie(request) {
    const cookieHeader = request.headers.get('Cookie') || '';
    if (/sfs_uid=/.test(cookieHeader)) return null;
    const uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return `sfs_uid=${uid}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
}

export function json(data, extra = {}) {
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders(), ...extra } });
}
