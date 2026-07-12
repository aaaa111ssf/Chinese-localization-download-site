// GET /api/stats - 获取所有模组下载统计
export async function onRequestGet(context) {
    const { SFS } = context.env;

    // 获取所有 key 列表
    const list = await SFS.list();
    const stats = {};

    for (const key of list.keys) {
        if (key.name.startsWith('mod:')) {
            const modName = key.name.slice(4);
            const count = await SFS.get(key.name);
            if (count) stats[modName] = parseInt(count) || 0;
        }
    }

    return new Response(JSON.stringify(stats), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=60, s-maxage=60'
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
