/**
 * ============================================================================
 * NKTg AI SYSTEM - PLAN MODULE
 * ============================================================================
 * Quản lý gói sử dụng + giới hạn nhập liệu/ngày:
 *   - Ẩn danh (chưa đăng nhập): 8 lần/ngày
 *   - Free (có tài khoản):      21 lần/ngày
 *   - NKTg AI Plus:             55 lần/ngày
 *   - NKTg AI Pro:              không giới hạn
 *
 * "1 lần nhập liệu" = 1 lượt gửi gốc (textarea/file) thành công, KHÔNG tính
 * các lượt bấm Condensed/Essence/Expanded/Comprehensive (chỉ biến hình lại
 * kết quả đã có, không phải nhập liệu mới).
 *
 * 100% local — đếm theo trình duyệt hiện tại, reset theo ngày giờ máy người dùng.
 * Dùng chung quy ước window.* với auth.js / settings.js / language.js.
 */

const USAGE_STORAGE_KEY   = 'nktg_usage';
const LICENSE_STORAGE_KEY = 'nktg_license';
const LICENSE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // gói theo tháng — 30 ngày/chu kỳ

const DAILY_LIMITS = {
    anonymous: 8,
    free: 21,
    plus: 55,
    pro: Infinity,
};

// ============================================================================
// ĐẾM LƯỢT DÙNG TRONG NGÀY
// ============================================================================

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadUsage() {
    try {
        const raw = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY));
        if (raw && raw.date === todayStr()) return raw;
    } catch { /* fallthrough */ }
    return { date: todayStr(), count: 0 };
}

function saveUsage(usage) {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
}

function getTodayCount() {
    return loadUsage().count;
}

function incrementUsage() {
    const usage = loadUsage();
    usage.count += 1;
    saveUsage(usage);
    return usage.count;
}

// ============================================================================
// LICENSE (Plus / Pro) — lưu kèm field `plan` để phân biệt 2 gói trả phí
// ============================================================================

function loadLicense() {
    try { return JSON.parse(localStorage.getItem(LICENSE_STORAGE_KEY)); } catch { return null; }
}

function saveLicense(data) {
    const payload = { ...data };
    // Tự tính ngày hết hạn (30 ngày kể từ lúc kích hoạt) nếu chưa có sẵn —
    // áp dụng chung cho cả license từ Lemon Squeezy lẫn VietQR, không cần
    // tính lặp lại ở từng nơi gọi.
    if (!payload.expiresAt && payload.activatedAt) {
        payload.expiresAt = payload.activatedAt + LICENSE_DURATION_MS;
    }
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(payload));
}

function isLicenseExpired(license) {
    const lic = license !== undefined ? license : loadLicense();
    return !!(lic?.expiresAt && Date.now() > lic.expiresAt);
}

function clearLicense() {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
}

// ============================================================================
// XÁC ĐỊNH GÓI HIỆN TẠI
// ============================================================================

function getCurrentTier() {
    const user = window._nktgAuth ? window._nktgAuth.loadUser() : null;
    if (!user) return 'anonymous';
    const license = loadLicense();
    if (license?.valid && !isLicenseExpired(license)) {
        if (license.plan === 'pro')  return 'pro';
        if (license.plan === 'plus') return 'plus';
    }
    return 'free';
}

function getDailyLimit() {
    return DAILY_LIMITS[getCurrentTier()];
}

function canSubmit() {
    const limit = getDailyLimit();
    if (limit === Infinity) return true;
    return getTodayCount() < limit;
}

window._nktgPlan = {
    DAILY_LIMITS,
    getCurrentTier,
    getDailyLimit,
    getTodayCount,
    canSubmit,
    incrementUsage,
    loadLicense,
    saveLicense,
    clearLicense,
    isLicenseExpired,
};
