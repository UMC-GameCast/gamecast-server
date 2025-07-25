// Express Response 객체에 success, error 메서드 추가
declare global {
  namespace Express {
    interface Response {
      success(success: any): Response;
      error(error: {
        errorCode?: string;
        reason?: string | null;
        data?: any;
      }): Response;
    }
  }
}

export {};