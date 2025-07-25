/**
 * 공통 예외 처리를 위한 커스텀 에러 클래스들
 */

export class BaseError extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;
  public readonly data: any;

  constructor(
    errorCode: string,
    message: string,
    statusCode: number = 500,
    data: any = null
  ) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.data = data;

    // Error 클래스를 상속할 때 필요한 설정
    Object.setPrototypeOf(this, BaseError.prototype);
  }
}

/**
 * 400 Bad Request 에러
 */
export class BadRequestError extends BaseError {
  constructor(message: string = "잘못된 요청입니다.", data: any = null) {
    super("BAD_REQUEST", message, 400, data);
  }
}

/**
 * 401 Unauthorized 에러
 */
export class UnauthorizedError extends BaseError {
  constructor(message: string = "인증이 필요합니다.", data: any = null) {
    super("UNAUTHORIZED", message, 401, data);
  }
}

/**
 * 403 Forbidden 에러
 */
export class ForbiddenError extends BaseError {
  constructor(message: string = "접근 권한이 없습니다.", data: any = null) {
    super("FORBIDDEN", message, 403, data);
  }
}

/**
 * 404 Not Found 에러
 */
export class NotFoundError extends BaseError {
  constructor(message: string = "요청한 리소스를 찾을 수 없습니다.", data: any = null) {
    super("NOT_FOUND", message, 404, data);
  }
}

/**
 * 409 Conflict 에러
 */
export class ConflictError extends BaseError {
  constructor(message: string = "리소스 충돌이 발생했습니다.", data: any = null) {
    super("CONFLICT", message, 409, data);
  }
}

/**
 * 422 Unprocessable Entity 에러 (유효성 검사 실패)
 */
export class ValidationError extends BaseError {
  constructor(message: string = "유효성 검사에 실패했습니다.", data: any = null) {
    super("VALIDATION_ERROR", message, 422, data);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends BaseError {
  constructor(message: string = "서버 내부 오류가 발생했습니다.", data: any = null) {
    super("INTERNAL_SERVER_ERROR", message, 500, data);
  }
}

/**
 * 데이터베이스 관련 에러
 */
export class DatabaseError extends BaseError {
  constructor(message: string = "데이터베이스 오류가 발생했습니다.", data: any = null) {
    super("DATABASE_ERROR", message, 500, data);
  }
}

/**
 * 인증 관련 에러
 */
export class AuthenticationError extends BaseError {
  constructor(message: string = "인증에 실패했습니다.", data: any = null) {
    super("AUTHENTICATION_ERROR", message, 401, data);
  }
}

/**
 * 외부 API 호출 에러
 */
export class ExternalAPIError extends BaseError {
  constructor(message: string = "외부 API 호출에 실패했습니다.", data: any = null) {
    super("EXTERNAL_API_ERROR", message, 502, data);
  }
}
