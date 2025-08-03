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
      events: [
        'join-room',
        'leave-room',
        'offer',
        'answer',
        'ice-candidate',
        'chat-message',
        'request-room-users'
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
 *     WebRTCOffer:
 *       type: object
 *       description: WebRTC Offer 데이터
 *       properties:
 *         offer:
 *           type: object
 *           description: RTCSessionDescription
 *         targetSocketId:
 *           type: string
 *           description: 대상 소켓 ID
 *       example:
 *         offer:
 *           type: "offer"
 *           sdp: "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n..."
 *         targetSocketId: "socket-123"
 *     
 *     WebRTCAnswer:
 *       type: object
 *       description: WebRTC Answer 데이터
 *       properties:
 *         answer:
 *           type: object
 *           description: RTCSessionDescription
 *         targetSocketId:
 *           type: string
 *           description: 대상 소켓 ID
 *     
 *     ICECandidate:
 *       type: object
 *       description: ICE Candidate 데이터
 *       properties:
 *         candidate:
 *           type: object
 *           description: RTCIceCandidate
 *         targetSocketId:
 *           type: string
 *           description: 대상 소켓 ID
 */

export default router;
