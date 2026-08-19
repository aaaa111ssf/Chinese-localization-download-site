// GET /mod/[slug] - 独立模组详情页（可分享、可被搜索引擎索引）
// 服务端渲染完整 HTML，含 SEO meta / Open Graph / JSON-LD
// 黑白简约风，无评论区

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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#fff;color:#111;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:24px 16px 60px}
.back{display:inline-block;margin-bottom:20px;color:#666;text-decoration:none;font-size:14px;transition:color .2s}
.back:hover{color:#000;text-decoration:underline}
.hero{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px;margin-bottom:24px}
.hero h1{font-size:26px;margin-bottom:10px;font-weight:700;letter-spacing:-.3px}
.tags{margin:10px 0}
.tags span{display:inline-block;background:#f5f5f5;color:#333;padding:3px 12px;border-radius:20px;font-size:12px;margin-right:6px;border:1px solid #eee}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;font-size:13px;color:#555}
.meta .m{background:#fafafa;padding:6px 12px;border-radius:6px;border:1px solid #eee}
.desc{color:#333;font-size:15px;margin:14px 0}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;border:1px solid #111;cursor:pointer;background:#fff;color:#111;transition:all .2s}
.btn:hover{background:#111;color:#fff}
.btn-dl{background:#111;color:#fff;flex:1;min-width:180px}
.btn-dl:hover{background:#333;border-color:#333}
.btn-fav.active{background:#111;color:#fff}
.btn-home{background:#fff;color:#111}
.stats{display:flex;gap:20px;margin-top:16px;font-size:13px;color:#555}
.stats .s{display:flex;align-items:center;gap:6px}
.mod-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:24px 0}
.mod-gallery img{width:100%;border-radius:8px;border:1px solid #e5e5e5;display:block;background:#fafafa}
.section{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;margin-bottom:24px}
.section h2{font-size:18px;margin-bottom:16px;color:#111;font-weight:700;border-bottom:1px solid #eee;padding-bottom:10px}
.rating-info{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.rating-num{font-size:32px;font-weight:700;color:#111;line-height:1}
.rating-count{color:#666;font-size:13px}
.rating-msg{font-size:13px;color:#111;min-height:18px}
/* 双层半星（参考 sfs-cn-mod） */
.stars{display:flex;gap:4px}
.star-wrap{position:relative;display:block;width:26px;height:26px}
.star-wrap svg{width:26px;height:26px;display:block}
.star-svg-base{fill:#e0e0e0}
.star-fill{position:absolute;inset:0;overflow:hidden;display:block}
.star-svg-fill{fill:#111}
.avatar-set-btn{display:none}
@media(max-width:600px){.hero h1{font-size:20px}.btn{width:100%}.hero{padding:20px}}
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
            ${file.heat ? `<span class="m">热力 ${esc(file.heat)}</span>` : ''}
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
            <button class="btn btn-fav" id="favBtn" onclick="toggleFav()">☆ 收藏</button>
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
</div>

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

/* 评分（双层半星，参考 sfs-cn-mod） */
function makeStarSvg(cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', cls);
    svg.innerHTML = '<path d="M12 2l2.9 6.26 6.6.57-5 4.47 1.5 6.7L12 16.9 5.99 20l1.5-6.7-5-4.47 6.6-.57z"/>';
    return svg;
}
function renderStars(score) {
    const row = document.getElementById('starRow');
    row.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const fill = Math.min(1, Math.max(0, score - i + 1));
        const wrap = document.createElement('span');
        wrap.className = 'star-wrap';
        const base = makeStarSvg('star-svg-base');
        const fillSpan = document.createElement('span');
        fillSpan.className = 'star-fill';
        fillSpan.style.width = (fill * 100) + '%';
        fillSpan.appendChild(makeStarSvg('star-svg-fill'));
        wrap.appendChild(base);
        wrap.appendChild(fillSpan);
        wrap.style.cursor = 'pointer';
        wrap.title = '点击评 ' + i + ' 星';
        wrap.onclick = () => submitRating(i);
        row.appendChild(wrap);
    }
}
function loadRating() {
    fetch('/api/ratings?mod=' + encodeURIComponent(MOD_NAME))
        .then(r => r.json())
        .then(d => {
            const avg = d.average || 0;
            document.getElementById('ratingNum').textContent = avg ? avg.toFixed(1) : '--';
            document.getElementById('ratingCount').textContent = d.count ? d.count + ' 人评分' : '暂无评分';
            document.getElementById('statRating').innerHTML = '评分 <b>' + (avg || '--') + '</b>';
            renderStars(avg);
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
            renderStars(d.average);
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

/* 下载上报 + 下载后自动刷新统计 */
document.getElementById('dlBtn').addEventListener('click', () => {
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ mod: MOD_NAME }),
        keepalive: true,
        cache: 'no-store'
    }).then(r => r.json()).then(d => {
        if (d.ok) document.getElementById('statDl').innerHTML = '下载 <b>' + d.count + '</b>';
    }).catch(() => {});
});

/* 收藏：与首页共用 sfs_favorites 数组 */
function readFavorites() {
    try {
        const value = JSON.parse(localStorage.getItem('sfs_favorites') || '[]');
        return Array.isArray(value) ? value : [];
    } catch (e) { return []; }
}
function writeFavorites(value) {
    try { localStorage.setItem('sfs_favorites', JSON.stringify(value)); } catch (e) {}
}
function applyFavoriteState(fav) {
    const btn = document.getElementById('favBtn');
    if (!btn) return;
    btn.textContent = fav ? '★ 已收藏' : '☆ 收藏';
    btn.classList.toggle('active', fav);
}
async function toggleFav() {
    const previous = readFavorites();
    const fav = !previous.includes(MOD_NAME);
    const next = fav ? [...previous, MOD_NAME] : previous.filter(name => name !== MOD_NAME);
    writeFavorites(next);
    applyFavoriteState(fav);
    try {
        const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ mod: MOD_NAME, action: fav ? 'add' : 'remove' }),
            keepalive: true,
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('收藏同步失败');
        const data = await response.json();
        document.getElementById('statFav').innerHTML = '收藏 <b>' + (data.count || 0) + '</b>';
    } catch (e) {
        writeFavorites(previous);
        applyFavoriteState(previous.includes(MOD_NAME));
        document.getElementById('statFav').innerHTML = '收藏 <b>--</b>';
    }
}
(function() { applyFavoriteState(readFavorites().includes(MOD_NAME)); })();
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
