declare global {
  interface BigInt {
    toJSON(): string;
  }
  
  namespace Express {
    interface Response {
      success<T>(data: T): Response;
      error(errorCode?: string, reason?: string | null, data?: any): Response;
      paginated<T>(data: T[], page: number, size: number, totalElements: number): Response;
    }
  }
}

export {};
