/**
 * ============================================================================
 * NKTg AI SYSTEM - AUTH MODULE
 * ============================================================================
 * Google OAuth (GSI) + Email/Password (localStorage)
 * Domains: dangnhamdl.github.io / nktg.org
 *
 * ĐỂ KÍCH HOẠT GOOGLE LOGIN:
 *   1. Vào https://console.cloud.google.com → APIs & Services → Credentials
 *   2. Tạo OAuth 2.0 Client ID (Web application)
 *   3. Authorized JavaScript origins: thêm cả 2 dòng:
 *        https://dangnhamdl.github.io
 *        https://nktg.org
 *   4. Thay 587038944456-rb8sgdqjf2l5h1sh9c9viqqnvab01sao.apps.googleusercontent.com bên dưới bằng Client ID vừa tạo
 */

const GOOGLE_CLIENT_ID = '587038944456-rb8sgdqjf2l5h1sh9c9viqqnvab01sao.apps.googleusercontent.com';

const AUTH_KEY     = 'nktg_auth_user';
const ACCOUNTS_KEY = 'nktg_accounts';
const HISTORY_KEY  = 'nktg_history'; // dùng khi xóa tài khoản — phải khớp HISTORY_KEY trong history-manager.js

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function saveUser(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function loadUser() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}

function clearUser() {
    localStorage.removeItem(AUTH_KEY);
}

function loadAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || {}; } catch { return {}; }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ============================================================================
// PASSWORD HASH (SHA-256 via SubtleCrypto — không lưu plain text)
// ============================================================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// AVATAR — chữ cái đầu của tên, hoặc ảnh nếu user.avatar (tự upload) / user.picture (Google) có sẵn
// ============================================================================

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

// sizePx: dùng cho cả nav-avatar nhỏ (28px) lẫn avatar lớn trong General tab
function renderAvatarHTML(user, sizePx) {
    const img = user.avatar || user.picture;
    const sizeStyle = sizePx ? `width:${sizePx}px;height:${sizePx}px;` : '';
    if (img) {
        return `<img src="${img}" class="nav-avatar" style="${sizeStyle}object-fit:cover;" alt="">`;
    }
    return `<span class="nav-avatar" style="${sizeStyle}">${getInitials(user.name)}</span>`;
}

// ============================================================================
// UI — CẬP NHẬT SIDEBAR SAU KHI LOGIN/LOGOUT
// ============================================================================

function updateNavUI(user) {
    // Cập nhật tất cả nav: desktop, mobile cũ, và mobile drawer mới
    ['navDesktop', 'navMobile', 'mobileDrawer'].forEach(navId => {
        const nav = document.getElementById(navId);
        if (!nav) return;
        const authBtn = nav.querySelector('[data-auth-btn]');
        if (!authBtn) return;

        if (user) {
            authBtn.innerHTML = `
                ${renderAvatarHTML(user)}
                <span class="nav-user-name">${user.name}</span>
            `;
            authBtn.title = 'Click để đăng xuất';
            authBtn.dataset.loggedIn = '1';
        } else {
            const signupLabel = window._nktgLanguage ? window._nktgLanguage.t('nav.signup') : 'Sign Up / Log in';
            authBtn.innerHTML = `
                <span class="nav-icon">▤</span>
                <span>${signupLabel}</span>
            `;
            authBtn.title = '';
            authBtn.dataset.loggedIn = '0';
        }
    });
}

// ============================================================================
// MODAL
// ============================================================================

function openAuthModal() {
    const modal = document.getElementById('nktgAuthModal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset về tab email mặc định
        switchAuthTab('email');
        clearAuthMessages();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('nktgAuthModal');
    if (modal) modal.style.display = 'none';
}

function switchAuthTab(tab) {
    const tabGoogle = document.getElementById('authTabGoogle');
    const tabEmail  = document.getElementById('authTabEmail');
    const panelGoogle = document.getElementById('authPanelGoogle');
    const panelEmail  = document.getElementById('authPanelEmail');
    if (!tabGoogle || !tabEmail) return;

    if (tab === 'google') {
        tabGoogle.classList.add('auth-tab-active');
        tabEmail.classList.remove('auth-tab-active');
        panelGoogle.style.display = 'block';
        panelEmail.style.display  = 'none';
    } else {
        tabEmail.classList.add('auth-tab-active');
        tabGoogle.classList.remove('auth-tab-active');
        panelEmail.style.display  = 'block';
        panelGoogle.style.display = 'none';
    }
    clearAuthMessages();
}

function switchEmailMode(mode) {
    // mode: 'login' | 'register'
    const loginPanel    = document.getElementById('emailLoginPanel');
    const registerPanel = document.getElementById('emailRegisterPanel');
    const toRegisterBtn = document.getElementById('toRegisterBtn');
    const toLoginBtn    = document.getElementById('toLoginBtn');
    if (!loginPanel || !registerPanel) return;

    if (mode === 'register') {
        loginPanel.style.display    = 'none';
        registerPanel.style.display = 'block';
        if (toRegisterBtn) toRegisterBtn.style.display = 'none';
        if (toLoginBtn)    toLoginBtn.style.display    = 'inline';
    } else {
        loginPanel.style.display    = 'block';
        registerPanel.style.display = 'none';
        if (toRegisterBtn) toRegisterBtn.style.display = 'inline';
        if (toLoginBtn)    toLoginBtn.style.display    = 'none';
    }
    clearAuthMessages();
}

function showAuthMessage(msg, type = 'error') {
    const el = document.getElementById('authMessage');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? '#dc2626' : '#16a34a';
    el.style.display = 'block';
}

function clearAuthMessages() {
    const el = document.getElementById('authMessage');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ============================================================================
// EMAIL / PASSWORD AUTH
// ============================================================================

async function handleEmailLogin() {
    const email    = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) { showAuthMessage('Vui lòng nhập đầy đủ thông tin.'); return; }

    const accounts = loadAccounts();
    const account  = accounts[email.toLowerCase()];
    if (!account) { showAuthMessage('Email chưa được đăng ký.'); return; }

    const hashed = await hashPassword(password);
    if (account.password !== hashed) { showAuthMessage('Mật khẩu không đúng.'); return; }

    const user = { name: account.name, email: account.email, provider: 'email' };
    saveUser(user);
    updateNavUI(user);
    closeAuthModal();
    showAuthMessage('Đăng nhập thành công!', 'success');
    if (typeof window._nktgRenderHistory === 'function') window._nktgRenderHistory();
}

async function handleEmailRegister() {
    const name     = document.getElementById('registerName')?.value.trim();
    const email    = document.getElementById('registerEmail')?.value.trim();
    const password = document.getElementById('registerPassword')?.value;
    const confirm  = document.getElementById('registerConfirm')?.value;

    if (!name || !email || !password || !confirm) { showAuthMessage('Vui lòng nhập đầy đủ thông tin.'); return; }
    if (password !== confirm) { showAuthMessage('Mật khẩu xác nhận không khớp.'); return; }
    if (password.length < 6)  { showAuthMessage('Mật khẩu tối thiểu 6 ký tự.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuthMessage('Email không hợp lệ.'); return; }

    const accounts = loadAccounts();
    if (accounts[email.toLowerCase()]) { showAuthMessage('Email này đã được đăng ký.'); return; }

    const hashed = await hashPassword(password);
    accounts[email.toLowerCase()] = { name, email: email.toLowerCase(), password: hashed };
    saveAccounts(accounts);

    const user = { name, email: email.toLowerCase(), provider: 'email' };
    saveUser(user);
    updateNavUI(user);
    closeAuthModal();
    if (typeof window._nktgRenderHistory === 'function') window._nktgRenderHistory();
}

// ============================================================================
// GOOGLE OAUTH (GSI — Google Identity Services)
// ============================================================================

function initGoogleAuth() {
    if (!GOOGLE_CLIENT_ID) return; // chưa cấu hình

    // Expose callback ra global scope — bắt buộc vì GSI gọi từ ngoài module
    window._nktgGoogleCallback = handleGoogleCredential;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        if (!window.google) return;
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window._nktgGoogleCallback,
        });
        // Render nút Google trong panel
        const container = document.getElementById('googleSignInBtn');
        if (container) {
            window.google.accounts.id.renderButton(container, {
                theme: 'outline',
                size: 'large',
                width: 300,
                text: 'continue_with',
            });
        }
    };
    document.head.appendChild(script);
}

function handleGoogleCredential(response) {
    // Decode JWT payload — Google dùng base64url (có - và _), cần chuyển về base64 thường
    const base64url = response.credential.split('.')[1];
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    const user = {
        name:     payload.name,
        email:    payload.email,
        picture:  payload.picture,
        provider: 'google',
    };
    saveUser(user);
    updateNavUI(user);
    closeAuthModal();
    if (typeof window._nktgRenderHistory === 'function') window._nktgRenderHistory();
}

// ============================================================================
// LOGOUT
// ============================================================================

function handleLogout() {
    clearUser();
    updateNavUI(null);
    if (typeof window._nktgRenderHistory === 'function') window._nktgRenderHistory();
    // Google sign out nếu đang dùng Google
    if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
    }
}

// ============================================================================
// ĐỔI MẬT KHẨU / XÓA TÀI KHOẢN (chỉ trên thiết bị hiện tại — kiến trúc local-only)
// ============================================================================

async function verifyPassword(plainPassword) {
    const user = loadUser();
    if (!user || user.provider !== 'email') return false;
    const accounts = loadAccounts();
    const account = accounts[user.email.toLowerCase()];
    if (!account) return false;
    const hashed = await hashPassword(plainPassword);
    return account.password === hashed;
}

async function changePassword(currentPassword, newPassword) {
    const user = loadUser();
    if (!user || user.provider !== 'email') {
        return { success: false, key: 'changePwd.onlyEmail' };
    }
    if (!(await verifyPassword(currentPassword))) {
        return { success: false, key: 'changePwd.wrongCurrent' };
    }
    if (!newPassword || newPassword.length < 6) {
        return { success: false, key: 'changePwd.tooShort' };
    }
    const accounts = loadAccounts();
    const key = user.email.toLowerCase();
    accounts[key].password = await hashPassword(newPassword);
    saveAccounts(accounts);
    return { success: true, key: 'changePwd.success' };
}

// Xóa tài khoản + lịch sử trên trình duyệt hiện tại.
// LƯU Ý: vì NKTg AI không có server/database trung tâm (chạy 100% client-side),
// việc xóa này CHỈ tác động lên trình duyệt đang dùng — tài khoản cùng email
// đăng nhập trên thiết bị khác sẽ không bị ảnh hưởng.
function deleteAccountData() {
    const user = loadUser();
    if (!user) return false;

    if (user.provider === 'email') {
        const accounts = loadAccounts();
        delete accounts[user.email.toLowerCase()];
        saveAccounts(accounts);
    }

    localStorage.removeItem(HISTORY_KEY);
    clearUser();
    updateNavUI(null);

    if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
    }
    if (typeof window._nktgRenderHistory === 'function') window._nktgRenderHistory();
    return true;
}

// ============================================================================
// PROFILE — Avatar / Full name / "What should NKTg AI call you?" (General tab)
// ============================================================================

const PREFERRED_NAME_KEY = 'nktg_preferred_name';

function loadPreferredName() {
    return localStorage.getItem(PREFERRED_NAME_KEY) || '';
}

function savePreferredName(value) {
    localStorage.setItem(PREFERRED_NAME_KEY, (value || '').trim());
}

// patch: { name?, avatar? } — avatar: data URL string để đặt, hoặc null để xóa (về lại initials/Google picture)
function updateProfile(patch) {
    const user = loadUser();
    if (!user) return false;

    if (typeof patch.name === 'string' && patch.name.trim()) {
        user.name = patch.name.trim();
        // Đồng bộ luôn vào accounts store nếu là tài khoản Email, để lần đăng nhập sau vẫn giữ tên mới
        if (user.provider === 'email') {
            const accounts = loadAccounts();
            const key = user.email.toLowerCase();
            if (accounts[key]) {
                accounts[key].name = user.name;
                saveAccounts(accounts);
            }
        }
    }

    if ('avatar' in patch) {
        if (patch.avatar) user.avatar = patch.avatar;
        else delete user.avatar; // null/undefined → xóa avatar tự upload, fallback initials/Google picture
    }

    saveUser(user);
    updateNavUI(user);
    return true;
}

// ============================================================================
// KHỞI ĐỘNG
// ============================================================================

function initAuth() {
    // Khôi phục session nếu đã login
    const user = loadUser();
    if (user) updateNavUI(user);

    // Gắn sự kiện cho nút auth trong tất cả nav: desktop, mobile cũ, và mobile drawer
    ['navDesktop', 'navMobile', 'mobileDrawer'].forEach(navId => {
        const nav = document.getElementById(navId);
        if (!nav) return;
        const authBtn = nav.querySelector('[data-auth-btn]');
        if (!authBtn) return;
        authBtn.addEventListener('click', () => {
            if (authBtn.dataset.loggedIn === '1') {
                if (confirm('Bạn muốn đăng xuất?')) handleLogout();
            } else {
                openAuthModal();
            }
        });
    });

    // Modal close khi click nền
    const modal = document.getElementById('nktgAuthModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAuthModal();
        });
    }

    // Tab buttons
    document.getElementById('authTabGoogle')?.addEventListener('click', () => switchAuthTab('google'));
    document.getElementById('authTabEmail')?.addEventListener('click',  () => switchAuthTab('email'));

    // Close button
    document.getElementById('authModalClose')?.addEventListener('click', closeAuthModal);

    // Email mode toggle
    document.getElementById('toRegisterBtn')?.addEventListener('click', () => switchEmailMode('register'));
    document.getElementById('toLoginBtn')?.addEventListener('click',    () => switchEmailMode('login'));

    // Submit buttons
    document.getElementById('emailLoginBtn')?.addEventListener('click',    handleEmailLogin);
    document.getElementById('emailRegisterBtn')?.addEventListener('click', handleEmailRegister);

    // Enter key trên input
    ['loginEmail','loginPassword','registerName','registerEmail','registerPassword','registerConfirm'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const isRegister = document.getElementById('emailRegisterPanel')?.style.display !== 'none';
            isRegister ? handleEmailRegister() : handleEmailLogin();
        });
    });

    // Google OAuth
    initGoogleAuth();
}

// Chờ DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

// ============================================================================
// EXPORT — dùng bởi settings.js (cùng quy ước window.* như _nktgRenderHistory)
// ============================================================================
window._nktgAuth = {
    loadUser,
    handleLogout,
    changePassword,
    verifyPassword,
    deleteAccountData,
    openAuthModal,
    updateProfile,
    renderAvatarHTML,
    loadPreferredName,
    savePreferredName,
};
