<?php
/**
 * GET /api/check_order.php?code=NKTGxxxxxx
 * Client gọi định kỳ (polling) để biết đơn đã thanh toán chưa.
 */

require_once __DIR__ . '/config.php';
nktg_handle_preflight();

$code = $_GET['code'] ?? '';
if ($code === '') {
    nktg_send_json(['error' => 'Missing code'], 400);
}

$db = nktg_db();
$stmt = $db->prepare('SELECT status, plan, license_key FROM nktg_orders WHERE order_code = ? LIMIT 1');
$stmt->execute([$code]);
$row = $stmt->fetch();

if (!$row) {
    nktg_send_json(['error' => 'Not found'], 404);
}

nktg_send_json([
    'status'     => $row['status'],
    'plan'       => $row['plan'],
    'licenseKey' => $row['status'] === 'paid' ? $row['license_key'] : null,
]);
