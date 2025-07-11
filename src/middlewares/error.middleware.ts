import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../errors/custom.errors.js';
import logger from '../logger.js';
import { createFailResponse } from '../utils/response.util.js';

/**
 * 전역 에러 핸들러 미들웨어
 */
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 이미 응답이 전송된 경우 다음 에러 핸들러로 전달
  if (res.headersSent) {
    return next(err);
  }

  // 로깅
  logger.error(`Error occurred: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // BaseError 인스턴스인 경우
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json(
      createFailResponse(err.errorCode, err.message, err.data)
    );
  }

  // Prisma 에러 처리
  if (err.name === 'PrismaClientKnownRequestError') {
    return handlePrismaError(err as any, res);
  }

  // 유효성 검사 에러 (예: Joi, express-validator 등)
  if (err.name === 'ValidationError') {
    return res.status(422).json(
      createFailResponse('VALIDATION_ERROR', err.message, null)
    );
  }

  // JWT 에러 처리
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      createFailResponse('INVALID_TOKEN', '유효하지 않은 토큰입니다.', null)
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      createFailResponse('EXPIRED_TOKEN', '토큰이 만료되었습니다.', null)
    );
  }

  // MongoDB 에러 처리 (필요한 경우)
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json(
      createFailResponse('DATABASE_ERROR', '데이터베이스 오류가 발생했습니다.', null)
    );
  }

  // 기본 500 에러
  res.status(500).json(
    createFailResponse(
      'INTERNAL_SERVER_ERROR',
      process.env.NODE_ENV === 'production' 
        ? '서버 내부 오류가 발생했습니다.' 
        : err.message,
      process.env.NODE_ENV === 'production' ? null : err.stack
    )
  );
};

/**
 * Prisma 에러 처리
 */
const handlePrismaError = (err: any, res: Response) => {
  switch (err.code) {
    case 'P2000':
      return res.status(400).json(
        createFailResponse('INVALID_INPUT', '입력 값이 너무 깁니다.', null)
      );
    case 'P2001':
      return res.status(404).json(
        createFailResponse('NOT_FOUND', '요청한 레코드를 찾을 수 없습니다.', null)
      );
    case 'P2002':
      return res.status(409).json(
        createFailResponse('DUPLICATE_ENTRY', '중복된 데이터입니다.', {
          fields: err.meta?.target
        })
      );
    case 'P2003':
      return res.status(400).json(
        createFailResponse('FOREIGN_KEY_CONSTRAINT', '외래 키 제약 조건 위반입니다.', null)
      );
    case 'P2025':
      return res.status(404).json(
        createFailResponse('RECORD_NOT_FOUND', '삭제하거나 업데이트할 레코드를 찾을 수 없습니다.', null)
      );
    default:
      return res.status(500).json(
        createFailResponse('DATABASE_ERROR', '데이터베이스 오류가 발생했습니다.', null)
      );
  }
};

/**
 * 404 Not Found 핸들러
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json(
    createFailResponse(
      'NOT_FOUND',
      `경로를 찾을 수 없습니다: ${req.method} ${req.path}`,
      null
    )
  );
};

/**
 * 비동기 함수의 에러를 자동으로 catch하는 래퍼 함수
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
