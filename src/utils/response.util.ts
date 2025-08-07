import { Response } from 'express';
import { BaseResponse, SuccessResponse, FailResponse, PaginatedResponse, PaginationInfo } from '../types/response.types.js';

/**
 * 성공 응답을 생성하는 헬퍼 함수
 */
export const createSuccessResponse = <T>(data: T): SuccessResponse<T> => {
  return {
    resultType: 'SUCCESS',
    error: null,
    success: data
  };
};

/**
 * 실패 응답을 생성하는 헬퍼 함수
 */
export const createFailResponse = (
  errorCode: string,
  reason: string | null = null,
  data: any = null
): FailResponse => {
  return {
    resultType: 'FAIL',
    error: {
      errorCode,
      reason,
      data
    },
    success: null
  };
};

/**
 * 페이지네이션 응답을 생성하는 헬퍼 함수
 */
export const createPaginatedResponse = <T>(
  data: T[],
  page: number,
  size: number,
  totalElements: number
): SuccessResponse<PaginatedResponse<T>> => {
  const totalPages = Math.ceil(totalElements / size);
  const hasNext = page < totalPages;
  const hasPrevious = page > 1;

  const paginationInfo: PaginationInfo = {
    page,
    size,
    totalElements,
    totalPages,
    hasNext,
    hasPrevious
  };

  return createSuccessResponse({
    data,
    pagination: paginationInfo
  });
};

/**
 * Express Response 객체에 응답 헬퍼 메서드를 추가하는 미들웨어
 */
declare global {
  namespace Express {
    interface Response {
      success<T>(data: T): Response;
      error(errorCode: string, reason?: string | null, data?: any): Response;
      paginated<T>(data: T[], page: number, size: number, totalElements: number): Response;
    }
  }
}

export const responseMiddleware = (req: any, res: Response, next: any) => {
  // 성공 응답 헬퍼
  res.success = function<T>(data: T) {
    return this.json(createSuccessResponse(data));
  };

  // 실패 응답 헬퍼 (오버로드 구현)
  res.error = function(
    errorCodeOrError?: string | { errorCode?: string; reason?: string | null; data?: any },
    reason?: string | null,
    data: any = null
  ) {
    if (typeof errorCodeOrError === 'string') {
      return this.json(createFailResponse(errorCodeOrError, reason, data));
    } else if (errorCodeOrError && typeof errorCodeOrError === 'object') {
      const { errorCode = "unknown", reason: errReason, data: errData } = errorCodeOrError;
      return this.json(createFailResponse(errorCode, errReason, errData));
    } else {
      return this.json(createFailResponse(String(errorCodeOrError || "unknown"), reason, data));
    }
  };

  // 페이지네이션 응답 헬퍼
  res.paginated = function<T>(data: T[], page: number, size: number, totalElements: number) {
    return this.json(createPaginatedResponse(data, page, size, totalElements));
  };

  next();
};
