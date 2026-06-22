<?php
/**
 * POST /api/webhook_casso.php
 * Casso gọi vào đây mỗi khi có giao dịch mới vào tài khoản ngân hàng đã
 * liên kết. Đăng ký URL này (đầy đủ, vd https://nktg.org/api/webhook_casso.php)
 * vào Casso Dashboard → Kết nối → Tích hợp → Webhook V2.
 *
 * Xác thực chữ ký theo đúng quy trình chính thức của Casso Webhook V2:
 * https://github.com/CassoHQ/casso-webhook-v2-verify-signature
 *   1. Header "X-Casso-Signature" dạng: t=<timestamp>,v1=<chữ ký hex>
 *   2. Sắp xếp key của object "data" theo thứ tự A→Z, encode lại thành JSON
 *   3. Chuỗi để ký = "<t>.<JSON đã sắp xếp>"
 *   4. Chữ ký = HMAC-SHA512(chuỗi để ký, Key bảo mật), dạng Hex
 *   5. So khớp với v1
 *
 * LƯU Ý: nếu chữ ký không khớp dù đã điền đúng CASSO_CHECKSUM_KEY, rất có
 * thể do cách encode JSON khác với phía Casso (escape unicode/slash...).
 * Hãy dùng nút "Gọi thử" trong Casso Dashboard để test, và tạm thời log
 * $computedSig / $v1 ra file để so sánh nếu cần điều chỉnh.
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
// Webhook được Casso gọi server-to-server, không phải từ trình duyệt — không cần CORS.

function nktg_verify_casso_signature($rawBody, $signatureHeader, $checksumKey) {
    if (!$signatureHeader) return false;

    // Header dạng: t=<timestamp>,v1=<signature>
    $t = null; $v1 = null;
    foreach (explode(',', $signatureHeader) as $part) {
        $kv = explode('=', trim($part), 2);
        if (count($kv) !== 2) continue;
        if ($kv[0] === 't')  $t  = $kv[1];
        if ($kv[0] === 'v1') $v1 = $kv[1];
    }
    if ($t === null || $v1 === null) return false;

    $payload = json_decode($rawBody, true);
    if (!isset($payload['data']) || !is_array($payload['data'])) return false;

    // Sắp xếp key của object "data" theo A→Z rồi encode lại thành JSON
    $data = $payload['data'];
    ksort($data);
    $jsonStr = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $signingString = $t . '.' . $jsonStr;
    $computedSig   = hash_hmac('sha512', $signingString, $checksumKey);

    return hash_equals($computedSig, (string)$v1);
}

$rawBody         = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_CASSO_SIGNATURE'] ?? '';

if (!nktg_verify_casso_signature($rawBody, $signatureHeader, CASSO_CHECKSUM_KEY)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid signature']);
    exit;
}

$payload = json_decode($rawBody, true);
$tx = $payload['data'] ?? null;

if (!$tx) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing data']);
    exit;
}

$txId        = (string)($tx['id'] ?? '');
$description = (string)($tx['description'] ?? '');
$amount      = (int)($tx['amount'] ?? 0);

// Dò mã đơn NKTGxxxxxx trong nội dung chuyển khoản — không phân biệt hoa/thường
// vì một số ngân hàng có thể viết thường hoá nội dung
$orderCode = null;
if (preg_match('/NKTG[A-Z0-9]{6}/i', $description, $m)) {
    $orderCode = strtoupper($m[0]);
}

if (!$orderCode) {
    // Giao dịch không liên quan tới NKTg AI — vẫn trả 200 để Casso không gọi lại
    http_response_code(200);
    echo json_encode(['success' => true, 'note' => 'No matching order code']);
    exit;
}

$db = nktg_db();

$check = $db->prepare('SELECT id, status, amount FROM nktg_orders WHERE order_code = ? LIMIT 1');
$check->execute([$orderCode]);
$order = $check->fetch();

if (!$order) {
    http_response_code(200);
    echo json_encode(['success' => true, 'note' => 'Order not found']);
    exit;
}

if ($order['status'] === 'paid') {
    // Chống xử lý trùng/replay — Casso có thể gọi lại nếu lần trước timeout
    http_response_code(200);
    echo json_encode(['success' => true, 'note' => 'Already paid']);
    exit;
}

if ($amount < (int)$order['amount']) {
    // Chuyển thiếu tiền — KHÔNG kích hoạt, để bạn tự kiểm tra & xử lý thủ công
    http_response_code(200);
    echo json_encode(['success' => true, 'note' => 'Amount mismatch — not activated']);
    exit;
}

// Sinh license key ngẫu nhiên gắn với đơn hàng này
$licenseKey = 'NKTG-' . strtoupper(bin2hex(random_bytes(2))) . '-' .
              strtoupper(bin2hex(random_bytes(2))) . '-' .
              strtoupper(bin2hex(random_bytes(2)));

$update = $db->prepare(
    'UPDATE nktg_orders SET status = "paid", license_key = ?, casso_tx_id = ?, paid_at = NOW() WHERE id = ?'
);
$update->execute([$licenseKey, $txId, $order['id']]);

http_response_code(200);
echo json_encode(['success' => true]);
