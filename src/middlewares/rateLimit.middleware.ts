import rateLimit from 'express-rate-limit';

// 일반 API 요청 제한
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1분
  max: 100, // 분당 최대 100개 요청
  message: {
    resultType: 'FAIL',
    error: {
      errorCode: 'RATE_LIMIT_EXCEEDED',
      reason: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
      data: null
    },
    success: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 방 생성 API 특별 제한
const roomCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 10, // 5분당 최대 10개 방 생성
  message: {
    resultType: 'FAIL',
    error: {
      errorCode: 'ROOM_CREATION_LIMIT_EXCEEDED',
      reason: '방 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      data: null
    },
    success: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const rateLimitMiddleware = {
  general: generalLimiter,
  roomCreation: roomCreationLimiter
};