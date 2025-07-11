# Gamecast Server (Node.js)

---

## 🚀목차
- [진행 현황](#진행-현황-progress)
- [API 응답 형식](#-api-응답-형식)
- [예외 처리](#-예외-처리)
- [Swagger 문서](#-swagger-문서)
- [개발 사이클](#-개발-사이클-development-workflow)
- [Git 커밋 메시지 컨벤션](#-git-커밋-메시지-컨벤션)

---

## 📆진행 현황 (Progress)

| 기능                  | 상태 | 설명                                      |
|---------------------|------|-----------------------------------------|
| 프로젝트 세팅          |✅ 완료| Express.js 세팅, TypeScript 적용           |
| 기본 응답 형식 설계     |✅ 완료| 응답 통일, 페이지네이션 지원               |
| 공통 예외 처리         |✅ 완료| 커스텀 에러 클래스, 전역 에러 핸들러        |
| Swagger 설정          |✅ 완료| API 문서 자동화, 타입 정의                |
| CI/CD 테스트           | ⏳ 예정 | GitHub Actions + EC2 + Docker           |

> 🟡 : 개발 중 / ⏳ : 예정 / ✅ : 완료

---

## 📋 API 응답 형식

### 기본 응답 구조

모든 API는 다음과 같은 통일된 형식으로 응답합니다:

#### 성공 응답
```json
{
  "resultType": "SUCCESS",
  "error": null,
  "success": {
    // 실제 데이터
  }
}
```

#### 실패 응답
```json
{
  "resultType": "FAIL",
  "error": {
    "errorCode": "ERROR_CODE",
    "reason": "에러 설명",
    "data": null // 추가 데이터 (선택사항)
  },
  "success": null
}
```

#### 페이지네이션 응답
```json
{
  "resultType": "SUCCESS",
  "error": null,
  "success": {
    "data": [
      // 실제 데이터 배열
    ],
    "pagination": {
      "page": 1,
      "size": 10,
      "totalElements": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

### 응답 헬퍼 사용법

컨트롤러에서 다음과 같이 사용할 수 있습니다:

```typescript
// 성공 응답
res.success(data);

// 에러 응답
res.error("ERROR_CODE", "에러 메시지", additionalData);

// 페이지네이션 응답
res.paginated(dataArray, page, size, totalElements);
```

---

## ⚠️ 예외 처리

### 커스텀 에러 클래스

| 에러 클래스 | HTTP 상태 | 설명 |
|------------|----------|------|
| `BadRequestError` | 400 | 잘못된 요청 |
| `UnauthorizedError` | 401 | 인증 필요 |
| `ForbiddenError` | 403 | 접근 권한 없음 |
| `NotFoundError` | 404 | 리소스 없음 |
| `ConflictError` | 409 | 리소스 충돌 |
| `ValidationError` | 422 | 유효성 검사 실패 |
| `InternalServerError` | 500 | 서버 내부 오류 |

### 사용 예시

```typescript
import { BadRequestError, NotFoundError } from '../errors/custom.errors.js';

// 에러 발생
throw new BadRequestError('유효하지 않은 파라미터입니다.');
throw new NotFoundError('사용자를 찾을 수 없습니다.');

// 비동기 함수 에러 처리
import { asyncHandler } from '../middlewares/error.middleware.js';

router.get('/users/:id', asyncHandler(async (req, res) => {
  // 에러가 발생하면 자동으로 전역 에러 핸들러로 전달됨
  const user = await getUserById(req.params.id);
  res.success(user);
}));
```

---

## � Swagger 문서

### 접속 방법
- 개발 환경: `http://localhost:8888/docs`
- API 스펙: `http://localhost:8888/openapi.json`

### Swagger 주석 사용법

```typescript
router.get('/users/:id', asyncHandler(async (req, res) => {
  // #swagger.tags = ['User']
  // #swagger.summary = '사용자 상세 조회'
  // #swagger.description = 'ID를 통해 특정 사용자의 정보를 조회합니다.'
  // #swagger.parameters['id'] = { 
  //   in: 'path', 
  //   description: '사용자 ID', 
  //   required: true, 
  //   schema: { type: 'integer' } 
  // }
  // #swagger.responses[200] = { 
  //   description: '사용자 조회 성공',
  //   content: {
  //     "application/json": {
  //       schema: { $ref: '#/definitions/SuccessResponse' }
  //     }
  //   }
  // }
  
  const user = await getUserById(req.params.id);
  res.success(user);
}));
```

### 사전 정의된 스키마

- `SuccessResponse`: 성공 응답 형식
- `FailResponse`: 실패 응답 형식
- `PaginatedResponse`: 페이지네이션 응답 형식
- `User`: 사용자 모델

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

