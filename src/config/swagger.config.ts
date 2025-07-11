/**
 * Swagger 설정 파일
 */

export const swaggerConfig = {
  info: {
    title: "GameCast Server API",
    version: "1.0.0",
    description: "GameCast 서버 API 문서입니다.",
    contact: {
      name: "GameCast Team",
      email: "contact@gamecast.com"
    }
  },
  host: process.env.NODE_ENV === 'production' 
    ? "api.gamecast.com" 
    : "localhost:8888",
  schemes: process.env.NODE_ENV === 'production' 
    ? ["https"] 
    : ["http"],
  securityDefinitions: {
    bearerAuth: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
      description: "Bearer token을 입력하세요. 예: Bearer {token}"
    },
    sessionAuth: {
      type: "apiKey",
      name: "connect.sid",
      in: "cookie",
      description: "세션 기반 인증"
    }
  },
  definitions: {
    SuccessResponse: {
      type: "object",
      properties: {
        resultType: {
          type: "string",
          enum: ["SUCCESS"],
          example: "SUCCESS"
        },
        error: {
          type: "null",
          example: null
        },
        success: {
          type: "object",
          description: "성공 시 반환되는 데이터"
        }
      }
    },
    FailResponse: {
      type: "object",
      properties: {
        resultType: {
          type: "string",
          enum: ["FAIL"],
          example: "FAIL"
        },
        error: {
          type: "object",
          properties: {
            errorCode: {
              type: "string",
              example: "BAD_REQUEST"
            },
            reason: {
              type: "string",
              example: "잘못된 요청입니다."
            },
            data: {
              type: "object",
              nullable: true,
              example: null
            }
          }
        },
        success: {
          type: "null",
          example: null
        }
      }
    },
    PaginatedResponse: {
      type: "object",
      properties: {
        resultType: {
          type: "string",
          enum: ["SUCCESS"],
          example: "SUCCESS"
        },
        error: {
          type: "null",
          example: null
        },
        success: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: {
                type: "object"
              }
            },
            pagination: {
              type: "object",
              properties: {
                page: {
                  type: "integer",
                  example: 1
                },
                size: {
                  type: "integer",
                  example: 10
                },
                totalElements: {
                  type: "integer",
                  example: 100
                },
                totalPages: {
                  type: "integer",
                  example: 10
                },
                hasNext: {
                  type: "boolean",
                  example: true
                },
                hasPrevious: {
                  type: "boolean",
                  example: false
                }
              }
            }
          }
        }
      }
    },
    User: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          example: 1
        },
        email: {
          type: "string",
          example: "user@example.com"
        },
        name: {
          type: "string",
          example: "홍길동"
        },
        createdAt: {
          type: "string",
          format: "date-time",
          example: "2023-01-01T00:00:00.000Z"
        },
        updatedAt: {
          type: "string",
          format: "date-time",
          example: "2023-01-01T00:00:00.000Z"
        }
      }
    }
  },
  tags: [
    {
      name: "Auth",
      description: "인증 관련 API"
    },
    {
      name: "User",
      description: "사용자 관련 API"
    },
    {
      name: "Game",
      description: "게임 관련 API"
    }
  ]
};
