<?php
/**
 * POST /api/create_order.php
 * Body: { "plan": "plus" | "pro" }
 * Trả về thông tin cần thiết để client tự dựng ảnh VietQR (img.vietqr.io).
 */

require_once __DIR__ . '/config.php';
nktg_handle_preflight();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    nktg_send_json(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$plan  = $input['plan'] ?? '';

if (!in_array($plan, ['plus', 'pro'], true)) {
    nktg_send_json(['error' => 'Invalid plan'], 400);
}

$amount = $plan === 'pro' ? PRICE_PRO : PRICE_PLUS;

// Mã đơn: NKTG + 6 ký tự hex viết hoa — ngắn, không dấu, sống sót qua nội
// dung chuyển khoản ngân hàng (banks thường lọc bỏ dấu/ký tự đặc biệt)
$orderCode = 'NKTG' . strtoupper(bin2hex(random_bytes(3)));

$db = nktg_db();
$stmt = $db->prepare(
    'INSERT INTO nktg_orders (order_code, plan, amount, status) VALUES (?, ?, ?, "pending")'
);
$stmt->execute([$orderCode, $plan, $amount]);

nktg_send_json([
    'orderCode'   => $orderCode,
    'amount'      => $amount,
    'bankBin'     => BANK_BIN,
    'accountNo'   => BANK_ACCOUNT_NO,
    'accountName' => BANK_ACCOUNT_NAME,
    'templateId'  => $plan === 'pro' ? TEMPLATE_ID_PRO : TEMPLATE_ID_PLUS,
]);
