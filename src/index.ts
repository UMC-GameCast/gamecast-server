import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import logger, { stream } from "./logger.js";
import compression from "compression";
import swaggerAutogen from "swagger-autogen";
import swaggerUiExpress from "swagger-ui-express";
import session from "express-session";
import passport from "passport";
import { prisma } from "./db.config.js";
import { responseMiddleware } from "./utils/response.util.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { swaggerConfig } from "./config/swagger.config.js";
import userRoutes from "./routes/users.routes.js";


dotenv.config();

// Passport Strategies 설정 (임시 주석 처리)
// passport.use(localStrategy);   // Local Strategy 추가
// passport.use(googleStrategy);
// passport.use(kakaoStrategy);
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

const port = process.env.PORT;
const app = express();

// 기존 미들웨어 설정...
app.use(compression({
  threshold: 512,
  level: 6,
  filter: (req, res) => {
    const contentType = res.getHeader('Content-Type');
    if (contentType && typeof contentType === 'string') {
      return !/(?:^|,)\s*(?:image\/|audio\/|video\/|application\/zip)/i.test(contentType);
    }
    return compression.filter(req, res);
  }
}));

app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan(':method :url :status :response-time ms - :res[content-length]', { stream }));

app.use(
  "/docs",
  swaggerUiExpress.serve,
  swaggerUiExpress.setup({}, {
    swaggerOptions: {
      url: "/openapi.json",
    },
  })
);

app.use(
  session({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
    resave: false,
    saveUninitialized: false,
    secret: process.env.EXPRESS_SESSION_SECRET || 'default-secret-key',
    // store: new PrismaSessionStore(prisma, {
    //   checkPeriod: 2 * 60 * 1000,
    //   dbRecordIdIsSessionId: true,
    //   dbRecordIdFunction: undefined,
    // }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

BigInt.prototype.toJSON = function() {
  return this.toString();
};

// 응답 형식 통일 미들웨어
app.use(responseMiddleware);

app.get("/", (req, res) => {
  // #swagger.tags = ['System']
  // #swagger.summary = '서버 상태 확인'
  // #swagger.description = '서버가 정상적으로 작동하는지 확인합니다.'
  // #swagger.responses[200] = { 
  //   description: '서버 정상 작동',
  //   content: {
  //     "application/json": {
  //       schema: { $ref: '#/definitions/SuccessResponse' },
  //       example: {
  //         resultType: "SUCCESS",
  //         error: null,
  //         success: "Hello World! Server is running successfully."
  //       }
  //     }
  //   }
  // }
  res.success("Hello World! Server is running successfully.");
});

app.get("/openapi.json", async (req, res, next) => {
  // #swagger.ignore = true
  try {
    const options = {
      openapi: "3.0.0",
      disableLogs: true,
      writeOutputFile: false,
    };
    const outputFile = "/dev/null";
    const routes = ["./src/index.ts"];
    
    const result = await swaggerAutogen(options)(outputFile, routes, swaggerConfig);
    res.json(result ? result.data : null);
  } catch (error) {
    next(error);
  }
});


// OAuth2 관련
app.get("/oauth2/login/google", 
  // #swagger.tags = ['Auth']
  // #swagger.summary = 'Google OAuth 로그인'
  // #swagger.description = 'Google OAuth를 통한 로그인을 시작합니다.'
  // #swagger.responses[302] = { description: 'Google 로그인 페이지로 리다이렉트' }
  passport.authenticate("google")
);

app.get("/oauth2/callback/google", 
  // #swagger.tags = ['Auth']
  // #swagger.summary = 'Google OAuth 콜백'
  // #swagger.description = 'Google OAuth 인증 후 콜백을 처리합니다.'
  // #swagger.responses[302] = { description: '로그인 성공 시 홈으로, 실패 시 로그인 페이지로 리다이렉트' }
  passport.authenticate("google", {
    failureRedirect: "/oauth2/login/google",
    failureMessage: true,
  }), (req, res) => res.redirect("/")
);

app.get("/oauth2/login/kakao", 
  // #swagger.tags = ['Auth']
  // #swagger.summary = 'Kakao OAuth 로그인'
  // #swagger.description = 'Kakao OAuth를 통한 로그인을 시작합니다.'
  // #swagger.responses[302] = { description: 'Kakao 로그인 페이지로 리다이렉트' }
  passport.authenticate("kakao")
);

app.get("/oauth2/callback/kakao", 
  // #swagger.tags = ['Auth']
  // #swagger.summary = 'Kakao OAuth 콜백'
  // #swagger.description = 'Kakao OAuth 인증 후 콜백을 처리합니다.'
  // #swagger.responses[302] = { description: '로그인 성공 시 홈으로, 실패 시 로그인 페이지로 리다이렉트' }
  passport.authenticate("kakao", {
    failureRedirect: "/oauth2/login/kakao",
    failureMessage: true,
  }), (req, res) => res.redirect("/")
);

// API 라우트 등록
app.use('/api/users', userRoutes);

// 404 Not Found 핸들러 (모든 라우트 뒤에 위치)
app.use(notFoundHandler);

// 전역 에러 핸들러 (가장 마지막에 위치)
app.use(globalErrorHandler);

app.listen(port, () => {
  logger.info(`Example app listening on port ${port}`);
});