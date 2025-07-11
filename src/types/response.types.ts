/**
 * 공통 응답 형식 타입 정의
 */
export interface BaseResponse<T = any> {
  resultType: 'SUCCESS' | 'FAIL';
  error: ErrorInfo | null;
  success: T | null;
}

export interface ErrorInfo {
  errorCode: string;
  reason: string | null;
  data: any;
}

export interface SuccessResponse<T> extends BaseResponse<T> {
  resultType: 'SUCCESS';
  error: null;
  success: T;
}

export interface FailResponse extends BaseResponse<null> {
  resultType: 'FAIL';
  error: ErrorInfo;
  success: null;
}

/**
 * 페이지네이션을 위한 타입
 */
export interface PaginationInfo {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}
