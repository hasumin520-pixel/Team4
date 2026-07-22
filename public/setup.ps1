# 모심(Mosim) PC 에이전트 원클릭 설치
# 실행: irm https://moim-blush.vercel.app/setup.ps1 | iex
# 하는 일: ① Claude Code 설치 ② catchtable-sniper 스킬 설치(MIT, NomaDamas/k-skill)
#          ③ 모심 PC 에이전트 설치 + 시작프로그램 등록 + 즉시 실행 ④ 크롬 확장 설치 페이지 열기

$ErrorActionPreference = 'Stop'
$BASE = 'https://moim-blush.vercel.app'

Write-Host ''
Write-Host '=== 모심(Mosim) PC 에이전트 설치 ===' -ForegroundColor Cyan

# 1) Claude Code (공식 네이티브 인스톨러 — Node.js 불필요)
if (Get-Command claude -ErrorAction SilentlyContinue) {
  Write-Host '[1/4] Claude Code 이미 설치됨' -ForegroundColor Green
} else {
  Write-Host '[1/4] Claude Code 설치 중...'
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine')
}

# 2) catchtable-sniper 스킬 (개인 스킬 폴더에 설치)
$skillDir = "$env:USERPROFILE\.claude\skills\catchtable-sniper"
if (Test-Path "$skillDir\SKILL.md") {
  Write-Host '[2/4] catchtable-sniper 스킬 이미 설치됨' -ForegroundColor Green
} else {
  Write-Host '[2/4] catchtable-sniper 스킬 설치 중...'
  New-Item -ItemType Directory -Force $skillDir | Out-Null
  Invoke-WebRequest 'https://raw.githubusercontent.com/NomaDamas/k-skill/main/catchtable-sniper/SKILL.md' -OutFile "$skillDir\SKILL.md"
}

# 3) 모심 PC 에이전트 (localhost:43110 브리지)
Write-Host '[3/4] 모심 PC 에이전트 설치·실행 중...'
$agentDir = "$env:USERPROFILE\.mosim"
New-Item -ItemType Directory -Force $agentDir | Out-Null
Invoke-WebRequest "$BASE/mosim-agent.ps1" -OutFile "$agentDir\mosim-agent.ps1"
$startup = [Environment]::GetFolderPath('Startup')
Set-Content -Encoding Ascii "$startup\mosim-agent.cmd" "@powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$agentDir\mosim-agent.ps1`""
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$agentDir\mosim-agent.ps1"

# 4) claude-in-chrome 확장 (크롬 정책상 자동 설치 불가 — 스토어에서 '추가' 클릭 필요)
Write-Host '[4/4] 크롬 확장 설치 페이지를 엽니다 — [Chrome에 추가]를 눌러주세요'
Start-Process 'https://claude.ai/chrome'

Write-Host ''
Write-Host '=== 설치 완료! 남은 수동 단계 ===' -ForegroundColor Cyan
Write-Host '  1. 크롬 확장 [Chrome에 추가] 클릭 (방금 열린 페이지)'
Write-Host '  2. 터미널에서 claude 실행 후 로그인 (최초 1회)'
Write-Host '  3. 크롬에서 캐치테이블(catchtable.co.kr) 로그인'
Write-Host ''
Write-Host '완료 후 모심의 [빈자리 감시] 버튼을 누르면 이 PC에서 감시가 시작됩니다.'
