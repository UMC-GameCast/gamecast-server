#!/bin/bash

# AWS 배포 스크립트
# GameCast Server Docker Compose 배포

set -e

echo "🚀 GameCast Server AWS 배포 시작..."

# 환경 변수 설정
export NODE_ENV=production
export COMPOSE_FILE=docker-compose.prod.yml

# .env.prod 파일 확인
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod 파일이 없습니다. .env.prod.example을 참고하여 생성해주세요."
    exit 1
fi

echo "📦 환경 설정 로드 중..."
set -a
source .env.prod
set +a

# 이전 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose -f $COMPOSE_FILE down --remove-orphans

# Docker 이미지 빌드
echo "🔨 Docker 이미지 빌드 중..."
docker-compose -f $COMPOSE_FILE build --no-cache

# 데이터베이스 마이그레이션 준비
echo "🗄️ 데이터베이스 서비스 시작 중..."
docker-compose -f $COMPOSE_FILE up -d mysql redis

# 데이터베이스 연결 대기
echo "⏳ 데이터베이스 연결 대기 중..."
sleep 30

# Prisma 마이그레이션 실행
echo "🔄 데이터베이스 마이그레이션 실행 중..."
docker-compose -f $COMPOSE_FILE run --rm gamecast-api npx prisma migrate deploy
docker-compose -f $COMPOSE_FILE run --rm gamecast-api npx prisma generate

# 전체 서비스 시작
echo "🌟 모든 서비스 시작 중..."
docker-compose -f $COMPOSE_FILE up -d

# 헬스 체크
echo "🏥 서비스 헬스 체크 중..."
sleep 10

# API 서버 상태 확인
if curl -f http://localhost:${API_PORT:-8889}/health > /dev/null 2>&1; then
    echo "✅ API 서버가 정상적으로 실행 중입니다!"
else
    echo "❌ API 서버 헬스 체크 실패"
    docker-compose -f $COMPOSE_FILE logs gamecast-api
    exit 1
fi

# Nginx 상태 확인
if curl -f http://localhost:${HTTP_PORT:-80}/health > /dev/null 2>&1; then
    echo "✅ Nginx가 정상적으로 실행 중입니다!"
else
    echo "❌ Nginx 헬스 체크 실패"
    docker-compose -f $COMPOSE_FILE logs nginx
fi

echo ""
echo "🎉 배포 완료!"
echo "📍 API 서버: http://localhost:${API_PORT:-8889}"
echo "🌐 Nginx: http://localhost:${HTTP_PORT:-80}"
echo "📚 API 문서: http://localhost:${HTTP_PORT:-80}/docs"
echo "🧪 WebRTC 테스트: http://localhost:${HTTP_PORT:-80}/webrtc-test"
echo ""
echo "📊 상태 확인: docker-compose -f $COMPOSE_FILE ps"
echo "📋 로그 확인: docker-compose -f $COMPOSE_FILE logs -f"
echo "🛑 중지: docker-compose -f $COMPOSE_FILE down"
