/**
 * ============================================================================
 * NKTg AI SYSTEM - VIETQR PAYMENT MODULE
 * ============================================================================
 * Luồng mua gói Plus/Pro qua VietQR (Casso/payOS) — tự động kích hoạt:
 *   1. Client gọi create_order.php → server tạo đơn (pending), trả về mã đơn
 *   2. Client tạo ảnh QR (api.vietqr.io, theo Template ID riêng Plus/Pro) chứa
 *      số tiền + nội dung = mã đơn
 *   3. Client poll check_order.php mỗi 3s
 *   4. Casso phát hiện giao dịch khớp nội dung → gọi webhook_casso.php trên
 *      server → server đánh dấu đơn đã thanh toán + sinh license key
 *   5. Lần poll kế tiếp thấy status='paid' → client tự lưu license, không
 *      cần người dùng nhập gì thêm
 *
 * CẤU HÌNH BẮT BUỘC trước khi dùng: điền VIETQR_API_BASE bên dưới trỏ tới
 * thư mục chứa các file PHP (create_order.php / check_order.php) trên
 * hosting riêng của bạn (vd: 'https://nktg.org/api').
 */

// ============================================================================
// CẤU HÌNH — điền đường dẫn thật tới thư mục API PHP trên hosting của bạn
// ============================================================================
const VIETQR_API_BASE = ''; // vd: 'https://nktg.org/api' — để trống = tính năng tắt

const POLL_INTERVAL_MS = 3000;
const PENDING_ORDER_KEY = 'nktg_vietqr_pending_order';

let pollTimer = null;

function t(key, params) {
    return window._nktgLanguage ? window._nktgLanguage.t(key, params) : key;
}

function formatVND(amount) {
    return amount.toLocaleString('vi-VN') + ' VND';
}

function buildQRImageUrl(order) {
    // Đúng định dạng Quick Link từ my.vietqr.io (Template ID riêng cho từng gói,
    // tạo logo/màu QR riêng biệt cho Plus và Pro). Dùng encodeURIComponent
    // (mã hoá khoảng trắng thành %20) để khớp y hệt định dạng Quick Link gốc
    // của VietQR.io — URLSearchParams sẽ mã hoá thành "+" thay vì "%20".
    const qs = [
        `accountName=${encodeURIComponent(order.accountName)}`,
        `amount=${encodeURIComponent(order.amount)}`,
        `addInfo=${encodeURIComponent(order.orderCode)}`,
    ].join('&');
    return `https://api.vietqr.io/image/${order.bankBin}-${order.accountNo}-${order.templateId}.jpg?${qs}`;
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function showModal() {
    const modal = document.getElementById('nktgVietQRModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('nktgVietQRModal');
    if (modal) modal.style.display = 'none';
    stopPolling();
}

function setStatus(text, cls) {
    const el = document.getElementById('vietqrStatus');
    if (!el) return;
    el.className = 'vietqr-status' + (cls ? ' ' + cls : '');
    if (cls === 'success' || cls === 'error') {
        el.innerHTML = `<span>${text}</span>`;
    } else {
        el.innerHTML = `<span class="vietqr-spinner"></span><span>${text}</span>`;
    }
}

function renderOrder(order) {
    document.getElementById('vietqrLoading').style.display = 'none';
    document.getElementById('vietqrContent').style.display = 'block';
    document.getElementById('vietqrImage').src = buildQRImageUrl(order);
    document.getElementById('vietqrAmount').textContent = formatVND(order.amount);
    document.getElementById('vietqrCode').textContent = order.orderCode;
    setStatus(t('vietqr.waiting'));
}

async function pollOrderStatus(orderCode, plan) {
    try {
        const res = await fetch(`${VIETQR_API_BASE}/check_order.php?code=${encodeURIComponent(orderCode)}`);
        const data = await res.json();

        if (data.status === 'paid') {
            stopPolling();
            localStorage.removeItem(PENDING_ORDER_KEY);

            window._nktgPlan?.saveLicense({
                key: data.licenseKey,
                valid: true,
                plan: data.plan || plan,
                activatedAt: Date.now(),
            });

            setStatus(t('vietqr.success'), 'success');

            setTimeout(() => {
                closeModal();
                if (window._nktgSettings?.renderPlanTab) window._nktgSettings.renderPlanTab();
            }, 1800);
        }
        // status === 'pending' → tiếp tục chờ, không cần làm gì thêm
    } catch (err) {
        // Lỗi mạng tạm thời — không dừng polling, thử lại ở lần kế tiếp
    }
}

async function startPurchase(plan) {
    if (!VIETQR_API_BASE) {
        console.warn('[VietQR] VIETQR_API_BASE chưa được cấu hình.');
        return;
    }

    document.getElementById('vietqrLoading').style.display = 'block';
    document.getElementById('vietqrContent').style.display = 'none';
    showModal();

    try {
        const res = await fetch(`${VIETQR_API_BASE}/create_order.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan }),
        });
        const order = await res.json();

        if (order.error) {
            setStatus(order.error, 'error');
            return;
        }

        localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderCode: order.orderCode, plan }));
        renderOrder(order);

        stopPolling();
        pollTimer = setInterval(() => pollOrderStatus(order.orderCode, plan), POLL_INTERVAL_MS);

    } catch (err) {
        document.getElementById('vietqrLoading').style.display = 'none';
        document.getElementById('vietqrContent').style.display = 'block';
        setStatus(t('vietqr.error'), 'error');
    }
}

// Nếu trang được mở lại trong lúc còn 1 đơn đang chờ thanh toán (vd: đóng modal
// rồi mở lại Settings), tự động nối lại polling cho đơn đó.
function resumePendingOrder() {
    if (!VIETQR_API_BASE) return;
    try {
        const pending = JSON.parse(localStorage.getItem(PENDING_ORDER_KEY));
        if (pending?.orderCode) {
            stopPolling();
            pollTimer = setInterval(() => pollOrderStatus(pending.orderCode, pending.plan), POLL_INTERVAL_MS);
        }
    } catch { /* không có đơn đang chờ */ }
}

function initVietQR() {
    document.getElementById('vietqrModalClose')?.addEventListener('click', closeModal);
    document.getElementById('nktgVietQRModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'nktgVietQRModal') closeModal();
    });
    resumePendingOrder();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVietQR);
} else {
    initVietQR();
}

window._nktgVietQR = { startPurchase, isConfigured: () => !!VIETQR_API_BASE };
