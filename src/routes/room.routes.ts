import express from 'express';
import { RoomController } from '../controllers/room.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { createRoomSchema, joinRoomSchema, updatePreparationSchema } from '../validators/room.validator.js';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware.js';
import { WebRTCService } from '../services/webrtc.service.js';

export function createRoomRoutes(webrtcService: WebRTCService) {
  const router = express.Router();
  const roomController = new RoomController(webrtcService);
  

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: 방 생성
 *     description: 새로운 게임 방을 생성합니다. 방장이 되어 다른 사용자들을 초대할 수 있습니다.
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomName
 *               - hostNickname
 *             properties:
 *               roomName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: 방 이름
 *                 example: "즐거운 게임 방"
 *               hostNickname:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: 방장 닉네임
 *                 example: "게임마스터"
 *               maxCapacity:
 *                 type: integer
 *                 minimum: 2
 *                 maximum: 5
 *                 default: 5
 *                 description: 최대 참여 인원
 *                 example: 4
 *               roomSettings:
 *                 type: object
 *                 description: 방 설정 (선택사항)
 *                 properties:
 *                   gameMode:
 *                     type: string
 *                     example: "competitive"
 *                   difficulty:
 *                     type: string
 *                     example: "normal"
 *     responses:
 *       201:
 *         description: 방 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     roomId:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     roomCode:
 *                       type: string
 *                       example: "ABC123"
 *                     roomName:
 *                       type: string
 *                       example: "즐거운 게임 방"
 *                     maxCapacity:
 *                       type: integer
 *                       example: 4
 *                     currentCapacity:
 *                       type: integer
 *                       example: 1
 *                     roomState:
 *                       type: string
 *                       example: "waiting"
 *                     hostGuestId:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440001"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-07-26T10:30:00.000Z"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-07-26T22:30:00.000Z"
 *             example:
 *               resultType: "SUCCESS"
 *               error: null
 *               success:
 *                 roomId: "550e8400-e29b-41d4-a716-446655440000"
 *                 roomCode: "ABC123"
 *                 roomName: "즐거운 게임 방"
 *                 maxCapacity: 4
 *                 currentCapacity: 1
 *                 roomState: "waiting"
 *                 hostGuestId: "550e8400-e29b-41d4-a716-446655440001"
 *                 createdAt: "2025-07-26T10:30:00.000Z"
 *                 expiresAt: "2025-07-26T22:30:00.000Z"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     reason:
 *                       type: string
 *                       example: "방 이름은 필수입니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *             example:
 *               resultType: "FAIL"
 *               error:
 *                 errorCode: "BAD_REQUEST"
 *                 reason: "방 이름은 필수입니다."
 *                 data: null
 *               success: null
 *       429:
 *         description: 너무 많은 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "RATE_LIMIT_EXCEEDED"
 *                     reason:
 *                       type: string
 *                       example: "방 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *             example:
 *               resultType: "FAIL"
 *               error:
 *                 errorCode: "RATE_LIMIT_EXCEEDED"
 *                 reason: "방 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
 *                 data: null
 *               success: null
 */
  router.post(
    '/',
    rateLimitMiddleware.roomCreation, // 방 생성 특별 제한
    validateRequest(createRoomSchema),
    roomController.createRoom.bind(roomController)
  );
  

/**
 * @swagger
 * /api/rooms/{roomCode}:
 *   get:
 *     summary: 방 정보 조회
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z0-9]{6}$'
 *         example: "ABC123"
 *     responses:
 *       200:
 *         description: 방 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     roomCode:
 *                       type: string
 *                       example: "ABC123"
 *                     roomName:
 *                       type: string
 *                       example: "즐거운 게임 방"
 *                     maxCapacity:
 *                       type: integer
 *                       example: 4
 *                     currentCapacity:
 *                       type: integer
 *                       example: 2
 *                     roomState:
 *                       type: string
 *                       example: "waiting"
 *                     hostGuestId:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440001"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-07-26T10:30:00.000Z"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-07-26T22:30:00.000Z"
 *                     hostGuest:
 *                       type: object
 *                       properties:
 *                         nickname:
 *                           type: string
 *                           example: "게임마스터"
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "550e8400-e29b-41d4-a716-446655440002"
 *                           nickname:
 *                             type: string
 *                             example: "플레이어1"
 *                           role:
 *                             type: string
 *                             enum: [host, guest]
 *                             example: "guest"
 *                           joinedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-07-26T10:35:00.000Z"
 *       404:
 *         description: 방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     reason:
 *                       type: string
 *                       example: "방을 찾을 수 없습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 */
  router.get(
    '/:roomCode',
    roomController.getRoomInfo.bind(roomController)
  );


/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: 방 목록 조회 (관리자용)
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: 방 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             example: "550e8400-e29b-41d4-a716-446655440000"
 *                           roomCode:
 *                             type: string
 *                             example: "ABC123"
 *                           roomName:
 *                             type: string
 *                             example: "즐거운 게임 방"
 *                           maxCapacity:
 *                             type: integer
 *                             example: 4
 *                           currentCapacity:
 *                             type: integer
 *                             example: 2
 *                           roomState:
 *                             type: string
 *                             example: "waiting"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-07-26T10:30:00.000Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         size:
 *                           type: integer
 *                           example: 20
 *                         totalElements:
 *                           type: integer
 *                           example: 45
 *                         totalPages:
 *                           type: integer
 *                           example: 3
 *                         hasNext:
 *                           type: boolean
 *                           example: true
 *                         hasPrevious:
 *                           type: boolean
 *                           example: false
 */
  router.get(
    '/',
    roomController.getAllRooms.bind(roomController)
  );

/**
 * @swagger
 * /api/rooms/join:
 *   post:
 *     summary: 방 참여
 *     description: |
 *       지정된 방에 참여합니다. 
 *       
 *       **실시간 알림**: 참여 성공 시 해당 방의 모든 참여자에게 Socket.IO `participant-update` 이벤트가 전송됩니다.
 *       - 이벤트 타입: `user-joined`
 *       - 전송 대상: 해당 방의 모든 Socket.IO 클라이언트
 *       - 이벤트 데이터: 업데이트된 참여자 목록, 새 참여자 정보, 방 정보
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomCode
 *               - nickname
 *             properties:
 *               roomCode:
 *                 type: string
 *                 pattern: '^[A-Z0-9]{6}$'
 *                 example: "ABC123"
 *               nickname:
 *                 type: string
 *                 maxLength: 50
 *                 example: "게스트닉네임"
 *     responses:
 *       200:
 *         description: 방 참여 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     guestUserId:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440002"
 *                     roomInfo:
 *                       type: object
 *                       properties:
 *                         roomId:
 *                           type: string
 *                           format: uuid
 *                           example: "550e8400-e29b-41d4-a716-446655440000"
 *                         roomCode:
 *                           type: string
 *                           example: "ABC123"
 *                         roomName:
 *                           type: string
 *                           example: "즐거운 게임 방"
 *                         currentCapacity:
 *                           type: integer
 *                           example: 2
 *                         maxCapacity:
 *                           type: integer
 *                           example: 4
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     reason:
 *                       type: string
 *                       example: "방 코드가 올바르지 않습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     reason:
 *                       type: string
 *                       example: "방을 찾을 수 없습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *       409:
 *         description: 방 참여 불가 (인원 초과, 닉네임 중복 등)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "CONFLICT"
 *                     reason:
 *                       type: string
 *                       example: "방이 가득 찼거나 동일한 닉네임이 존재합니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *     callbacks:
 *       participantUpdate:
 *         'participant-update':
 *           post:
 *             summary: Socket.IO 실시간 참여자 업데이트 이벤트
 *             description: 방 참여 성공 시 해당 방의 모든 클라이언트에게 전송되는 실시간 이벤트
 *             requestBody:
 *               content:
 *                 application/json:
 *                   schema:
 *                     $ref: '#/components/schemas/ParticipantUpdateEvent'
 *                   examples:
 *                     user-joined:
 *                       summary: 사용자 참여 이벤트
 *                       value:
 *                         roomCode: "ABC123"
 *                         eventType: "user-joined"
 *                         newParticipant:
 *                           guestUserId: "550e8400-e29b-41d4-a716-446655440004"
 *                           nickname: "새로운플레이어"
 *                           role: "participant"
 *                           joinedAt: "2025-07-31T01:30:00.000Z"
 *                         roomInfo:
 *                           currentCapacity: 2
 *                           maxCapacity: 4
 *                         timestamp: "2025-07-31T01:30:00.000Z"
 *             responses:
 *               '200':
 *                 description: 실시간 이벤트 수신 성공
 */
  router.post(
    '/join',
    validateRequest(joinRoomSchema),
    roomController.joinRoom.bind(roomController)
  );

/**
 * @swagger
 * /api/rooms/leave:
 *   post:
 *     summary: 방 나가기
 *     description: |
 *       현재 참여 중인 방에서 나갑니다.
 *       
 *       **실시간 알림**: 방 나가기 성공 시 해당 방의 남은 참여자들에게 Socket.IO `participant-update` 이벤트가 전송됩니다.
 *       - 이벤트 타입: `user-left`
 *       - 전송 대상: 해당 방의 모든 Socket.IO 클라이언트
 *       - 이벤트 데이터: 업데이트된 참여자 목록, 떠난 참여자 정보, 방 정보
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestUserId
 *             properties:
 *               guestUserId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *     responses:
 *       200:
 *         description: 방 나가기 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "방에서 성공적으로 나갔습니다."
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     reason:
 *                       type: string
 *                       example: "게스트 사용자 ID가 필요합니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 참여 중인 방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     reason:
 *                       type: string
 *                       example: "참여 중인 방을 찾을 수 없습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *     callbacks:
 *       participantUpdate:
 *         'participant-update':
 *           post:
 *             summary: Socket.IO 실시간 참여자 업데이트 이벤트
 *             description: 방 나가기 성공 시 해당 방의 남은 참여자들에게 전송되는 실시간 이벤트
 *             requestBody:
 *               content:
 *                 application/json:
 *                   schema:
 *                     $ref: '#/components/schemas/ParticipantUpdateEvent'
 *                   examples:
 *                     user-left:
 *                       summary: 사용자 퇴장 이벤트
 *                       value:
 *                         roomCode: "ABC123"
 *                         eventType: "user-left"
 *                         leftParticipant:
 *                           guestUserId: "550e8400-e29b-41d4-a716-446655440004"
 *                           nickname: "떠난플레이어"
 *                           role: "participant"
 *                         roomInfo:
 *                           currentCapacity: 1
 *                           maxCapacity: 4
 *                         timestamp: "2025-07-31T01:30:05.000Z"
 *             responses:
 *               '200':
 *                 description: 실시간 이벤트 수신 성공
 */
  router.post(
    '/leave',
    roomController.leaveRoom.bind(roomController)
  );


/**
 * @swagger
 * /api/rooms/end:
 *   delete:
 *     summary: 방 종료 (방장만 가능)
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hostGuestId
 *             properties:
 *               hostGuestId:
 *                 type: string
 *                 format: uuid
 *                 description: 방장 게스트 사용자 ID
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *     responses:
 *       200:
 *         description: 방 종료 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "방이 성공적으로 종료되었습니다."
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     reason:
 *                       type: string
 *                       example: "방장 권한이 필요합니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 방을 찾을 수 없음 또는 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     reason:
 *                       type: string
 *                       example: "방을 찾을 수 없거나 권한이 없습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 */
  router.delete(
    '/end',
    roomController.endRoom.bind(roomController)
  );


/**
 * @swagger
 * /api/rooms/state:
 *   put:
 *     summary: 방 상태 변경 (방장만 가능)
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hostGuestId
 *               - roomState
 *             properties:
 *               hostGuestId:
 *                 type: string
 *                 format: uuid
 *                 description: 방장 게스트 사용자 ID
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *               roomState:
 *                 type: string
 *                 enum: [waiting, active, recording, expired]
 *                 description: 변경할 방 상태
 *                 example: "active"
 *     responses:
 *       200:
 *         description: 방 상태 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "방 상태가 변경되었습니다."
 *                     roomState:
 *                       type: string
 *                       example: "active"
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     reason:
 *                       type: string
 *                       example: "유효하지 않은 방 상태입니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 방을 찾을 수 없음 또는 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     reason:
 *                       type: string
 *                       example: "방을 찾을 수 없거나 권한이 없습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 */
  router.patch(
    '/state',
    roomController.updateRoomState.bind(roomController)
  );


/**
 * @swagger
 * /api/rooms/preparation:
 *   put:
 *     summary: 준비 상태 업데이트
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guestUserId
 *             properties:
 *               guestUserId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *               characterSetup:
 *                 type: boolean
 *                 example: true
 *               screenSetup:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: 준비 상태 업데이트 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 error:
 *                   type: null
 *                   example: null
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "준비 상태가 업데이트되었습니다."
 *                     preparationStatus:
 *                       type: object
 *                       properties:
 *                         characterSetup:
 *                           type: boolean
 *                           example: true
 *                         screenSetup:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "BAD_REQUEST"
 *                     reason:
 *                       type: string
 *                       example: "게스트 사용자 ID가 필요합니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 참여 중인 방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "FAIL"
 *                 error:
 *                   type: object
 *                   properties:
 *                     errorCode:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     reason:
 *                       type: string
 *                       example: "참여 중인 방을 찾을 수 없습니다."
 *                     data:
 *                       type: object
 *                       example: null
 *                 success:
 *                   type: null
 *                   example: null
 */
  router.patch(
    '/preparation',
    validateRequest(updatePreparationSchema),
    roomController.updatePreparation.bind(roomController)
  );


/**
 * @swagger
 * /api/rooms/dev/clear-all:
 *   delete:
 *     summary: 개발용 - 모든 방 삭제
 *     tags: [Development]
 *     description: |
 *       **개발 환경에서만 사용 가능**
 *       
 *       모든 방, 참여자, 게스트 사용자를 삭제합니다.
 *       프로덕션 환경에서는 실행되지 않습니다.
 *     responses:
 *       200:
 *         description: 모든 데이터 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultType:
 *                   type: string
 *                   example: "SUCCESS"
 *                 success:
 *                   type: object
 *                   properties:
 *                     deletedRooms:
 *                       type: number
 *                     deletedParticipants:
 *                       type: number
 *                     deletedGuests:
 *                       type: number
 *                     message:
 *                       type: string
 *       400:
 *         description: 프로덕션 환경에서 실행 시도
 */
  router.delete(
    '/dev/clear-all',
    roomController.deleteAllRooms.bind(roomController)
  );

  /**
   * @swagger
   * /api/rooms/cleanup:
   *   delete:
   *     summary: 만료된 방 정리 (관리자용)
   *     tags: [Rooms]
   *     responses:
   *       200:
   *         description: 정리 완료
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 resultType:
   *                   type: string
   *                   example: "SUCCESS"
   *                 success:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                     deleted_rooms:
   *                       type: integer
   *                     deleted_guests:
   *                       type: integer
   */
  router.delete(
    '/cleanup',
    roomController.cleanupRooms.bind(roomController)
  );

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateRoomRequest:
 *       type: object
 *       required:
 *         - roomName
 *         - hostNickname
 *       properties:
 *         roomName:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 방 이름
 *           example: "즐거운 게임 방"
 *         hostNickname:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: 방장 닉네임
 *           example: "게임마스터"
 *         maxCapacity:
 *           type: integer
 *           minimum: 2
 *           maximum: 5
 *           default: 5
 *           description: 최대 참여 인원
 *           example: 4
 *         roomSettings:
 *           type: object
 *           description: 방 설정 (선택사항)
 *           example: 
 *             gameMode: "competitive"
 *             difficulty: "normal"
 *     
 *     JoinRoomRequest:
 *       type: object
 *       required:
 *         - roomCode
 *         - nickname
 *       properties:
 *         roomCode:
 *           type: string
 *           pattern: '^[A-Z0-9]{6}$'
 *           description: 6자리 방 입장 코드
 *           example: "ABC123"
 *         nickname:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: 참여자 닉네임
 *           example: "플레이어1"
 *     
 *     Room:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 방 고유 ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         roomCode:
 *           type: string
 *           description: 6자리 방 입장 코드
 *           example: "ABC123"
 *         roomName:
 *           type: string
 *           description: 방 이름
 *           example: "즐거운 게임 방"
 *         maxCapacity:
 *           type: integer
 *           description: 최대 참여 인원
 *           example: 4
 *         currentCapacity:
 *           type: integer
 *           description: 현재 참여 인원
 *           example: 2
 *         roomState:
 *           type: string
 *           enum: [waiting, active, recording, expired]
 *           description: 방 상태
 *           example: "waiting"
 *         hostGuestId:
 *           type: string
 *           format: uuid
 *           description: 방장 게스트 ID
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 방 생성 시간
 *           example: "2025-07-26T10:30:00.000Z"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: 방 만료 시간
 *           example: "2025-07-26T22:30:00.000Z"
 *         roomSettings:
 *           type: object
 *           description: 방 설정
 *           example:
 *             gameMode: "competitive"
 *             difficulty: "normal"
 *     
 *     Participant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 참여자 ID
 *           example: "550e8400-e29b-41d4-a716-446655440002"
 *         nickname:
 *           type: string
 *           description: 참여자 닉네임
 *           example: "플레이어1"
 *         role:
 *           type: string
 *           enum: [host, guest]
 *           description: 참여자 역할
 *           example: "guest"
 *         joinedAt:
 *           type: string
 *           format: date-time
 *           description: 참여 시간
 *           example: "2025-07-26T10:35:00.000Z"
 *         preparationStatus:
 *           type: object
 *           properties:
 *             screenSetup:
 *               type: boolean
 *               description: 화면 설정 완료 여부
 *               example: true
 *             characterSetup:
 *               type: boolean
 *               description: 캐릭터 설정 완료 여부
 *               example: false
 *     
 *     RoomWithParticipants:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 방 고유 ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         roomCode:
 *           type: string
 *           description: 6자리 방 입장 코드
 *           example: "ABC123"
 *         roomName:
 *           type: string
 *           description: 방 이름
 *           example: "즐거운 게임 방"
 *         maxCapacity:
 *           type: integer
 *           description: 최대 참여 인원
 *           example: 4
 *         currentCapacity:
 *           type: integer
 *           description: 현재 참여 인원
 *           example: 2
 *         roomState:
 *           type: string
 *           enum: [waiting, active, recording, expired]
 *           description: 방 상태
 *           example: "waiting"
 *         hostGuestId:
 *           type: string
 *           format: uuid
 *           description: 방장 게스트 ID
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 방 생성 시간
 *           example: "2025-07-26T10:30:00.000Z"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: 방 만료 시간
 *           example: "2025-07-26T22:30:00.000Z"
 *         roomSettings:
 *           type: object
 *           description: 방 설정
 *           example:
 *             gameMode: "competitive"
 *             difficulty: "normal"
 *         hostGuest:
 *           type: object
 *           properties:
 *             nickname:
 *               type: string
 *               description: 방장 닉네임
 *               example: "게임마스터"
 *         participants:
 *           type: array
 *           description: 방 참여자 목록
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: 참여자 ID
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *               nickname:
 *                 type: string
 *                 description: 참여자 닉네임
 *                 example: "플레이어1"
 *               role:
 *                 type: string
 *                 enum: [host, guest]
 *                 description: 참여자 역할
 *                 example: "guest"
 *               joinedAt:
 *                 type: string
 *                 format: date-time
 *                 description: 참여 시간
 *                 example: "2025-07-26T10:35:00.000Z"
 *               preparationStatus:
 *                 type: object
 *                 properties:
 *                   screenSetup:
 *                     type: boolean
 *                     description: 화면 설정 완료 여부
 *                     example: true
 *                   characterSetup:
 *                     type: boolean
 *                     description: 캐릭터 설정 완료 여부
 *                     example: false
 *     
 *     PaginatedResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           description: 페이지 데이터
 *           items:
 *             $ref: '#/components/schemas/RoomWithParticipants'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               description: 현재 페이지
 *               example: 1
 *             size:
 *               type: integer
 *               description: 페이지 크기
 *               example: 20
 *             totalElements:
 *               type: integer
 *               description: 전체 요소 수
 *               example: 45
 *             totalPages:
 *               type: integer
 *               description: 전체 페이지 수
 *               example: 3
 *             hasNext:
 *               type: boolean
 *               description: 다음 페이지 존재 여부
 *               example: true
 *             hasPrevious:
 *               type: boolean
 *               description: 이전 페이지 존재 여부
 *               example: false
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ParticipantUpdateEvent:
 *       type: object
 *       description: |
 *         Socket.IO 실시간 참여자 업데이트 이벤트
 *         
 *         **이벤트명**: `participant-update`
 *         
 *         **발생 시점**:
 *         - 사용자가 방에 참여할 때 (eventType: user-joined)
 *         - 사용자가 방에서 나갈 때 (eventType: user-left)
 *         
 *         **수신 방법**:
 *         ```javascript
 *         socket.on('participant-update', (data) => {
 *           console.log('참여자 업데이트:', data);
 *           if (data.eventType === 'user-joined') {
 *             console.log('새 참여자:', data.newParticipant.nickname);
 *           } else if (data.eventType === 'user-left') {
 *             console.log('떠난 참여자:', data.leftParticipant.nickname);
 *           }
 *         });
 *         ```
 *       properties:
 *         roomCode:
 *           type: string
 *           description: 방 코드
 *           example: "ABC123"
 *         eventType:
 *           type: string
 *           enum: [user-joined, user-left]
 *           description: 이벤트 타입
 *           example: "user-joined"
 *         participants:
 *           type: array
 *           description: 현재 방의 모든 참여자 목록
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: 참여자 ID
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *               guestUserId:
 *                 type: string
 *                 format: uuid
 *                 description: 게스트 사용자 ID
 *                 example: "550e8400-e29b-41d4-a716-446655440003"
 *               nickname:
 *                 type: string
 *                 description: 참여자 닉네임
 *                 example: "플레이어1"
 *               role:
 *                 type: string
 *                 enum: [host, participant]
 *                 description: 참여자 역할
 *                 example: "participant"
 *               joinedAt:
 *                 type: string
 *                 format: date-time
 *                 description: 참여 시간
 *                 example: "2025-07-31T01:30:00.000Z"
 *               preparationStatus:
 *                 type: object
 *                 description: 준비 상태
 *                 properties:
 *                   characterSetup:
 *                     type: boolean
 *                     description: 캐릭터 설정 완료 여부
 *                     example: false
 *                   screenSetup:
 *                     type: boolean
 *                     description: 화면 설정 완료 여부
 *                     example: false
 *               isHost:
 *                 type: boolean
 *                 description: 방장 여부
 *                 example: false
 *         newParticipant:
 *           type: object
 *           description: 새로 참여한 사용자 정보 (user-joined인 경우)
 *           properties:
 *             guestUserId:
 *               type: string
 *               format: uuid
 *               description: 게스트 사용자 ID
 *               example: "550e8400-e29b-41d4-a716-446655440003"
 *             nickname:
 *               type: string
 *               description: 닉네임
 *               example: "새로운플레이어"
 *             role:
 *               type: string
 *               enum: [participant]
 *               description: 역할
 *               example: "participant"
 *             joinedAt:
 *               type: string
 *               format: date-time
 *               description: 참여 시간
 *               example: "2025-07-31T01:30:00.000Z"
 *         leftParticipant:
 *           type: object
 *           description: 떠난 사용자 정보 (user-left인 경우)
 *           properties:
 *             guestUserId:
 *               type: string
 *               format: uuid
 *               description: 게스트 사용자 ID
 *               example: "550e8400-e29b-41d4-a716-446655440003"
 *             nickname:
 *               type: string
 *               description: 닉네임
 *               example: "떠난플레이어"
 *             role:
 *               type: string
 *               enum: [participant]
 *               description: 역할
 *               example: "participant"
 *         roomInfo:
 *           type: object
 *           description: 방 정보
 *           properties:
 *             currentCapacity:
 *               type: integer
 *               description: 현재 인원
 *               example: 3
 *             maxCapacity:
 *               type: integer
 *               description: 최대 인원
 *               example: 4
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 이벤트 발생 시간
 *           example: "2025-07-31T01:30:00.000Z"
 */
  return router;
}

export default createRoomRoutes;
