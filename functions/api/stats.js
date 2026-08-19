// GET /api/stats - 获取所有模组下载统计 + 收藏统计
import { json } from '../_lib.js';

export async function onRequestGet(context) {
    const { SFS } = context.env;

    // 获取所有 key 列表
    const list = await SFS.list();
    const stats = {};

    for (const key of list.keys) {
        if (!key.name.startsWith('mod:')) continue;
        const modName = key.name.slice(4);
        const count = await SFS.get(key.name);
        if (count) stats[modName] = parseInt(count, 10) || 0;
    }

    return json({ downloads: stats }, {
        'Cache-Control': 'no-store'
    });
}

export async function onRequestOptions() {
    return json({});
}
