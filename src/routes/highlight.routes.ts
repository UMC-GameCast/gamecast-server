import { Router } from 'express';
import { HighlightController } from '../controllers/highlight.controller.js';

const router = Router();
const highlightController = new HighlightController();

/**
 * @swagger
 * /api/highlights/debug/{roomCode}:
 *   get:
 *     summary: 디버깅용 하이라이트 콜백 데이터 반환
 *     description: 하이라이트 처리 완료 후 콜백 데이터를 시뮬레이션하는 개발용 API입니다. roomCode만 요청값으로 교체되고 나머지는 고정 데이터를 반환합니다.
 *     tags: [Highlights - Debug]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *           example: "EHKCSY"
 *         description: 방 입장 코드
 *     responses:
 *       200:
 *         description: 디버깅용 하이라이트 콜백 데이터
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 room_code:
 *                   type: string
 *                   example: "EHKCSY"
 *                 game_title:
 *                   type: string
 *                   example: "League of Legends"
 *                 participants_count:
 *                   type: number
 *                   example: 3
 *                 processing_completed_at:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-08-21T10:53:12.280869"
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_highlights:
 *                       type: number
 *                       example: 2
 *                     total_participant_clips:
 *                       type: number
 *                       example: 6
 *                     total_duration:
 *                       type: number
 *                       example: 300.0
 *                     average_quality:
 *                       type: number
 *                       example: 1204.0499267578125
 *                 participants:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: string
 *                         example: "host"
 *                       audio_s3_key:
 *                         type: string
 *                         example: "EHKCSY/raw/host/audio/2025-08-21T10-37-43-789Z_edce797d-5144-4d77-af21-4b5d6fe02401_Host_Talk.MP3"
 *                       video_s3_key:
 *                         type: string
 *                         example: "EHKCSY/raw/host/video/2025-08-21T10-37-39-105Z_8d3d0ce8-efda-42c8-a12d-e3932bd8fa62_Host_Play.mp4"
 *                 highlights:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       highlight_id:
 *                         type: string
 *                         example: "b6154170-036f-4861-b8f8-7b50dd76f9d7"
 *                       highlight_number:
 *                         type: number
 *                         example: 1
 *                       highlight_name:
 *                         type: string
 *                         example: "Normal 하이라이트 #1 (180초)"
 *                       detected_by_user:
 *                         type: string
 *                         example: "host"
 *                       timing:
 *                         type: object
 *                         properties:
 *                           start_time:
 *                             type: number
 *                             example: 196.32
 *                           end_time:
 *                             type: number
 *                             example: 376.32
 *                           duration:
 *                             type: number
 *                             example: 180.0
 *                       emotion_info:
 *                         type: object
 *                       quality_metrics:
 *                         type: object
 *                       clip_files:
 *                         type: object
 *                       participant_clips:
 *                         type: array
 *       400:
 *         description: roomCode가 누락된 경우
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "roomCode가 필요합니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "디버깅용 하이라이트 데이터 생성 중 오류가 발생했습니다."
 */
router.get('/debug/:roomCode', highlightController.getDebugHighlightCallback.bind(highlightController));

export default router;
