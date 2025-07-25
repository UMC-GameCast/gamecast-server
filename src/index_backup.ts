import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
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
import { rateLimitMiddleware } from "./middlewares/rateLimit.middleware.js";

// GameCast 관련 import
import roomRoutes from "./routes/room.routes.js";
import { WebRTCService } from "./services/webrtc.service.js";
import { responseMiddleware } from "./utils/response.util.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { swaggerConfig } from "./config/swagger.config.js";

// 환경변수 로딩 - 개발 환경에서는 .env.dev 파일 사용
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.dev';
dotenv.config({ path: envFile });

// 필요한 환경변수 확인
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

// Passport Strategies 설정
// passport.use(localStrategy);
// passport.use(googleStrategy);
// passport.use(kakaoStrategy);
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

const port = process.env.PORT || 8888;
const app = express();

// HTTP 서버 생성 (WebRTC용)
const server = createServer(app);

// WebRTC 서비스 초기화
const webrtcService = new WebRTCService(server);

// 압축 미들웨어
app.use(compression({
  threshold: 512,
  level: 6,
  filter: (req, res) => {
    if (res.getHeader('Content-Type')) {
      const contentType = res.getHeader('Content-Type') as string;
      return !/(?:^|,)\s*(?:image\/|audio\/|video\/|application\/zip)/i.test(contentType);
    }
    return compression.filter(req, res);
  }
}));

// CORS 설정 (WebRTC를 위해 더 관대하게)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8888',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting 적용
app.use('/api', rateLimitMiddleware.general);

app.use(express.static("public"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
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
    secret: process.env.EXPRESS_SESSION_SECRET!,
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

// 응답 헬퍼 미들웨어 적용
app.use(responseMiddleware);

BigInt.prototype.toJSON = function() {
  return this.toString();
};


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

// GameCast API 라우트
app.use("/api/rooms", roomRoutes);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>GameCast WebRTC Test</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          background: #f5f5f5;
        }
        .container { 
          max-width: 800px; 
          margin: 0 auto; 
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section { 
          margin: 20px 0; 
          padding: 15px; 
          border: 1px solid #ddd; 
          border-radius: 5px; 
          background: #fafafa;
        }
        button { 
          padding: 10px 15px; 
          margin: 5px; 
          cursor: pointer; 
          background: #007bff;
          color: white;
          border: none;
          border-radius: 3px;
        }
        button:hover { background: #0056b3; }
        button:disabled { 
          background: #ccc; 
          cursor: not-allowed; 
        }
        input { 
          padding: 8px; 
          margin: 5px; 
          border: 1px solid #ddd;
          border-radius: 3px;
        }
        #status { 
          background: #e9ecef; 
          padding: 10px; 
          border-radius: 3px; 
          font-family: monospace;
          min-height: 100px;
          overflow-y: auto;
        }
        .audio-container { margin: 10px 0; }
        audio { width: 100%; max-width: 300px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .info { color: #17a2b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎮 GameCast WebRTC 테스트</h1>
        
        <div class="section">
          <h3>연결 상태</h3>
          <div id="status">대기 중...</div>
        </div>
        
        <div class="section">
          <h3>방 관리</h3>
          <div>
            <input type="text" id="roomName" placeholder="방 이름" value="테스트방" />
            <input type="text" id="hostNickname" placeholder="방장 닉네임" value="방장" />
            <button onclick="createRoom()">방 생성</button>
          </div>
          <div>
            <input type="text" id="roomCode" placeholder="방 코드 (예: ABC123)" />
            <input type="text" id="guestNickname" placeholder="게스트 닉네임" value="게스트" />
            <button onclick="joinRoom()">방 참여</button>
          </div>
          <button onclick="leaveRoom()" disabled id="leaveBtn">방 나가기</button>
        </div>
        
        <div class="section">
          <h3>오디오 컨트롤</h3>
          <button onclick="toggleMicrophone()" disabled id="micBtn">마이크 토글</button>
          <button onclick="updatePreparation()" disabled id="prepBtn">준비 완료</button>
        </div>
        
        <div class="section">
          <h3>녹화 컨트롤</h3>
          <button onclick="startRecording()" disabled id="recordBtn">녹화 시작</button>
          <button onclick="stopRecording()" disabled id="stopBtn">녹화 중지</button>
        </div>
        
        <div class="section">
          <h3>참여자 목록</h3>
          <div id="participants">참여자가 없습니다.</div>
        </div>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        class GameCastTestClient {
          constructor() {
            this.socket = io();
            this.currentRoom = null;
            this.isConnected = false;
            this.isMuted = false;
            this.isRecording = false;
            this.setupSocketEvents();
            this.log('소켓 연결 중...', 'info');
          }

          setupSocketEvents() {
            this.socket.on('connect', () => {
              this.log('✅ 소켓 연결됨: ' + this.socket.id, 'success');
              this.isConnected = true;
            });

            this.socket.on('disconnect', () => {
              this.log('❌ 소켓 연결 끊어짐', 'error');
              this.isConnected = false;
              this.updateButtons();
            });

            this.socket.on('joined-room-success', (data) => {
              this.log('🎉 방 참여 성공: ' + data.roomCode, 'success');
              this.currentRoom = data.roomCode;
              this.updateParticipants(data.users);
              this.updateButtons();
            });

            this.socket.on('user-joined', (data) => {
              this.log('👋 ' + data.nickname + '님이 입장했습니다', 'info');
              this.addParticipant(data);
            });

            this.socket.on('user-left', (data) => {
              this.log('👋 ' + data.nickname + '님이 퇴장했습니다', 'info');
              this.removeParticipant(data);
            });

            this.socket.on('join-room-error', (error) => {
              this.log('❌ 방 참여 오류: ' + error.message, 'error');
            });

            this.socket.on('recording-started', (data) => {
              this.log('🔴 녹화 시작: ' + data.startedBy + '님이 시작', 'success');
              this.isRecording = true;
              this.updateButtons();
            });

            this.socket.on('recording-stopped', () => {
              this.log('⏹️ 녹화 종료', 'info');
              this.isRecording = false;
              this.updateButtons();
            });

            this.socket.on('preparation-status-updated', (data) => {
              this.log('✅ ' + data.nickname + '님 준비 완료', 'info');
            });

            this.socket.on('offer', (data) => {
              this.log('📞 Offer 수신: ' + data.fromNickname, 'info');
            });

            this.socket.on('answer', (data) => {
              this.log('📞 Answer 수신: ' + data.fromNickname, 'info');
            });

            this.socket.on('ice-candidate', () => {
              this.log('🧊 ICE Candidate 수신', 'info');
            });
          }

          log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const statusDiv = document.getElementById('status');
            const className = type;
            statusDiv.innerHTML += \`<div class="\${className}">[\${timestamp}] \${message}</div>\`;
            statusDiv.scrollTop = statusDiv.scrollHeight;
          }

          async createRoom() {
            const roomName = document.getElementById('roomName').value;
            const nickname = document.getElementById('hostNickname').value;
            
            if (!roomName || !nickname) {
              this.log('❌ 방 이름과 닉네임을 입력하세요', 'error');
              return;
            }

            try {
              const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  room_name: roomName,
                  max_capacity: 5,
                  host_session_id: 'test_session_' + Date.now(),
                  host_nickname: nickname
                })
              });

              const data = await response.json();
              
              if (data.resultType === 'SUCCESS') {
                const roomCode = data.success.roomCode;
                document.getElementById('roomCode').value = roomCode;
                this.log('🏠 방 생성 성공: ' + roomCode, 'success');
                
                // 생성한 방에 자동 참여
                setTimeout(() => {
                  document.getElementById('guestNickname').value = nickname;
                  this.joinRoom();
                }, 500);
              } else {
                this.log('❌ 방 생성 실패: ' + data.error.reason, 'error');
              }
            } catch (error) {
              this.log('❌ 방 생성 오류: ' + error.message, 'error');
            }
          }

          joinRoom() {
            const roomCode = document.getElementById('roomCode').value.toUpperCase();
            const nickname = document.getElementById('guestNickname').value;
            
            if (!roomCode || !nickname) {
              this.log('❌ 방 코드와 닉네임을 입력하세요', 'error');
              return;
            }

            this.socket.emit('join-room', {
              roomCode,
              guestUserId: 'test_user_' + Date.now(),
              nickname
            });
          }

          leaveRoom() {
            if (this.currentRoom) {
              this.socket.emit('leave-room');
              this.currentRoom = null;
              this.updateButtons();
              this.updateParticipants([]);
              this.log('👋 방에서 나갔습니다', 'info');
            }
          }

          startRecording() {
            if (this.currentRoom) {
              this.socket.emit('start-recording', {
                roomCode: this.currentRoom
              });
            }
          }

          stopRecording() {
            if (this.currentRoom) {
              this.socket.emit('stop-recording', {
                roomCode: this.currentRoom
              });
            }
          }

          toggleMicrophone() {
            this.isMuted = !this.isMuted;
            this.log('🎤 마이크 ' + (this.isMuted ? '음소거' : '활성화'), 'info');
            this.updateButtons();
          }

          updatePreparation() {
            if (this.currentRoom) {
              this.socket.emit('update-preparation-status', {
                characterSetup: true,
                screenSetup: true
              });
            }
          }

          updateParticipants(users) {
            const container = document.getElementById('participants');
            if (users.length === 0) {
              container.innerHTML = '참여자가 없습니다.';
            } else {
              container.innerHTML = users.map(user => 
                \`<div>👤 \${user.nickname} (\${user.isHost ? '방장' : '게스트'})</div>\`
              ).join('');
            }
          }

          addParticipant(user) {
            const container = document.getElementById('participants');
            const div = document.createElement('div');
            div.innerHTML = \`👤 \${user.nickname} (게스트)\`;
            container.appendChild(div);
          }

          removeParticipant(user) {
            // 실제로는 전체 참여자 목록을 다시 받아서 업데이트하는 것이 좋음
          }

          updateButtons() {
            const inRoom = !!this.currentRoom;
            
            document.getElementById('leaveBtn').disabled = !inRoom;
            document.getElementById('micBtn').disabled = !inRoom;
            document.getElementById('prepBtn').disabled = !inRoom;
            document.getElementById('recordBtn').disabled = !inRoom || this.isRecording;
            document.getElementById('stopBtn').disabled = !inRoom || !this.isRecording;
            
            if (inRoom) {
              document.getElementById('micBtn').textContent = 
                this.isMuted ? '마이크 켜기' : '마이크 끄기';
            }
          }
        }

        const client = new GameCastTestClient();

        // 전역 함수들
        function createRoom() { client.createRoom(); }
        function joinRoom() { client.joinRoom(); }
        function leaveRoom() { client.leaveRoom(); }
        function startRecording() { client.startRecording(); }
        function stopRecording() { client.stopRecording(); }
        function toggleMicrophone() { client.toggleMicrophone(); }
        function updatePreparation() { client.updatePreparation(); }
      </script>
    </body>
    </html>
  `);
});

// 헬스체크 엔드포인트
app.get("/health", (req, res) => {
  res.json({
    resultType: "SUCCESS",
    error: null,
    success: {
      message: "GameCast API Server is healthy",
      timestamp: new Date().toISOString(),
      services: {
        api: "healthy",
        webrtc: "healthy",
        database: "healthy"
      }
    }
  });
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
      title: "GameCast API",
      description: "게스트 기반 실시간 게임 녹화/편집 플랫폼 API",
      version: "1.0.0"
    },
    host: `localhost:${port}`,
    tags: [
      {
        name: "Rooms",
        description: "방 관련 API"
      }
    ]
  };

  const result = await swaggerAutogen(options)(outputFile, routes, doc);
  res.json(result ? result.data : null);
});

// OAuth2 관련 (기존 유지)
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

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).error({
    errorCode: 'NOT_FOUND',
    reason: 'API 엔드포인트를 찾을 수 없습니다.',
    data: {
      availableEndpoints: [
        'GET /',
        'GET /health',
        'GET /test-webrtc',
        'GET /docs',
        'POST /api/rooms',
        'GET /api/rooms/:roomCode',
        'POST /api/rooms/join',
        'POST /api/rooms/leave',
        'PUT /api/rooms/preparation',
        'DELETE /api/rooms/cleanup'
      ]
    }
  });
});

// 서버 시작 (HTTP 서버 사용)
server.listen(port, () => {
  logger.info(`
🚀 GameCast API 서버가 시작되었습니다!
📍 포트: ${port}
🌍 환경: ${process.env.NODE_ENV || 'development'}
🔗 API: http://localhost:${port}/api/rooms
📚 문서: http://localhost:${port}/docs
🎮 WebRTC 테스트: http://localhost:${port}/test-webrtc
💊 헬스체크: http://localhost:${port}/health
  `);
});