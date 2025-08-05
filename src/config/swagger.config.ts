/**
 * Swagger 설정 파일
 */

const swaggerConfig = {
  openapi: "3.0.0",
  info: {
    title: "GameCast Server API",
    version: "1.0.0",
    description: `
# GameCast API Documentation

GameCast 실시간 게임 스트리밍 플랫폼의 백엔드 API 문서입니다.

## 주요 기능
- 게임 방 생성 및 관리
- 실시간 참여자 관리
- WebRTC 기반 스트리밍 지원

## 응답 형식
모든 API는 다음과 같은 표준 응답 형식을 사용합니다:

### 성공 응답
\`\`\`json
{
  "resultType": "SUCCESS",
  "error": null,
  "success": { ... }
}
\`\`\`

### 실패 응답
\`\`\`json
{
  "resultType": "FAIL",
  "error": {
    "errorCode": "ERROR_CODE",
    "reason": "에러 메시지",
    "data": null
  },
  "success": null
}
\`\`\`
    `,
    contact: {
      name: "GameCast Team",
      email: "contact@gamecast.com"
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    }
  },
  servers: [
    {
      url: "http://3.37.34.211:8889", 
      description: "AWS production server"
    },
    {
      url: "http://localhost:8889", 
      description: "Local development server"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Bearer token을 입력하세요. 예: Bearer {token}"
      },
      sessionAuth: {
        type: "apiKey",
        name: "connect.sid",
        in: "cookie",
        description: "세션 기반 인증"
      }
    },
    schemas: {
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
      Room: {
        type: "object",
        properties: {
          roomId: {
            type: "string",
            format: "uuid",
            example: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
          },
          roomCode: {
            type: "string",
            example: "QN5IFN"
          },
          roomName: {
            type: "string",
            example: "테스트 방"
          },
          maxCapacity: {
            type: "integer",
            example: 4
          },
          currentCapacity: {
            type: "integer",
            example: 1
          },
          roomState: {
            type: "string",
            enum: ["waiting", "playing", "completed", "expired"],
            example: "waiting"
          },
          hostGuestId: {
            type: "string",
            format: "uuid",
            example: "e7b5ae58-3e99-40cc-96ad-cebd3881e357"
          },
          expiresAt: {
            type: "string",
            format: "date-time",
            example: "2025-07-25T17:26:56.260Z"
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2025-07-25T05:26:56.262Z"
          }
        }
      },
      CreateRoomRequest: {
        type: "object",
        required: ["roomName", "hostNickname"],
        properties: {
          roomName: {
            type: "string",
            example: "테스트 방",
            description: "방 이름 (최대 100자)"
          },
          maxCapacity: {
            type: "integer",
            minimum: 2,
            maximum: 5,
            example: 4,
            description: "최대 참여자 수 (2-5명)"
          },
          hostSessionId: {
            type: "string",
            example: "test_session_123",
            description: "방장의 세션 ID (선택사항, 자동 생성됨)"
          },
          hostNickname: {
            type: "string",
            example: "테스트 호스트",
            description: "방장 닉네임 (최대 50자)"
          },
          roomSettings: {
            type: "object",
            description: "방 설정 (선택사항)",
            example: {}
          }
        }
      },
      RoomParticipant: {
        type: "object",
        properties: {
          guestUserId: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440001"
          },
          nickname: {
            type: "string",
            example: "참여자1"
          },
          role: {
            type: "string",
            enum: ["host", "guest"],
            example: "host"
          },
          joined_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-25T05:26:56.262Z"
          },
          preparation_status: {
            type: "object",
            properties: {
              characterSetup: {
                type: "object",
                properties: {
                  selectedOptions: {
                    type: "object",
                    properties: {
                      face: { type: "string", example: "face2" },
                      hair: { type: "string", example: "hair1" },
                      top: { type: "string", example: "top2" },
                      bottom: { type: "string", example: "bottom3" },
                      accessory: { type: "string", example: "accessories1" }
                    }
                  },
                  selectedColors: {
                    type: "object",
                    properties: {
                      face: { type: "string", example: "beige" },
                      hair: { type: "string", example: "red" },
                      top: { type: "string", example: "green" },
                      bottom: { type: "string", example: "blue" },
                      accessory: { type: "string", example: "yellow" }
                    }
                  }
                }
              },
              screenSetup: {
                type: "boolean",
                example: false
              }
            }
          }
        }
      },
      RoomWithParticipants: {
        type: "object",
        properties: {
          room_id: {
            type: "string",
            format: "uuid",
            example: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
          },
          room_code: {
            type: "string",
            example: "QN5IFN"
          },
          room_name: {
            type: "string",
            example: "테스트 방"
          },
          max_capacity: {
            type: "integer",
            example: 4
          },
          current_capacity: {
            type: "integer",
            example: 2
          },
          room_state: {
            type: "string",
            enum: ["waiting", "playing", "completed", "expired"],
            example: "waiting"
          },
          host_nickname: {
            type: "string",
            example: "게임마스터"
          },
          created_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-25T05:26:56.262Z"
          },
          expires_at: {
            type: "string",
            format: "date-time",
            example: "2025-07-25T17:26:56.260Z"
          },
          room_settings: {
            type: "object",
            example: {}
          },
          participants: {
            type: "array",
            items: {
              $ref: "#/components/schemas/RoomParticipant"
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: "Rooms",
      description: "방 관리 API"
    },
    {
      name: "WebRTC", 
      description: "WebRTC 관련 API"
    },
    {
      name: "Auth",
      description: "인증 관련 API"
    }
  ]
};

export { swaggerConfig };
export default swaggerConfig;
