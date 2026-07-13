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
                if (idx === -1) {
                    favorites.push(name);
                } else {
                    favorites.splice(idx, 1);
                }
                saveFavorites();
                updateFavButtons();
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

            /* ---------- 图片CDN回退列表 ---------- */
            const CDN_MIRRORS = [
                'https://testingcf.jsdelivr.net/gh',
                'https://cdn.jsdmirror.com/gh',
                'https://jsdelivr.aby.pub/gh',
                'https://cdn.jsdelivr.net/gh'
            ];
            const GH_PATH_PREFIX = '/aaaa111ssf/images@main';

            /* ---------- 图片加载失败回退 ---------- */
            window.handleImgError = function(img) {
                img.onerror = null;

                // 尝试CDN镜像回退
                const currentSrc = img.src || '';
                let mirrorIdx = parseInt(img.dataset.mirrorIdx || '0', 10);

                if (mirrorIdx < CDN_MIRRORS.length - 1) {
                    mirrorIdx++;
                    const path = currentSrc.substring(currentSrc.indexOf(GH_PATH_PREFIX));
                    if (path) {
                        const newSrc = CDN_MIRRORS[mirrorIdx] + path;
                        img.dataset.mirrorIdx = mirrorIdx;
                        img.src = newSrc;
                        img.onerror = function() { window.handleImgError(img); };
                        return;
                    }
                }

                // 所有CDN都失败，显示占位图
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
            };

            /* ---------- 图片加载完成移除骨架屏 ---------- */
            window.handleImgLoad = function(img) {
                var wrap = img.closest('.card-image-wrap');
                if (wrap) {
                    wrap.style.animation = 'none';
                    wrap.style.background = '';
                }
            }

            /* ---------- 工具 ---------- */
            function checkAndRemoveModalOpen() {
                const anyActive = document.querySelector(
                    '.modal-overlay.active, .img-viewer-overlay.active, .mod-detail-overlay.active, .sponsor-modal-overlay.active'
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
                            <button class="btn btn-fav" data-name="${safe.name}" onclick="event.stopPropagation(); toggleFavorite(this.dataset.name)">&#9825;</button>
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
                grid.style.display = '';

                if (currentCategory === 'tutorial') {
                    grid.style.display = 'none';
                    noResults.classList.remove('show');
                    tutorialSection.style.display = 'block';
                    document.getElementById('totalCount').textContent = '教程';
                    return;
                } else {
                    grid.style.display = 'grid';
                    tutorialSection.style.display = 'none';
                }

                grid.innerHTML = '';
                noResults.innerHTML = '';
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
                        grid.innerHTML += createModCard(file, index);
                    }
                });

                // 动态设置入场动画 stagger delay
                const cards = grid.querySelectorAll('.file-card');
                const baseDelay = 0.03;
                const maxDelay = 0.5;
                cards.forEach((card, i) => {
                    const delay = Math.min(i * baseDelay, maxDelay);
                    card.style.setProperty('--card-enter-delay', delay + 's');
                });

                document.getElementById('totalCount').textContent = visibleCount;

                if (visibleCount === 0) {
                    grid.style.display = 'none';
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
                } else {
                    noResults.classList.remove('show');
                    grid.style.display = 'grid';
                }

                observeLazyImages();
                updateFavButtons();
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

            /* ---------- 开屏弹窗（不再提示） ---------- */
            function showModal() {
                if (localStorage.getItem('hideEntryModal') === 'true') return;
                const modal = document.getElementById('entryModal');
                document.body.classList.add('modal-open');
                setTimeout(() => modal.classList.add('active'), 100);
            }

            window.closeModal = function() {
                const checkbox = document.getElementById('dontShowAgain');
                if (checkbox && checkbox.checked) {
                    localStorage.setItem('hideEntryModal', 'true');
                }
                document.getElementById('entryModal').classList.remove('active');
                checkAndRemoveModalOpen();
            };

            window.addEventListener('DOMContentLoaded', showModal);
            updateFavFilterBtn();

            /* ---------- 模组详情 ---------- */
            window.openModDetail = function(index) {
                const file = files[index];
                if (!file) return;
                const validImages = getValidImages(file);
                const box = document.getElementById('modDetailBox');
                const tags = (Array.isArray(file.tags) ? file.tags : []).map(t => `<span>${escapeHtml(t)}</span>`).join('');
                const icon = typeIcons[file.type] || typeIcons.default;

                const firstImage = validImages.length > 0 
                    ? `<img data-src="${escapeHtml(validImages[0])}" alt="${escapeHtml(file.name||'模组')}预览图" class="lazy-img" data-icon="${icon}" data-mirror-idx="0" onerror="handleImgError(this)" onload="handleImgLoad(this)">`
                    : `<div style="height:100%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;"><div class="card-image-fallback"><span class="fallback-icon">${icon}</span><span class="fallback-text">暂无预览</span></div></div>`;

                const gallery = validImages.length > 0 ?
                    `<div class="detail-section"><h4>预览图</h4><div class="mod-detail-gallery">${validImages.map((img,i)=>`<img data-src="${escapeHtml(img)}" alt="${escapeHtml(file.name||'模组')}预览图${i+1}" data-icon="${icon}" class="lazy-img" data-mirror-idx="0" onclick="openImgViewer(${index},${i})" onerror="handleImgError(this)" onload="handleImgLoad(this)">`).join('')}</div></div>` : '';

                box.innerHTML = `
                    <div class="mod-detail-header">
                        ${firstImage}
                        <div class="header-overlay">
                            <h2>${escapeHtml(file.name || '未命名模组')}</h2>
                            <div class="header-tags">${tags}</div>
                        </div>
                    </div>
                    <div class="mod-detail-body">
                        <div class="detail-section"><h4>简介</h3><p>${escapeHtml(file.desc || '暂无描述')}</p></div>
                        <div class="detail-section"><h4>信息</h3><p>版本：${escapeHtml(file.version||'v1.0')} &nbsp;|&nbsp; 作者：${escapeHtml(file.author||'A Future star')} &nbsp;|&nbsp; 兼容：${escapeHtml(file.compat||'1.6.00.3+')} &nbsp;|&nbsp; 大小：${escapeHtml(file.size||'未知')} &nbsp;|&nbsp; 更新：${escapeHtml(file.date||'')}</p></div>
                        ${gallery}
                    </div>
                    <div class="mod-detail-footer">
                        <button onclick="closeModDetail()" class="detail-btn detail-btn-secondary">关闭</button>
                        <a href="${escapeHtml(file.link || '#')}" target="_blank" class="detail-btn detail-btn-primary">前往下载</a>
                    </div>
                `;
                document.getElementById('modDetailOverlay').classList.add('active');
                document.body.classList.add('modal-open');
                observeLazyImages();
            };

            window.closeModDetail = function() {
                document.getElementById('modDetailOverlay').classList.remove('active');
                checkAndRemoveModalOpen();
            };

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
                "https://testingcf.jsdelivr.net/gh/aaaa111ssf/images@main/5.png"
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
            fetch('data/data.json?v=' + Date.now())
                .then(response => {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(data => {
                    if (Array.isArray(data)) {
                        files = data;
                    } else if (data && typeof data === 'object' && Array.isArray(data.files)) {
                        files = data.files;
                    } else {
                        throw new Error('数据格式错误');
                    }
                    renderFiles();
                })
                .catch(err => {
                    console.error('数据加载失败:', err);
                    document.getElementById('gridLoading').classList.add('hidden');
                    document.getElementById('loadError').classList.add('show');
                    document.getElementById('fileGrid').style.display = 'none';
                    document.getElementById('totalCount').textContent = '0';
                });

            // 加载全局下载统计
            async function loadDownloadStats() {
                try {
                    const resp = await fetch('/api/stats');
                    if (resp.ok) {
                        downloadStats = await resp.json();
                        // 更新页面上的下载计数显示
                        document.querySelectorAll('.dl-count[data-mod]').forEach(el => {
                            const name = el.getAttribute('data-mod');
                            if (downloadStats[name] > 0) el.textContent = downloadStats[name];
                        });
                    }
                } catch (e) {
                    // 统计服务不可用时静默降级
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
                // 后台上报（不阻塞下载）
                navigator.sendBeacon('/api/log', JSON.stringify({ mod: name }));
            }

            // 单独加载公告
            fetch('data/announce.json?v=' + Date.now())
                .then(r => r.ok ? r.json() : [])
                .then(data => {
                    if (Array.isArray(data) && data.length) renderAnnouncements(data);
                })
                .catch(() => {});

            // 加载下载统计（等卡片渲染完后再显示计数）
            setTimeout(loadDownloadStats, 500);

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
            }
            function closePanel() {
                panel.classList.remove('active');
                overlay.classList.remove('active');
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