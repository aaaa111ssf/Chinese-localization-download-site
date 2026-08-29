// GET /api/comments?slugs=slug1,slug2,... -> { '/mod/slug1': count, ... }
// 从 D1 的 wl_Comment 表统计每个模组页的评论数（评论 url 为 /mod/slug 格式）
import { json } from '../_lib.js';

export async function onRequestGet(context) {
    const { SFS_DB } = context.env;
    const url = new URL(context.request.url);
    const slugs = (url.searchParams.get('slugs') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 100);

    if (slugs.length === 0) return json({}, {}, context.request);

    // 评论路径统一为 /mod/slug
    const paths = slugs.map(s => '/mod/' + s);
    const placeholders = paths.map(() => '?').join(',');

    try {
        const result = await SFS_DB.prepare(
            `SELECT url, COUNT(*) as count FROM wl_Comment
             WHERE url IN (${placeholders}) AND status = 'approved'
             GROUP BY url`
        ).bind(...paths).all();

        const countMap = {};
        for (const row of result.results || []) {
            countMap[row.url] = row.count;
        }
        return json(countMap, { 'Cache-Control': 'public, max-age=60, s-maxage=60' }, context.request);
    } catch (e) {
        // 表未初始化（Waline 未部署）时降级为空
        return json({}, {}, context.request);
    }
}

export async function onRequestOptions(context) {
    return json({}, { status: 204 }, context.request);
}
