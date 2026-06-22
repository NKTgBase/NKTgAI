/**
 * NKTg AI SYSTEM - HISTORY MANAGER v4
 * - Menu 3 chấm với 4 chức năng như Gemini: Chia sẻ, Ghim, Đổi tên, Xoá
 * - URL chia sẻ: https://nktg.org
 */

const HISTORY_KEY = 'nktg_history';
const MAX_HISTORY = 21;
const AUTH_KEY    = 'nktg_auth_user';
const SHARE_BASE  = 'https://nktg.org';

let _activeId = null;
let _ctxMenu  = null; // menu DOM hiện đang mở

function t(key) {
    return window._nktgLanguage ? window._nktgLanguage.t(key) : key;
}

// Locale cho toLocaleDateString/toLocaleTimeString — bám theo ngôn ngữ giao diện
const LOCALE_MAP = { EN: 'en-US', VI: 'vi-VN', FR: 'fr-FR', DE: 'de-DE', ES: 'es-ES', ZH: 'zh-CN', JA: 'ja-JP', RU: 'ru-RU' };
function currentLocale() {
    const lang = window._nktgLanguage ? window._nktgLanguage.getLang() : 'EN';
    return LOCALE_MAP[lang] || 'en-US';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLoggedIn() {
    try { return !!JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return false; }
}

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function saveHistoryList(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function isCorrupt(r) {
    return !r || typeof r.inputText !== 'string' || typeof r.preview !== 'string'
        || r.preview === 'undefined' || r.preview === '';
}

function formatTime(iso) {
    const d = new Date(iso);
    const locale = currentLocale();
    return d.toLocaleDateString(locale, { day:'2-digit', month:'2-digit' }) + ' ' +
           d.toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' });
}

// ── Context menu helpers ──────────────────────────────────────────────────────

function closeCtxMenu() {
    if (_ctxMenu) {
        _ctxMenu.remove();
        _ctxMenu = null;
    }
    document.querySelectorAll('.history-item-wrap.menu-open')
        .forEach(el => el.classList.remove('menu-open'));
}

function svgIcon(path, size = 16) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const ICONS = {
    share:  svgIcon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'),
    pin:    svgIcon('<path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/>'),
    rename: svgIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
    trash:  svgIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
};

function openCtxMenu(wrap, rec, btnEl) {
    closeCtxMenu();
    wrap.classList.add('menu-open');

    const menu = document.createElement('div');
    menu.className = 'history-ctx-menu';
    _ctxMenu = menu;

    const isPinned = !!rec.pinned;

    const items = [
        {
            icon: ICONS.share,
            label: t('history.shareConversation'),
            action: () => doShare(rec),
        },
        {
            icon: ICONS.pin,
            label: isPinned ? t('history.unpin') : t('history.pin'),
            action: () => doPin(rec.id, !isPinned),
        },
        {
            icon: ICONS.rename,
            label: t('history.rename'),
            action: () => doRename(rec),
        },
        {
            icon: ICONS.trash,
            label: t('history.delete'),
            danger: true,
            action: () => doDelete(rec.id),
        },
    ];

    items.forEach(({ icon, label, action, danger }) => {
        const btn = document.createElement('button');
        btn.className = 'history-ctx-item' + (danger ? ' danger' : '');
        btn.innerHTML = icon + `<span>${label}</span>`;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCtxMenu();
            action();
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Định vị menu cạnh nút 3 chấm
    const rect = btnEl.getBoundingClientRect();
    let top  = rect.bottom + 4;
    let left = rect.left - menu.offsetWidth + rect.width;
    if (left < 8) left = 8;
    if (top + 180 > window.innerHeight) top = rect.top - 180;
    menu.style.top  = top  + 'px';
    menu.style.left = left + 'px';

    // Đóng khi click ngoài
    setTimeout(() => {
        document.addEventListener('click', closeCtxMenu, { once: true });
    }, 0);
}

// ── 4 chức năng ──────────────────────────────────────────────────────────────

function doShare(rec) {
    const shareUrl  = `${SHARE_BASE}/share/${rec.id}`;
    const shareText = encodeURIComponent(`${rec.preview} — NKTg AI for Organizers`);
    const encUrl    = encodeURIComponent(shareUrl);

    const socials = [
        {
            name: 'Facebook',
            url:  `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
            color: '#1877F2',
            svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.253h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>`,
        },
        {
            name: 'X',
            url:  `https://twitter.com/intent/tweet?url=${encUrl}&text=${shareText}`,
            color: '#000',
            svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>`,
        },
        {
            name: 'LinkedIn',
            url:  `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
            color: '#0A66C2',
            svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>`,
        },
        {
            name: 'Reddit',
            url:  `https://reddit.com/submit?url=${encUrl}&title=${shareText}`,
            color: '#FF4500',
            svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#FF4500">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
            </svg>`,
        },
    ];

    const box = document.createElement('div');
    box.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.42);z-index:10001;
        display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;`;

    const socialBtns = socials.map(s => `
        <button data-url="${s.url}" style="
            display:flex;flex-direction:column;align-items:center;gap:8px;
            background:none;border:none;cursor:pointer;padding:8px 12px;
            border-radius:10px;transition:background 0.15s;font-family:inherit;">
            <div style="width:48px;height:48px;border-radius:50%;background:#f3f4f6;
                display:flex;align-items:center;justify-content:center;">
                ${s.svg}
            </div>
            <span style="font-size:12px;color:#374151;">${s.name}</span>
        </button>
    `).join('');

    box.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px 24px;width:100%;max-width:420px;
            box-shadow:0 8px 40px rgba(0,0,0,0.18);font-family:inherit;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-size:17px;font-weight:700;">${t('history.shareConversation')}</div>
                <button id="_shareCloseX" style="background:none;border:none;font-size:20px;
                    cursor:pointer;color:#9ca3af;line-height:1;padding:4px;">✕</button>
            </div>
            <div style="font-size:13px;color:#6b7280;margin-bottom:20px;">
                ${t('history.shareLinkDesc')}
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:24px;">
                <input readonly value="${shareUrl}"
                    style="flex:1;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;
                    font-size:13px;color:#374151;background:#f9fafb;outline:none;">
                <button id="_shareCopyBtn"
                    style="padding:9px 16px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;
                    font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">
                    ${t('history.copy')}
                </button>
            </div>
            <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
                <div style="font-size:12px;color:#9ca3af;margin-bottom:14px;text-align:center;">
                    ${t('history.shareSocial')}
                </div>
                <div style="display:flex;justify-content:center;gap:8px;">
                    ${socialBtns}
                </div>
            </div>
        </div>`;

    document.body.appendChild(box);

    box.querySelector('#_shareCopyBtn').addEventListener('click', function() {
        navigator.clipboard.writeText(shareUrl).catch(() => {});
        this.textContent = t('history.copied');
        this.style.background = '#16a34a';
        setTimeout(() => { this.textContent = t('history.copy'); this.style.background = '#1a1a1a'; }, 2000);
    });

    box.querySelectorAll('[data-url]').forEach(btn => {
        btn.addEventListener('mouseenter', () => btn.style.background = '#f3f4f6');
        btn.addEventListener('mouseleave', () => btn.style.background = 'none');
        btn.addEventListener('click', () => window.open(btn.dataset.url, '_blank', 'noopener'));
    });

    box.querySelector('#_shareCloseX').addEventListener('click', () => box.remove());
    box.addEventListener('click', e => { if (e.target === box) box.remove(); });
}

function doPin(id, pin) {
    const list = loadHistory().map(r => r.id === id ? { ...r, pinned: pin } : r);
    // Ghim: đẩy lên đầu; bỏ ghim: giữ nguyên thứ tự timestamp
    if (pin) {
        const idx = list.findIndex(r => r.id === id);
        if (idx > 0) { const [item] = list.splice(idx, 1); list.unshift(item); }
    }
    saveHistoryList(list);
    renderHistoryList();
}

function doRename(rec) {
    const modal = document.getElementById('historyRenameModal');
    const input = document.getElementById('historyRenameInput');
    const saveBtn = document.getElementById('historyRenameSave');
    const cancelBtn = document.getElementById('historyRenameCancel');
    if (!modal || !input) return;

    input.value = rec.preview;
    modal.classList.add('open');
    input.focus();
    input.select();

    const save = () => {
        const newName = input.value.trim();
        if (newName) {
            const list = loadHistory().map(r =>
                r.id === rec.id ? { ...r, preview: newName } : r
            );
            saveHistoryList(list);
            renderHistoryList();
        }
        modal.classList.remove('open');
        cleanup();
    };

    const cancel = () => { modal.classList.remove('open'); cleanup(); };

    const onKey = (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); };

    saveBtn.addEventListener('click', save, { once: true });
    cancelBtn.addEventListener('click', cancel, { once: true });
    input.addEventListener('keydown', onKey);

    function cleanup() {
        input.removeEventListener('keydown', onKey);
    }
}

function doDelete(id) {
    if (!confirm(t('history.deleteConfirm'))) return;
    const list = loadHistory().filter(r => r.id !== id);
    saveHistoryList(list);
    if (_activeId === id) _activeId = null;
    renderHistoryList();
}

// ── Public: lưu 1 bản ghi ────────────────────────────────────────────────────

export function saveHistoryEntry(entry) {
    if (!isLoggedIn()) return;

    const inputText = String(entry.inputText || '').trim();
    if (!inputText) return;

    const record = {
        id:           Date.now(),
        timestamp:    new Date().toISOString(),
        mode:         entry.mode         || 'Extraction',
        state:        entry.state        || '',
        inputText:    inputText,
        outputHTML:   entry.outputHTML   || '',
        inputLength:  entry.inputLength  || 0,
        outputLength: entry.outputLength || 0,
        ratio:        entry.ratio        || '',
        preview:      inputText.replace(/\s+/g, ' ').slice(0, 60),
        pinned:       false,
    };

    const list = loadHistory().filter(r => !isCorrupt(r));
    // Ghim nằm đầu, không ghim nằm sau ghim
    const pinned   = list.filter(r => r.pinned);
    const unpinned = list.filter(r => !r.pinned);
    unpinned.unshift(record);
    if (unpinned.length + pinned.length > MAX_HISTORY) {
        unpinned.splice(MAX_HISTORY - pinned.length);
    }
    saveHistoryList([...pinned, ...unpinned]);

    renderHistoryList();
    return record.id;
}

// ── Render danh sách ──────────────────────────────────────────────────────────

export function renderHistoryList() {
    const containers = [
        document.getElementById('historyDropdown'),
        document.getElementById('mobileHistoryDropdown'),
    ].filter(Boolean);

    if (containers.length === 0) return;

    if (!isLoggedIn()) {
        containers.forEach(c => c.innerHTML = `<div class="history-empty">${t('history.loginToView')}</div>`);
        return;
    }

    const rawList = loadHistory();
    const list = rawList.filter(r => !isCorrupt(r));
    if (list.length !== rawList.length) saveHistoryList(list);

    if (list.length === 0) {
        containers.forEach(c => c.innerHTML = `<div class="history-empty">${t('history.empty')}</div>`);
        return;
    }

    containers.forEach(container => {
        container.innerHTML = '';

        list.forEach(rec => {
            const modeColor = rec.mode === 'Addition' ? '#16a34a' : '#d97706';
            const pinBadge  = rec.pinned
                ? `<span style="font-size:10px;color:#9ca3af;margin-left:4px;" title="${t('history.pinnedTooltip')}">📌</span>`
                : '';

            const wrap = document.createElement('div');
            wrap.className = 'history-item-wrap' + (rec.id === _activeId ? ' active' : '');
            wrap.dataset.id = rec.id;

            const btn = document.createElement('button');
            btn.className = 'history-item';
            btn.innerHTML = `
                <span class="history-item-preview">${rec.preview}${pinBadge}</span>
                <span class="history-item-meta" style="color:${modeColor}">${rec.mode} · ${formatTime(rec.timestamp)}</span>
            `;
            btn.addEventListener('click', () => loadHistoryEntry(rec));

            // Nút 3 chấm — đầy đủ 4 chức năng cả desktop lẫn mobile
            const moreBtn = document.createElement('button');
            moreBtn.className = 'history-item-more';
            moreBtn.title = t('history.optionsTooltip');
            moreBtn.innerHTML = '⋮';
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openCtxMenu(wrap, rec, moreBtn);
            });

            wrap.appendChild(btn);
            wrap.appendChild(moreBtn);
            container.appendChild(wrap);
        });

        // Nút xóa tất cả
        const clearRow = document.createElement('div');
        clearRow.className = 'history-clear-row';
        const clearBtn = document.createElement('button');
        clearBtn.textContent = t('history.clearAll');
        clearBtn.addEventListener('click', () => {
            if (confirm(t('history.clearAllConfirm'))) {
                localStorage.removeItem(HISTORY_KEY);
                _activeId = null;
                renderHistoryList();
            }
        });
        clearRow.appendChild(clearBtn);
        container.appendChild(clearRow);
    });
}

// ── Load bản ghi ──────────────────────────────────────────────────────────────

async function loadHistoryEntry(rec) {
    const panel = document.getElementById('outputPanel');
    if (!panel) return;

    const cached = window._nktgHistoryCache?.[rec.id];

    if (cached) {
        if (cached.cache)     panel.__nktgCache     = cached.cache;
        if (cached.writeBase) panel.__nktgWriteBase = cached.writeBase;
        try {
            if (cached.mode === 'Addition') {
                const output = cached.cache?.refined || cached.cache?.standard;
                if (output && window._nktgOutputWriteLayer) {
                    await window._nktgOutputWriteLayer.renderToUI(output);
                } else { panel.innerHTML = rec.outputHTML; }
            } else {
                const output = cached.cache?.standard;
                if (output && window._nktgOutputLayer) {
                    await window._nktgOutputLayer.renderToUI(output);
                } else { panel.innerHTML = rec.outputHTML; }
            }
        } catch { panel.innerHTML = rec.outputHTML; }
    } else {
        panel.innerHTML = rec.outputHTML;
    }

    const textarea = document.getElementById('queryInput');
    if (textarea) {
        textarea.value = rec.inputText;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    _activeId = rec.id;
    document.querySelectorAll('.history-item-wrap').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.id) === _activeId);
    });

    // Đóng mobile drawer trước khi scroll
    document.getElementById('mobileDrawer')?.classList.remove('open');
    document.getElementById('mobileOverlay')?.classList.remove('open');

    requestAnimationFrame(() => {
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// ── Toggle dropdown ───────────────────────────────────────────────────────────

function toggleHistoryDropdown() {
    const dropdown = document.getElementById('historyDropdown');
    const chevron  = document.getElementById('historyChevron');
    if (!dropdown) return;
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) {
        dropdown.style.display = 'none';
        if (chevron) chevron.textContent = '∧';
    } else {
        dropdown.style.display = 'flex';
        dropdown.style.flexDirection = 'column';
        if (chevron) chevron.textContent = '∨';
        renderHistoryList();
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function initHistory() {
    const raw = loadHistory();
    const clean = raw.filter(r => !isCorrupt(r));
    if (clean.length !== raw.length) saveHistoryList(clean);

    document.getElementById('historyToggleBtn')?.addEventListener('click', toggleHistoryDropdown);
    renderHistoryList();
}

export function activateHome() {
    const nav = document.getElementById('navDesktop');
    if (!nav) return;
    nav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('homeBtn')?.classList.add('active');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initHistory();
        window._nktgRenderHistory = renderHistoryList;
    });
} else {
    initHistory();
    window._nktgRenderHistory = renderHistoryList;
}

document.addEventListener('nktg:langchange', () => renderHistoryList());
