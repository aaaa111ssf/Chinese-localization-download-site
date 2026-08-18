(function() {
            'use strict';

            let files = [];
            let downloadStats = {}; // 全局下载统计
            const typeIcons = {
                pdf: '📄', zip: '📦', doc: '📝', img: '🖼️',
                video: '🎬', code: '💻', default: '📎'
            };
            let currentCategory = 'all';
            let searchKeyword = '';
            let viewerImages = [];
            let viewerIndex = 0;

            /* ---------- 收藏功能 ---------- */
            let favorites = [];
            let favFilterActive = false;
            try {
                favorites = JSON.parse(localStorage.getItem('sfs_favorites')) || [];
            } catch(e) {
                favorites = [];
            }
            function saveFavorites() {
                localStorage.setItem('sfs_favorites', JSON.stringify(favorites));
            }
            function toggleFavorite(name) {
                const idx = favorites.indexOf(name);
                let action;
                if (idx === -1) {
                    favorites.push(name);
                    action = 'add';
                } else {
                    favorites.splice(idx, 1);
                    action = 'remove';
                }
                saveFavorites();
                updateFavButtons();
                // 上报收藏统计（不阻塞）
                try {
                    navigator.sendBeacon('/api/favorites', JSON.stringify({ mod: name, action }));
                } catch (e) {}
                // 更新卡片上的收藏计数
                const el = document.querySelector('.fav-count[data-mod="' + name + '"]');
                if (el) {
                    const cur = parseInt(el.textContent || '0', 10);
                    el.textContent = Math.max(0, cur + (action === 'add' ? 1 : -1));
                }
            }
            window.toggleFavorite = toggleFavorite;
            function updateFavButtons() {
                document.querySelectorAll('.btn-fav').forEach(btn => {
                    const name = btn.dataset.name;
                    if (!name) return;
                    if (favorites.includes(name)) {
                        btn.textContent = '\u2665';
                        btn.classList.add('active');
                    } else {
                        btn.textContent = '\u2661';
                        btn.classList.remove('active');
                    }
                });
            }
            function updateFavFilterBtn() {
                const item = document.getElementById('favDropdownItem');
                if (!item) return;
                if (favFilterActive) {
                    item.classList.add('active');
                    item.innerHTML = '\u2665 收藏';
                } else {
                    item.classList.remove('active');
                    item.innerHTML = '\u2661 收藏';
                }
            }

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

            /* ---------- Waline 评论服务地址（走主站代理，解决 workers.dev 大陆无法访问） ---------- */
            const WALINE_SERVER = location.origin + '/waline-proxy';

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
            const IMG_TIMEOUT_MS = 3500;

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
                const icon = img.dataset.icon || '📦';
                wrap.innerHTML = `
                    <div class="card-image-fallback">
                        <span class="fallback-icon">${icon}</span>
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

                // 回绕保护：若当前已是最后一个镜像(B2)，回绕到第一个镜像再试一轮
                let retries = parseInt(img.dataset.retry || '0', 10);
                if (mirrorIdx >= CDN_MIRRORS.length - 1) {
                    if (retries >= 1) {
                        showImgPlaceholder(img);
                        return;
                    }
                    mirrorIdx = 0;
                    retries++;
                    img.dataset.retry = retries;
                } else {
                    mirrorIdx++;
                }

                // 提取文件名（最后一个 / 之后的部分）
                const fileName = currentSrc.substring(currentSrc.lastIndexOf('/') + 1);
                if (fileName) {
                    const newSrc = CDN_MIRRORS[mirrorIdx] + '/' + fileName;
                    img.dataset.mirrorIdx = mirrorIdx;
                    img.src = newSrc;
                    img.onerror = function() { window.handleImgError(img); };
                    armImgTimeout(img);
                    return;
                }

                showImgPlaceholder(img);
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
                                img.src = src;
                                armImgTimeout(img);
                                // 立即显示模糊占位，等加载完再变清晰
                                img.style.opacity = '1';
                                if (img.complete) {
                                    img.classList.add('loaded');
                                } else {
                                    img.onload = () => img.classList.add('loaded');
                                    img.onerror = () => img.classList.add('loaded');
                                }
                                img.removeAttribute('data-src');
                            }
                            obs.unobserve(img);
                        }
                    });
                }, { rootMargin: '100px 0px', threshold: 0.01 });
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
                const icon = typeIcons[safe.type] || typeIcons.default;
                const slug = toSlug(file.name || '');

                let imageHtml = '';
                if (validImages.length > 0) {
                    const thumbs = validImages.slice(1, 4);
                    const moreCount = validImages.length > 4 ? validImages.length - 4 : 0;
                    const thumbsHtml = thumbs.length ? `
                        <div class="card-image-gallery" onclick="event.stopPropagation()">
                            ${thumbs.map((img, i) => `<img data-src="${escapeHtml(img)}" onclick="openImgViewer(${index}, ${i+1})" alt="${escapeHtml(safe.name)}缩略图${i+1}" class="lazy-img" onerror="this.style.display='none'; this.onerror=null;">`).join('')}
                            ${moreCount ? `<span style="color:#fff;font-size:0.7rem;padding:4px 6px;background:rgba(0,0,0,0.4);border-radius:4px;white-space:nowrap;">+${moreCount}</span>` : ''}
                        </div>
                    ` : '';
                    const isAboveFold = index < 4;
                    imageHtml = `
                        <div class="card-image-wrap" onclick="openModDetail(${index})">
                            <img ${isAboveFold ? 'src' : 'data-src'}="${escapeHtml(validImages[0])}" alt="${safe.name}预览图" class="lazy-img" data-icon="${icon}" data-mirror-idx="0" onerror="handleImgError(this)" onload="handleImgLoad(this)" ${isAboveFold ? 'loading="eager" fetchpriority="high"' : ''}>
                            ${thumbsHtml}
                        </div>
                    `;
                } else {
                    imageHtml = `
                        <div class="card-image-wrap card-image-placeholder" onclick="openModDetail(${index})">
                            <div class="card-image-fallback">
                                <span class="fallback-icon">${icon}</span>
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
                                <span>作者: ${safe.author}</span>
                                <span>版本: ${safe.version}</span>
                            </div>
                            <div class="card-tags">${tagsHtml}</div>
                            <div class="card-desc">${safe.desc}</div>
                            <div class="card-meta-boxes">
                                <div class="meta-box">大小: ${safe.size}</div>
                                <div class="meta-box">日期: ${safe.date}</div>
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-detail" onclick="event.stopPropagation(); openModDetail(${index})">详情</button>
                            <button class="btn btn-comment" title="查看评论" onclick="event.stopPropagation(); openModDetail(${index}, true)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
                                <span class="comment-count" data-slug="${slug}"></span>
                            </button>
                            <button class="btn btn-fav" data-name="${safe.name}" onclick="event.stopPropagation(); toggleFavorite(this.dataset.name)">&#9825;<span class="fav-count" data-mod="${safe.name}"></span></button>
                            <button class="btn btn-share" title="分享模组" onclick="event.stopPropagation(); shareModLink(${index})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                            </button>
                            <a href="${safe.link}" target="_blank" class="btn btn-download" onclick="event.stopPropagation(); logDownload(${index})">下载<span class="dl-count" data-mod="${safe.name}"></span></a>
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
                    heat: escapeHtml(file.heat || '热'),
                    link: escapeHtml(file.link || '#'),
                    type: file.type || 'default'
                };
                const icon = typeIcons[safe.type] || typeIcons.default;
                const img = validImages.length > 0
                    ? `<div class="sug-img-wrap"><img data-src="${escapeHtml(validImages[0])}" data-icon="${icon}" class="lazy-img" alt="${safe.name}预览图" data-mirror-idx="0" onerror="handleImgError(this)" onload="handleImgLoad(this)"></div>`
                    : `<div class="sug-img-wrap card-image-placeholder"><div class="card-image-fallback"><span class="fallback-icon">${icon}</span><span class="fallback-text">暂无预览</span></div></div>`;
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
                                <span>热度: ${safe.heat}</span>
                            </div>
                        </div>
                        <a href="${safe.link}" target="_blank" class="sug-btn">下载</a>
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

                files.forEach((file, index) => {
                    /* 收藏筛选 */
                    if (favFilterActive && !favorites.includes(file.name || '')) return;

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
                            <div style="font-size:3rem;margin-bottom:10px;">😕</div>
                            <div style="font-size:1.2rem;color:#111;font-weight:700;">没有找到匹配的文件</div>
                            <div style="color:#666;margin-top:8px;">请尝试其他关键词，或浏览以下热门推荐</div>
                        </div>
                        <div class="suggestion-grid">
                            ${suggestions.map((file, idx) => createCompactCard(file, idx)).join('')}
                        </div>
                    `;
                }

                observeLazyImages();
                updateFavButtons();
                loadCommentCounts();
                loadDownloadStats();
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
            });

            document.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                    currentCategory = this.dataset.category;
                    favFilterActive = (currentCategory === 'fav');
                    if (favFilterActive) {
                        currentCategory = 'all';
                    }
                    categoryToggleText.textContent = this.textContent;
                    categoryDropdown.classList.remove('open');
                    categoryToggle.setAttribute('aria-expanded', 'false');
                    updateFavFilterBtn();
                    renderFiles();
                });
            });

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
            function showModal() {
                if (entryModalShown || localStorage.getItem('hideEntryModal') === 'true') return;
                const modal = document.getElementById('entryModal');
                document.body.classList.add('modal-open');
                setTimeout(() => modal.classList.add('active'), 100);
                entryModalShown = true;
            }

            window.closeModal = function() {
                const checkbox = document.getElementById('dontShowAgain');
                if (checkbox && checkbox.checked) {
                    localStorage.setItem('hideEntryModal', 'true');
                }
                document.getElementById('entryModal').classList.remove('active');
                checkAndRemoveModalOpen();
            };

            window.addEventListener('load', function() {
                setTimeout(showModal, 100);
            });
            updateFavFilterBtn();

            /* ---------- 模组详情 ---------- */
            window.openModDetail = function(index, gotoComment) {
                const file = files[index];
                if (!file) return;
                const validImages = getValidImages(file);
                const box = document.getElementById('modDetailBox');
                const tags = (Array.isArray(file.tags) ? file.tags : []).map(t => `<span>${escapeHtml(t)}</span>`).join('');
                const icon = typeIcons[file.type] || typeIcons.default;
                const modName = file.name || '未命名模组';
                const slug = toSlug(modName);
                const modUrl = location.origin + '/mod/' + slug;
                const dlCount = downloadStats[modName] || 0;

                const firstImage = validImages.length > 0 
                    ? `<img data-src="${escapeHtml(validImages[0])}" alt="${escapeHtml(file.name||'模组')}预览图" class="lazy-img" data-icon="${icon}" data-mirror-idx="0" onerror="handleImgError(this)" onload="handleImgLoad(this)">`
                    : `<div style="height:100%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;"><div class="card-image-fallback"><span class="fallback-icon">${icon}</span><span class="fallback-text">暂无预览</span></div></div>`;

                const gallery = validImages.length > 0 ?
                    `<div class="detail-section"><h4>预览图</h4><div class="mod-detail-gallery">${validImages.map((img,i)=>`<img data-src="${escapeHtml(img)}" alt="${escapeHtml(file.name||'模组')}预览图${i+1}" data-icon="${icon}" class="lazy-img" data-mirror-idx="0" onclick="openImgViewer(${index},${i})" onerror="handleImgError(this)" onload="handleImgLoad(this)">`).join('')}</div></div>` : '';

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
                        <div class="detail-section"><h4>信息</h3><p>版本：${escapeHtml(file.version||'v1.0')} &nbsp;|&nbsp; 作者：${escapeHtml(file.author||'A Future star')} &nbsp;|&nbsp; 兼容：${escapeHtml(file.compat||'1.6.00.3+')} &nbsp;|&nbsp; 大小：${escapeHtml(file.size||'未知')} &nbsp;|&nbsp; 更新：${escapeHtml(file.date||'')}</p></div>
                        <div class="detail-section detail-stats">
                            <h4>数据</h3>
                            <div class="detail-stats-row">
                                <span class="stat-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> 下载 <b id="dlCountDetail">${dlCount}</b></span>
                                <span class="stat-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> 收藏 <b id="favCountDetail">${favorites.includes(modName) ? '--' : '--'}</b></span>
                                <span class="stat-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> 评分 <b id="ratingCountDetail">--</b></span>
                            </div>
                        </div>
                        <div class="detail-section detail-rating">
                            <h4>评分</h3>
                            <div class="rating-row">
                                <div class="stars" id="detailStars"></div>
                                <span class="rating-score" id="detailRatingScore">--</span>
                                <span class="rating-msg" id="detailRatingMsg"></span>
                            </div>
                        </div>
                        ${gallery}
                        <div class="detail-section" id="commentSection">
                            <h4>评论</h4>
                            <div id="waline"></div>
                        </div>
                    </div>
                    <div class="mod-detail-footer">
                        <button onclick="closeModDetail()" class="detail-btn detail-btn-secondary">关闭</button>
                        <button onclick="shareModLink(${index})" class="detail-btn detail-btn-share">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                            分享
                        </button>
                        <a href="${escapeHtml(file.link || '#')}" target="_blank" class="detail-btn detail-btn-primary" onclick="event.stopPropagation(); logDownload(${index})">前往下载</a>
                    </div>
                `;
                document.getElementById('modDetailOverlay').classList.add('active');
                document.body.classList.add('modal-open');
                observeLazyImages();
                // 加载评分
                loadRating(modName);
                // 初始化评论
                initWaline('/mod/' + slug);
                // 从卡片评论按钮进入时，滚动到评论区
                if (gotoComment) {
                    setTimeout(function() {
                        const sec = document.getElementById('commentSection');
                        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                }
            };

            window.closeModDetail = function() {
                document.getElementById('modDetailOverlay').classList.remove('active');
                checkAndRemoveModalOpen();
                destroyWaline();
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

            /* ---------- 评分（SVG 星星） ---------- */
            function renderStars(container, score, onClick) {
                container.innerHTML = '';
                for (let i = 1; i <= 5; i++) {
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('viewBox', '0 0 24 24');
                    svg.setAttribute('class', 'star-svg' + (i <= score ? ' on' : ''));
                    svg.innerHTML = '<path d="M12 2l2.9 6.26 6.6.57-5 4.47 1.5 6.7L12 16.9 5.99 20l1.5-6.7-5-4.47 6.6-.57z"/>';
                    if (onClick) {
                        svg.style.cursor = 'pointer';
                        svg.onclick = function() { onClick(i); };
                    }
                    container.appendChild(svg);
                }
            }

            function loadRating(modName) {
                fetch('/api/ratings?mod=' + encodeURIComponent(modName))
                    .then(r => r.json())
                    .then(d => {
                        const scoreEl = document.getElementById('detailRatingScore');
                        const countEl = document.getElementById('ratingCountDetail');
                        if (scoreEl) scoreEl.textContent = d.average ? d.average.toFixed(1) : '--';
                        if (countEl) countEl.textContent = d.count ? d.count + '人' : '--';
                        const stars = document.getElementById('detailStars');
                        if (stars) renderStars(stars, d.myScore || 0, function(s) { submitRating(modName, s); });
                    })
                    .catch(() => {});
            }

            function submitRating(modName, score) {
                fetch('/api/ratings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mod: modName, score })
                })
                    .then(r => r.json())
                    .then(d => {
                        if (d.ok) {
                            const scoreEl = document.getElementById('detailRatingScore');
                            const countEl = document.getElementById('ratingCountDetail');
                            const msgEl = document.getElementById('detailRatingMsg');
                            if (scoreEl) scoreEl.textContent = d.average.toFixed(1);
                            if (countEl) countEl.textContent = d.count + '人';
                            if (msgEl) msgEl.textContent = '感谢你的评分！';
                            const stars = document.getElementById('detailStars');
                            if (stars) renderStars(stars, score);
                        }
                    })
                    .catch(() => {
                        const msgEl = document.getElementById('detailRatingMsg');
                        if (msgEl) msgEl.textContent = '评分提交失败';
                    });
            }

            /* ---------- Waline 评论（SVG 符号，无表情反应） ---------- */
            let walineInstance = null;
            function initWaline(path) {
                if (!window.Waline) {
                    // Waline 脚本可能尚未加载完成，稍后重试
                    setTimeout(function() { initWaline(path); }, 300);
                    return;
                }
                try {
                    if (walineInstance) { walineInstance.destroy(); walineInstance = null; }
                } catch (e) {}
                walineInstance = Waline.init({
                    el: '#waline',
                    serverURL: WALINE_SERVER,
                    path: path,
                    lang: 'zh-CN',
                    reaction: false,
                    pageview: false,
                    dark: 'auto',
                    emoji: false
                });
            }
            function destroyWaline() {
                if (walineInstance) {
                    try { walineInstance.destroy(); } catch (e) {}
                    walineInstance = null;
                }
            }

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

            // 加载全局下载统计 + 收藏统计（必须在所有 renderFiles 调用之前声明，避免 TDZ 错误）
            let statsLoading = false;
            async function loadDownloadStats() {
                if (statsLoading) return;
                statsLoading = true;
                try {
                    const resp = await fetch('/api/stats');
                    if (resp.ok) {
                        const data = await resp.json();
                        downloadStats = data.downloads || {};
                        const favStats = data.favorites || {};
                        // 更新页面上的下载计数显示
                        document.querySelectorAll('.dl-count[data-mod]').forEach(el => {
                            const name = el.getAttribute('data-mod');
                            if (downloadStats[name] > 0) el.textContent = downloadStats[name];
                        });
                        // 更新页面上的收藏计数显示
                        document.querySelectorAll('.fav-count[data-mod]').forEach(el => {
                            const name = el.getAttribute('data-mod');
                            if (favStats[name] > 0) el.textContent = favStats[name];
                        });
                    }
                } catch (e) {
                    // 统计服务不可用时静默降级
                } finally {
                    statsLoading = false;
                }
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

            fetch('data/data.json?v=20260713')
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

            // 加载每个模组的评论数（从 D1 的 wl_Comment 表统计）
            async function loadCommentCounts() {
                try {
                    const els = document.querySelectorAll('.comment-count[data-slug]');
                    if (!els.length) return;
                    const slugs = Array.from(new Set(
                        Array.from(els).map(el => el.getAttribute('data-slug')).filter(Boolean)
                    )).slice(0, 100);
                    if (!slugs.length) return;
                    const resp = await fetch('/api/comments?slugs=' + encodeURIComponent(slugs.join(',')));
                    if (!resp.ok) return;
                    const counts = await resp.json();
                    els.forEach(el => {
                        const slug = el.getAttribute('data-slug');
                        const n = counts['/mod/' + slug] || 0;
                        if (n > 0) el.textContent = n;
                    });
                } catch (e) {
                    // 评论服务不可用时静默降级
                }
            }

            // 记录下载
            function logDownload(index) {
                const file = files[index];
                if (!file) return;
                const name = (file.name || '').trim();
                // 更新本地显示
                downloadStats[name] = (downloadStats[name] || 0) + 1;
                const el = document.querySelector('.dl-count[data-mod="' + name + '"]');
                if (el) el.textContent = downloadStats[name];
                // 记录个人下载历史
                addDlHistory(name);
                // 后台上报（不阻塞下载）
                navigator.sendBeacon('/api/log', JSON.stringify({ mod: name }));
            }

            // 加载下载统计（等卡片渲染完后再显示计数）
            // 已移至 renderFiles 中调用

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
                cardGap: 20
            };

            // 读取设置
            function loadSettings() {
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) return JSON.parse(saved);
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
            const styleSelector = document.getElementById('styleSelector');

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

                // 懒加载
                lazyLoadToggle.checked = settings.lazyLoad;
            }

            // 创建动态样式标签
            const dynamicStyle = document.createElement('style');
            dynamicStyle.id = 'dynamicImgHeightStyle';
            document.head.appendChild(dynamicStyle);

            // 事件绑定
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

            styleSelector.querySelectorAll('.style-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    settings.layoutStyle = this.dataset.style;
                    saveSettings(settings);
                    applySettings();
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