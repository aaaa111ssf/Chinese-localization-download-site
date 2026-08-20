(function() {
            'use strict';

            let files = [];
            const typeIconNames = {
                pdf: 'file', zip: 'archive', doc: 'file-text', img: 'image',
                video: 'video', code: 'code', default: 'file'
            };
            const uiIconPaths = {
                file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
                'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
                archive: '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1zM10 12h4"/>',
                image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
                video: '<rect x="3" y="5" width="15" height="14" rx="2"/><path d="m18 10 3-2v8l-3-2z"/>',
                code: '<path d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"/>',
                user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
                tag: '<path d="M20.59 13.41 11 3.83V3H4v7h.83l9.58 9.59a2 2 0 0 0 2.83 0l3.35-3.35a2 2 0 0 0 0-2.83Z"/><circle cx="7.5" cy="7.5" r="1"/>',
                box: '<path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5M12 13v9"/>',
                calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
                activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
                info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
                download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
                close: '<path d="m6 6 12 12M18 6 6 18"/>',
                share: '<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/>',
                edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
                folder: '<path d="M3 6h6l2 2h10v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
                search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
            };
            function svgIcon(name) {
                return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${uiIconPaths[name] || uiIconPaths.file}</svg>`;
            }
            let currentCategory = 'all';
            let searchKeyword = '';
            let currentSort = 'default'; // default | date
            let viewerImages = [];
            let viewerIndex = 0;
            let activeRatingMod = '';
            let activeRating = { average: 0, count: 0, myScore: 0 };
            let pendingRating = 0;
            let ratingSubmitting = false;
            let ratingRequestId = 0;

            /* ---------- 安全转义工具 ---------- */
            function escapeHtml(str) {
                if (str == null) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }

            function escapeJs(str) {
                if (str == null) return '';
                return String(str)
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'")
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r');
            }

            /* ---------- 数据安全与图片校验 ---------- */
            function getValidImages(file) {
                if (!file || file.images == null) return [];
                const arr = Array.isArray(file.images) ? file.images : [file.images];
                return arr.filter(url => typeof url === 'string' && url.trim().length > 0);
            }

            /* ---------- 独立页面 slug ---------- */
            function toSlug(name) {
                return String(name || '').toLowerCase().trim()
                    .replace(/[^\p{L}\p{N}]+/gu, '-')
                    .replace(/^-+|-+$/g, '');
            }
            window.toSlug = toSlug;

            /* ---------- 更新日期解析（兼容 2026-6-10 与 2026-08-06） ---------- */
            function parseDate(dateStr) {
                if (!dateStr) return 0;
                const m = String(dateStr).match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
                if (!m) return 0;
                return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
            }

            /* ---------- 排序 ---------- */
            function sortFiles(list) {
                const arr = list.slice();
                if (currentSort === 'date') {
                    arr.sort((a, b) => parseDate(b.date) - parseDate(a.date));
                }
                return arr;
            }

            /* ---------- 个人下载记录（localStorage） ---------- */
            const DL_HISTORY_KEY = 'sfs_dl_history';
            let dlHistory = [];
            try {
                dlHistory = JSON.parse(localStorage.getItem(DL_HISTORY_KEY)) || [];
            } catch (e) {
                dlHistory = [];
            }
            function saveDlHistory() {
                try { localStorage.setItem(DL_HISTORY_KEY, JSON.stringify(dlHistory)); } catch (e) {}
            }
            function addDlHistory(name) {
                dlHistory = dlHistory.filter(h => h.name !== name);
                dlHistory.unshift({ name, time: Date.now() });
                if (dlHistory.length > 50) dlHistory = dlHistory.slice(0, 50);
                saveDlHistory();
            }

            /* ---------- 图片CDN回退列表（国内优先，base含完整路径前缀） ---------- */
            const CDN_MIRRORS = [
                'https://cdn.jsdmirror.com/gh/aaaa111ssf/images@main',      // 国内jsDelivr镜像(主)
                'https://testingcf.jsdelivr.net/gh/aaaa111ssf/images@main', // jsDelivr国内节点
                'https://gh-proxy.com/https://raw.githubusercontent.com/aaaa111ssf/images/main',  // GitHub代理
                'https://ghfast.top/https://raw.githubusercontent.com/aaaa111ssf/images/main',    // GitHub代理
                'https://ghproxy.net/https://raw.githubusercontent.com/aaaa111ssf/images/main',   // GitHub代理
                'https://cdn.jsdelivr.net/gh/aaaa111ssf/images@main',       // jsDelivr全球
                'https://cloudflare-b2.a2107478976.workers.dev'             // B2兜底
            ];
            const IMG_TIMEOUT_MS = 3200;
            const MAX_IMG_MIRROR_ATTEMPTS = 3;

            /* ---------- 图片加载超时回退（慢则自动换源） ---------- */
            function armImgTimeout(img) {
                if (img._imgTimer) clearTimeout(img._imgTimer);
                img._imgTimer = setTimeout(function() {
                    img._imgTimer = null;
                    // 已成功加载则跳过
                    if (img.complete && img.naturalWidth > 0) return;
                    window.handleImgError(img);
                }, IMG_TIMEOUT_MS);
            }

            function armAllImgTimeouts() {
                document.querySelectorAll('.lazy-img').forEach(function(img) {
                    if (img.src && !img.complete) armImgTimeout(img);
                });
            }

            /* ---------- 图片加载失败/超时回退 ---------- */
            function showImgPlaceholder(img) {
                const wrap = img.parentElement;
                if (!wrap) return;
                wrap.classList.add('card-image-placeholder');
                const icon = img.dataset.icon || 'file';
                wrap.innerHTML = `
                    <div class="card-image-fallback">
                        <span class="fallback-icon">${svgIcon(icon)}</span>
                        <span class="fallback-text">暂无预览</span>
                    </div>
                `;
            }

            window.handleImgError = function(img) {
                img.onerror = null;

                // 尝试CDN镜像回退
                const currentSrc = img.src || '';
                let mirrorIdx = parseInt(img.dataset.mirrorIdx || '0', 10);

                // 根据当前src自动识别所在镜像，避免重复尝试同一镜像
                const found = CDN_MIRRORS.findIndex(function(m) { return currentSrc.indexOf(m) === 0; });
                if (found !== -1) mirrorIdx = found;

                // 仅尝试有限的备用镜像，避免移动网络下对多个代理反复发起请求。
                const attempts = parseInt(img.dataset.attempts || '0', 10);
                const nextMirrorIdx = mirrorIdx + 1;
                if (attempts >= MAX_IMG_MIRROR_ATTEMPTS || nextMirrorIdx >= CDN_MIRRORS.length) {
                    showImgPlaceholder(img);
                    return;
                }

                // 提取文件名（最后一个 / 之后的部分）
                const fileName = currentSrc.substring(currentSrc.lastIndexOf('/') + 1);
                if (!fileName) {
                    showImgPlaceholder(img);
                    return;
                }
                img.dataset.attempts = String(attempts + 1);
                img.dataset.mirrorIdx = String(nextMirrorIdx);
                img.src = CDN_MIRRORS[nextMirrorIdx] + '/' + fileName;
                img.onerror = function() { window.handleImgError(img); };
                armImgTimeout(img);
            };

            /* ---------- 图片加载完成移除骨架屏 ---------- */
            window.openQQGroup = function(uin) {
                var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
                if (isMobile) {
                    window.location.href = 'mqqapi://card/show_pslcard?src_type=internal&version=1&uin=' + uin + '&card_type=group&source=qrcode';
                } else {
                    try {
                        navigator.clipboard.writeText(uin);
                    } catch(e) {}
                    alert('群号 ' + uin + ' 已复制到剪贴板，请在QQ中搜索添加');
                }
            };
            window.handleImgLoad = function(img) {
                if (img._imgTimer) { clearTimeout(img._imgTimer); img._imgTimer = null; }
                var wrap = img.closest('.card-image-wrap');
                if (wrap) {
                    wrap.style.setProperty('--shimmer-done', '1');
                    wrap.classList.add('img-loaded');
                }
            }

            /* ---------- 工具 ---------- */
            function checkAndRemoveModalOpen() {
                const anyActive = document.querySelector(
                    '.modal-overlay.active, .img-viewer-overlay.active, .mod-detail-overlay.active, .sponsor-modal-overlay.active, .dl-history-overlay.active'
                );
                if (!anyActive) document.body.classList.remove('modal-open');
            }

            /* ---------- 图片懒加载 ---------- */
            let imgObserver;
            if ('IntersectionObserver' in window) {
                imgObserver = new IntersectionObserver((entries, obs) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            const src = img.dataset.src;
                            if (src) {
                                img.decoding = 'async';
                                img.src = src;
                                armImgTimeout(img);
                                const markLoaded = function() {
                                    if (img.naturalWidth > 0) {
                                        img.classList.add('loaded');
                                        window.handleImgLoad(img);
                                    }
                                };
                                if (img.complete) markLoaded();
                                else img.addEventListener('load', markLoaded, { once: true });
                                img.removeAttribute('data-src');
                            }
                            obs.unobserve(img);
                        }
                    });
                }, { rootMargin: '200px 0px', threshold: 0.01 });
            } else {
                imgObserver = null;
            }

            function observeLazyImages() {
                if (!imgObserver) {
                    document.querySelectorAll('img[data-src]').forEach(img => {
                        img.src = img.dataset.src;
                        img.loading = 'lazy';
                        img.classList.add('loaded');
                        img.removeAttribute('data-src');
                    });
                    return;
                }
                document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));
            }

            /* ---------- 下载方式与 Android 安装助手 ---------- */
            const SITE_SETTINGS_KEY = 'sfs_site_settings';
            const INSTALLER_SCHEME = 'sfsmodinstaller://install';
            const INSTALLER_DIRECT_HOSTS = ['sfszhmod.pages.dev', 'sfs-cn-mod.pages.dev', 'nasyt.dpdns.org'];
            let downloadNavigationLockedUntil = 0;

            function getDownloadMode() {
                try {
                    const saved = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || '{}');
                    if (['direct', 'auto', 'lanzou'].includes(saved.downloadMode)) return saved.downloadMode;
                    // 兼容旧版“手动”设置：旧手动下载即蓝奏云下载。
                    return saved.downloadMode === 'manual' ? 'lanzou' : 'direct';
                } catch (e) {
                    return 'direct';
                }
            }

            function isAllowedInstallerSource(parsed) {
                if (parsed.protocol !== 'https:' || !INSTALLER_DIRECT_HOSTS.includes(parsed.hostname.toLowerCase())) return false;
                return parsed.hostname.toLowerCase() !== 'nasyt.dpdns.org' || /^\/sd\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname);
            }

            function getAutoInstallPayload(file) {
                const installType = String(file && file.installType || '').toLowerCase();
                const installUrl = String(file && file.installUrl || '').trim();
                const sha256 = String(file && file.sha256 || '').trim();
                if (!file || !file.name || !installUrl || !['parts', 'textures'].includes(installType)) return null;
                try {
                    if (!isAllowedInstallerSource(new URL(installUrl))) return null;
                } catch (e) {
                    return null;
                }
                if (sha256 && !/^[a-f0-9]{64}$/i.test(sha256)) return null;
                return { installType, installUrl, sha256 };
            }

            function buildInstallerUrl(file, payload) {
                const params = new URLSearchParams({
                    name: String(file.name).slice(0, 120),
                    url: payload.installUrl,
                    type: payload.installType
                });
                if (payload.sha256) params.set('sha256', payload.sha256.toLowerCase());
                return INSTALLER_SCHEME + '?' + params.toString();
            }

            function getDownloadLabel(file, fallbackLabel) {
                const mode = getDownloadMode();
                const hasDirectLink = Boolean(getAutoInstallPayload(file));
                if (mode === 'auto') return hasDirectLink ? '自动安装' : '蓝奏云下载';
                if (mode === 'direct') return hasDirectLink ? '直链下载' : '蓝奏云下载';
                return '蓝奏云下载';
            }

            function openExternalDownload(url) {
                const target = String(url || '').trim();
                if (!target) {
                    toast('下载地址无效');
                    return false;
                }
                // 不使用 noopener 特性参数：部分浏览器会成功打开新页却返回 null，旧逻辑会因此再次改写当前页。
                const opened = window.open(target, '_blank');
                if (!opened) {
                    toast('浏览器阻止了新下载页面，请允许弹出窗口后重试');
                    return false;
                }
                try { opened.opener = null; } catch (e) {}
                return true;
            }

            function updateDownloadLabels() {
                document.querySelectorAll('[data-download-label]').forEach(label => {
                    const index = Number(label.dataset.downloadLabel);
                    label.textContent = getDownloadLabel(files[index], label.dataset.manualLabel);
                });
            }

            window.addEventListener('sfs-download-mode-change', updateDownloadLabels);

            window.handleModDownload = function(index, event) {
                if (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    event.stopPropagation();
                }
                const now = Date.now();
                if (now < downloadNavigationLockedUntil) return false;
                // 同一点击在浏览器、卡片父级或内联事件中重复传播时，只允许第一条路径执行。
                downloadNavigationLockedUntil = now + 1200;
                const file = files[index];
                if (!file) return false;
                const mode = getDownloadMode();
                const payload = getAutoInstallPayload(file);

                if (mode === 'lanzou') {
                    logDownload(index);
                    openExternalDownload(file.link);
                    return false;
                }

                if (mode === 'direct') {
                    if (payload) {
                        logDownload(index);
                        openExternalDownload(payload.installUrl);
                    } else {
                        toast('此资源未配置安全直链，已改用蓝奏云下载');
                        logDownload(index);
                        openExternalDownload(file.link);
                    }
                    return false;
                }

                if (!payload) {
                    toast('此资源未配置安全直链，已改用蓝奏云下载');
                    logDownload(index);
                    openExternalDownload(file.link);
                    return false;
                }

                let appOpened = false;
                const markOpened = () => { appOpened = true; };
                window.addEventListener('blur', markOpened, { once: true });
                document.addEventListener('visibilitychange', function onVisibilityChange() {
                    if (document.visibilityState === 'hidden') appOpened = true;
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                });
                logDownload(index);
                if (!openExternalDownload(buildInstallerUrl(file, payload))) return false;
                window.setTimeout(() => {
                    if (!appOpened && document.visibilityState === 'visible') {
                        toast('未检测到安装助手，请先安装 SFS 汉化模组安装助手，或改用直链下载');
                    }
                }, 1400);
                return false;
            };

            /* ---------- 渲染：主卡片（截图风格） ---------- */
            function createModCard(file, index) {
                const validImages = getValidImages(file);

                const safe = {
                    name: escapeHtml(file.name || '未命名模组'),
                    desc: escapeHtml(file.desc || '暂无描述'),
                    author: escapeHtml(file.author || 'A Future star'),
                    version: escapeHtml(file.version || 'v1.0'),
                    size: escapeHtml(file.size || '未知'),
                    date: escapeHtml(file.date || ''),
                    link: escapeHtml(file.link || '#'),
                    tags: Array.isArray(file.tags) ? file.tags : [],
                    type: file.type || 'default'
                };

                const tagsHtml = safe.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
                const icon = typeIconNames[safe.type] || typeIconNames.default;
                const slug = toSlug(file.name || '');

                let imageHtml = '';
                if (validImages.length > 0) {
                    const enableThumbs = window.matchMedia('(min-width: 641px)').matches;
                    const thumbs = enableThumbs ? validImages.slice(1, 3) : [];
                    const moreCount = enableThumbs && validImages.length > 3 ? validImages.length - 3 : 0;
                    const thumbsHtml = thumbs.length ? `
                        <div class="card-image-gallery" onclick="event.stopPropagation()">
                            ${thumbs.map((img, i) => `<img data-src="${escapeHtml(img)}" decoding="async" onclick="openImgViewer(${index}, ${i+1})" alt="${escapeHtml(safe.name)}缩略图${i+1}" class="lazy-img" onerror="this.style.display='none'; this.onerror=null;">`).join('')}
                            ${moreCount ? `<span style="color:#fff;font-size:0.7rem;padding:4px 6px;background:rgba(0,0,0,0.4);border-radius:4px;white-space:nowrap;">+${moreCount}</span>` : ''}
                        </div>
                    ` : '';
                    const eagerCount = window.matchMedia('(max-width: 640px)').matches ? 1 : 3;
                    const isAboveFold = index < eagerCount;
                    const fetchPriority = index === 0 ? 'fetchpriority="high"' : '';
                    imageHtml = `
                        <div class="card-image-wrap" onclick="openModDetail(${index})">
                            <img ${isAboveFold ? 'src' : 'data-src'}="${escapeHtml(validImages[0])}" alt="${safe.name}预览图" class="lazy-img" data-icon="${icon}" data-mirror-idx="0" decoding="async" onerror="handleImgError(this)" onload="handleImgLoad(this)" ${isAboveFold ? `loading="eager" ${fetchPriority}` : 'loading="lazy"'}>
                            ${thumbsHtml}
                        </div>
                    `;
                } else {
                    imageHtml = `
                        <div class="card-image-wrap card-image-placeholder" onclick="openModDetail(${index})">
                            <div class="card-image-fallback">
                                <span class="fallback-icon">${svgIcon(icon)}</span>
                                <span class="fallback-text">暂无预览</span>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="file-card" onclick="openModDetail(${index})" style="cursor:pointer;">
                        ${imageHtml}
                        <div class="card-body">
                            <div class="card-title">${safe.name}</div>
                            <div class="card-subtitle">
                                <span class="card-inline-meta">${svgIcon('user')}作者: ${safe.author}</span>
                                <span class="card-inline-meta">${svgIcon('tag')}版本: ${safe.version}</span>
                            </div>
                            <div class="card-tags">${tagsHtml}</div>
                            <div class="card-desc">${safe.desc}</div>
                            <div class="card-meta-boxes">
                                <div class="meta-box">${svgIcon('box')}<span>大小: ${safe.size}</span></div>
                                <div class="meta-box">${svgIcon('calendar')}<span>日期: ${safe.date}</span></div>
                            </div>
                        </div>
                        <div class="card-actions">
                            <div class="card-actions-secondary">
                                <button class="btn btn-share" aria-label="分享 ${safe.name}" title="分享模组" onclick="event.stopPropagation(); shareModLink(${index})">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
                                </button>
                            </div>
                            <div class="card-actions-primary">
                                <button class="btn btn-detail" onclick="event.stopPropagation(); openModDetail(${index})">${svgIcon('info')}<span>详情</span></button>
                                <button type="button" class="btn btn-download" onclick="return handleModDownload(${index}, event)">${svgIcon('download')}<span data-download-label="${index}" data-manual-label="蓝奏云下载">${getDownloadLabel(file, '蓝奏云下载')}</span></button>
                            </div>
                        </div>
                    </div>
                `;
            }

            /* ---------- 渲染：推荐卡片（无结果） ---------- */
            function createCompactCard(file, index) {
                const validImages = getValidImages(file);
                const safe = {
                    name: escapeHtml((file.name || '').replace(/<br>/gi, ' ')),
                    author: escapeHtml((file.author || 'UP').slice(0,6)),
                    version: escapeHtml(file.version || 'v1.0'),
                    compat: escapeHtml(file.compat || '1.5.x+'),
                    link: escapeHtml(file.link || '#'),
                    type: file.type || 'default'
                };
                const icon = typeIconNames[safe.type] || typeIconNames.default;
                const img = validImages.length > 0
                    ? `<div class="sug-img-wrap"><img data-src="${escapeHtml(validImages[0])}" data-icon="${icon}" class="lazy-img" alt="${safe.name}预览图" data-mirror-idx="0" onerror="handleImgError(this)" onload="handleImgLoad(this)"></div>`
                    : `<div class="sug-img-wrap card-image-placeholder"><div class="card-image-fallback"><span class="fallback-icon">${svgIcon(icon)}</span><span class="fallback-text">暂无预览</span></div></div>`;
                return `
                    <div class="suggestion-card">
                        ${img}
                        <div class="sug-body">
                            <div class="sug-name">${safe.name}</div>
                            <div class="sug-meta">
                                <span class="sug-badge">${safe.version}</span>
                                <span class="sug-badge">${safe.compat}</span>
                            </div>
                            <div class="sug-extra">
                                <span>作者: ${safe.author}</span>
                            </div>
                        </div>
                        <button type="button" class="sug-btn" onclick="return handleModDownload(${index}, event)"><span data-download-label="${index}" data-manual-label="蓝奏云下载">${getDownloadLabel(file, '蓝奏云下载')}</span></button>
                    </div>
                `;
            }

            /* ---------- 主渲染 ---------- */
            function renderFiles() {
                const grid = document.getElementById('fileGrid');
                const noResults = document.getElementById('noResults');
                const tutorialSection = document.getElementById('tutorialSection');
                const gridLoading = document.getElementById('gridLoading');
                gridLoading.classList.add('hidden');

                if (currentCategory === 'tutorial') {
                    grid.style.display = 'none';
                    noResults.classList.remove('show');
                    tutorialSection.style.display = 'block';
                    document.getElementById('totalCount').textContent = '教程';
                    return;
                } else {
                    tutorialSection.style.display = 'none';
                }

                noResults.classList.remove('show');
                const rawQuery = searchKeyword.trim();
                const lowerFilter = rawQuery.toLowerCase();
                let visibleCount = 0;

                /* 标签搜索：#开头则在tags中查找 */
                const isTagSearch = rawQuery.startsWith('#');
                const tagQuery = isTagSearch ? rawQuery.slice(1).toLowerCase() : '';

                /* 拼音首字母逐字符匹配（简化版） */
                function matchPinyinInitials(name, query) {
                    if (!query || !name) return false;
                    let qi = 0;
                    for (let ni = 0; ni < name.length && qi < query.length; ni++) {
                        if (name[ni].toLowerCase() === query[qi]) {
                            qi++;
                        }
                    }
                    return qi === query.length;
                }

                /* 使用 DocumentFragment 批量构建卡片，减少回流 */
                const fragment = document.createDocumentFragment();
                let cardsHtml = '';
                const cardIndices = [];

                const sortedFiles = sortFiles(files);

                sortedFiles.forEach((file, sortedIndex) => {
                    const matchCategory = currentCategory === 'all' || file.category === currentCategory;
                    let matchSearch = false;
                    if (isTagSearch) {
                        matchSearch = tagQuery && Array.isArray(file.tags) && file.tags.some(t => t.toLowerCase().includes(tagQuery));
                    } else if (lowerFilter) {
                        const searchText = ((file.name || '') + ' ' + (file.desc || '') + ' ' + (Array.isArray(file.tags) ? file.tags.join(' ') : '')).toLowerCase();
                        matchSearch = searchText.includes(lowerFilter) || matchPinyinInitials(file.name || '', lowerFilter);
                    } else {
                        matchSearch = true;
                    }
                    if (matchCategory && matchSearch) {
                        visibleCount++;
                        const index = files.indexOf(file);
                        cardsHtml += createModCard(file, index);
                    }
                });

                /* 一次性写入 DOM */
                if (cardsHtml) {
                    grid.innerHTML = cardsHtml;
                    grid.style.display = 'grid';
                    armAllImgTimeouts();
                } else {
                    grid.innerHTML = '';
                    grid.style.display = 'none';
                }

                // 入场动画仅前8张卡片，其余直接显示
                if (visibleCount > 0) {
                    const cards = grid.querySelectorAll('.file-card');
                    const baseDelay = 0.03;
                    cards.forEach((card, i) => {
                        if (i < 8) {
                            const delay = i * baseDelay;
                            card.style.setProperty('--card-enter-delay', delay + 's');
                        } else {
                            card.style.setProperty('--card-enter-delay', '0s');
                            card.style.animation = 'none';
                            card.style.opacity = '1';
                        }
                    });
                }

                document.getElementById('totalCount').textContent = visibleCount;

                if (visibleCount === 0) {
                    noResults.classList.add('show');
                    const suggestions = files.filter(f => currentCategory === 'all' || f.category === currentCategory).slice(0, 5);
                    noResults.innerHTML = `
                        <div style="text-align:center;margin-bottom:30px;">
                            <div class="no-results-icon">${svgIcon('search')}</div>
                            <div style="font-size:1.2rem;color:#111;font-weight:700;">没有找到匹配的文件</div>
                            <div style="color:#666;margin-top:8px;">请尝试其他关键词，或浏览以下热门推荐</div>
                        </div>
                        <div class="suggestion-grid">
                            ${suggestions.map(file => createCompactCard(file, files.indexOf(file))).join('')}
                        </div>
                    `;
                }

                observeLazyImages();
            }

            /* ---------- 事件绑定 ---------- */
            document.getElementById('searchInput').addEventListener('input', function(e) {
                searchKeyword = e.target.value;
                renderFiles();
            });

            // 下拉菜单
            const categoryDropdown = document.getElementById('categoryDropdown');
            const categoryToggle = document.getElementById('categoryToggle');
            const categoryToggleText = document.getElementById('categoryToggleText');

            categoryToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                categoryDropdown.classList.toggle('open');
                this.setAttribute('aria-expanded', categoryDropdown.classList.contains('open'));
            });
            document.addEventListener('click', function() {
                categoryDropdown.classList.remove('open');
                categoryToggle.setAttribute('aria-expanded', 'false');
                if (sortDropdown) {
                    sortDropdown.classList.remove('open');
                    sortToggle.setAttribute('aria-expanded', 'false');
                }
            });

            document.querySelectorAll('.dropdown-item[data-category]').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('.dropdown-item[data-category]').forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                    currentCategory = this.dataset.category;
                    categoryToggleText.textContent = this.textContent;
                    categoryDropdown.classList.remove('open');
                    categoryToggle.setAttribute('aria-expanded', 'false');
                    renderFiles();
                });
            });

            // 排序下拉菜单
            const sortDropdown = document.getElementById('sortDropdown');
            const sortToggle = document.getElementById('sortToggle');
            const sortToggleText = document.getElementById('sortToggleText');
            if (sortDropdown && sortToggle) {
                sortToggle.addEventListener('click', function(e) {
                    e.stopPropagation();
                    sortDropdown.classList.toggle('open');
                    this.setAttribute('aria-expanded', sortDropdown.classList.contains('open'));
                });
                document.querySelectorAll('.dropdown-item[data-sort]').forEach(item => {
                    item.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        document.querySelectorAll('.dropdown-item[data-sort]').forEach(i => i.classList.remove('active'));
                        this.classList.add('active');
                        currentSort = this.dataset.sort;
                        sortToggleText.textContent = this.textContent;
                        sortDropdown.classList.remove('open');
                        sortToggle.setAttribute('aria-expanded', 'false');
                        renderFiles();
                    });
                });
            }

            document.querySelectorAll('.tutorial-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    document.querySelectorAll('.tutorial-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    document.querySelectorAll('.tutorial-content').forEach(c => c.classList.remove('active'));
                    document.getElementById('tutorial-' + this.dataset.tutorial).classList.add('active');
                });
            });

            // 顶部导航栏切换
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                    const page = this.dataset.page;
                    const grid = document.getElementById('fileGrid');
                    const tutorialSection = document.getElementById('tutorialSection');
                    const aboutPage = document.getElementById('aboutPage');
                    const footer = document.querySelector('.footer');
                    if (page === 'mods') {
                        grid.style.display = 'grid';
                        tutorialSection.style.display = 'none';
                        aboutPage.style.display = 'none';
                        if (footer) footer.style.display = 'grid';
                    } else if (page === 'tutorial') {
                        grid.style.display = 'none';
                        tutorialSection.style.display = 'block';
                        aboutPage.style.display = 'none';
                        if (footer) footer.style.display = 'grid';
                    } else if (page === 'about') {
                        grid.style.display = 'none';
                        tutorialSection.style.display = 'none';
                        aboutPage.style.display = 'block';
                        if (footer) footer.style.display = 'grid';
                    }
                });
            });

            /* ---------- 标题作者链接：跳转至关于我们 ---------- */
            const titleAuthorLink = document.getElementById('titleAuthorLink');
            if (titleAuthorLink) {
                titleAuthorLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const aboutNav = document.querySelector('.nav-item[data-page="about"]');
                    if (aboutNav) aboutNav.click();
                });
            }

            /* ---------- 开屏弹窗（不再提示） ---------- */
            let entryModalShown = false;
            const ENTRY_SEEN_KEY = 'sfs_entry_modal_seen';
            function showModal() {
                if (entryModalShown || localStorage.getItem('hideEntryModal') === 'true' || sessionStorage.getItem(ENTRY_SEEN_KEY) === 'true') return;
                const modal = document.getElementById('entryModal');
                if (!modal) return;
                document.body.classList.add('modal-open');
                setTimeout(() => modal.classList.add('active'), 650);
                entryModalShown = true;
            }

            window.closeModal = function() {
                const checkbox = document.getElementById('dontShowAgain');
                if (checkbox && checkbox.checked) {
                    localStorage.setItem('hideEntryModal', 'true');
                }
                try { sessionStorage.setItem(ENTRY_SEEN_KEY, 'true'); } catch (e) {}
                document.getElementById('entryModal').classList.remove('active');
                checkAndRemoveModalOpen();
            };

            window.addEventListener('load', function() {
                showModal();
            });
            /* ---------- 模组详情 ---------- */
            window.openModDetail = function(index) {
                const file = files[index];
                if (!file) return;
                const validImages = getValidImages(file);
                const box = document.getElementById('modDetailBox');
                const tags = (Array.isArray(file.tags) ? file.tags : []).map(t => `<span>${escapeHtml(t)}</span>`).join('');
                const icon = typeIconNames[file.type] || typeIconNames.default;
                const modName = file.name || '未命名模组';
                const slug = toSlug(modName);
                const modUrl = location.origin + '/mod/' + slug;
                const detailInfo = [
                    ['tag', '版本', file.version || 'v1.0'],
                    ['user', '作者', file.author || 'A Future star'],
                    ['code', '兼容', file.compat || '1.6.00.3+'],
                    ['box', '大小', file.size || '未知'],
                    ['calendar', '更新', file.date || '']
                ];
                const detailInfoHtml = detailInfo.map(([iconName, label, value]) => `<span class="detail-info-item">${svgIcon(iconName)}<span><b>${label}</b>${escapeHtml(value)}</span></span>`).join('');

                const firstImage = validImages.length > 0
                    ? `<img data-src="${escapeHtml(validImages[0])}" alt="${escapeHtml(file.name||'模组')}预览图" class="lazy-img" data-icon="${icon}" data-mirror-idx="0" loading="lazy" decoding="async" onerror="handleImgError(this)" onload="handleImgLoad(this)">`
                    : `<div style="height:100%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;"><div class="card-image-fallback"><span class="fallback-icon">${svgIcon(icon)}</span><span class="fallback-text">暂无预览</span></div></div>`;

                const gallery = validImages.length > 0 ?
                    `<div class="detail-section"><h4>预览图</h4><div class="mod-detail-gallery">${validImages.map((img,i)=>`<img data-src="${escapeHtml(img)}" alt="${escapeHtml(file.name||'模组')}预览图${i+1}" data-icon="${icon}" class="lazy-img" data-mirror-idx="0" loading="lazy" decoding="async" onclick="openImgViewer(${index},${i})" onerror="handleImgError(this)" onload="handleImgLoad(this)">`).join('')}</div></div>` : '';

                box.innerHTML = `
                    <div class="mod-detail-header">
                        ${firstImage}
                        <div class="header-overlay">
                            <h2>${escapeHtml(modName)}</h2>
                            <div class="header-tags">${tags}</div>
                        </div>
                    </div>
                    <div class="mod-detail-body">
                        <div class="detail-section"><h4>简介</h3><p>${escapeHtml(file.desc || '暂无描述')}</p></div>
                        <div class="detail-section"><h4>信息</h3><div class="detail-info-grid">${detailInfoHtml}</div></div>
                        <div class="detail-section detail-rating">
                            <div class="detail-section-heading">
                                <h4>评分</h4>
                                <button type="button" class="rating-edit-btn" id="ratingEditBtn" onclick="openRatingEditor()" aria-label="编辑评分">${svgIcon('edit')}<span>编辑评分</span></button>
                            </div>
                            <div class="rating-summary" id="detailRatingSummary" aria-live="polite">
                                <div class="rating-score" id="detailRatingScore">--</div>
                                <div class="stars rating-read-stars" id="detailRatingStars" aria-label="评分加载中"></div>
                                <span class="rating-count" id="detailRatingCount">正在加载评分...</span>
                            </div>
                            <div class="rating-msg" id="detailRatingMsg"></div>
                            <div class="rating-editor" id="ratingEditor" hidden aria-label="编辑评分">
                                <div class="rating-editor-head"><strong>为模组评分</strong><button type="button" class="rating-editor-close" onclick="closeRatingEditor()" aria-label="取消编辑">${svgIcon('close')}</button></div>
                                <p class="rating-editor-desc" id="ratingEditorDesc">请选择 1 至 5 星</p>
                                <div class="stars rating-editor-stars" id="ratingEditorStars" role="group" aria-label="选择星级"></div>
                                <div class="rating-editor-actions">
                                    <button type="button" class="rating-cancel-btn" onclick="closeRatingEditor()">取消</button>
                                    <button type="button" class="rating-submit-btn" id="ratingSubmitBtn" onclick="submitRating()" disabled>提交评分</button>
                                </div>
                            </div>
                        </div>
                        ${gallery}
                    </div>
                    <div class="mod-detail-footer">
                        <button onclick="closeModDetail()" class="detail-btn detail-btn-secondary">${svgIcon('close')}<span>关闭</span></button>
                        <button onclick="shareModLink(${index})" class="detail-btn detail-btn-share">${svgIcon('share')}<span>分享</span></button>
                        <button type="button" class="detail-btn detail-btn-primary" onclick="return handleModDownload(${index}, event)">${svgIcon('download')}<span data-download-label="${index}" data-manual-label="蓝奏云下载">${getDownloadLabel(file, '蓝奏云下载')}</span></button>
                    </div>
                `;
                document.getElementById('modDetailOverlay').classList.add('active');
                document.body.classList.add('modal-open');
                observeLazyImages();
                // 加载只读评分摘要
                loadRating(modName);
            };

            window.closeModDetail = function() {
                ratingRequestId += 1;
                activeRatingMod = '';
                document.getElementById('modDetailOverlay').classList.remove('active');
                checkAndRemoveModalOpen();
            };

            /* ---------- 分享模组链接 ---------- */
            window.shareModLink = function(index) {
                const file = files[index];
                if (!file) return;
                const slug = toSlug(file.name || '');
                const url = location.origin + '/mod/' + slug;
                const text = file.name + ' - SFS汉化模组下载中心';
                if (navigator.share) {
                    navigator.share({ title: text, url }).catch(() => {});
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(() => {
                        toast('链接已复制：' + url);
                    }).catch(() => {
                        window.prompt('复制模组链接：', url);
                    });
                } else {
                    window.prompt('复制模组链接：', url);
                }
            };

            /* ---------- 评分：默认只读，编辑后再提交 ---------- */
            function makeStarSvg(cls) {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('class', cls);
                svg.innerHTML = '<path d="M12 2l2.9 6.26 6.6.57-5 4.47 1.5 6.7L12 16.9 5.99 20l1.5-6.7-5-4.47 6.6-.57z"/>';
                return svg;
            }

            function renderStars(container, score, onClick) {
                if (!container) return;
                container.innerHTML = '';
                for (let i = 1; i <= 5; i++) {
                    const fill = Math.min(1, Math.max(0, Number(score) - i + 1));
                    const wrap = document.createElement(onClick ? 'button' : 'span');
                    wrap.className = 'star-wrap' + (onClick ? ' star-option' : '');
                    if (onClick) {
                        wrap.type = 'button';
                        wrap.title = '选择 ' + i + ' 星';
                        wrap.setAttribute('aria-label', '选择 ' + i + ' 星');
                        wrap.onclick = function() { onClick(i); };
                    }
                    const base = makeStarSvg('star-svg-base');
                    const fillSpan = document.createElement('span');
                    fillSpan.className = 'star-fill';
                    fillSpan.style.width = (fill * 100) + '%';
                    fillSpan.appendChild(makeStarSvg('star-svg-fill'));
                    wrap.appendChild(base);
                    wrap.appendChild(fillSpan);
                    container.appendChild(wrap);
                }
            }

            function renderRatingSummary(status) {
                const avg = Number(activeRating.average) || 0;
                const count = Number(activeRating.count) || 0;
                const scoreEl = document.getElementById('detailRatingScore');
                const countEl = document.getElementById('detailRatingCount');
                const stars = document.getElementById('detailRatingStars');
                const editBtn = document.getElementById('ratingEditBtn');
                if (scoreEl) scoreEl.textContent = avg ? avg.toFixed(1) : '--';
                if (countEl) countEl.textContent = status || (count ? count + ' 人评分' : '暂无评分');
                if (stars) {
                    renderStars(stars, avg);
                    stars.setAttribute('aria-label', avg ? '平均分数 ' + avg.toFixed(1) + ' 分' : '暂无评分');
                }
                if (editBtn) editBtn.querySelector('span').textContent = activeRating.myScore ? '修改评分' : '编辑评分';
            }

            function renderRatingEditor() {
                const editor = document.getElementById('ratingEditor');
                if (!editor || editor.hidden) return;
                const editorStars = document.getElementById('ratingEditorStars');
                const desc = document.getElementById('ratingEditorDesc');
                const submitBtn = document.getElementById('ratingSubmitBtn');
                renderStars(editorStars, pendingRating, function(score) {
                    if (ratingSubmitting) return;
                    pendingRating = score;
                    renderRatingEditor();
                });
                if (desc) desc.textContent = pendingRating ? '已选择 ' + pendingRating + ' 星，可提交或继续修改' : '请选择 1 至 5 星';
                if (submitBtn) {
                    submitBtn.disabled = !pendingRating || ratingSubmitting;
                    submitBtn.textContent = ratingSubmitting ? '正在保存...' : (activeRating.myScore ? '保存修改' : '提交评分');
                }
            }

            window.openRatingEditor = function() {
                if (!activeRatingMod) return;
                const editor = document.getElementById('ratingEditor');
                const msgEl = document.getElementById('detailRatingMsg');
                if (!editor) return;
                if (msgEl) msgEl.textContent = '';
                pendingRating = Number(activeRating.myScore) || 0;
                ratingSubmitting = false;
                editor.hidden = false;
                renderRatingEditor();
            };

            window.closeRatingEditor = function() {
                const editor = document.getElementById('ratingEditor');
                if (editor) editor.hidden = true;
                ratingSubmitting = false;
            };

            function loadRating(modName) {
                const requestId = ++ratingRequestId;
                activeRatingMod = modName;
                activeRating = { average: 0, count: 0, myScore: 0 };
                renderRatingSummary('正在加载评分...');
                fetch('/api/ratings?mod=' + encodeURIComponent(modName), { cache: 'no-store', headers: { 'Accept': 'application/json' } })
                    .then(r => r.ok ? r.json() : Promise.reject(new Error('评分加载失败')))
                    .then(d => {
                        if (requestId !== ratingRequestId || activeRatingMod !== modName) return;
                        activeRating = {
                            average: Number(d.average) || 0,
                            count: Number(d.count) || 0,
                            myScore: Number(d.myScore) || 0
                        };
                        renderRatingSummary();
                    })
                    .catch(() => {
                        if (requestId === ratingRequestId && activeRatingMod === modName) renderRatingSummary('评分暂时无法加载');
                    });
            }

            window.submitRating = function() {
                if (!activeRatingMod || !pendingRating || ratingSubmitting) return;
                ratingSubmitting = true;
                renderRatingEditor();
                fetch('/api/ratings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ mod: activeRatingMod, score: pendingRating }),
                    keepalive: true,
                    cache: 'no-store'
                })
                    .then(r => r.ok ? r.json() : Promise.reject(new Error('评分提交失败')))
                    .then(d => {
                        if (!d.ok) throw new Error(d.error || '评分提交失败');
                        activeRating = {
                            average: Number(d.average) || 0,
                            count: Number(d.count) || 0,
                            myScore: Number(d.myScore) || pendingRating
                        };
                        renderRatingSummary();
                        closeRatingEditor();
                        const msgEl = document.getElementById('detailRatingMsg');
                        if (msgEl) msgEl.textContent = activeRating.myScore === pendingRating ? '评分已保存，可随时点击编辑修改' : '评分已更新';
                    })
                    .catch(() => {
                        ratingSubmitting = false;
                        renderRatingEditor();
                        const msgEl = document.getElementById('detailRatingMsg');
                        if (msgEl) msgEl.textContent = '评分提交失败，请稍后重试';
                    });
            };

            /* ---------- 轻提示 ---------- */
            function toast(msg) {
                let t = document.getElementById('sfsToast');
                if (!t) {
                    t = document.createElement('div');
                    t.id = 'sfsToast';
                    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:99999;opacity:0;transition:opacity .3s;pointer-events:none;max-width:80vw;text-align:center';
                    document.body.appendChild(t);
                }
                t.textContent = msg;
                t.style.opacity = '1';
                clearTimeout(t._timer);
                t._timer = setTimeout(function() { t.style.opacity = '0'; }, 2200);
            }

            /* ---------- 图片查看器 ---------- */
            window.openImgViewer = function(fileIdx, imgIdx) {
                const file = files[fileIdx];
                if (!file) return;
                const validImages = getValidImages(file);
                if (!validImages.length) return;
                viewerImages = validImages;
                viewerIndex = Math.max(0, Math.min(imgIdx || 0, validImages.length - 1));
                updateImgViewer();
                document.getElementById('imgViewerOverlay').classList.add('active');
                document.body.classList.add('modal-open');
            };

            function updateImgViewer() {
                if (viewerImages.length === 0) {
                    closeImgViewer();
                    return;
                }
                document.getElementById('imgViewerImg').src = viewerImages[viewerIndex];
                document.getElementById('imgViewerCounter').textContent = `${viewerIndex + 1} / ${viewerImages.length}`;
            }

            window.changeImg = function(dir) {
                if (viewerImages.length === 0) return;
                viewerIndex = (viewerIndex + dir + viewerImages.length) % viewerImages.length;
                updateImgViewer();
            };

            window.closeImgViewer = function() {
                document.getElementById('imgViewerOverlay').classList.remove('active');
                checkAndRemoveModalOpen();
            };

            /* ---------- 赞助 ---------- */
            const sponsorImageList = [
                "https://cdn.jsdmirror.com/gh/aaaa111ssf/images@main/5.png"
            ];

            function openSponsorModal() {
                const grid = document.getElementById('sponsorImagesGrid');
                grid.innerHTML = sponsorImageList.map(url => `
                    <div class="sponsor-image-item">
                        <img data-src="${escapeHtml(url)}" alt="赞助码" class="lazy-img">
                        <span class="img-label">感谢支持</span>
                    </div>
                `).join('');
                document.getElementById('sponsorModalOverlay').classList.add('active');
                document.body.classList.add('modal-open');
                observeLazyImages();
            }

            function closeSponsorModal() {
                document.getElementById('sponsorModalOverlay').classList.remove('active');
                checkAndRemoveModalOpen();
            }

            document.getElementById('sponsorFloatBtn').addEventListener('click', openSponsorModal);
            window.closeSponsorModal = closeSponsorModal;

            /* ---------- 初始化 ---------- */
            function setFiles(data) {
                if (Array.isArray(data)) {
                    files = data;
                } else if (data && typeof data === 'object' && Array.isArray(data.files)) {
                    files = data.files;
                } else {
                    throw new Error('数据格式错误');
                }
            }

            function handleDataError() {
                document.getElementById('gridLoading').classList.add('hidden');
                document.getElementById('loadError').classList.add('show');
                document.getElementById('fileGrid').style.display = 'none';
                document.getElementById('totalCount').textContent = '—';
            }

            // 优先从本地缓存读取并立即渲染
            let cacheLoaded = false;
            try {
                const cacheRaw = localStorage.getItem('sfs_data_cache');
                if (cacheRaw) {
                    setFiles(JSON.parse(cacheRaw));
                    renderFiles();
                    cacheLoaded = true;
                }
            } catch (e) {
                console.warn('缓存读取失败:', e);
            }

            fetch('data/data.json?v=20260818g')
                .then(response => {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(data => {
                    const newVersion = JSON.stringify(data);
                    const oldVersion = localStorage.getItem('sfs_data_version');
                    if (newVersion !== oldVersion || !cacheLoaded) {
                        setFiles(data);
                        renderFiles();
                        try {
                            localStorage.setItem('sfs_data_cache', JSON.stringify(data));
                            localStorage.setItem('sfs_data_version', newVersion);
                        } catch (e) {
                            console.warn('缓存写入失败:', e);
                        }
                    }
                })
                .catch(err => {
                    console.error('数据加载失败:', err);
                    if (!cacheLoaded) {
                        handleDataError();
                    }
                });

            // 记录下载
            function logDownload(index) {
                const file = files[index];
                if (!file) return;
                const name = (file.name || '').trim();
                // 记录个人下载历史
                addDlHistory(name);
                // 后台上报（不阻塞下载）
                fetch('/api/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ mod: name }),
                    keepalive: true,
                    cache: 'no-store'
                }).catch(() => {});
            }

            /* ---------- 下载记录弹窗 ---------- */
            window.openDlHistory = function() {
                // 关闭设置面板
                const sp = document.getElementById('settingsPanel');
                const spo = document.getElementById('settingsPanelOverlay');
                if (sp) sp.classList.remove('active');
                if (spo) spo.classList.remove('active');
                document.getElementById('dlHistoryOverlay').classList.add('active');
                document.body.classList.add('modal-open');
                renderDlHistoryMine();
                renderDlHistoryRecent();
            };
            window.closeDlHistory = function() {
                document.getElementById('dlHistoryOverlay').classList.remove('active');
                checkAndRemoveModalOpen();
            };
            window.switchDlTab = function(tab) {
                const mine = document.getElementById('dlTabMine');
                const recent = document.getElementById('dlTabRecent');
                const mineBody = document.getElementById('dlHistoryMine');
                const recentBody = document.getElementById('dlHistoryRecent');
                if (tab === 'mine') {
                    mine.classList.add('active'); recent.classList.remove('active');
                    mineBody.style.display = ''; recentBody.style.display = 'none';
                } else {
                    recent.classList.add('active'); mine.classList.remove('active');
                    recentBody.style.display = ''; mineBody.style.display = 'none';
                }
            };
            function renderDlHistoryMine() {
                const el = document.getElementById('dlHistoryMine');
                if (!dlHistory.length) {
                    el.innerHTML = '<div class="dl-empty">还没有下载记录</div>';
                    return;
                }
                el.innerHTML = dlHistory.map(h => {
                    const d = new Date(h.time);
                    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
                    return `<div class="dl-item"><span class="dl-item-name">${escapeHtml(h.name)}</span><span class="dl-item-time">${dateStr}</span></div>`;
                }).join('');
            }
            async function renderDlHistoryRecent() {
                const el = document.getElementById('dlHistoryRecent');
                try {
                    const resp = await fetch('/api/downloads?limit=20');
                    const data = await resp.json();
                    const records = data.records || [];
                    if (!records.length) {
                        el.innerHTML = '<div class="dl-empty">暂无最近下载</div>';
                        return;
                    }
                    el.innerHTML = records.map(r => {
                        const d = new Date((r.created_at || '').replace(' ', 'T') + 'Z');
                        const dateStr = isNaN(d) ? (r.created_at || '') : (d.getMonth()+1) + '-' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
                        return `<div class="dl-item"><span class="dl-item-name">${escapeHtml(r.mod_name)}</span><span class="dl-item-time">${escapeHtml(dateStr)}</span></div>`;
                    }).join('');
                } catch (e) {
                    el.innerHTML = '<div class="dl-empty">加载失败</div>';
                }
            }

            // 设置面板中的"下载记录"按钮
            const dlBtn = document.getElementById('settingsDlBtn');
            if (dlBtn) dlBtn.addEventListener('click', openDlHistory);

        })();

        /* ============================================
           设置面板逻辑
           ============================================ */
        (function() {
            'use strict';

            const STORAGE_KEY = 'sfs_site_settings';

            // 默认设置
            const DEFAULTS = {
                darkMode: false,
                animations: true,
                cardWidth: 280,
                compact: false,
                imgHeight: 180,
                lazyLoad: true,
                columns: 0,
                layoutStyle: 'grid',
                cardRadius: 16,
                cardGap: 20,
                cardOpacity: 100,
                accentColor: '#111111',
                backgroundStyle: 'grid',
                backgroundImage: '',
                downloadMode: 'direct'
            };

            // 读取设置
            function loadSettings() {
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
                } catch(e) {}
                return { ...DEFAULTS };
            }

            // 保存设置
            function saveSettings(settings) {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
                } catch(e) {}
            }

            let settings = loadSettings();

            /* ---------- 公告栏 ---------- */
            const ANNOUNCE_KEY = 'sfs_announcements';

            function renderAnnouncements(announcements) {
                const list = document.getElementById('announceList');
                if (!announcements || !announcements.length) {
                    list.innerHTML = '<div class="announce-empty">暂无公告</div>';
                    return;
                }
                list.innerHTML = announcements.map(a => {
                    const esc = (s) => {
                        if (s == null) return '';
                        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                    };
                    return `
                    <div class="announce-item">
                        <div class="announce-item-header">
                            <span class="announce-item-type ${a.type || 'info'}">${a.type === 'info' ? '通知' : a.type === 'warn' ? '警告' : a.type === 'success' ? '更新' : a.type === 'error' ? '紧急' : '通知'}</span>
                            <span class="announce-item-date">${esc(a.date || '')}</span>
                        </div>
                        <div class="announce-item-title">${esc(a.title || '')}</div>
                        <div class="announce-item-content">${esc(a.content || '')}</div>
                    </div>`;
                }).join('');

                // 检查是否有未读公告
                const readIds = JSON.parse(localStorage.getItem(ANNOUNCE_KEY) || '[]');
                const hasUnread = announcements.length > readIds.length;
                const badge = document.getElementById('announceBadge');
                if (hasUnread) badge.classList.add('show');
            }

            // 单独加载公告（在 renderAnnouncements 定义后调用，避免作用域问题）
            fetch('data/announce.json?v=' + Date.now())
                .then(r => r.ok ? r.json() : [])
                .then(data => {
                    if (Array.isArray(data) && data.length) renderAnnouncements(data);
                })
                .catch(() => {});

            // 初始化默认公告（会被 data.json 中的数据覆盖）
            renderAnnouncements([
                {
                    type: 'info',
                    title: '欢迎使用汉化模组站',
                    content: '本站提供 Spaceflight Simulator 汉化模组下载，所有模组仅供学习交流。如遇问题请加QQ群 923038827 反馈。',
                    date: '2026-07-11'
                }
            ]);

            function openAnnouncePanel() {
                document.getElementById('announcePanel').classList.add('active');
                document.getElementById('announcePanelOverlay').classList.add('active');
                document.body.classList.add('modal-open');
                const badge = document.getElementById('announceBadge');
                badge.classList.remove('show');
                const list = document.getElementById('announceList');
                const count = list.querySelectorAll('.announce-item').length;
                localStorage.setItem(ANNOUNCE_KEY, JSON.stringify(Array.from({length: count}, (_, i) => i)));
            }
            function closeAnnouncePanel() {
                document.getElementById('announcePanel').classList.remove('active');
                document.getElementById('announcePanelOverlay').classList.remove('active');
                // 检查是否还有其他弹窗/面板打开
                const anyOpen = document.querySelector('.modal-overlay.active, .mod-detail-overlay.active, .sponsor-modal-overlay.active, .img-viewer-overlay.active, .settings-panel.active, .settings-panel-overlay.active');
                if (!anyOpen) document.body.classList.remove('modal-open');
            }

            document.getElementById('announceFloatBtn').addEventListener('click', openAnnouncePanel);
            document.getElementById('announceCloseBtn').addEventListener('click', closeAnnouncePanel);
            document.getElementById('announcePanelOverlay').addEventListener('click', closeAnnouncePanel);

            // DOM 引用
            const panel = document.getElementById('settingsPanel');
            const overlay = document.getElementById('settingsPanelOverlay');
            const openBtn = document.getElementById('settingsFloatBtn');
            const closeBtn = document.getElementById('settingsPanelClose');
            const resetBtn = document.getElementById('settingsResetBtn');

            const darkModeToggle = document.getElementById('settingDarkMode');
            const animationsToggle = document.getElementById('settingAnimations');
            const compactToggle = document.getElementById('settingCompact');
            const lazyLoadToggle = document.getElementById('settingLazyLoad');
            const cardWidthSlider = document.getElementById('settingCardWidth');
            const cardWidthValue = document.getElementById('cardWidthValue');
            const imgHeightSlider = document.getElementById('settingImgHeight');
            const imgHeightValue = document.getElementById('imgHeightValue');
            const columnsSlider = document.getElementById('settingColumns');
            const columnsValue = document.getElementById('columnsValue');
            const cardRadiusSlider = document.getElementById('settingCardRadius');
            const cardRadiusValue = document.getElementById('cardRadiusValue');
            const cardGapSlider = document.getElementById('settingCardGap');
            const cardGapValue = document.getElementById('cardGapValue');
            const cardOpacitySlider = document.getElementById('settingCardOpacity');
            const cardOpacityValue = document.getElementById('cardOpacityValue');
            const styleSelector = document.getElementById('styleSelector');
            const accentColorItem = document.getElementById('accentColorItem');
            const accentColorControl = document.getElementById('accentColorControl');
            const accentColorInput = document.getElementById('settingAccentColor');
            const accentColorValue = document.getElementById('accentColorValue');
            const accentColorDesc = document.getElementById('accentColorDesc');
            const backgroundStyleSelector = document.getElementById('backgroundStyleSelector');
            const backgroundImageInput = document.getElementById('settingBackgroundImage');
            const clearBackgroundImageBtn = document.getElementById('clearBackgroundImage');
            const backgroundUploadStatus = document.getElementById('backgroundUploadStatus');
            const downloadModeSelector = document.getElementById('downloadModeSelector');
            const downloadModeDesc = document.getElementById('downloadModeDesc');
            const downloadModeNote = document.getElementById('downloadModeNote');

            function normalizeAccentColor(value) {
                return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : DEFAULTS.accentColor;
            }
            function normalizeCardOpacity(value) {
                const parsed = parseInt(value, 10);
                return Number.isFinite(parsed) ? Math.min(100, Math.max(70, parsed)) : DEFAULTS.cardOpacity;
            }
            function getOnAccentColor(hex) {
                const value = normalizeAccentColor(hex).slice(1);
                const r = parseInt(value.slice(0, 2), 16);
                const g = parseInt(value.slice(2, 4), 16);
                const b = parseInt(value.slice(4, 6), 16);
                return (r * 0.299 + g * 0.587 + b * 0.114) > 176 ? '#111111' : '#FFFFFF';
            }
            function hasCustomBackgroundImage() {
                return typeof settings.backgroundImage === 'string' && settings.backgroundImage.startsWith('data:image/');
            }
            function applyCustomStyle() {
                const selectedAccent = normalizeAccentColor(settings.accentColor);
                const imageReady = hasCustomBackgroundImage();
                const activeBackground = settings.backgroundStyle === 'image' && !imageReady ? 'grid' : settings.backgroundStyle;
                const imageColorLocked = activeBackground === 'image';
                const colorAdjustmentLocked = Boolean(settings.darkMode || imageColorLocked);
                // 深色模式和图片背景均使用中性色，避免已保存的高饱和主题色破坏阅读对比。
                const activeAccent = settings.darkMode ? '#FFFFFF' : imageColorLocked ? DEFAULTS.accentColor : selectedAccent;
                settings.accentColor = selectedAccent;
                document.documentElement.style.setProperty('--site-accent', activeAccent);
                document.documentElement.style.setProperty('--site-on-accent', getOnAccentColor(activeAccent));
                document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
                    meta.content = settings.darkMode ? '#0D0D0D' : activeAccent;
                });
                accentColorInput.value = selectedAccent;
                accentColorValue.textContent = selectedAccent;
                accentColorInput.disabled = colorAdjustmentLocked;
                accentColorItem.classList.toggle('is-disabled', colorAdjustmentLocked);
                accentColorItem.classList.toggle('is-image-locked', imageColorLocked);
                accentColorControl.setAttribute('aria-disabled', String(colorAdjustmentLocked));
                accentColorDesc.textContent = settings.darkMode
                    ? '黑夜模式下已锁定为高对比配色；切回浅色模式后可调整'
                    : imageColorLocked
                        ? '图片背景下已锁定为中性色；切回网格或纯色背景后可调整'
                        : '同步应用于卡片、设置、公告、赞助和主按钮';
                document.body.classList.remove('background-plain', 'background-grid', 'background-image');
                document.body.classList.add('background-' + activeBackground);
                if (activeBackground === 'image') {
                    const safeUrl = settings.backgroundImage.replace(/"/g, '%22');
                    document.documentElement.style.setProperty('--custom-background-image', 'url("' + safeUrl + '")');
                } else {
                    document.documentElement.style.removeProperty('--custom-background-image');
                }
                backgroundStyleSelector.querySelectorAll('.background-style-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.background === activeBackground);
                });
                clearBackgroundImageBtn.disabled = !imageReady;
                backgroundUploadStatus.textContent = imageReady ? '当前图片仅保存在此浏览器，可随时移除或更换' : '支持 JPG、PNG、WebP，建议不超过 1.5MB';
            }

            // 打开/关闭面板
            function openPanel() {
                panel.classList.add('active');
                overlay.classList.add('active');
                document.body.classList.add('modal-open');
            }
            function closePanel() {
                panel.classList.remove('active');
                overlay.classList.remove('active');
                const anyOpen = document.querySelector('.modal-overlay.active, .mod-detail-overlay.active, .sponsor-modal-overlay.active, .img-viewer-overlay.active, .announce-panel.active, .announce-panel-overlay.active');
                if (!anyOpen) document.body.classList.remove('modal-open');
            }

            openBtn.addEventListener('click', openPanel);
            closeBtn.addEventListener('click', closePanel);
            overlay.addEventListener('click', closePanel);

            // 应用设置到 UI
            function applySettings() {
                // 自定义主题与背景
                applyCustomStyle();

                // 黑夜模式
                document.body.classList.toggle('dark-mode', settings.darkMode);
                darkModeToggle.checked = settings.darkMode;

                // 动画
                if (settings.animations) {
                    document.body.classList.remove('no-animations');
                } else {
                    document.body.classList.add('no-animations');
                }
                animationsToggle.checked = settings.animations;

                // 卡片宽度
                document.documentElement.style.setProperty('--card-min-width', settings.cardWidth + 'px');
                cardWidthSlider.value = settings.cardWidth;
                cardWidthValue.textContent = settings.cardWidth + 'px';

                const grid = document.getElementById('fileGrid');

                // 紧凑模式
                document.body.classList.toggle('compact-mode', settings.compact);
                compactToggle.checked = settings.compact;

                // 图片高度
                document.documentElement.style.setProperty('--card-img-height', settings.imgHeight + 'px');
                const style = document.getElementById('dynamicImgHeightStyle');
                if (style) {
                    style.textContent = '.card-image-wrap { height: ' + settings.imgHeight + 'px !important; }';
                }
                imgHeightSlider.value = settings.imgHeight;
                imgHeightValue.textContent = settings.imgHeight + 'px';

                // 布局风格（先于列数处理，因为布局风格可能覆盖列数）
                document.body.classList.remove('layout-list', 'layout-wide');
                if (settings.layoutStyle !== 'grid') {
                    document.body.classList.add('layout-' + settings.layoutStyle);
                }
                styleSelector.querySelectorAll('.style-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.style === settings.layoutStyle);
                });

                // 一行显示个数（仅在网格布局下生效）
                if (settings.layoutStyle === 'grid') {
                    if (settings.columns > 0) {
                        grid.style.gridTemplateColumns = 'repeat(' + settings.columns + ', 1fr)';
                    } else {
                        grid.style.gridTemplateColumns = '';
                    }
                } else {
                    grid.style.gridTemplateColumns = '';
                }
                columnsSlider.value = settings.columns;
                columnsValue.textContent = settings.columns === 0 ? '自动' : settings.columns + '列';

                // 卡片宽度：仅自动列数时可用
                const cardWidthItem = document.getElementById('cardWidthItem');
                const cardWidthDesc = document.getElementById('cardWidthDesc');
                if (settings.columns > 0) {
                    cardWidthSlider.disabled = true;
                    cardWidthItem.style.opacity = '0.5';
                    cardWidthItem.style.pointerEvents = 'none';
                    cardWidthDesc.textContent = '手动列数模式下不可用';
                } else {
                    cardWidthSlider.disabled = false;
                    cardWidthItem.style.opacity = '1';
                    cardWidthItem.style.pointerEvents = 'auto';
                    cardWidthDesc.textContent = '调整卡片大小（仅自动列数时生效）';
                }

                // 卡片圆角
                document.documentElement.style.setProperty('--card-radius', settings.cardRadius + 'px');
                cardRadiusSlider.value = settings.cardRadius;
                cardRadiusValue.textContent = settings.cardRadius + 'px';

                // 卡片间距
                document.documentElement.style.setProperty('--card-gap', settings.cardGap + 'px');
                cardGapSlider.value = settings.cardGap;
                cardGapValue.textContent = settings.cardGap + 'px';

                // 卡片透明度：保留至少 70% 表面不透明度，避免图片背景或深色模式中文字失去对比。
                settings.cardOpacity = normalizeCardOpacity(settings.cardOpacity);
                document.documentElement.style.setProperty('--card-surface-alpha', settings.cardOpacity + '%');
                cardOpacitySlider.value = settings.cardOpacity;
                cardOpacityValue.textContent = settings.cardOpacity + '%';

                // 懒加载
                lazyLoadToggle.checked = settings.lazyLoad;

                // 下载方式
                if (!['direct', 'auto', 'lanzou'].includes(settings.downloadMode)) {
                    settings.downloadMode = settings.downloadMode === 'manual' ? 'lanzou' : 'direct';
                }
                if (downloadModeSelector) {
                    downloadModeSelector.querySelectorAll('[data-download-mode]').forEach(btn => {
                        const active = btn.dataset.downloadMode === settings.downloadMode;
                        btn.classList.toggle('active', active);
                        btn.setAttribute('aria-checked', String(active));
                    });
                    const messages = {
                        direct: {
                            desc: '从固定 HTTPS 直链直接下载 ZIP 文件',
                            note: '直链下载会在浏览器中直接获取文件；未配置安全直链的资源将回退到蓝奏云。'
                        },
                        auto: {
                            desc: '由安装助手下载、校验、解压并写入对应目录',
                            note: '自动安装仅限 Android，需安装 SFS 汉化模组安装助手；不满足条件时回退到蓝奏云。'
                        },
                        lanzou: {
                            desc: '打开原蓝奏云分享页后手动下载',
                            note: '适用于未安装助手或希望使用原网盘下载方式的情况。'
                        }
                    };
                    downloadModeDesc.textContent = messages[settings.downloadMode].desc;
                    downloadModeNote.textContent = messages[settings.downloadMode].note;
                    window.dispatchEvent(new Event('sfs-download-mode-change'));
                }
            }

            // 创建动态样式标签
            const dynamicStyle = document.createElement('style');
            dynamicStyle.id = 'dynamicImgHeightStyle';
            document.head.appendChild(dynamicStyle);

            // 事件绑定
            accentColorInput.addEventListener('input', function() {
                if (settings.darkMode || (settings.backgroundStyle === 'image' && hasCustomBackgroundImage())) return;
                settings.accentColor = normalizeAccentColor(this.value);
                saveSettings(settings);
                applySettings();
            });

            backgroundStyleSelector.querySelectorAll('.background-style-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const nextStyle = this.dataset.background;
                    if (nextStyle === 'image' && !(settings.backgroundImage || '').startsWith('data:image/')) {
                        backgroundImageInput.click();
                        return;
                    }
                    settings.backgroundStyle = nextStyle;
                    saveSettings(settings);
                    applySettings();
                });
            });

            backgroundImageInput.addEventListener('change', function() {
                const file = this.files && this.files[0];
                this.value = '';
                if (!file) return;
                const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    toast('请选择 JPG、PNG 或 WebP 图片');
                    return;
                }
                if (file.size > 1.5 * 1024 * 1024) {
                    toast('背景图片请控制在 1.5MB 以内');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function() {
                    settings.backgroundImage = String(reader.result || '');
                    settings.backgroundStyle = 'image';
                    saveSettings(settings);
                    applySettings();
                    toast('已应用自定义背景图片');
                };
                reader.onerror = function() { toast('图片读取失败，请更换后重试'); };
                reader.readAsDataURL(file);
            });

            clearBackgroundImageBtn.addEventListener('click', function() {
                settings.backgroundImage = '';
                settings.backgroundStyle = 'grid';
                saveSettings(settings);
                applySettings();
                toast('已移除自定义背景图片');
            });

            darkModeToggle.addEventListener('change', function() {
                settings.darkMode = this.checked;
                saveSettings(settings);
                applySettings();
            });

            animationsToggle.addEventListener('change', function() {
                settings.animations = this.checked;
                saveSettings(settings);
                applySettings();
            });

            cardWidthSlider.addEventListener('input', function() {
                settings.cardWidth = parseInt(this.value);
                saveSettings(settings);
                applySettings();
            });

            compactToggle.addEventListener('change', function() {
                settings.compact = this.checked;
                saveSettings(settings);
                applySettings();
            });

            imgHeightSlider.addEventListener('input', function() {
                settings.imgHeight = parseInt(this.value);
                saveSettings(settings);
                applySettings();
            });

            lazyLoadToggle.addEventListener('change', function() {
                settings.lazyLoad = this.checked;
                saveSettings(settings);
                applySettings();
            });

            columnsSlider.addEventListener('input', function() {
                settings.columns = parseInt(this.value);
                saveSettings(settings);
                applySettings();
            });

            cardRadiusSlider.addEventListener('input', function() {
                settings.cardRadius = parseInt(this.value);
                saveSettings(settings);
                applySettings();
            });

            cardGapSlider.addEventListener('input', function() {
                settings.cardGap = parseInt(this.value);
                saveSettings(settings);
                applySettings();
            });

            cardOpacitySlider.addEventListener('input', function() {
                settings.cardOpacity = normalizeCardOpacity(this.value);
                saveSettings(settings);
                applySettings();
            });

            styleSelector.querySelectorAll('.style-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    settings.layoutStyle = this.dataset.style;
                    saveSettings(settings);
                    applySettings();
                });
            });

            downloadModeSelector.querySelectorAll('[data-download-mode]').forEach(btn => {
                btn.addEventListener('click', function() {
                    settings.downloadMode = ['direct', 'auto', 'lanzou'].includes(this.dataset.downloadMode) ? this.dataset.downloadMode : 'direct';
                    saveSettings(settings);
                    applySettings();
                    if (settings.downloadMode === 'auto') {
                        toast('已选择自动安装，请确认已安装 SFS 汉化模组安装助手');
                    } else if (settings.downloadMode === 'direct') {
                        toast('已选择直链下载，将直接下载 ZIP 文件');
                    }
                });
            });

            // 重置
            resetBtn.addEventListener('click', function() {
                settings = { ...DEFAULTS };
                saveSettings(settings);
                applySettings();
            });

            // 初始化应用设置
            applySettings();

        })();

        /* ============================================
           回到顶部按钮逻辑
           ============================================ */
        (function() {
            'use strict';

            var btn = document.getElementById('backToTopBtn');
            var scrollThreshold = 300;

            function toggleVisibility() {
                if (window.scrollY > scrollThreshold) {
                    btn.classList.add('visible');
                } else {
                    btn.classList.remove('visible');
                }
            }

            btn.addEventListener('click', function() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            window.addEventListener('scroll', toggleVisibility, { passive: true });
            toggleVisibility();

        })();
