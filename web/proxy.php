<?php
$allowed_origins = ['https://olovenet.de', 'https://www.olovenet.de'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    if (!in_array($origin, $allowed_origins, true)) {
        http_response_code(403);
        exit;
    }
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: GET, PUT, MOVE, COPY, DELETE, PROPFIND, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Webdav-Target, X-Webdav-User, X-Webdav-Pass, Destination, Overwrite, Depth');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? '';

function ipSubnet(string $addr): string {
    if (filter_var($addr, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $bin = inet_pton($addr);
        $masked = substr($bin, 0, 6) . str_repeat("\x00", 10);
        return md5(inet_ntop($masked));
    }
    $parts = explode('.', $addr);
    return md5(($parts[0] ?? '0') . '.' . ($parts[1] ?? '0') . '.' . ($parts[2] ?? '0') . '.0');
}

if ($action === 'store_code') {
    header('Content-Type: application/json');
    $rawInput = file_get_contents('php://input');
    if (strlen($rawInput) > 4096) { http_response_code(413); echo json_encode(['error' => 'Payload zu groß']); exit; }
    $payload = json_decode($rawInput, true);
    if (!$payload) { http_response_code(400); echo json_encode(['error' => 'Ungültiger Body']); exit; }
    $tmp = sys_get_temp_dir();

    // Rate-Limit: max 5 store_code-Requests pro IP in 5 Minuten
    $ip = ipSubnet($_SERVER['REMOTE_ADDR'] ?? '');
    $rlFile = $tmp . '/tgb_rlstore_' . $ip . '.json';
    $now = time();
    $rl = file_exists($rlFile) ? (json_decode(file_get_contents($rlFile), true) ?? []) : [];
    $rl['ts'] = array_filter($rl['ts'] ?? [], fn($t) => $t > $now - 300);
    if (count($rl['ts']) >= 5) {
        http_response_code(429);
        echo json_encode(['error' => 'Zu viele Anfragen. Bitte warten.']);
        exit;
    }
    $rl['ts'][] = $now;
    file_put_contents($rlFile, json_encode($rl));

    foreach (glob($tmp . '/tgb_relay_*.json') ?: [] as $f) {
        if (filemtime($f) < $now - 300) @unlink($f);
    }
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 6; $i++) $code .= $chars[random_int(0, strlen($chars) - 1)];
    file_put_contents($tmp . '/tgb_relay_' . $code . '.json', json_encode(['ts' => $now, 'p' => $payload]));
    echo json_encode(['code' => $code]);
    exit;
}

if ($action === 'fetch_code') {
    header('Content-Type: application/json');
    $code = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $_GET['code'] ?? ''));
    if (strlen($code) !== 6) { http_response_code(400); echo json_encode(['error' => 'Ungültiger Code']); exit; }

    // Brute-force protection: progressive lockout per IP
    // Delays after n-th wrong attempt: 3→30s, 4→60s, 5→5min, 6→30min, 7+→1h
    $delays = [0, 0, 0, 30, 60, 300, 1800, 3600];
    $ip = ipSubnet($_SERVER['REMOTE_ADDR'] ?? '');
    $rlFile = sys_get_temp_dir() . '/tgb_rl_' . $ip . '.json';
    $rl = file_exists($rlFile) ? (json_decode(file_get_contents($rlFile), true) ?? []) : [];
    $now = time();
    if (($rl['locked_until'] ?? 0) > $now) {
        $wait = $rl['locked_until'] - $now;
        http_response_code(429);
        echo json_encode(['error' => 'Zu viele Versuche.', 'retry_after' => $wait]);
        exit;
    }
    // Reset only after lock has fully expired AND 10+ min of inactivity
    $lockExpired = ($rl['locked_until'] ?? 0) <= $now;
    $inactive = ($rl['last'] ?? 0) < $now - 600;
    if ($lockExpired && $inactive) $rl = [];

    $file = sys_get_temp_dir() . '/tgb_relay_' . $code . '.json';
    $wrongAttempt = false;
    if (!file_exists($file)) {
        $wrongAttempt = true;
        http_response_code(404); $errMsg = 'Code nicht gefunden oder abgelaufen.';
    } else {
        $content = json_decode(file_get_contents($file), true);
        @unlink($file);
        if (!$content || ($content['ts'] ?? 0) < $now - 300) {
            $wrongAttempt = true;
            http_response_code(404); $errMsg = 'Code abgelaufen.';
        }
    }
    if ($wrongAttempt) {
        $rl['attempts'] = ($rl['attempts'] ?? 0) + 1;
        $rl['last'] = $now;
        $idx = min($rl['attempts'], count($delays) - 1);
        if ($delays[$idx] > 0) $rl['locked_until'] = $now + $delays[$idx];
        file_put_contents($rlFile, json_encode($rl));
        echo json_encode(['error' => $errMsg]); exit;
    }
    // Success: reset rate limit
    @unlink($rlFile);
    echo json_encode($content['p']);
    exit;
}

if ($action === 'google_token' || $action === 'google_refresh') {
    header('Content-Type: application/json');
    require_once __DIR__ . '/proxy.config.php';
    $clientId     = $googleClientId;
    $clientSecret = $googleClientSecret;
    $input        = json_decode(file_get_contents('php://input'), true) ?? [];
    $params = $action === 'google_token'
        ? ['code'          => $input['code']          ?? '',
           'client_id'     => $clientId,
           'client_secret' => $clientSecret,
           'redirect_uri'  => $input['redirect_uri']  ?? '',
           'grant_type'    => 'authorization_code',
           'code_verifier' => $input['code_verifier'] ?? '']
        : ['refresh_token' => $input['refresh_token'] ?? '',
           'client_id'     => $clientId,
           'client_secret' => $clientSecret,
           'grant_type'    => 'refresh_token'];
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    http_response_code($httpCode);
    echo $response;
    exit;
}

$target = $_SERVER['HTTP_X_WEBDAV_TARGET'] ?? '';
if (!$target || !preg_match('#^https://#', $target)) {
    http_response_code(400);
    echo 'Missing or invalid X-Webdav-Target (must be https://)';
    exit;
}

// Method whitelist
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'PUT', 'MOVE', 'COPY', 'DELETE', 'PROPFIND'], true)) {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

// SSRF: alle aufgelösten IPs prüfen, dann curl auf validierte IP pinnen
$host = parse_url($target, PHP_URL_HOST) ?: '';
if (!$host) { http_response_code(400); echo 'Ungültiger Ziel-Host'; exit; }

$dnsRecords = @dns_get_record($host, DNS_A | DNS_AAAA) ?: [];
$pinnedIp = '';
foreach ($dnsRecords as $r) {
    $ip = $r['ip'] ?? $r['ipv6'] ?? '';
    if (!$ip) continue;
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        http_response_code(403); echo 'Ziel nicht erlaubt'; exit;
    }
    if (!$pinnedIp) $pinnedIp = $ip;
}
if (!$pinnedIp) { http_response_code(403); echo 'Ziel nicht auflösbar'; exit; }

// Rate-Limit: max 120 WebDAV-Requests pro IP-Subnetz in 60 Sekunden
$ip    = ipSubnet($_SERVER['REMOTE_ADDR'] ?? '');
$rlWd  = sys_get_temp_dir() . '/tgb_rlwebdav_' . $ip . '.json';
$now   = time();
$rlW   = file_exists($rlWd) ? (json_decode(file_get_contents($rlWd), true) ?? []) : [];
$rlW['ts'] = array_filter($rlW['ts'] ?? [], fn($t) => $t > $now - 60);
if (count($rlW['ts']) >= 120) {
    http_response_code(429);
    echo 'Zu viele Anfragen';
    exit;
}
$rlW['ts'][] = $now;
file_put_contents($rlWd, json_encode($rlW));

$user = $_SERVER['HTTP_X_WEBDAV_USER'] ?? '';
$pass = $_SERVER['HTTP_X_WEBDAV_PASS'] ?? '';

$port = (int)(parse_url($target, PHP_URL_PORT) ?? 443);
$ch = curl_init($target);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_RESOLVE, ["$host:$port:$pinnedIp"]);

if ($user !== '') {
    curl_setopt($ch, CURLOPT_USERPWD, "$user:$pass");
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
}

$fwdHeaders = [];

// Destination: SSRF-Prüfung + Header-Injection verhindern
$dest = $_SERVER['HTTP_DESTINATION'] ?? '';
if ($dest !== '') {
    if (strpbrk($dest, "\r\n") !== false) { http_response_code(400); echo 'Ungültiger Destination-Header'; exit; }
    $destHost = parse_url($dest, PHP_URL_HOST) ?: '';
    if (!$destHost) { http_response_code(400); echo 'Ungültiger Destination-Host'; exit; }
    $destRecords = @dns_get_record($destHost, DNS_A | DNS_AAAA) ?: [];
    $destOk = false;
    foreach ($destRecords as $r) {
        $ip2 = $r['ip'] ?? $r['ipv6'] ?? '';
        if (!$ip2) continue;
        if (!filter_var($ip2, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            http_response_code(403); echo 'Destination nicht erlaubt'; exit;
        }
        $destOk = true;
    }
    if (!$destOk) { http_response_code(403); echo 'Destination nicht auflösbar'; exit; }
    $fwdHeaders[] = 'Destination: ' . $dest;
}

// Overwrite und Depth auf bekannte Werte beschränken
$overwrite = $_SERVER['HTTP_OVERWRITE'] ?? '';
if (preg_match('/^[TF]$/', $overwrite)) $fwdHeaders[] = 'Overwrite: ' . $overwrite;
$depth = $_SERVER['HTTP_DEPTH'] ?? '';
if (preg_match('/^(0|1|infinity)$/i', $depth)) $fwdHeaders[] = 'Depth: ' . $depth;

if (in_array($method, ['PUT', 'PROPFIND'], true)) {
    $data = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    if ($method === 'PUT') $fwdHeaders[] = 'Content-Type: application/octet-stream';
}

if ($fwdHeaders) curl_setopt($ch, CURLOPT_HTTPHEADER, $fwdHeaders);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo 'cURL error: ' . $curlErr;
    exit;
}

http_response_code($httpCode);
header('Content-Type: application/octet-stream');
echo $response;
