// POST /api/log - 记录一次下载
export async function onRequestPost(context) {
    const { SFS } = context.env;
    const body = await context.request.json();
    const modName = body.mod;

    if (!modName) {
        return new Response(JSON.stringify({ error: '缺少 mod 参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // KV key 格式: mod:模组名
    const key = 'mod:' + modName;
    const current = await SFS.get(key);
    const newCount = (parseInt(current) || 0) + 1;
    await SFS.put(key, String(newCount));

    return new Response(JSON.stringify({ ok: true, count: newCount }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// OPTIONS - CORS 预检
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
