import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: WebRTC
 *     description: WebRTC 시그널링 및 실시간 통신 관련 API
 */


router.get('/test', (req: Request, res: Response) => {
  res.redirect('/webrtc-test');
});

/**
 * @swagger
 * /api/webrtc/connection-info:
 *   get:
 *     tags: [WebRTC]
 *     summary: WebRTC 연결 정보 조회
 *     description: 현재 WebRTC 연결 상태와 STUN/TURN 서버 정보를 조회합니다
 *     responses:
 *       200:
 *         description: WebRTC 연결 정보
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
 *                     iceServers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           urls:
 *                             type: string
 *                             example: "stun:stun.l.google.com:19302"
 *                     signaling:
 *                       type: object
 *                       properties:
 *                         socketUrl:
 *                           type: string
 *                           example: "ws://localhost:8889"
 *                         events:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["join-room", "offer", "answer", "ice-candidate"]
 *                     supportedCodecs:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["H264", "VP8", "VP9", "AV1"]
 */
router.get('/connection-info', (req: Request, res: Response) => {
  const connectionInfo = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    signaling: {
      socketUrl: `ws://${req.get('host')}`,
      namespace: '/',
      clientEvents: [
        'join-room',
        'leave-room',
        'offer',
        'answer',
        'ice-candidate',
        'update-preparation-status',
        'update-character-status',
        'ready-to-start',
        'start-recording',
        'stop-recording',
        'chat-message',
        'audio-quality-report',
        'request-room-users'
      ],
      serverEvents: [
        'joined-room-success',
        'join-room-error',
        'user-joined',
        'user-left',
        'room-users',
        'offer',
        'answer',
        'ice-candidate',
        'preparation-status-updated',
        'character-status-updated',
        'user-ready',
        'all-users-ready',
        'ready-status-update',
        'participant-update',
        'recording-countdown-started',
        'recording-countdown',
        'recording-started',
        'recording-stopped',
        'recording-error',
        'chat-message',
        'error'
      ]
    },
    supportedCodecs: ['H264', 'VP8', 'VP9', 'AV1', 'Opus', 'G722'],
    features: {
      video: true,
      audio: true,
      screenShare: true,
      recording: true,
      chat: true
    },
    constraints: {
      video: { width: 640, height: 480 },
      audio: true
    }
  };

  res.json({
    resultType: 'SUCCESS',
    error: null,
    success: connectionInfo
  });
});

/**
 * @swagger
 * /api/webrtc/stats:
 *   get:
 *     tags: [WebRTC]
 *     summary: WebRTC 통계 정보
 *     description: 현재 활성화된 WebRTC 연결 통계를 조회합니다
 *     responses:
 *       200:
 *         description: WebRTC 통계 정보
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
 *                     activeConnections:
 *                       type: integer
 *                       example: 5
 *                     totalRooms:
 *                       type: integer
 *                       example: 3
 *                     connectedUsers:
 *                       type: integer
 *                       example: 8
 *                     averageLatency:
 *                       type: number
 *                       example: 45.5
 *                     totalDataTransferred:
 *                       type: number
 *                       example: 1024000
 */
router.get('/stats', (req: Request, res: Response) => {
  // 실제 구현에서는 WebRTCService에서 통계를 가져와야 합니다
  const stats = {
    activeConnections: 0, // webrtcService.getActiveConnections()
    totalRooms: 0, // webrtcService.getTotalRooms()
    connectedUsers: 0, // webrtcService.getConnectedUsers()
    averageLatency: 0,
    totalDataTransferred: 0,
    timestamp: new Date().toISOString()
  };

  res.json({
    resultType: 'SUCCESS',
    error: null,
    success: stats
  });
});

/**
 * @swagger
 * components:
 *   schemas:
 *     # 기본 Socket.IO 이벤트 구조
 *     WebRTCSocketEvent:
 *       type: object
 *       description: WebRTC Socket.IO 이벤트 구조
 *       properties:
 *         event:
 *           type: string
 *           description: 이벤트 이름
 *         data:
 *           type: object
 *           description: 이벤트 데이터
 *       example:
 *         event: "join-room"
 *         data:
 *           roomCode: "ABC123"
 *           guestUserId: "user-123"
 *           nickname: "사용자1"
 *     
 *     # 방 참여 관련 이벤트
 *     JoinRoomEvent:
 *       type: object
 *       description: 방 참여 이벤트 데이터
 *       required: ["roomCode", "guestUserId", "nickname"]
 *       properties:
 *         roomCode:
 *           type: string
 *           example: "ABC123"
 *           description: "6자리 방 코드"
 *         guestUserId:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *           description: "참여자 UUID"
 *         nickname:
 *           type: string
 *           example: "플레이어1"
 *           description: "참여자 닉네임"
 *     
 *     JoinedRoomSuccessEvent:
 *       type: object
 *       description: 방 참여 성공 응답
 *       properties:
 *         roomCode:
 *           type: string
 *           example: "ABC123"
 *         roomId:
 *           type: string
 *           format: uuid
 *           example: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
 *         users:
 *           type: array
 *           items:
 *             $ref: "#/components/schemas/RoomUser"
 *     
 *     RoomUser:
 *       type: object
 *       description: 방 참여자 정보 (캐릭터 정보 포함)
 *       properties:
 *         socketId:
 *           type: string
 *           example: "socket_123"
 *         guestUserId:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *         nickname:
 *           type: string
 *           example: "플레이어1"
 *         isHost:
 *           type: boolean
 *           example: false
 *         joinedAt:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *         preparationStatus:
 *           type: object
 *           description: "준비 상태 정보"
 *           properties:
 *             characterSetup:
 *               type: boolean
 *               example: true
 *             screenSetup:
 *               type: boolean
 *               example: false
 *         characterInfo:
 *           type: object
 *           nullable: true
 *           description: "캐릭터 커스터마이징 정보"
 *           properties:
 *             selectedOptions:
 *               type: object
 *               nullable: true
 *               description: "캐릭터 선택 옵션"
 *               properties:
 *                 face:
 *                   type: string
 *                   example: "face2"
 *                 hair:
 *                   type: string
 *                   example: "hair1"
 *                 top:
 *                   type: string
 *                   example: "top2"
 *                 bottom:
 *                   type: string
 *                   example: "bottom3"
 *                 accessory:
 *                   type: string
 *                   example: "accessories1"
 *             selectedColors:
 *               type: object
 *               nullable: true
 *               description: "캐릭터 색상 설정"
 *               properties:
 *                 face:
 *                   type: string
 *                   example: "beige"
 *                 hair:
 *                   type: string
 *                   example: "red"
 *                 top:
 *                   type: string
 *                   example: "green"
 *                 bottom:
 *                   type: string
 *                   example: "blue"
 *                 accessory:
 *                   type: string
 *                   example: "yellow"
 *             isCustomized:
 *               type: boolean
 *               example: true
 *               description: "캐릭터 커스터마이징 완료 여부"
 *     
 *     # WebRTC 시그널링 이벤트
 *     WebRTCOffer:
 *       type: object
 *       description: WebRTC Offer 데이터
 *       required: ["targetSocketId", "offer"]
 *       properties:
 *         targetSocketId:
 *           type: string
 *           example: "socket-123"
 *           description: "대상 소켓 ID"
 *         offer:
 *           type: object
 *           description: "RTCSessionDescription"
 *           properties:
 *             type:
 *               type: string
 *               example: "offer"
 *             sdp:
 *               type: string
 *               example: "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n..."
 *     
 *     WebRTCAnswer:
 *       type: object
 *       description: WebRTC Answer 데이터
 *       required: ["targetSocketId", "answer"]
 *       properties:
 *         targetSocketId:
 *           type: string
 *           example: "socket-123"
 *           description: "대상 소켓 ID"
 *         answer:
 *           type: object
 *           description: "RTCSessionDescription"
 *           properties:
 *             type:
 *               type: string
 *               example: "answer"
 *             sdp:
 *               type: string
 *               example: "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n..."
 *     
 *     ICECandidate:
 *       type: object
 *       description: ICE Candidate 데이터
 *       required: ["targetSocketId", "candidate"]
 *       properties:
 *         targetSocketId:
 *           type: string
 *           example: "socket-123"
 *           description: "대상 소켓 ID"
 *         candidate:
 *           type: object
 *           description: "RTCIceCandidate"
 *           properties:
 *             candidate:
 *               type: string
 *               example: "candidate:842163049 1 udp 1677729535 192.168.0.1 54400 typ srflx raddr 0.0.0.0 rport 0 generation 0"
 *             sdpMLineIndex:
 *               type: number
 *               example: 0
 *             sdpMid:
 *               type: string
 *               example: "0"
 *     
 *     # 준비 상태 관련 이벤트
 *     PreparationStatusEvent:
 *       type: object
 *       description: 준비 상태 업데이트 이벤트
 *       required: ["characterSetup", "screenSetup"]
 *       properties:
 *         characterSetup:
 *           type: boolean
 *           example: true
 *           description: "캐릭터 설정 완료 여부"
 *         screenSetup:
 *           type: boolean
 *           example: false
 *           description: "화면 설정 완료 여부"
 *     
 *     CharacterStatusEvent:
 *       type: object
 *       description: 캐릭터 상태 업데이트 이벤트
 *       required: ["selectedOptions", "selectedColors"]
 *       properties:
 *         selectedOptions:
 *           type: object
 *           description: "캐릭터 선택 옵션"
 *           properties:
 *             face:
 *               type: string
 *               example: "face2"
 *             hair:
 *               type: string
 *               example: "hair1"
 *             top:
 *               type: string
 *               example: "top2"
 *             bottom:
 *               type: string
 *               example: "bottom3"
 *             accessory:
 *               type: string
 *               example: "accessories1"
 *         selectedColors:
 *           type: object
 *           description: "캐릭터 색상 설정"
 *           properties:
 *             face:
 *               type: string
 *               example: "beige"
 *             hair:
 *               type: string
 *               example: "red"
 *             top:
 *               type: string
 *               example: "green"
 *             bottom:
 *               type: string
 *               example: "blue"
 *             accessory:
 *               type: string
 *               example: "yellow"
 *     
 *     # 녹화 관련 이벤트
 *     StartRecordingEvent:
 *       type: object
 *       description: 녹화 시작 이벤트
 *       required: ["roomCode"]
 *       properties:
 *         roomCode:
 *           type: string
 *           example: "ABC123"
 *           description: "방 코드"
 *     
 *     StopRecordingEvent:
 *       type: object
 *       description: 녹화 중단 이벤트 (방장 전용)
 *       required: ["roomCode"]
 *       properties:
 *         roomCode:
 *           type: string
 *           example: "ABC123"
 *           description: "방 코드"
 *         sessionId:
 *           type: string
 *           example: "rec_session_123"
 *           description: "녹화 세션 ID (선택사항)"
 *     
 *     RecordingStartedEvent:
 *       type: object
 *       description: 녹화 시작 알림
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "rec_session_123"
 *         startedBy:
 *           type: string
 *           example: "플레이어1"
 *           description: "녹화 시작자 (SYSTEM인 경우 자동 시작)"
 *         autoStarted:
 *           type: boolean
 *           example: true
 *           description: "자동 시작 여부"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *     
 *     RecordingStoppedEvent:
 *       type: object
 *       description: 녹화 종료 알림
 *       properties:
 *         sessionId:
 *           type: string
 *           example: "rec_session_123"
 *         stoppedBy:
 *           type: string
 *           example: "방장닉네임"
 *         stoppedByHost:
 *           type: boolean
 *           example: true
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *     
 *     RecordingCountdownEvent:
 *       type: object
 *       description: 녹화 카운트다운 이벤트
 *       properties:
 *         countdown:
 *           type: integer
 *           example: 3
 *           description: "카운트다운 시간 (초)"
 *         count:
 *           type: integer
 *           example: 2
 *           description: "현재 카운트"
 *         message:
 *           type: string
 *           example: "모든 참여자가 준비되었습니다! 녹화가 곧 시작됩니다."
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *     
 *     # 채팅 관련 이벤트
 *     ChatMessageEvent:
 *       type: object
 *       description: 채팅 메시지 이벤트
 *       required: ["roomCode", "message", "timestamp"]
 *       properties:
 *         roomCode:
 *           type: string
 *           example: "ABC123"
 *         message:
 *           type: string
 *           example: "안녕하세요!"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *     
 *     ChatMessageReceived:
 *       type: object
 *       description: 수신된 채팅 메시지
 *       properties:
 *         roomCode:
 *           type: string
 *           example: "ABC123"
 *         message:
 *           type: string
 *           example: "안녕하세요!"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *         senderSocketId:
 *           type: string
 *           example: "socket_123"
 *         senderNickname:
 *           type: string
 *           example: "플레이어1"
 *         senderGuestUserId:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *     
 *     # 모니터링 관련 이벤트
 *     AudioQualityReportEvent:
 *       type: object
 *       description: 음성 품질 리포트
 *       required: ["latency", "packetLoss", "audioLevel"]
 *       properties:
 *         latency:
 *           type: number
 *           example: 50
 *           description: "지연시간 (ms)"
 *         packetLoss:
 *           type: number
 *           example: 0.1
 *           description: "패킷 손실률 (0-1)"
 *         audioLevel:
 *           type: number
 *           example: 0.8
 *           description: "음성 레벨 (0-1)"
 *     
 *     # 오류 관련 이벤트
 *     SocketErrorEvent:
 *       type: object
 *       description: Socket.IO 오류 이벤트
 *       properties:
 *         message:
 *           type: string
 *           example: "녹화 중단은 방장만 할 수 있습니다."
 *         code:
 *           type: string
 *           example: "INSUFFICIENT_PERMISSION"
 *           description: "오류 코드 (선택사항)"
 *     
 *     # 준비 완료 관련 이벤트
 *     ReadyToStartEvent:
 *       type: object
 *       description: 최종 준비 완료 이벤트 (레디 버튼)
 *       properties:
 *         guestUserId:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *           description: "준비 완료한 사용자 ID"
 *         nickname:
 *           type: string
 *           example: "플레이어1"
 *           description: "준비 완료한 사용자 닉네임"
 *         isReady:
 *           type: boolean
 *           example: true
 *           description: "준비 완료 상태"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *           description: "준비 완료 시간"
 *     
 *     AllUsersReadyEvent:
 *       type: object
 *       description: 모든 사용자 준비 완료 알림 (방장에게 전송)
 *       properties:
 *         message:
 *           type: string
 *           example: "모든 참여자가 준비 완료되었습니다. 녹화를 시작할 수 있습니다."
 *           description: "방장에게 전달할 메시지"
 *         readyCount:
 *           type: integer
 *           example: 4
 *           description: "준비 완료된 참여자 수"
 *         totalCount:
 *           type: integer
 *           example: 4
 *           description: "총 참여자 수"
 *         canStartRecording:
 *           type: boolean
 *           example: true
 *           description: "녹화 시작 가능 여부"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *           description: "알림 시간"
 *     
 *     ReadyStatusUpdateEvent:
 *       type: object
 *       description: 준비 상태 업데이트 알림
 *       properties:
 *         readyCount:
 *           type: integer
 *           example: 2
 *           description: "준비 완료된 참여자 수"
 *         totalCount:
 *           type: integer
 *           example: 4
 *           description: "총 참여자 수"
 *         canStartRecording:
 *           type: boolean
 *           example: false
 *           description: "녹화 시작 가능 여부"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-08-05T10:30:00.000Z"
 *           description: "업데이트 시간"
 *     
 *     # 참여자 입장/퇴장 이벤트
 *     UserJoinedEvent:
 *       type: object
 *       description: 새 사용자 참여 알림 (캐릭터 정보 포함)
 *       allOf:
 *         - $ref: "#/components/schemas/RoomUser"
 *       example:
 *         socketId: "socket_456"
 *         guestUserId: "550e8400-e29b-41d4-a716-446655440002"
 *         nickname: "새참여자"
 *         isHost: false
 *         joinedAt: "2025-08-05T10:35:00.000Z"
 *         preparationStatus:
 *           characterSetup: false
 *           screenSetup: false
 *         characterInfo:
 *           selectedOptions:
 *             face: "face1"
 *             hair: "hair2"
 *             top: "top1"
 *             bottom: "bottom2"
 *             accessory: "accessories1"
 *           selectedColors:
 *             face: "peach"
 *             hair: "brown"
 *             top: "blue"
 *             bottom: "black"
 *             accessory: "silver"
 *           isCustomized: true
 *     
 *     UserLeftEvent:
 *       type: object
 *       description: 사용자 퇴장 알림 (캐릭터 정보 포함)
 *       allOf:
 *         - $ref: "#/components/schemas/RoomUser"
 *       example:
 *         socketId: "socket_789"
 *         guestUserId: "550e8400-e29b-41d4-a716-446655440003"
 *         nickname: "퇴장자"
 *         isHost: false
 *         joinedAt: "2025-08-05T10:30:00.000Z"
 *         preparationStatus:
 *           characterSetup: true
 *           screenSetup: true
 *         characterInfo:
 *           selectedOptions:
 *             face: "face3"
 *             hair: "hair1"
 *             top: "top3"
 *             bottom: "bottom1"
 *             accessory: "accessories2"
 *           selectedColors:
 *             face: "tan"
 *             hair: "blonde"
 *             top: "red"
 *             bottom: "white"
 *             accessory: "gold"
 *           isCustomized: true
 *     
 *     RecordingErrorEvent:
 *       type: object
 *       description: 녹화 관련 오류 이벤트
 *       properties:
 *         message:
 *           type: string
 *           example: "녹화 시작 중 오류가 발생했습니다."
 *         code:
 *           type: string
 *           example: "RECORDING_START_FAILED"
 *           description: "오류 코드 (선택사항)"
 */

export default router;
