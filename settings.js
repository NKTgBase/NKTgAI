/**
 * ============================================================================
 * NKTg AI SYSTEM - SETTINGS MODULE
 * ============================================================================
 * Bánh răng (gear icon) → mở modal Cài đặt kiểu sidebar (Account / Plan /
 * General / Language) — tham khảo bố cục Claude.ai Settings nhưng chỉ giữ
 * lại những gì khả thi với kiến trúc 100% client-side (không server) của
 * NKTg AI. Không có "Active sessions" / "Organization ID" vì cần backend.
 *
 * Dùng chung quy ước window.* với auth.js / history-manager.js để giao tiếp
 * giữa các module (không import ES module chéo giữa các file UI-layer này).
 */

// ============================================================================
// CẤU HÌNH THANH TOÁN — điền khi có thông tin thật, hiện đang để trống
// ============================================================================
// Lemon Squeezy — cần 2 SẢN PHẨM riêng (NKTg AI Plus / NKTg AI Pro):
//   1. Sau khi cửa hàng kích hoạt, lấy Checkout URL từng sản phẩm tại:
//      Dashboard → Store → chọn Product → nút Share/Copy checkout URL
//   2. Dán vào LEMONSQUEEZY_CHECKOUT_URL_PLUS / _PRO bên dưới
//   3. License API dùng để kích hoạt/kiểm tra license key — gọi thẳng từ
//      client, KHÔNG cần secret key:
//      https://docs.lemonsqueezy.com/api/license-api
//   4. Sau khi activate thành công, mình dò chữ "plus"/"pro" trong tên sản
//      phẩm (data.meta.product_name) trả về để biết user vừa mua gói nào —
//      ĐẶT TÊN SẢN PHẨM TRÊN LEMON SQUEEZY CÓ CHỨA CHỮ "Plus" / "Pro" NHÉ.
const LEMONSQUEEZY_CHECKOUT_URL_PLUS = ''; // vd: 'https://yourstore.lemonsqueezy.com/buy/xxxx-plus'
const LEMONSQUEEZY_CHECKOUT_URL_PRO  = ''; // vd: 'https://yourstore.lemonsqueezy.com/buy/xxxx-pro'
const LEMONSQUEEZY_LICENSE_API       = 'https://api.lemonsqueezy.com/v1/licenses';

// Giá hiển thị trong bảng — điền tay vì Lemon Squeezy hiển thị giá theo sản phẩm, không lấy tự động
const PLUS_PRICE_VND = '50.000 VND/tháng';
const PLUS_PRICE_USD = '$2 USD/month';
const PRO_PRICE_VND  = '125.000 VND/tháng';
const PRO_PRICE_USD  = '$5 USD/month';

function t(key, params) {
    return window._nktgLanguage ? window._nktgLanguage.t(key, params) : key;
}

let activeSettingsTab = 'account';

// ============================================================================
// MODAL OPEN / CLOSE / TAB SWITCH
// ============================================================================

function openSettingsModal(tab = 'account') {
    const modal = document.getElementById('nktgSettingsModal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchSettingsTab(tab);
}

function closeSettingsModal() {
    const modal = document.getElementById('nktgSettingsModal');
    if (modal) modal.style.display = 'none';
}

function switchSettingsTab(tab) {
    activeSettingsTab = tab;
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.settingsTab === tab);
    });
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `settingsPanel-${tab}`);
    });
    if (tab === 'account') renderAccountTab();
    if (tab === 'plan') renderPlanTab();
    if (tab === 'general') renderGeneralTab();
    if (tab === 'language' && window._nktgLanguage) window._nktgLanguage.renderLanguageTab();
}

// Khi đổi ngôn ngữ giao diện: vẽ lại tab đang mở (nếu modal đang hiện)
document.addEventListener('nktg:langchange', () => {
    const modal = document.getElementById('nktgSettingsModal');
    if (!modal || modal.style.display === 'none' || !modal.style.display) return;
    switchSettingsTab(activeSettingsTab);
});

// ============================================================================
// TAB: ACCOUNT
// ============================================================================

function renderAccountTab() {
    const container = document.getElementById('settingsAccountContent');
    const auth = window._nktgAuth;
    if (!container || !auth) return;

    const user = auth.loadUser();

    if (!user) {
        container.innerHTML = `
            <p style="color:#6b7280;font-size:var(--fs-body);margin-bottom:14px;">${t('account.notLoggedIn')}</p>
            <button class="auth-btn-primary" id="settingsGotoLogin" style="width:auto;padding:9px 20px;margin-top:0;">${t('account.login')}</button>
        `;
        document.getElementById('settingsGotoLogin')?.addEventListener('click', () => {
            closeSettingsModal();
            auth.openAuthModal();
        });
        return;
    }

    const isEmail = user.provider === 'email';

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
            ${auth.renderAvatarHTML(user, 40)}
            <div style="min-width:0;">
                <div style="font-weight:600;font-size:var(--fs-body);color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.name || ''}</div>
                <div style="font-size:var(--fs-small);color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.email || ''}</div>
            </div>
        </div>

        <button class="settings-row-btn" id="settingsLogoutBtn">${t('account.logout')}</button>

        ${isEmail ? `
        <button class="settings-row-btn" id="settingsChangePwdBtn">${t('account.changePwd')}</button>
        <div id="settingsChangePwdForm" style="display:none;margin:0 0 8px;padding:14px;background:#f9fafb;border-radius:8px;">
            <input class="auth-input" type="password" id="cpCurrent" placeholder="${t('account.currentPwdPlaceholder')}" autocomplete="current-password">
            <input class="auth-input" type="password" id="cpNew" placeholder="${t('account.newPwdPlaceholder')}" autocomplete="new-password">
            <input class="auth-input" type="password" id="cpConfirm" placeholder="${t('account.confirmNewPwdPlaceholder')}" autocomplete="new-password">
            <div id="cpMessage" style="display:none;font-size:var(--fs-small);margin-bottom:8px;"></div>
            <div style="display:flex;gap:8px;">
                <button class="auth-btn-primary" id="cpSaveBtn" style="margin-top:0;width:auto;padding:9px 18px;">${t('account.save')}</button>
                <button class="history-rename-cancel" id="cpCancelBtn" type="button">${t('account.cancel')}</button>
            </div>
        </div>` : ''}

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
            <button class="settings-row-btn danger" id="settingsDeleteBtn">${t('account.deleteAccount')}</button>
            <div id="settingsDeleteForm" style="display:none;margin-top:8px;padding:14px;background:#fef2f2;border-radius:8px;">
                <p style="font-size:var(--fs-small);color:#dc2626;margin:0 0 10px;">${t('account.deleteWarning')}</p>
                ${isEmail ? `<input class="auth-input" type="password" id="delPassword" placeholder="${t('account.deletePwdPlaceholder')}" autocomplete="current-password">` : ''}
                <div id="delMessage" style="display:none;font-size:var(--fs-small);color:#dc2626;margin-bottom:8px;"></div>
                <div style="display:flex;gap:8px;">
                    <button class="auth-btn-primary" id="delConfirmBtn" style="margin-top:0;width:auto;padding:9px 18px;background:#dc2626;">${t('account.deletePermanently')}</button>
                    <button class="history-rename-cancel" id="delCancelBtn" type="button">${t('account.cancel')}</button>
                </div>
            </div>
        </div>
    `;

    // Đăng xuất
    document.getElementById('settingsLogoutBtn')?.addEventListener('click', () => {
        if (confirm(t('account.logoutConfirm'))) {
            auth.handleLogout();
            renderAccountTab();
        }
    });

    // Đổi mật khẩu (chỉ tài khoản Email)
    if (isEmail) {
        const form = document.getElementById('settingsChangePwdForm');
        document.getElementById('settingsChangePwdBtn')?.addEventListener('click', () => {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('cpCancelBtn')?.addEventListener('click', () => { form.style.display = 'none'; });
        document.getElementById('cpSaveBtn')?.addEventListener('click', async () => {
            const cur = document.getElementById('cpCurrent').value;
            const nw  = document.getElementById('cpNew').value;
            const cf  = document.getElementById('cpConfirm').value;
            const msg = document.getElementById('cpMessage');
            msg.style.display = 'block';

            if (nw !== cf) {
                msg.textContent = t('account.pwdMismatch');
                msg.style.color = '#dc2626';
                return;
            }
            const result = await auth.changePassword(cur, nw);
            msg.textContent = t(result.key);
            msg.style.color = result.success ? '#16a34a' : '#dc2626';
            if (result.success) {
                ['cpCurrent', 'cpNew', 'cpConfirm'].forEach(id => { document.getElementById(id).value = ''; });
                setTimeout(() => { form.style.display = 'none'; msg.style.display = 'none'; }, 1500);
            }
        });
    }

    // Xóa tài khoản
    const delForm = document.getElementById('settingsDeleteForm');
    document.getElementById('settingsDeleteBtn')?.addEventListener('click', () => {
        if (!isEmail) {
            if (confirm(t('account.deleteConfirmGoogle'))) {
                auth.deleteAccountData();
                closeSettingsModal();
            }
            return;
        }
        delForm.style.display = delForm.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('delCancelBtn')?.addEventListener('click', () => { delForm.style.display = 'none'; });
    document.getElementById('delConfirmBtn')?.addEventListener('click', async () => {
        const msg = document.getElementById('delMessage');
        if (isEmail) {
            const pwd = document.getElementById('delPassword').value;
            const ok = await auth.verifyPassword(pwd);
            if (!ok) {
                msg.textContent = t('account.deleteWrongPwd');
                msg.style.display = 'block';
                return;
            }
        }
        auth.deleteAccountData();
        closeSettingsModal();
    });
}

// ============================================================================
// TAB: GENERAL (Profile — Avatar / Full name / "What should NKTg AI call you?")
// ============================================================================

// Crop vuông ở giữa + resize về avatarSize px — tránh localStorage phình to vì ảnh gốc lớn
function resizeAvatarFile(file, avatarSize = 200) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;
            const canvas = document.createElement('canvas');
            canvas.width = avatarSize;
            canvas.height = avatarSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, side, side, 0, 0, avatarSize, avatarSize);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Không đọc được ảnh.'));
        };
        img.src = url;
    });
}

function renderGeneralTab() {
    const container = document.getElementById('settingsGeneralContent');
    const auth = window._nktgAuth;
    if (!container || !auth) return;

    const user = auth.loadUser();

    if (!user) {
        container.innerHTML = `
            <p style="color:#6b7280;font-size:var(--fs-body);margin-bottom:14px;">${t('account.notLoggedIn')}</p>
            <button class="auth-btn-primary" id="settingsGeneralGotoLogin" style="width:auto;padding:9px 20px;margin-top:0;">${t('account.login')}</button>
        `;
        document.getElementById('settingsGeneralGotoLogin')?.addEventListener('click', () => {
            closeSettingsModal();
            auth.openAuthModal();
        });
        return;
    }

    const hasCustomAvatar = !!user.avatar;

    container.innerHTML = `
        <div class="settings-field-label" style="margin-bottom:14px;">${t('general.profile')}</div>

        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
            <div class="settings-avatar-wrap">
                <button class="settings-avatar-upload" id="settingsAvatarBtn" title="${t('general.avatarChange')}">
                    ${auth.renderAvatarHTML(user, 64)}
                </button>
                ${hasCustomAvatar ? `<button class="settings-avatar-remove" id="settingsAvatarRemove" title="${t('general.avatarRemove')}">✕</button>` : ''}
            </div>
            <input type="file" id="settingsAvatarInput" accept="image/png,image/jpeg,image/webp" style="display:none;">
        </div>

        <div style="margin-bottom:16px;">
            <label class="settings-field-label" style="display:block;margin-bottom:8px;font-size:var(--fs-body);">${t('general.fullName')}</label>
            <input class="auth-input" type="text" id="settingsFullName" value="${(user.name || '').replace(/"/g, '&quot;')}" style="margin-bottom:0;">
        </div>

        <div style="margin-bottom:8px;">
            <label class="settings-field-label" style="display:block;margin-bottom:8px;font-size:var(--fs-body);">${t('general.preferredName')}</label>
            <input class="auth-input" type="text" id="settingsPreferredName" placeholder="${t('general.preferredNamePlaceholder')}" value="${(auth.loadPreferredName() || '').replace(/"/g, '&quot;')}" style="margin-bottom:0;">
        </div>
        <div id="generalSavedNote" style="display:none;font-size:var(--fs-small);color:#16a34a;margin-top:6px;">${t('general.saved')}</div>
    `;

    const savedNote = document.getElementById('generalSavedNote');
    function flashSaved() {
        savedNote.style.display = 'block';
        clearTimeout(flashSaved._t);
        flashSaved._t = setTimeout(() => { savedNote.style.display = 'none'; }, 1500);
    }

    const fileInput = document.getElementById('settingsAvatarInput');
    document.getElementById('settingsAvatarBtn')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await resizeAvatarFile(file);
            auth.updateProfile({ avatar: dataUrl });
            renderGeneralTab();
        } catch {
            alert(t('general.avatarError'));
        }
    });

    document.getElementById('settingsAvatarRemove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        auth.updateProfile({ avatar: null });
        renderGeneralTab();
    });

    // Auto-save khi rời khỏi ô nhập (blur)
    document.getElementById('settingsFullName')?.addEventListener('blur', (e) => {
        const v = e.target.value.trim();
        if (v && v !== user.name) {
            auth.updateProfile({ name: v });
            flashSaved();
        }
    });
    document.getElementById('settingsPreferredName')?.addEventListener('blur', (e) => {
        auth.savePreferredName(e.target.value);
        flashSaved();
    });
}

// ============================================================================
// TAB: PLAN (Lemon Squeezy License API — không cần backend)
// ============================================================================

function renderPlanTab() {
    const container = document.getElementById('settingsPlanContent');
    const planApi = window._nktgPlan;
    if (!container || !planApi) return;

    const user = window._nktgAuth ? window._nktgAuth.loadUser() : null;

    // License chỉ có tác dụng khi đã đăng nhập — chưa đăng nhập thì mời đăng nhập trước,
    // giống cách Account/General tab xử lý
    if (!user) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px 10px;">
                <p style="color:#6b7280;font-size:var(--fs-body);margin-bottom:14px;">${t('account.notLoggedIn')}</p>
                <button class="auth-btn-primary" id="planLoginBtn" style="width:auto;padding:9px 24px;">${t('account.login')}</button>
            </div>
        `;
        document.getElementById('planLoginBtn')?.addEventListener('click', () => {
            closeSettingsModal();
            window._nktgAuth.openAuthModal?.();
        });
        return;
    }

    const tier  = planApi.getCurrentTier();
    const limit = planApi.getDailyLimit();
    const count = planApi.getTodayCount();
    const license = planApi.loadLicense();
    const checkoutReadyAny = !!(LEMONSQUEEZY_CHECKOUT_URL_PLUS || LEMONSQUEEZY_CHECKOUT_URL_PRO);

    const tiers = [
        { id: 'free', name: t('plan.free'), priceMain: '', priceAlt: '', desc: t('plan.dailyLimit', { limit: planApi.DAILY_LIMITS.free }) },
        { id: 'plus', name: 'NKTg AI Plus', priceMain: PLUS_PRICE_USD, priceAlt: PLUS_PRICE_VND, desc: t('plan.dailyLimit', { limit: planApi.DAILY_LIMITS.plus }), checkoutUrl: LEMONSQUEEZY_CHECKOUT_URL_PLUS },
        { id: 'pro',  name: 'NKTg AI Pro',  priceMain: PRO_PRICE_USD,  priceAlt: PRO_PRICE_VND,  desc: t('plan.unlimited'), checkoutUrl: LEMONSQUEEZY_CHECKOUT_URL_PRO },
    ];

    const cardsHTML = tiers.map(info => {
        const isCurrent = tier === info.id;
        const vietqrReady = (info.id === 'plus' || info.id === 'pro') && window._nktgVietQR?.isConfigured();

        let actionHTML;
        if (isCurrent) {
            actionHTML = `<span class="plan-card-badge">${t('plan.currentBadge')}</span>`;
            if ((info.id === 'plus' || info.id === 'pro') && license?.expiresAt) {
                const expiryDate = new Date(license.expiresAt).toLocaleDateString(
                    window._nktgLanguage?.getLang() === 'VI' ? 'vi-VN' : 'en-US'
                );
                actionHTML += `<div style="font-size:11px;color:#9ca3af;margin-top:5px;white-space:nowrap;">${t('plan.expiresOn', { date: expiryDate })}</div>`;
            }
        } else {
            const buttons = [];
            if (vietqrReady) {
                buttons.push(`<button class="plan-card-badge" data-vietqr-plan="${info.id}" style="border:none;cursor:pointer;">${t('vietqr.buyButton')}</button>`);
            }
            if (info.checkoutUrl) {
                buttons.push(`<a href="${info.checkoutUrl}" target="_blank" rel="noopener" class="plan-card-badge" style="text-decoration:none;cursor:pointer;">${t('plan.upgradeNow')}</a>`);
            }
            actionHTML = buttons.length
                ? buttons.map((b, i) => `<div${i > 0 ? ' style="margin-top:6px;"' : ''}>${b}</div>`).join('')
                : `<span style="font-size:var(--fs-small);color:#9ca3af;">${t('plan.comingSoon')}</span>`;
        }
        const priceHTML = info.priceMain
            ? `<div class="plan-card-price">
                   <div class="plan-card-price-main">${info.priceMain}</div>
                   ${info.priceAlt ? `<div class="plan-card-price-alt">≈ ${info.priceAlt}</div>` : ''}
               </div>`
            : '';
        return `
            <div class="plan-card${isCurrent ? ' current' : ''}">
                <div>
                    <div class="plan-card-name">${info.name}</div>
                    <div class="plan-card-desc">${info.desc}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    ${priceHTML}
                    <div style="margin-top:6px;">${actionHTML}</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="font-size:var(--fs-small);color:#6b7280;margin-bottom:16px;">
            ${t('plan.usageToday', { count, limit: limit === Infinity ? '∞' : limit })}
        </div>

        ${cardsHTML}

        <div style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;">
            <label style="display:block;font-weight:600;font-size:var(--fs-body);margin-bottom:8px;">${t('plan.licenseKey')}</label>
            <input class="auth-input" type="text" id="licenseKeyInput"
                placeholder="${checkoutReadyAny ? t('plan.licensePlaceholder') : t('plan.licenseDisabled')}"
                value="${license?.key || ''}" ${checkoutReadyAny ? '' : 'disabled'}>
            <div id="licenseMessage" style="display:none;font-size:var(--fs-small);margin-bottom:8px;"></div>
            <button class="auth-btn-primary" id="licenseActivateBtn" style="width:auto;padding:9px 20px;margin-top:4px;" ${checkoutReadyAny ? '' : 'disabled'}>${t('plan.activate')}</button>
        </div>

        <div style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;">
            <label style="display:block;font-weight:600;font-size:var(--fs-body);margin-bottom:6px;">${t('manual.title')}</label>
            <div style="font-size:var(--fs-small);color:#6b7280;margin-bottom:12px;">${t('manual.desc')}</div>
            <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
                <img src="https://api.vietqr.io/image/970436-0451000210442-hoMn03R.jpg?accountName=NGUYEN%20KHANH%20TUNG" alt="Vietcombank QR" style="width:130px;border-radius:8px;border:1px solid #e5e7eb;flex-shrink:0;">
                <div style="font-size:var(--fs-small);line-height:1.8;min-width:200px;">
                    <div><strong>${t('manual.accountName')}:</strong> NGUYEN KHANH TUNG</div>
                    <div><strong>${t('manual.accountNo')}:</strong> 0451000210442</div>
                    <div><strong>${t('manual.bank')}:</strong> Vietcombank</div>
                    <div style="margin-top:8px;">${t('manual.instructions')}</div>
                    <div style="margin-top:2px;"><a href="mailto:nktg.org@gmail.com" style="color:var(--accent-color);font-weight:600;text-decoration:none;">nktg.org@gmail.com</a></div>
                    <div style="margin-top:8px;font-style:italic;color:#9ca3af;">${t('manual.note')}</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('licenseActivateBtn')?.addEventListener('click', activateLicense);
    document.querySelectorAll('[data-vietqr-plan]').forEach(btn => {
        btn.addEventListener('click', () => window._nktgVietQR?.startPurchase(btn.dataset.vietqrPlan));
    });
}

async function activateLicense() {
    const input = document.getElementById('licenseKeyInput');
    const msg = document.getElementById('licenseMessage');
    const key = input.value.trim();
    if (!key) return;

    msg.style.display = 'block';
    msg.style.color = '#6b7280';
    msg.textContent = t('plan.activating');

    try {
        const instanceName = `nktg-web-${Date.now()}`;
        const res = await fetch(`${LEMONSQUEEZY_LICENSE_API}/activate`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: new URLSearchParams({ license_key: key, instance_name: instanceName }),
        });
        const data = await res.json();

        if (data.activated) {
            // Dò tên sản phẩm trả về để biết vừa kích hoạt Plus hay Pro
            const productName = (data.meta?.product_name || '').toLowerCase();
            const plan = productName.includes('pro') ? 'pro' : 'plus';

            window._nktgPlan.saveLicense({
                key,
                valid: true,
                plan,
                instanceId: data.instance?.id || null,
                activatedAt: Date.now(),
            });
            msg.style.color = '#16a34a';
            msg.textContent = t('plan.activateSuccess');
            renderPlanTab();
        } else {
            msg.style.color = '#dc2626';
            msg.textContent = data.error || t('plan.activateInvalid');
        }
    } catch (err) {
        msg.style.color = '#dc2626';
        msg.textContent = t('plan.activateError');
    }
}

// ============================================================================
// INIT
// ============================================================================

function initSettings() {
    document.getElementById('settingsModalClose')?.addEventListener('click', closeSettingsModal);

    document.getElementById('nktgSettingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'nktgSettingsModal') closeSettingsModal();
    });

    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
    });

    // Cả bánh răng desktop (#navGearBtn) lẫn mobile (cùng class .nav-gear-btn)
    document.querySelectorAll('.nav-gear-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Đóng drawer mobile nếu đang mở, tránh chồng lớp
            document.getElementById('mobileDrawer')?.classList.remove('open');
            document.getElementById('mobileOverlay')?.classList.remove('open');
            openSettingsModal('account');
        });
    });

    document.getElementById('planUpgradeBtn')?.addEventListener('click', () => {
        document.getElementById('mobileDrawer')?.classList.remove('open');
        document.getElementById('mobileOverlay')?.classList.remove('open');
        openSettingsModal('plan');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSettingsModal();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettings);
} else {
    initSettings();
}

window._nktgSettings = { renderPlanTab, openSettingsModal };
