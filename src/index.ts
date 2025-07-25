import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer } from "http";
import morgan from "morgan";
import logger, { stream } from "./logger.js";
import compression from "compression";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUiExpress from "swagger-ui-express";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import session from "express-session";
import passport from "passport";
import { googleStrategy, kakaoStrategy, localStrategy } from "./auth/auth.config.js";
import { prisma } from "./db.config.js";
import { rateLimitMiddleware } from "./middlewares/rateLimit.middleware.js";

// GameCast 관련 import
import roomRoutes from "./routes/room.routes.js";
import webrtcRoutes from "./routes/webrtc.routes.js";
import { WebRTCService } from "./services/webrtc.service.js";
import { responseMiddleware } from "./utils/response.util.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
// import { swaggerConfig } from "./config/swagger.config.js";

// 환경변수 로딩 - 개발 환경에서는 .env.dev 파일 사용
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.dev';
console.log('Loading env file:', envFile);
dotenv.config({ path: envFile });
console.log('PORT from env:', process.env.PORT);

// 필요한 환경변수 확인
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

// Passport Strategies 설정
// passport.use(localStrategy);
// passport.use(googleStrategy);
// passport.use(kakaoStrategy);
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

const app = express();
const port = process.env.PORT || 8889;

// HTTP 서버 생성 (Socket.IO와 함께 사용)
const server = createServer(app);

// 응답 압축
app.use(compression({
  threshold: 1024,
  level: 6,
  memLevel: 8,
}));

const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

// CORS 설정
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Rate limiting
app.use('/api', rateLimitMiddleware.general);

app.use(express.static("public"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]', { stream }));

app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24시간
    },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
    })
  })
);

app.use(passport.initialize());
app.use(passport.session());

// 응답 헬퍼 미들웨어 적용
app.use(responseMiddleware);

BigInt.prototype.toJSON = function() {
  return this.toString();
};

// WebRTC 서비스 초기화
const webrtcService = new WebRTCService(server);
logger.info('WebRTC 시그널링 서버가 초기화되었습니다.');

// 라우트 설정
app.get("/", (req, res) => {
  res.json({
    message: "🎮 GameCast API Server",
    version: "1.0.0",
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      api: "/api/rooms",
      docs: "/docs",
      health: "/health"
    },
    description: "GameCast 실시간 게임 스트리밍 플랫폼 API"
  });
});

// 세션 초기화 엔드포인트 (테스트용)
app.get('/init-session', (req, res) => {
  (req.session as any).initialized = true;
  res.json({
    message: 'Session initialized',
    sessionID: req.sessionID,
    session: req.session
  });
});

// 세션 상태 확인 엔드포인트
app.get('/session-info', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
    isAuthenticated: !!(req.session as any).initialized,
    timestamp: new Date().toISOString()
  });
});

// GameCast API 라우트
app.use("/api/rooms", roomRoutes);
app.use("/api/webrtc", webrtcRoutes);

// WebRTC 테스트 페이지
app.get('/webrtc-test', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'webrtc-test.html'));
});

// 정적 파일 서빙 (Socket.IO 클라이언트 등)
app.use(express.static('public'));

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Swagger 문서 설정
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GameCast Server API",
      version: "1.0.0",
      description: "GameCast 실시간 게임 스트리밍 플랫폼 API",
    },
    servers: [
      {
        url: "http://localhost:8889",
        description: "개발 서버"
      }
    ]
  },
  apis: [
    './dist/routes/*.js',
    './src/routes/*.ts'
  ], // JSDoc 주석이 있는 파일 경로
};

const swaggerSpecs = swaggerJSDoc(swaggerOptions);

// 디버깅을 위해 생성된 스펙 로그 출력
console.log('Generated Swagger specs paths:', Object.keys((swaggerSpecs as any).paths || {}));

app.use('/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'GameCast API Documentation'
}));

// 에러 핸들링 미들웨어
app.use(globalErrorHandler);

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    resultType: 'FAIL',
    error: {
      errorCode: 'NOT_FOUND',
      reason: 'API 엔드포인트를 찾을 수 없습니다.',
      data: {
        availableEndpoints: [
          'GET /',
          'GET /health',
          'GET /docs',
          'POST /api/rooms',
          'GET /api/rooms/:roomCode'
        ]
      }
    },
    success: null
  });
});

// 서버 시작
server.listen(port, () => {
  logger.info(`
🚀 GameCast API 서버가 시작되었습니다!
📍 포트: ${port}
🌍 환경: ${process.env.NODE_ENV || 'development'}
🔗 로컬 API: http://localhost:${port}/api/rooms
🔗 네트워크 API: http://192.168.75.1:${port}/api/rooms
📚 로컬 문서: http://localhost:${port}/docs
📚 네트워크 문서: http://192.168.75.1:${port}/docs
🧪 WebRTC 테스트: http://192.168.75.1:${port}/webrtc-test
💊 헬스체크: http://localhost:${port}/health
  `);
});

export default app;
