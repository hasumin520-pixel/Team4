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
      $auth = Test-Path "$env:USERPROFILE\.claude\.credentials.json"
      Send-Json $res @{ agent = $true; claude = $claude; skill = $skill; auth = $auth }
    }
    elseif ($req.Url.AbsolutePath -eq '/snipe' -and $req.HttpMethod -eq 'POST') {
      $body = (New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd() | ConvertFrom-Json
      # 감시 조건은 자유 문장(prompt)으로 받는다 — "8월 2일 밍글스 저녁 2명 빈자리 감시해줘".
      # 구버전 웹(날짜·시간·인원 필드)에서 온 요청도 호환 처리한다.
      if ($body.prompt) {
        $request = "$($body.prompt) (대상 식당: $($body.name))"
      } else {
        $request = "식당: $($body.name), 날짜: $($body.date), 시간: $($body.time), 인원: $($body.people)명 빈자리 감시"
      }
      $request = $request -replace '"', ''  # claude "인자" 문자열 깨짐 방지
      # 온보딩 포함 프롬프트 — 확장 미연결/캐치테이블 미로그인이어도 Claude가 대화로 해결을 안내한 뒤 감시 시작
      $prompt = "캐치테이블 빈자리(취소표) 감시를 도와줘. 사용자가 캐치테이블에서 직접 예약을 시도했지만 원하는 날짜에 자리가 없는 상황이야. 요청: $request. 먼저 claude-in-chrome 크롬 확장이 연결되는지 확인하고, 안 되면 설치·연결 방법을 한국어로 차근차근 안내해줘. 캐치테이블 로그인이 안 돼 있으면 크롬에서 직접 로그인하도록 안내하고 기다려줘. 준비가 되면 catchtable-sniper 스킬을 사용해서: 혹시 요청한 시간대에 빈자리가 있으면 감시 없이 바로 예약을 진행하고, 없으면 취소표 감시 모드로 전환해서 자리가 나는 즉시 예약해줘. 결제가 필요한 단계는 반드시 내 확인을 받아줘."
      # cmd /k — claude 종료 후에도 창을 남겨 결과/오류를 볼 수 있게 함
      $log = "$env:USERPROFILE\.mosim\agent.log"
      try {
        $proc = Start-Process cmd.exe -ArgumentList '/k', "claude `"$prompt`"" -PassThru
        Add-Content $log "$(Get-Date -Format o) snipe 실행: pid=$($proc.Id) name=$($body.name)"
      } catch {
        Add-Content $log "$(Get-Date -Format o) snipe 실패: $($_.Exception.Message)"
        Send-Json $res @{ ok = $false; error = $_.Exception.Message } 500
        continue
      }
      Send-Json $res @{ ok = $true }
    }
    else {
      Send-Json $res @{ error = 'not found' } 404
    }
  } catch {
    # 요청 단위 오류는 무시하고 리스너 유지
  }
}
