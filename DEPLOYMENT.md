# GameCast Server - AWS Docker Deployment Guide

## 🚀 AWS 서버 배포 가이드

이 가이드는 GameCast WebRTC 시그널링 서버를 AWS EC2에 Docker Compose로 배포하는 방법을 설명합니다.

## 📋 사전 요구사항

### AWS EC2 인스턴스
- **권장 사양**: t3.medium 이상 (2 vCPU, 4GB RAM)
- **운영체제**: Ubuntu 20.04 LTS 이상
- **스토리지**: 20GB 이상
- **보안 그룹 설정**:
  - SSH (22): 관리용
  - HTTP (80): 웹 서비스
  - HTTPS (443): SSL 웹 서비스
  - Custom (8889): API 서버 (선택적)

### 설치된 소프트웨어
```bash
# Docker & Docker Compose 설치
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

## 🛠️ 배포 과정

### 1. 소스 코드 업로드
```bash
# 서버에 코드 업로드 (Git 사용 권장)
git clone https://github.com/UMC-GameCast/gamecast-server.git
cd gamecast-server

# 또는 SCP/SFTP로 직접 업로드
scp -r ./gamecast-server ubuntu@your-ec2-ip:~/
```

### 2. 환경 설정
```bash
# 프로덕션 환경 변수 설정
cp .env.prod.example .env.prod
nano .env.prod
```

**필수 설정 항목**:
```env
# 보안 키 (32자 이상 랜덤 문자열)
JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
SESSION_SECRET=your_super_secure_session_secret_key_here_minimum_32_characters

# 데이터베이스 비밀번호
MYSQL_ROOT_PASSWORD=your_secure_root_password_here
MYSQL_PASSWORD=your_secure_mysql_password_here

# 도메인 설정
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com

# 포트 설정 (필요시 변경)
API_PORT=8889
HTTP_PORT=80
HTTPS_PORT=443
```

### 3. 배포 실행

#### Linux/Mac 사용자:
```bash
chmod +x deploy.sh
./deploy.sh
```

#### Windows 사용자:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\deploy.ps1
```

### 4. SSL 인증서 설정 (선택적)

#### Let's Encrypt 사용:
```bash
# Certbot 설치
sudo apt install certbot

# 인증서 발급
sudo certbot certonly --standalone -d your-domain.com

# Nginx SSL 설정 활성화
# nginx/nginx.conf 파일에서 HTTPS 섹션 주석 제거 후 재배포
```

## 📊 서비스 관리

### 상태 확인
```bash
# 전체 서비스 상태
docker-compose -f docker-compose.prod.yml ps

# 개별 서비스 로그
docker-compose -f docker-compose.prod.yml logs -f gamecast-api
docker-compose -f docker-compose.prod.yml logs -f mysql
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### 서비스 제어
```bash
# 전체 서비스 중지
docker-compose -f docker-compose.prod.yml down

# 전체 서비스 시작
docker-compose -f docker-compose.prod.yml up -d

# 특정 서비스만 재시작
docker-compose -f docker-compose.prod.yml restart gamecast-api
```

### 데이터베이스 관리
```bash
# 데이터베이스 마이그레이션
docker-compose -f docker-compose.prod.yml run --rm gamecast-api npx prisma migrate deploy

# 데이터베이스 백업
docker-compose -f docker-compose.prod.yml exec mysql mysqldump -u root -p gamecast > backup.sql

# 데이터베이스 복원
docker-compose -f docker-compose.prod.yml exec -i mysql mysql -u root -p gamecast < backup.sql
```

## 🔍 모니터링 및 헬스체크

### 엔드포인트
- **API 헬스체크**: `http://your-domain/health`
- **API 문서**: `http://your-domain/docs`
- **WebRTC 테스트**: `http://your-domain/webrtc-test`

### 로그 위치
```bash
# 애플리케이션 로그
./logs/all.log
./logs/error.log

# Nginx 로그
docker-compose -f docker-compose.prod.yml logs nginx

# MySQL 로그
docker-compose -f docker-compose.prod.yml logs mysql
```

## 🔧 트러블슈팅

### 일반적인 문제들

#### 1. 포트 충돌
```bash
# 사용 중인 포트 확인
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8889

# 포트 변경 후 재배포
```

#### 2. 메모리 부족
```bash
# 메모리 사용량 확인
docker stats

# 스왑 메모리 추가
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 3. 데이터베이스 연결 실패
```bash
# MySQL 로그 확인
docker-compose -f docker-compose.prod.yml logs mysql

# 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart mysql

# 데이터베이스 초기화 (주의: 데이터 손실)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 업데이트 과정

```bash
# 1. 새 코드 받기
git pull origin main

# 2. 서비스 중지
docker-compose -f docker-compose.prod.yml down

# 3. 이미지 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 4. 마이그레이션 실행
docker-compose -f docker-compose.prod.yml run --rm gamecast-api npx prisma migrate deploy

# 5. 서비스 재시작
docker-compose -f docker-compose.prod.yml up -d
```

## 📈 성능 최적화

### 리소스 제한 설정
```yaml
# docker-compose.prod.yml에 추가
services:
  gamecast-api:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

### 로드 밸런싱 (고가용성)
```yaml
# 여러 API 인스턴스 실행
services:
  gamecast-api:
    deploy:
      replicas: 3
```

## 🔐 보안 권장사항

1. **방화벽 설정**: 필요한 포트만 개방
2. **정기적인 보안 업데이트**: `sudo apt update && sudo apt upgrade`
3. **SSL/TLS 인증서**: Let's Encrypt 또는 상용 인증서 사용
4. **환경 변수 보안**: `.env.prod` 파일 권한 설정 (`chmod 600`)
5. **로그 모니터링**: 비정상적인 접근 패턴 감시

## 📞 지원

문제가 발생하면 다음을 확인해주세요:
1. 로그 파일 확인
2. 헬스체크 엔드포인트 상태
3. 리소스 사용량 (CPU, 메모리, 디스크)
4. 네트워크 연결 상태
