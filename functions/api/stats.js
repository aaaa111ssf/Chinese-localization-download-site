// GET /api/stats - 获取所有模组下载统计 + 收藏统计
import { json } from '../_lib.js';

export async function onRequestGet(context) {
    const { SFS } = context.env;

    // 获取所有 key 列表
    const list = await SFS.list();
    const stats = {};
    const favs = {};

    for (const key of list.keys) {
        if (key.name.startsWith('mod:')) {
            const modName = key.name.slice(4);
            const count = await SFS.get(key.name);
            if (count) stats[modName] = parseInt(count) || 0;
        } else if (key.name.startsWith('fav:')) {
            const modName = key.name.slice(4);
            const count = await SFS.get(key.name);
            const n = parseInt(count, 10) || 0;
            if (n > 0) favs[modName] = n;
        }
    }

    return json({ downloads: stats, favorites: favs }, {
        'Cache-Control': 'public, max-age=60, s-maxage=60'
    });
}

export async function onRequestOptions() {
    return json({});
}
