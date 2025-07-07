import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import logger, { stream } from "./logger.js";
import compression from "compression";
import swaggerAutogen from "swagger-autogen";
import swaggerUiExpress from "swagger-ui-express";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import session from "express-session";
import passport from "passport";
import { googleStrategy, kakaoStrategy, localStrategy } from "./auth/auth.config.js";
import { prisma } from "./db.config.js";
import { requireAuth } from "./utils/Auth.util.js";

dotenv.config();

// Passport Strategies 설정
passport.use(localStrategy);   // Local Strategy 추가
passport.use(googleStrategy);
passport.use(kakaoStrategy);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const port = process.env.PORT;
const app = express();

// 기존 미들웨어 설정...
app.use(compression({
  threshold: 512,
  level: 6,
  filter: (req, res) => {
    if (res.getHeader('Content-Type')) {
      const contentType = res.getHeader('Content-Type');
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
    secret: process.env.EXPRESS_SESSION_SECRET,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

BigInt.prototype.toJSON = function() {
  return this.toString();
};

app.use((req, res, next) => {
  res.success = (success) => {
    return res.json({ resultType: "SUCCESS", error: null, success });
  };

  res.error = ({ errorCode = "unknown", reason = null, data = null }) => {
    return res.json({
      resultType: "FAIL",
      error: { errorCode, reason, data },
      success: null,
    });
  };

  next();
});

app.get("/", (req, res) => {
  console.log(req.user);
  res.send("Hello World!");
});

app.get("/openapi.json", async (req, res, next) => {
  // #swagger.ignore = true
  const options = {
    openapi: "3.0.0",
    disableLogs: true,
    writeOutputFile: false,
  };
  const outputFile = "/dev/null";
  const routes = ["./src/index.js"];
  const doc = {
    info: {
      title: "UMC 7th",
      description: "UMC 7th Node.js 테스트 프로젝트입니다.",
    },
    host: "localhost:8888",
  };

  const result = await swaggerAutogen(options)(outputFile, routes, doc);
  res.json(result ? result.data : null);
});


// OAuth2 관련
app.get("/oauth2/login/google", passport.authenticate("google"));
app.get("/oauth2/callback/google", passport.authenticate("google", {
  failureRedirect: "/oauth2/login/google",
  failureMessage: true,
}), (req, res) => res.redirect("/"));

app.get("/oauth2/login/kakao", passport.authenticate("kakao"));
app.get("/oauth2/callback/kakao", passport.authenticate("kakao", {
  failureRedirect: "/oauth2/login/kakao",
  failureMessage: true,
}), (req, res) => res.redirect("/"));

/**
 * 전역 오류를 처리하기 위한 미들웨어
 */
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.log(err);
  res.status(err.statusCode || 500).error({
    errorCode: err.errorCode || "unknown",
    reason: err.reason || err.message || null,
    data: err.data || null,
  });
});

app.listen(port, () => {
  logger.info(`Example app listening on port ${port}`);
});