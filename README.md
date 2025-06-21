# Gamecast Server (Node.js)

---

## 🚀목차
- [진행 현황](#진행-현황-progress)
- [개발 사이클](#-개발-사이클-development-workflow)
- [Git 커밋 메시지 컨벤션](#-git-커밋-메시지-컨벤션)

---

## 📆진행 현황 (Progress)

| 기능                  | 상태 | 설명                                      |
|---------------------|------|-----------------------------------------|
| 프로젝트 세팅          |🟡 진행 중| Express.js 세팅, Swagger 문서화, CI/CD파이프라인, Dockerfile 세팅 |
| CI/CD 테스트           | ⏳ : 예정 | GitHub Actions + EC2 + Docker           |
| API 문서화             | ⏳ : 예정 | API 설계, Swagger 적용                    |

> 🟡 : 개발 중 / ⏳ : 예정 / ✅ : 완료

---

## 🔄 개발 사이클 (Development Workflow)

이 프로젝트는 **GitHub Flow**를 기반으로 하며, 다음과 같은 절차로 개발을 진행합니다:

### 📌 브랜치 전략

| 브랜치명              | 용도 |
|-------------------|------|
| `main`            | 운영 배포용 (배포되는 안정 버전) |
| `dev`             | 개발용 통합 브랜치 |
| `feature/#(이슈번호)` | 기능 개발 브랜치 (`feature/login-api` 등) |

---

### 👨‍💻 기능 개발 절차

```bash
# 1. dev에서 기능 브랜치 생성
git checkout dev
git pull origin dev
git checkout -b feature/#1-login-api # 이슈 번호 1번 기준

# 2. 코드 작성 & 커밋
git add .
git commit -m "feat: #1 로그인 API 구현" # 이슈 번호 1번 기준

# 3. 원격 브랜치 푸시
git push origin feature/login-api

# 4. GitHub에서 PR 생성 → 대상 브랜치: dev
# PR 설명에 Closes #1 이런식으로 작성
```

> **PR 제목 예시:**  
> `feat: 로그인 API 구현`  
> `fix: 회원가입 이메일 유효성 수정`

---

### 🧪 PR 생성 시 자동 실행 (CI)

`feature/* → dev` Pull Request 생성 혹은 업데이트 시 CI workflow 실행됨

테스트 Job 실행 (`npm test`)

---

### 🚀 병합 후 자동 배포 (CD)

예정

---

### 🧼 브랜치 정리

- PR 병합 완료 후, `feature/*` 브랜치는 **삭제**
- `dev` 브랜치에 병합
- `main` 브랜치는 항상 **배포 가능한 상태 유지**

---

## 🔐 Git 커밋 메시지 컨벤션

| 태그 | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가 |
| `chore` | 빌드, 설정 관련 작업 |

> 예시:  
> `feat: 회원가입 API 구현`  
> `fix: 로그인시 토큰 발급 오류 수정`

---

## 📋 Node.js 프로젝트 구조

```
gamecast-server/
├── src/
│   ├── controllers/     # 컨트롤러
│   ├── models/         # 데이터 모델
│   ├── routes/         # 라우터
│   ├── middleware/     # 미들웨어
│   ├── services/       # 비즈니스 로직
│   ├── utils/          # 유틸리티
│   └── app.js          # Express 앱 설정
├── tests/              # 테스트 파일
├── docs/               # API 문서 (Swagger)
├── docker-compose.yml  # Docker 컨테이너 설정
├── Dockerfile          # Docker 이미지 빌드
├── package.json        # 프로젝트 의존성
└── README.md
```

---

