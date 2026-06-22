<?php
/**
 * ============================================================================
 * NKTg AI - VIETQR PAYMENT CONFIG
 * ============================================================================
 * Điền ĐẦY ĐỦ các giá trị TODO bên dưới trước khi dùng.
 * File này KHÔNG được gọi trực tiếp từ trình duyệt — chỉ require từ các
 * file PHP khác trong cùng thư mục (create_order.php / check_order.php /
 * webhook_casso.php).
 *
 * KHUYẾN NGHỊ: đặt file này NGOÀI thư mục public (vd: một cấp trên
 * public_html) nếu hosting cho phép, để tránh ai đó truy cập trực tiếp
 * URL .../config.php. Nếu không thể, ít nhất chặn truy cập bằng .htaccess:
 *     <Files "config.php">
 *         Require all denied
 *     </Files>
 */

// --- Kết nối MySQL ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'TODO_ten_database');
define('DB_USER', 'TODO_user_mysql');
define('DB_PASS', 'TODO_mat_khau_mysql');

// --- Casso Webhook V2 ---
// Lấy tại: Casso Dashboard → Kết nối → Tích hợp → (tích hợp Webhook V2 của
// bạn, trỏ Webhook URL về https://nktg.org/api/webhook_casso.php) → Key bảo mật
define('CASSO_CHECKSUM_KEY', 'TODO_key_bao_mat_casso');

// --- Thông tin tài khoản ngân hàng nhận tiền (dùng để tạo ảnh VietQR) ---
// BIN ngân hàng theo chuẩn NAPAS/VietQR — 970436 = Vietcombank
define('BANK_BIN', '970436');
define('BANK_ACCOUNT_NO', '0451000210442');
define('BANK_ACCOUNT_NAME', 'NGUYEN KHANH TUNG');

// Template ID tạo riêng cho từng gói tại my.vietqr.io (logo/màu QR riêng biệt)
define('TEMPLATE_ID_PLUS', 'hoMn03R');
define('TEMPLATE_ID_PRO', 'XZwhOwC');

// --- Giá gói (VND) — khớp với PLUS_PRICE_LABEL / PRO_PRICE_LABEL trong settings.js ---
define('PRICE_PLUS', 50000);
define('PRICE_PRO', 125000);

// --- CORS: domain web của bạn (KHÔNG có dấu / ở cuối) ---
define('ALLOWED_ORIGIN', 'https://nktg.org');

function nktg_db() {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

function nktg_send_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function nktg_handle_preflight() {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        nktg_send_json(['ok' => true]);
    }
}
