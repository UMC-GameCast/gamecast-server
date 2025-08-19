// /**
//  * Swagger 설정 파일
//  */

// const swaggerConfig = {
//   openapi: "3.0.0",
//   info: {
//     title: "GameCast Server API",
//     version: "1.0.0",
//     description: `
// # GameCast API Documentation

// GameCast 실시간 게임 스트리밍 플랫폼의 백엔드 API 문서입니다.

// ## 주요 기능
// - 게임 방 생성 및 관리
// - 실시간 참여자 관리
// - WebRTC 기반 스트리밍 지원

// ## 응답 형식
// 모든 API는 다음과 같은 표준 응답 형식을 사용합니다:

// ### 성공 응답
// \`\`\`json
// {
//   "resultType": "SUCCESS",
//   "error": null,
//   "success": { ... }
// }
// \`\`\`

// ### 실패 응답
// \`\`\`json
// {
//   "resultType": "FAIL",
//   "error": {
//     "errorCode": "ERROR_CODE",
//     "reason": "에러 메시지",
//     "data": null
//   },
//   "success": null
// }
// \`\`\`
//     `,
//     contact: {
//       name: "GameCast Team",
//       email: "contact@gamecast.com"
//     },
//     license: {
//       name: "MIT",
//       url: "https://opensource.org/licenses/MIT"
//     }
//   },
//   servers: [
//     {
//       url: "http://3.37.34.211:8889", 
//       description: "AWS production server"
//     },
//     {
//       url: "http://localhost:8889", 
//       description: "Local development server"
//     }
//   ],
//   components: {
//     securitySchemes: {
//       bearerAuth: {
//         type: "http",
//         scheme: "bearer",
//         bearerFormat: "JWT",
//         description: "Bearer token을 입력하세요. 예: Bearer {token}"
//       },
//       sessionAuth: {
//         type: "apiKey",
//         name: "connect.sid",
//         in: "cookie",
//         description: "세션 기반 인증"
//       }
//     },
//     schemas: {
//       SuccessResponse: {
//         type: "object",
//         properties: {
//           resultType: {
//             type: "string",
//             enum: ["SUCCESS"],
//             example: "SUCCESS"
//           },
//           error: {
//             type: "null",
//             example: null
//           },
//           success: {
//             type: "object",
//             description: "성공 시 반환되는 데이터"
//           }
//         }
//       },
//       FailResponse: {
//         type: "object",
//         properties: {
//           resultType: {
//             type: "string",
//             enum: ["FAIL"],
//             example: "FAIL"
//           },
//           error: {
//             type: "object",
//             properties: {
//               errorCode: {
//                 type: "string",
//                 example: "BAD_REQUEST"
//               },
//               reason: {
//                 type: "string",
//                 example: "잘못된 요청입니다."
//               },
//               data: {
//                 type: "object",
//                 nullable: true,
//                 example: null
//               }
//             }
//           },
//           success: {
//             type: "null",
//             example: null
//           }
//         }
//       },
//       Room: {
//         type: "object",
//         properties: {
//           roomId: {
//             type: "string",
//             format: "uuid",
//             example: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
//           },
//           roomCode: {
//             type: "string",
//             example: "QN5IFN"
//           },
//           roomName: {
//             type: "string",
//             example: "테스트 방"
//           },
//           maxCapacity: {
//             type: "integer",
//             example: 4
//           },
//           currentCapacity: {
//             type: "integer",
//             example: 1
//           },
//           roomState: {
//             type: "string",
//             enum: ["waiting", "playing", "completed", "expired"],
//             example: "waiting"
//           },
//           hostGuestId: {
//             type: "string",
//             format: "uuid",
//             example: "e7b5ae58-3e99-40cc-96ad-cebd3881e357"
//           },
//           expiresAt: {
//             type: "string",
//             format: "date-time",
//             example: "2025-07-25T17:26:56.260Z"
//           },
//           createdAt: {
//             type: "string",
//             format: "date-time",
//             example: "2025-07-25T05:26:56.262Z"
//           }
//         }
//       },
//       CreateRoomRequest: {
//         type: "object",
//         required: ["roomName", "hostNickname"],
//         properties: {
//           roomName: {
//             type: "string",
//             example: "테스트 방",
//             description: "방 이름 (최대 100자)"
//           },
//           maxCapacity: {
//             type: "integer",
//             minimum: 2,
//             maximum: 5,
//             example: 4,
//             description: "최대 참여자 수 (2-5명)"
//           },
//           hostSessionId: {
//             type: "string",
//             example: "test_session_123",
//             description: "방장의 세션 ID (선택사항, 자동 생성됨)"
//           },
//           hostNickname: {
//             type: "string",
//             example: "테스트 호스트",
//             description: "방장 닉네임 (최대 50자)"
//           },
//           roomSettings: {
//             type: "object",
//             description: "방 설정 (선택사항)",
//             example: {}
//           }
//         }
//       },
//       // WebRTC Socket.IO 이벤트 스키마들
//       SocketJoinRoomData: {
//         type: "object",
//         required: ["roomCode", "guestUserId", "nickname"],
//         properties: {
//           roomCode: {
//             type: "string",
//             example: "ABC123",
//             description: "6자리 방 코드"
//           },
//           guestUserId: {
//             type: "string",
//             format: "uuid",
//             example: "550e8400-e29b-41d4-a716-446655440001",
//             description: "참여자 UUID"
//           },
//           nickname: {
//             type: "string",
//             example: "플레이어1",
//             description: "참여자 닉네임"
//           }
//         }
//       },
//       SocketWebRTCSignalData: {
//         type: "object",
//         required: ["targetSocketId"],
//         properties: {
//           targetSocketId: {
//             type: "string",
//             example: "socket_id_123",
//             description: "대상 소켓 ID"
//           },
//           offer: {
//             type: "object",
//             description: "WebRTC Offer (RTCSessionDescription)"
//           },
//           answer: {
//             type: "object", 
//             description: "WebRTC Answer (RTCSessionDescription)"
//           },
//           candidate: {
//             type: "object",
//             description: "ICE Candidate (RTCIceCandidate)"
//           }
//         }
//       },
//       SocketPreparationStatusData: {
//         type: "object",
//         required: ["characterSetup", "screenSetup"],
//         properties: {
//           characterSetup: {
//             type: "boolean",
//             example: true,
//             description: "캐릭터 설정 완료 여부"
//           },
//           screenSetup: {
//             type: "boolean", 
//             example: false,
//             description: "화면 설정 완료 여부"
//           }
//         }
//       },
//       SocketCharacterStatusData: {
//         type: "object",
//         required: ["selectedOptions", "selectedColors"],
//         properties: {
//           selectedOptions: {
//             type: "object",
//             properties: {
//               face: {
//                 type: "string",
//                 example: "face2",
//                 description: "선택된 얼굴 옵션"
//               },
//               hair: {
//                 type: "string", 
//                 example: "hair1",
//                 description: "선택된 머리 옵션"
//               },
//               top: {
//                 type: "string",
//                 example: "top2", 
//                 description: "선택된 상의 옵션"
//               },
//               bottom: {
//                 type: "string",
//                 example: "bottom3",
//                 description: "선택된 하의 옵션"
//               },
//               accessory: {
//                 type: "string",
//                 example: "accessories1",
//                 description: "선택된 액세서리 옵션"
//               }
//             }
//           },
//           selectedColors: {
//             type: "object",
//             properties: {
//               face: {
//                 type: "string",
//                 example: "beige",
//                 description: "얼굴 색상"
//               },
//               hair: {
//                 type: "string",
//                 example: "red", 
//                 description: "머리 색상"
//               },
//               top: {
//                 type: "string",
//                 example: "green",
//                 description: "상의 색상"
//               },
//               bottom: {
//                 type: "string",
//                 example: "blue",
//                 description: "하의 색상"
//               },
//               accessory: {
//                 type: "string",
//                 example: "yellow",
//                 description: "액세서리 색상"
//               }
//             }
//           }
//         }
//       },
//       SocketAudioQualityData: {
//         type: "object",
//         required: ["latency", "packetLoss", "audioLevel"],
//         properties: {
//           latency: {
//             type: "number",
//             example: 50,
//             description: "지연시간 (ms)"
//           },
//           packetLoss: {
//             type: "number",
//             example: 0.1,
//             description: "패킷 손실률 (0-1)"
//           },
//           audioLevel: {
//             type: "number",
//             example: 0.8,
//             description: "음성 레벨 (0-1)"
//           }
//         }
//       },
//       SocketChatMessageData: {
//         type: "object",
//         required: ["roomCode", "message", "timestamp"],
//         properties: {
//           roomCode: {
//             type: "string",
//             example: "ABC123",
//             description: "방 코드"
//           },
//           message: {
//             type: "string",
//             example: "안녕하세요!",
//             description: "채팅 메시지"
//           },
//           timestamp: {
//             type: "string",
//             format: "date-time",
//             example: "2025-08-05T10:30:00.000Z",
//             description: "메시지 전송 시간"
//           }
//         }
//       },
//       SocketRecordingData: {
//         type: "object",
//         required: ["roomCode"],
//         properties: {
//           roomCode: {
//             type: "string",
//             example: "ABC123",
//             description: "방 코드"
//           },
//           sessionId: {
//             type: "string",
//             example: "rec_session_123",
//             description: "녹화 세션 ID (선택사항)"
//           }
//         }
//       },
//       SocketRoomUser: {
//         type: "object",
//         properties: {
//           socketId: {
//             type: "string",
//             example: "socket_123",
//             description: "소켓 ID"
//           },
//           guestUserId: {
//             type: "string",
//             format: "uuid",
//             example: "550e8400-e29b-41d4-a716-446655440001",
//             description: "참여자 UUID"
//           },
//           nickname: {
//             type: "string",
//             example: "플레이어1",
//             description: "참여자 닉네임"
//           },
//           isHost: {
//             type: "boolean",
//             example: false,
//             description: "방장 여부"
//           },
//           joinedAt: {
//             type: "string",
//             format: "date-time",
//             example: "2025-08-05T10:30:00.000Z",
//             description: "참여 시간"
//           }
//         }
//       },
//       SocketRecordingStartedData: {
//         type: "object",
//         properties: {
//           sessionId: {
//             type: "string",
//             example: "rec_session_123",
//             description: "녹화 세션 ID"
//           },
//           startedBy: {
//             type: "string",
//             example: "플레이어1",
//             description: "녹화 시작자 (SYSTEM인 경우 자동 시작)"
//           },
//           autoStarted: {
//             type: "boolean",
//             example: true,
//             description: "자동 시작 여부"
//           },
//           timestamp: {
//             type: "string",
//             format: "date-time",
//             example: "2025-08-05T10:30:00.000Z",
//             description: "녹화 시작 시간"
//           }
//         }
//       },
//       SocketRecordingStoppedData: {
//         type: "object",
//         properties: {
//           sessionId: {
//             type: "string",
//             example: "rec_session_123",
//             description: "녹화 세션 ID"
//           },
//           stoppedBy: {
//             type: "string",
//             example: "방장닉네임",
//             description: "녹화 중단자"
//           },
//           stoppedByHost: {
//             type: "boolean",
//             example: true,
//             description: "방장에 의한 중단 여부"
//           },
//           timestamp: {
//             type: "string",
//             format: "date-time",
//             example: "2025-08-05T10:30:00.000Z",
//             description: "녹화 중단 시간"
//           }
//         }
//       },
//       SocketCountdownData: {
//         type: "object",
//         properties: {
//           countdown: {
//             type: "integer",
//             example: 3,
//             description: "카운트다운 시간"
//           },
//           count: {
//             type: "integer",
//             example: 2,
//             description: "현재 카운트"
//           },
//           message: {
//             type: "string",
//             example: "모든 참여자가 준비되었습니다! 녹화가 곧 시작됩니다.",
//             description: "카운트다운 메시지"
//           },
//           timestamp: {
//             type: "string",
//             format: "date-time",
//             example: "2025-08-05T10:30:00.000Z",
//             description: "이벤트 시간"
//           }
//         }
//       },
//       SocketErrorData: {
//         type: "object",
//         properties: {
//           message: {
//             type: "string",
//             example: "녹화 중단은 방장만 할 수 있습니다.",
//             description: "오류 메시지"
//           },
//           code: {
//             type: "string",
//             example: "INSUFFICIENT_PERMISSION",
//             description: "오류 코드"
//           }
//         }
//       },
//       RoomParticipant: {
//         type: "object",
//         properties: {
//           guestUserId: {
//             type: "string",
//             format: "uuid",
//             example: "550e8400-e29b-41d4-a716-446655440001"
//           },
//           nickname: {
//             type: "string",
//             example: "참여자1"
//           },
//           role: {
//             type: "string",
//             enum: ["host", "guest"],
//             example: "host"
//           },
//           joined_at: {
//             type: "string",
//             format: "date-time",
//             example: "2025-07-25T05:26:56.262Z"
//           },
//           preparation_status: {
//             type: "object",
//             properties: {
//               characterSetup: {
//                 type: "object",
//                 properties: {
//                   selectedOptions: {
//                     type: "object",
//                     properties: {
//                       face: { type: "string", example: "face2" },
//                       hair: { type: "string", example: "hair1" },
//                       top: { type: "string", example: "top2" },
//                       bottom: { type: "string", example: "bottom3" },
//                       accessory: { type: "string", example: "accessories1" }
//                     }
//                   },
//                   selectedColors: {
//                     type: "object",
//                     properties: {
//                       face: { type: "string", example: "beige" },
//                       hair: { type: "string", example: "red" },
//                       top: { type: "string", example: "green" },
//                       bottom: { type: "string", example: "blue" },
//                       accessory: { type: "string", example: "yellow" }
//                     }
//                   }
//                 }
//               },
//               screenSetup: {
//                 type: "boolean",
//                 example: false
//               }
//             }
//           }
//         }
//       },
//       RoomWithParticipants: {
//         type: "object",
//         properties: {
//           room_id: {
//             type: "string",
//             format: "uuid",
//             example: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
//           },
//           room_code: {
//             type: "string",
//             example: "QN5IFN"
//           },
//           room_name: {
//             type: "string",
//             example: "테스트 방"
//           },
//           max_capacity: {
//             type: "integer",
//             example: 4
//           },
//           current_capacity: {
//             type: "integer",
//             example: 2
//           },
//           room_state: {
//             type: "string",
//             enum: ["waiting", "playing", "completed", "expired"],
//             example: "waiting"
//           },
//           host_nickname: {
//             type: "string",
//             example: "게임마스터"
//           },
//           created_at: {
//             type: "string",
//             format: "date-time",
//             example: "2025-07-25T05:26:56.262Z"
//           },
//           expires_at: {
//             type: "string",
//             format: "date-time",
//             example: "2025-07-25T17:26:56.260Z"
//           },
//           room_settings: {
//             type: "object",
//             example: {}
//           },
//           participants: {
//             type: "array",
//             items: {
//               $ref: "#/components/schemas/RoomParticipant"
//             }
//           }
//         }
//       }
//     }
//   },
//   tags: [
//     {
//       name: "Rooms",
//       description: "방 관리 API"
//     },
//     {
//       name: "WebRTC", 
//       description: "WebRTC 관련 API"
//     },
//     {
//       name: "Socket.IO Events",
//       description: "실시간 WebRTC 시그널링 이벤트"
//     },
//     {
//       name: "Auth",
//       description: "인증 관련 API"
//     }
//   ],
//   paths: {
//     "/socket.io/events": {
//       get: {
//         tags: ["Socket.IO Events"],
//         summary: "WebRTC Socket.IO 이벤트 문서",
//         description: `
// # WebRTC Socket.IO 이벤트 문서

// GameCast 플랫폼에서 사용되는 실시간 Socket.IO 이벤트들의 상세 문서입니다.

// ## 연결 및 방 관리 이벤트

// ### 🔹 클라이언트 → 서버 이벤트

// #### 1. join-room
// 방에 참여하는 이벤트
// \`\`\`javascript
// socket.emit('join-room', {
//   roomCode: 'ABC123',
//   guestUserId: 'uuid-string',
//   nickname: '사용자닉네임'
// });
// \`\`\`

// #### 2. leave-room
// 방에서 나가는 이벤트
// \`\`\`javascript
// socket.emit('leave-room');
// \`\`\`

// #### 3. request-room-users
// 현재 방 참여자 목록 요청
// \`\`\`javascript
// socket.emit('request-room-users', { roomCode: 'ABC123' });
// \`\`\`

// ## WebRTC 시그널링 이벤트

// #### 4. offer
// WebRTC Offer 신호 전송
// \`\`\`javascript
// socket.emit('offer', {
//   targetSocketId: 'target-socket-id',
//   offer: RTCSessionDescription
// });
// \`\`\`

// #### 5. answer
// WebRTC Answer 신호 전송
// \`\`\`javascript
// socket.emit('answer', {
//   targetSocketId: 'target-socket-id',
//   answer: RTCSessionDescription
// });
// \`\`\`

// #### 6. ice-candidate
// ICE Candidate 전송
// \`\`\`javascript
// socket.emit('ice-candidate', {
//   targetSocketId: 'target-socket-id',
//   candidate: RTCIceCandidate
// });
// \`\`\`

// ## 게임 상태 관리 이벤트

// #### 7. update-preparation-status
// 준비 상태 업데이트
// \`\`\`javascript
// socket.emit('update-preparation-status', {
//   characterSetup: true,
//   screenSetup: false
// });
// \`\`\`

// #### 8. update-character-status
// 캐릭터 상태 업데이트
// \`\`\`javascript
// socket.emit('update-character-status', {
//   selectedOptions: {
//     face: 'face2',
//     hair: 'hair1',
//     top: 'top2',
//     bottom: 'bottom3',
//     accessory: 'accessories1'
//   },
//   selectedColors: {
//     face: 'beige',
//     hair: 'red',
//     top: 'green',
//     bottom: 'blue',
//     accessory: 'yellow'
//   }
// });
// \`\`\`

// ## 녹화 제어 이벤트

// #### 9. start-recording
// 녹화 시작 (수동)
// \`\`\`javascript
// socket.emit('start-recording', {
//   roomCode: 'ABC123'
// });
// \`\`\`

// #### 10. stop-recording
// 녹화 중단 (방장 전용)
// \`\`\`javascript
// socket.emit('stop-recording', {
//   roomCode: 'ABC123',
//   sessionId: 'recording-session-id' // 선택사항
// });
// \`\`\`

// ## 채팅 이벤트

// #### 11. chat-message
// 채팅 메시지 전송
// \`\`\`javascript
// socket.emit('chat-message', {
//   roomCode: 'ABC123',
//   message: '안녕하세요!',
//   timestamp: '2025-08-05T10:30:00.000Z'
// });
// \`\`\`

// ## 모니터링 이벤트

// #### 12. audio-quality-report
// 음성 품질 리포트 전송
// \`\`\`javascript
// socket.emit('audio-quality-report', {
//   latency: 50,
//   packetLoss: 0.1,
//   audioLevel: 0.8
// });
// \`\`\`

// ---

// ### 🔸 서버 → 클라이언트 이벤트

// #### 1. joined-room-success
// 방 참여 성공 알림
// \`\`\`javascript
// socket.on('joined-room-success', (data) => {
//   // data: { roomCode, roomId, users }
// });
// \`\`\`

// #### 2. join-room-error
// 방 참여 실패 알림
// \`\`\`javascript
// socket.on('join-room-error', (data) => {
//   // data: { message }
// });
// \`\`\`

// #### 3. user-joined
// 새 사용자 참여 알림
// \`\`\`javascript
// socket.on('user-joined', (data) => {
//   // data: { socketId, guestUserId, nickname, joinedAt }
// });
// \`\`\`

// #### 4. user-left
// 사용자 퇴장 알림
// \`\`\`javascript
// socket.on('user-left', (data) => {
//   // data: { socketId, guestUserId, nickname }
// });
// \`\`\`

// #### 5. room-users
// 방 참여자 목록
// \`\`\`javascript
// socket.on('room-users', (users) => {
//   // users: Array<{ socketId, guestUserId, nickname, isHost, joinedAt }>
// });
// \`\`\`

// #### 6. offer
// WebRTC Offer 수신
// \`\`\`javascript
// socket.on('offer', (data) => {
//   // data: { fromSocketId, fromNickname, offer }
// });
// \`\`\`

// #### 7. answer
// WebRTC Answer 수신
// \`\`\`javascript
// socket.on('answer', (data) => {
//   // data: { fromSocketId, fromNickname, answer }
// });
// \`\`\`

// #### 8. ice-candidate
// ICE Candidate 수신
// \`\`\`javascript
// socket.on('ice-candidate', (data) => {
//   // data: { fromSocketId, candidate }
// });
// \`\`\`

// #### 9. preparation-status-updated
// 준비 상태 변경 알림
// \`\`\`javascript
// socket.on('preparation-status-updated', (data) => {
//   // data: { guestUserId, nickname, characterSetup, screenSetup }
// });
// \`\`\`

// #### 10. character-status-updated
// 캐릭터 상태 변경 알림
// \`\`\`javascript
// socket.on('character-status-updated', (data) => {
//   // data: { guestUserId, nickname, selectedOptions, selectedColors, updatedAt }
// });
// \`\`\`

// #### 11. participant-update
// 참여자 업데이트 (방 서비스 연동)
// \`\`\`javascript
// socket.on('participant-update', (data) => {
//   // data: { roomCode, eventType, participants, newParticipant, leftParticipant, roomInfo, timestamp }
// });
// \`\`\`

// ## 자동 녹화 시스템 이벤트

// #### 12. recording-countdown-started
// 녹화 카운트다운 시작 (모든 플레이어 준비 완료 시)
// \`\`\`javascript
// socket.on('recording-countdown-started', (data) => {
//   // data: { countdown: 3, message, timestamp }
// });
// \`\`\`

// #### 13. recording-countdown
// 녹화 카운트다운 (3, 2, 1)
// \`\`\`javascript
// socket.on('recording-countdown', (data) => {
//   // data: { count, timestamp }
// });
// \`\`\`

// #### 14. recording-started
// 녹화 시작 알림
// \`\`\`javascript
// socket.on('recording-started', (data) => {
//   // data: { sessionId, startedBy, autoStarted?, timestamp }
// });
// \`\`\`

// #### 15. recording-stopped
// 녹화 종료 알림
// \`\`\`javascript
// socket.on('recording-stopped', (data) => {
//   // data: { sessionId, stoppedBy, stoppedByHost, timestamp }
// });
// \`\`\`

// #### 16. recording-error
// 녹화 관련 오류
// \`\`\`javascript
// socket.on('recording-error', (data) => {
//   // data: { message, code? }
// });
// \`\`\`

// #### 17. chat-message
// 채팅 메시지 수신
// \`\`\`javascript
// socket.on('chat-message', (data) => {
//   // data: { roomCode, message, timestamp, senderSocketId, senderNickname, senderGuestUserId }
// });
// \`\`\`

// #### 18. error
// 일반 오류 메시지
// \`\`\`javascript
// socket.on('error', (data) => {
//   // data: { message }
// });
// \`\`\`

// ---

// ## 이벤트 흐름도

// ### 방 참여 플로우
// 1. 클라이언트: \`join-room\` → 서버
// 2. 서버: 검증 후 \`joined-room-success\` 또는 \`join-room-error\`
// 3. 서버: 기존 참여자들에게 \`user-joined\` 브로드캐스트
// 4. 서버: 신규 참여자에게 \`room-users\` 전송

// ### 자동 녹화 플로우
// 1. 클라이언트: \`update-preparation-status\` → 서버
// 2. 서버: 모든 참여자 준비 상태 체크
// 3. 준비 완료 시: \`recording-countdown-started\` 브로드캐스트
// 4. 서버: 3초 카운트다운 \`recording-countdown\` 브로드캐스트
// 5. 서버: \`recording-started\` 브로드캐스트

// ### WebRTC 연결 플로우
// 1. 클라이언트A: \`offer\` → 서버 → 클라이언트B
// 2. 클라이언트B: \`answer\` → 서버 → 클라이언트A
// 3. 양방향: \`ice-candidate\` 교환

// ---

// ## 주의사항

// - 모든 이벤트는 방(roomCode) 단위로 브로드캐스트됩니다
// - 녹화 중단은 방장만 가능합니다
// - 자동 녹화는 모든 참여자가 준비되면 자동으로 시작됩니다
// - 방에 최소 2명 이상 있어야 녹화가 시작됩니다
//         `,
//         responses: {
//           "200": {
//             description: "Socket.IO 이벤트 문서",
//             content: {
//               "application/json": {
//                 schema: {
//                   type: "object",
//                   properties: {
//                     documentation: {
//                       type: "string",
//                       example: "이 문서는 WebRTC Socket.IO 이벤트를 설명합니다."
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// };

// export { swaggerConfig };
// export default swaggerConfig;
