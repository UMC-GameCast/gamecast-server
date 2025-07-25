# AWS 배포용 PowerShell 스크립트
# GameCast Server Docker Compose 배포 (Windows)

param(
    [switch]$Clean = $false,
    [switch]$NoBuild = $false
)

Write-Host "🚀 GameCast Server AWS 배포 시작..." -ForegroundColor Green

# 환경 변수 설정
$env:NODE_ENV = "production"
$env:COMPOSE_FILE = "docker-compose.prod.yml"

# .env.prod 파일 확인
if (-not (Test-Path ".env.prod")) {
    Write-Host "❌ .env.prod 파일이 없습니다. .env.prod.example을 참고하여 생성해주세요." -ForegroundColor Red
    exit 1
}

Write-Host "📦 환경 설정 로드 중..." -ForegroundColor Yellow

# .env.prod 파일 로드
Get-Content ".env.prod" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.*)$") {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

# 이전 컨테이너 정리
if ($Clean) {
    Write-Host "🧹 기존 컨테이너 및 볼륨 정리 중..." -ForegroundColor Yellow
    docker-compose -f $env:COMPOSE_FILE down --remove-orphans -v
    docker system prune -f
} else {
    Write-Host "🧹 기존 컨테이너 정리 중..." -ForegroundColor Yellow
    docker-compose -f $env:COMPOSE_FILE down --remove-orphans
}

# Docker 이미지 빌드
if (-not $NoBuild) {
    Write-Host "🔨 Docker 이미지 빌드 중..." -ForegroundColor Yellow
    docker-compose -f $env:COMPOSE_FILE build --no-cache
}

# 데이터베이스 서비스 먼저 시작
Write-Host "🗄️ 데이터베이스 서비스 시작 중..." -ForegroundColor Yellow
docker-compose -f $env:COMPOSE_FILE up -d mysql redis

# 데이터베이스 연결 대기
Write-Host "⏳ 데이터베이스 연결 대기 중..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 헬스 체크
$maxRetries = 10
$retryCount = 0

do {
    $mysqlHealth = docker-compose -f $env:COMPOSE_FILE ps mysql --format json | ConvertFrom-Json | Select-Object -ExpandProperty Health
    $redisHealth = docker-compose -f $env:COMPOSE_FILE ps redis --format json | ConvertFrom-Json | Select-Object -ExpandProperty Health
    
    if ($mysqlHealth -eq "healthy" -and $redisHealth -eq "healthy") {
        Write-Host "✅ 데이터베이스 서비스가 준비되었습니다!" -ForegroundColor Green
        break
    }
    
    $retryCount++
    Write-Host "⏳ 데이터베이스 서비스 대기 중... ($retryCount/$maxRetries)" -ForegroundColor Yellow
    Start-Sleep -Seconds 10
} while ($retryCount -lt $maxRetries)

if ($retryCount -eq $maxRetries) {
    Write-Host "❌ 데이터베이스 서비스 시작 실패" -ForegroundColor Red
    docker-compose -f $env:COMPOSE_FILE logs mysql
    docker-compose -f $env:COMPOSE_FILE logs redis
    exit 1
}

# Prisma 마이그레이션 실행
Write-Host "🔄 데이터베이스 마이그레이션 실행 중..." -ForegroundColor Yellow
docker-compose -f $env:COMPOSE_FILE run --rm gamecast-api npx prisma migrate deploy
docker-compose -f $env:COMPOSE_FILE run --rm gamecast-api npx prisma generate

# 전체 서비스 시작
Write-Host "🌟 모든 서비스 시작 중..." -ForegroundColor Yellow
docker-compose -f $env:COMPOSE_FILE up -d

# 서비스 시작 대기
Write-Host "⏳ 서비스 시작 대기 중..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# 헬스 체크
Write-Host "🏥 서비스 헬스 체크 중..." -ForegroundColor Yellow

$apiPort = $env:API_PORT
if (-not $apiPort) { $apiPort = "8889" }

$httpPort = $env:HTTP_PORT
if (-not $httpPort) { $httpPort = "80" }

# API 서버 상태 확인
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$apiPort/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API 서버가 정상적으로 실행 중입니다!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ API 서버 헬스 체크 실패" -ForegroundColor Red
    docker-compose -f $env:COMPOSE_FILE logs gamecast-api
}

# Nginx 상태 확인
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$httpPort/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Nginx가 정상적으로 실행 중입니다!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Nginx 헬스 체크 실패" -ForegroundColor Red
    docker-compose -f $env:COMPOSE_FILE logs nginx
}

Write-Host ""
Write-Host "🎉 배포 완료!" -ForegroundColor Green
Write-Host "📍 API 서버: http://localhost:$apiPort" -ForegroundColor Cyan
Write-Host "🌐 Nginx: http://localhost:$httpPort" -ForegroundColor Cyan
Write-Host "📚 API 문서: http://localhost:$httpPort/docs" -ForegroundColor Cyan
Write-Host "🧪 WebRTC 테스트: http://localhost:$httpPort/webrtc-test" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 상태 확인: docker-compose -f $env:COMPOSE_FILE ps" -ForegroundColor White
Write-Host "📋 로그 확인: docker-compose -f $env:COMPOSE_FILE logs -f" -ForegroundColor White
Write-Host "🛑 중지: docker-compose -f $env:COMPOSE_FILE down" -ForegroundColor White
