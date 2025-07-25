import express from 'express';
import { RoomController } from '../controllers/room.controller';
import { validateRequest } from '../middlewares/validation.middleware';
import { createRoomSchema, joinRoomSchema, updatePreparationSchema } from '../validators/room.validator';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';

const router = express.Router();
const roomController = new RoomController();

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: 방 생성
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoomRequest'
 *     responses:
 *       201:
 *         description: 방 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FailResponse'
 *       429:
 *         description: 너무 많은 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FailResponse'
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
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     success:
 *                       $ref: '#/components/schemas/RoomWithParticipants'
 *       404:
 *         description: 방을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FailResponse'
 */
router.get(
  '/:roomCode',
  roomController.getRoomInfo.bind(roomController)
);

/**
 * @swagger
 * /api/rooms/join:
 *   post:
 *     summary: 방 참여
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - room_code
 *               - session_id
 *               - nickname
 *             properties:
 *               room_code:
 *                 type: string
 *                 pattern: '^[A-Z0-9]{6}$'
 *                 example: "ABC123"
 *               session_id:
 *                 type: string
 *                 example: "session_987654321"
 *               nickname:
 *                 type: string
 *                 maxLength: 50
 *                 example: "게스트닉네임"
 *     responses:
 *       200:
 *         description: 방 참여 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 방을 찾을 수 없음
 *       409:
 *         description: 방 참여 불가 (인원 초과, 닉네임 중복 등)
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
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guest_user_id
 *             properties:
 *               guest_user_id:
 *                 type: string
 *                 format: uuid
 *                 example: "uuid-guest-id"
 *     responses:
 *       200:
 *         description: 방 나가기 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 참여 중인 방을 찾을 수 없음
 */
router.post(
  '/leave',
  roomController.leaveRoom.bind(roomController)
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
 *               - guest_user_id
 *             properties:
 *               guest_user_id:
 *                 type: string
 *                 format: uuid
 *               character_setup:
 *                 type: boolean
 *                 example: true
 *               screen_setup:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: 준비 상태 업데이트 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 참여 중인 방을 찾을 수 없음
 */
router.put(
  '/preparation',
  validateRequest(updatePreparationSchema),
  roomController.updatePreparation.bind(roomController)
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
 */
router.get(
  '/',
  roomController.getAllRooms.bind(roomController)
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
 *               - host_guest_id
 *             properties:
 *               host_guest_id:
 *                 type: string
 *                 description: 방장 게스트 사용자 ID
 *     responses:
 *       200:
 *         description: 방 종료 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 방을 찾을 수 없음 또는 권한 없음
 */
router.delete(
  '/end',
  rateLimitMiddleware.general,
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
 *               - host_guest_id
 *               - room_state
 *             properties:
 *               host_guest_id:
 *                 type: string
 *                 description: 방장 게스트 사용자 ID
 *               room_state:
 *                 type: string
 *                 enum: [waiting, active, recording, expired]
 *                 description: 변경할 방 상태
 *     responses:
 *       200:
 *         description: 방 상태 변경 성공
 *       400:
 *         description: 잘못된 요청
 *       404:
 *         description: 방을 찾을 수 없음 또는 권한 없음
 */
router.put(
  '/state',
  rateLimitMiddleware.general,
  roomController.updateRoomState.bind(roomController)
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

export default router;