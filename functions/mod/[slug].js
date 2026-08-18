// GET /mod/[slug] - 独立模组详情页（可分享、可被搜索引擎索引）
// 服务端渲染完整 HTML，含 SEO meta / Open Graph / JSON-LD
import { json } from '../_lib.js';

// Waline 评论服务地址（走主站代理，解决 workers.dev 大陆无法访问）
const WALINE_SERVER = '/waline-proxy';

// Waline 客户端要求 serverURL 为绝对地址，基于请求 origin 拼接
function walineServerUrl(origin) {
    return origin + WALINE_SERVER;
}

// 与前端一致的 slug 生成规则
function toSlug(name) {
    return String(name || '').toLowerCase().trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
}

function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export async function onRequestGet(context) {
    // Cloudflare Pages Functions 的 params 可能返回 URL 编码值，需解码
    let slug = context.params.slug || '';
    try { slug = decodeURIComponent(slug); } catch (e) {}
    const origin = new URL(context.request.url).origin;

    // 读取模组数据
    let data = [];
    try {
        const resp = await fetch(origin + '/data/data.json');
        if (resp.ok) data = await resp.json();
    } catch (e) {
        return new Response('数据加载失败', { status: 500 });
    }

    const file = (Array.isArray(data) ? data : []).find(f => toSlug(f.name) === slug);
    if (!file) {
        return new Response('模组不存在', {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    const images = (Array.isArray(file.images) ? file.images : file.images ? [file.images] : [])
        .filter(u => typeof u === 'string' && u);
    const tags = (Array.isArray(file.tags) ? file.tags : []).map(t => esc(t)).join(' ');
    const pageUrl = origin + '/mod/' + slug;
    const mainUrl = origin + '/';
    const cover = images[0] || '';

    const galleryHtml = images.length > 0
        ? `<div class="mod-gallery">${images.map((img, i) =>
            `<img src="${esc(img)}" alt="${esc(file.name)}预览图${i + 1}" loading="lazy">`).join('')}</div>`
        : '';

    const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: file.name,
        description: file.desc || '',
        image: cover,
        url: pageUrl,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Android, iOS, PC',
        softwareVersion: file.version || 'v1.0',
        author: { '@type': 'Person', name: file.author || 'A Future star' },
        datePublished: file.date || ''
    });

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(file.name)} - SFS汉化模组下载中心</title>
<meta name="description" content="${esc((file.desc || '').slice(0, 150))}">
<meta name="keywords" content="SFS,Spaceflight Simulator,${esc(file.name)},汉化模组,模组下载">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(file.name)} - SFS汉化模组下载中心">
<meta property="og:description" content="${esc((file.desc || '').slice(0, 150))}">
<meta property="og:url" content="${esc(pageUrl)}">
${cover ? `<meta property="og:image" content="${esc(cover)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
${cover ? `<meta name="twitter:image" content="${esc(cover)}">` : ''}
<script type="application/ld+json">${jsonLd}</script>
<link rel="stylesheet" href="/waline/waline.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#0d0d0d;color:#eee;line-height:1.6}
.wrap{max-width:860px;margin:0 auto;padding:24px 16px 60px}
.back{display:inline-block;margin-bottom:20px;color:#7aa2ff;text-decoration:none;font-size:14px}
.back:hover{text-decoration:underline}
.hero{background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:28px;margin-bottom:24px;border:1px solid #2a2a4a}
.hero h1{font-size:26px;margin-bottom:10px;background:linear-gradient(90deg,#4facfe,#00f2fe);-webkit-background-clip:text;background-clip:text;color:transparent}
.tags{margin:10px 0}
.tags span{display:inline-block;background:rgba(122,162,255,.15);color:#7aa2ff;padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;font-size:13px;color:#aab}
.meta .m{background:#1c1c2e;padding:6px 12px;border-radius:8px}
.desc{color:#ccc;font-size:15px;margin:14px 0}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;border:none;cursor:pointer}
.btn-dl{background:linear-gradient(90deg,#4facfe,#00f2fe);color:#001;flex:1;justify-content:center;min-width:180px}
.btn-share{background:#2a2a4a;color:#eee}
.btn-home{background:#1c1c2e;color:#7aa2ff;border:1px solid #2a2a4a}
.stats{display:flex;gap:20px;margin-top:16px;font-size:13px;color:#99a}
.stats .s{display:flex;align-items:center;gap:6px}
.mod-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:24px 0}
.mod-gallery img{width:100%;border-radius:12px;border:1px solid #2a2a4a;display:block}
.section{background:#14141f;border:1px solid #22223a;border-radius:16px;padding:24px;margin-bottom:24px}
.section h2{font-size:18px;margin-bottom:16px;color:#7aa2ff}
.stars{display:flex;gap:6px;cursor:pointer}
.stars svg{width:28px;height:28px;fill:#333;transition:fill .15s}
.stars svg.on{fill:#ffb400}
.rating-info{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.rating-num{font-size:30px;font-weight:700;color:#ffb400}
.rating-count{color:#99a;font-size:13px}
.rating-msg{font-size:13px;color:#7aa2ff;min-height:18px}
.waline-wrap{margin-top:8px}
@media(max-width:600px){.hero h1{font-size:20px}.btn{width:100%}}
</style>
</head>
<body>
<div class="wrap">
    <a class="back" href="${esc(mainUrl)}">← 返回 SFS 汉化模组下载中心</a>
    <div class="hero">
        <h1>${esc(file.name)}</h1>
        <div class="tags">${tags ? tags.split(' ').map(t => `<span>${t}</span>`).join('') : ''}</div>
        <div class="meta">
            <span class="m">版本 ${esc(file.version || 'v1.0')}</span>
            <span class="m">作者 ${esc(file.author || 'A Future star')}</span>
            <span class="m">大小 ${esc(file.size || '未知')}</span>
            <span class="m">兼容 ${esc(file.compat || '1.6.00.3+')}</span>
            <span class="m">更新 ${esc(file.date || '')}</span>
        </div>
        <div class="desc">${esc(file.desc || '暂无描述')}</div>
        <div class="stats" id="modStats">
            <span class="s" id="statDl">下载 <b>--</b></span>
            <span class="s" id="statFav">收藏 <b>--</b></span>
            <span class="s" id="statRating">评分 <b>--</b></span>
        </div>
        <div class="actions">
            <a class="btn btn-dl" href="${esc(file.link || '#')}" target="_blank" rel="noopener" id="dlBtn">下载模组</a>
            <button class="btn btn-share" onclick="sharePage()">分享</button>
            <a class="btn btn-home" href="${esc(mainUrl)}">回到主页</a>
        </div>
    </div>

    ${galleryHtml ? `<div class="section"><h2>预览图</h2>${galleryHtml}</div>` : ''}

    <div class="section">
        <h2>评分</h2>
        <div class="rating-info">
            <div class="rating-num" id="ratingNum">--</div>
            <div class="stars" id="starRow"></div>
            <div class="rating-count" id="ratingCount"></div>
        </div>
        <div class="rating-msg" id="ratingMsg"></div>
    </div>

    <div class="section">
        <h2>评论</h2>
        <div class="waline-wrap" id="waline"></div>
    </div>
</div>

<script src="/waline/waline.js"></script>
<script>
const MOD_NAME = ${JSON.stringify(file.name)};
const MOD_SLUG = ${JSON.stringify(slug)};
const PAGE_URL = ${JSON.stringify(pageUrl)};

/* 统计加载 */
fetch('/api/stats').then(r => r.json()).then(s => {
    const d = (s.downloads || {})[MOD_NAME] || 0;
    const f = (s.favorites || {})[MOD_NAME] || 0;
    document.getElementById('statDl').innerHTML = '下载 <b>' + d + '</b>';
    document.getElementById('statFav').innerHTML = '收藏 <b>' + f + '</b>';
}).catch(() => {});

/* 评分 */
function renderStars(score) {
    const row = document.getElementById('starRow');
    row.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        if (i <= score) svg.classList.add('on');
        svg.innerHTML = '<path d="M12 2l2.9 6.26 6.6.57-5 4.47 1.5 6.7L12 16.9 5.99 20l1.5-6.7-5-4.47 6.6-.57z"/>';
        svg.onclick = () => submitRating(i);
        row.appendChild(svg);
    }
}
function loadRating() {
    fetch('/api/ratings?mod=' + encodeURIComponent(MOD_NAME))
        .then(r => r.json())
        .then(d => {
            document.getElementById('ratingNum').textContent = d.average ? d.average.toFixed(1) : '--';
            document.getElementById('ratingCount').textContent = d.count ? d.count + ' 人评分' : '暂无评分';
            document.getElementById('statRating').innerHTML = '评分 <b>' + (d.average || '--') + '</b>';
            renderStars(d.myScore || 0);
        }).catch(() => {});
}
function submitRating(score) {
    fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mod: MOD_NAME, score })
    }).then(r => r.json()).then(d => {
        if (d.ok) {
            document.getElementById('ratingNum').textContent = d.average.toFixed(1);
            document.getElementById('ratingCount').textContent = d.count + ' 人评分';
            document.getElementById('ratingMsg').textContent = '感谢你的评分！';
            renderStars(score);
        }
    }).catch(() => {
        document.getElementById('ratingMsg').textContent = '评分提交失败，请稍后再试';
    });
}
loadRating();

/* 分享 */
function sharePage() {
    const text = MOD_NAME + ' - SFS汉化模组下载中心';
    if (navigator.share) {
        navigator.share({ title: text, url: PAGE_URL }).catch(() => {});
    } else {
        navigator.clipboard.writeText(PAGE_URL).then(() => {
            alert('链接已复制：' + PAGE_URL);
        });
    }
}

/* 下载上报 */
document.getElementById('dlBtn').addEventListener('click', () => {
    navigator.sendBeacon('/api/log', JSON.stringify({ mod: MOD_NAME }));
});

/* Waline 评论 */
if (window.Waline) {
    Waline.init({
        el: '#waline',
        serverURL: ${JSON.stringify(walineServerUrl(origin))},
        path: '/mod/' + MOD_SLUG,
        lang: 'zh-CN',
        reaction: false,
        pageview: false,
        dark: 'auto'
    });
}
</script>
</body>
</html>`;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
        }
    });
}
