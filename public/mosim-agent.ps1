# 모심(Mosim) PC 에이전트 — localhost 브리지
# 모심 웹앱의 "빈자리 감시" 버튼 요청을 받아 이 PC에서 Claude Code(catchtable-sniper)를 실행한다.
# 설치: irm https://moim-blush.vercel.app/setup.ps1 | iex  (시작프로그램에 자동 등록됨)

$ErrorActionPreference = 'Stop'
$PORT = 43110

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$PORT/")
try {
  $listener.Start()
} catch {
  # 이미 다른 인스턴스가 떠 있으면 조용히 종료
  exit 0
}
Write-Host "모심 PC 에이전트 실행 중: http://localhost:$PORT (이 창을 닫으면 중지됩니다)"

function Send-Json($res, $obj, $code = 200) {
  $res.StatusCode = $code
  $res.ContentType = 'application/json; charset=utf-8'
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.Close()
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    # 브라우저(https 모심 페이지)에서 localhost 호출 허용 — CORS + Private Network Access
    $res.Headers.Add('Access-Control-Allow-Origin', '*')
    $res.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    $res.Headers.Add('Access-Control-Allow-Headers', 'content-type')
    $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')
    if ($req.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
      $res.Close()
      continue
    }

    if ($req.Url.AbsolutePath -eq '/status') {
      $claude = $null -ne (Get-Command claude -ErrorAction SilentlyContinue)
      $skill = Test-Path "$env:USERPROFILE\.claude\skills\catchtable-sniper\SKILL.md"
      Send-Json $res @{ agent = $true; claude = $claude; skill = $skill }
    }
    elseif ($req.Url.AbsolutePath -eq '/snipe' -and $req.HttpMethod -eq 'POST') {
      $body = (New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd() | ConvertFrom-Json
      $prompt = "캐치테이블 빈자리 감시를 시작해줘. 식당: $($body.name), 날짜: $($body.date), 시간: $($body.time), 인원: $($body.people)명. catchtable-sniper 스킬을 사용하고, 결제가 필요한 단계는 반드시 내 확인을 받아줘."
      # cmd /k — claude 종료 후에도 창을 남겨 결과/오류를 볼 수 있게 함
      Start-Process cmd.exe -ArgumentList '/k', "claude `"$prompt`""
      Send-Json $res @{ ok = $true }
    }
    else {
      Send-Json $res @{ error = 'not found' } 404
    }
  } catch {
    # 요청 단위 오류는 무시하고 리스너 유지
  }
}
