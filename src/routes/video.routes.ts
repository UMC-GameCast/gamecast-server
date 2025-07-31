import { Router } from 'express';
import multer from 'multer';
import { VideoController } from '../controllers/video.controller.js';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware.js';

const router = Router();
const videoController = new VideoController();

// Multer 설정 - 메모리에 파일 저장
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 2 // 비디오 + 오디오 최대 2개 파일
  },
  fileFilter: (req, file, cb) => {
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov'];
    const allowedAudioTypes = ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/webm'];
    
    if (file.fieldname === 'video' && allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else if (file.fieldname === 'audio' && allowedAudioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다: ${file.mimetype}`), false);
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     VideoMetadata:
 *       type: object
 *       required:
 *         - roomCode
 *         - userId
 *         - gameTitle
 *         - duration
 *         - resolution
 *         - fps
 *       properties:
 *         roomCode:
 *           type: string
 *           description: 방 코드
 *           example: "ABCD12"
 *         userId:
 *           type: string
 *           description: 사용자 ID
 *           example: "user123"
 *         gameTitle:
 *           type: string
 *           description: 게임 제목
 *           example: "League of Legends"
 *         duration:
 *           type: integer
 *           description: 영상 길이 (초)
 *           example: 1800
 *         resolution:
 *           type: string
 *           description: 해상도
 *           example: "1920x1080"
 *         fps:
 *           type: integer
 *           description: 프레임 레이트
 *           example: 60
 *         description:
 *           type: string
 *           description: 영상 설명
 *           example: "Epic gaming moment"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: 태그 목록
 *           example: ["gaming", "highlight", "epic"]
 *     
 *     VideoResult:
 *       type: object
 *       properties:
 *         videoId:
 *           type: string
 *           description: 영상 ID
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         videoPath:
 *           type: string
 *           description: 비디오 파일 경로
 *         audioPath:
 *           type: string
 *           description: 오디오 파일 경로
 *         metadata:
 *           $ref: '#/components/schemas/VideoMetadata'
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           description: 업로드 시간
 *         status:
 *           type: string
 *           enum: [processing, completed, failed]
 *           description: 처리 상태
 *     
 *     VideoStatus:
 *       type: object
 *       properties:
 *         videoId:
 *           type: string
 *           description: 영상 ID
 *         status:
 *           type: string
 *           enum: [processing, completed, failed]
 *           description: 처리 상태
 *         progress:
 *           type: integer
 *           description: 진행률 (0-100)
 *         videoPath:
 *           type: string
 *           description: 비디오 파일 경로
 *         audioPath:
 *           type: string
 *           description: 오디오 파일 경로
 *         error:
 *           type: string
 *           description: 오류 메시지
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     VideoListResult:
 *       type: object
 *       properties:
 *         videos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/VideoResult'
 *         totalCount:
 *           type: integer
 *           description: 전체 영상 수
 *         currentPage:
 *           type: integer
 *           description: 현재 페이지
 *         totalPages:
 *           type: integer
 *           description: 전체 페이지 수
 *         hasNextPage:
 *           type: boolean
 *           description: 다음 페이지 존재 여부
 *         hasPrevPage:
 *           type: boolean
 *           description: 이전 페이지 존재 여부
 */

/**
 * @swagger
 * /api/videos/upload:
 *   post:
 *     summary: 게임 녹화 영상 업로드
 *     description: 게임 녹화 영상 파일과 오디오 파일, 메타데이터를 업로드합니다.
 *     tags: [Videos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *               - roomCode
 *               - userId
 *               - gameTitle
 *               - duration
 *               - resolution
 *               - fps
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: 게임 녹화 영상 파일 (MP4, WebM, AVI, MOV)
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: 마이크 녹음 오디오 파일 (MP3, WAV, AAC, WebM) - 선택사항
 *               roomCode:
 *                 type: string
 *                 description: 방 코드
 *                 example: "ABCD12"
 *               userId:
 *                 type: string
 *                 description: 사용자 ID
 *                 example: "user123"
 *               gameTitle:
 *                 type: string
 *                 description: 게임 제목
 *                 example: "League of Legends"
 *               duration:
 *                 type: integer
 *                 description: 영상 길이 (초)
 *                 example: 1800
 *               resolution:
 *                 type: string
 *                 description: 해상도
 *                 example: "1920x1080"
 *               fps:
 *                 type: integer
 *                 description: 프레임 레이트
 *                 example: 60
 *               description:
 *                 type: string
 *                 description: 영상 설명
 *                 example: "Epic gaming moment"
 *               tags:
 *                 type: string
 *                 description: 태그 목록 (JSON 문자열)
 *                 example: '["gaming", "highlight", "epic"]'
 *     responses:
 *       201:
 *         description: 영상 업로드 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "게임 녹화 영상이 성공적으로 업로드되었습니다."
 *                     data:
 *                       $ref: '#/components/schemas/VideoResult'
 *       400:
 *         description: 잘못된 요청 (파일 누락, 형식 오류 등)
 *       413:
 *         description: 파일 크기 초과
 *       500:
 *         description: 서버 오류
 */
router.post('/upload', 
  rateLimitMiddleware.upload,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
  ]),
  videoController.uploadGameRecording
);

/**
 * @swagger
 * /api/videos/{videoId}/status:
 *   get:
 *     summary: 영상 처리 상태 조회
 *     description: 업로드된 영상의 처리 상태를 조회합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         description: 영상 ID
 *         schema:
 *           type: string
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: 상태 조회 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "영상 상태 조회 성공"
 *                     data:
 *                       $ref: '#/components/schemas/VideoStatus'
 *       404:
 *         description: 영상을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:videoId/status', videoController.getVideoStatus);

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: 영상 목록 조회
 *     description: 업로드된 영상 목록을 조회합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: query
 *         name: userId
 *         description: 사용자 ID로 필터링
 *         schema:
 *           type: string
 *           example: "user123"
 *       - in: query
 *         name: roomCode
 *         description: 방 코드로 필터링
 *         schema:
 *           type: string
 *           example: "ABCD12"
 *       - in: query
 *         name: page
 *         description: 페이지 번호
 *         schema:
 *           type: integer
 *           default: 1
 *           example: 1
 *       - in: query
 *         name: limit
 *         description: 페이지당 항목 수
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *           example: 10
 *     responses:
 *       200:
 *         description: 목록 조회 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "영상 목록 조회 성공"
 *                     data:
 *                       $ref: '#/components/schemas/VideoListResult'
 *       500:
 *         description: 서버 오류
 */
router.get('/', videoController.getVideos);

/**
 * @swagger
 * /api/videos/{videoId}/stream:
 *   get:
 *     summary: 영상 스트리밍
 *     description: 영상을 스트리밍으로 재생합니다. Range 요청을 지원합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         description: 영상 ID
 *         schema:
 *           type: string
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: header
 *         name: Range
 *         description: HTTP Range 헤더 (부분 요청)
 *         schema:
 *           type: string
 *           example: "bytes=0-1023"
 *     responses:
 *       200:
 *         description: 전체 영상 스트리밍
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       206:
 *         description: 부분 영상 스트리밍 (Range 요청)
 *         headers:
 *           Content-Range:
 *             description: 전송되는 바이트 범위
 *             schema:
 *               type: string
 *               example: "bytes 0-1023/2048"
 *           Accept-Ranges:
 *             description: 지원하는 범위 단위
 *             schema:
 *               type: string
 *               example: "bytes"
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 영상을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:videoId/stream', videoController.streamVideo);

/**
 * @swagger
 * /api/videos/{videoId}/download:
 *   get:
 *     summary: 영상 다운로드
 *     description: 영상 파일을 다운로드합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         description: 영상 ID
 *         schema:
 *           type: string
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: userId
 *         required: true
 *         description: 사용자 ID (권한 확인용)
 *         schema:
 *           type: string
 *           example: "user123"
 *     responses:
 *       200:
 *         description: 다운로드 성공
 *         headers:
 *           Content-Disposition:
 *             description: 다운로드 파일명
 *             schema:
 *               type: string
 *               example: 'attachment; filename="game_recording.mp4"'
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 영상을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:videoId/download', videoController.downloadVideo);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   delete:
 *     summary: 영상 삭제
 *     description: 업로드된 영상을 삭제합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         description: 영상 ID
 *         schema:
 *           type: string
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 사용자 ID (권한 확인용)
 *                 example: "user123"
 *     responses:
 *       200:
 *         description: 삭제 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "영상이 성공적으로 삭제되었습니다."
 *                     data:
 *                       type: object
 *                       properties:
 *                         videoId:
 *                           type: string
 *                           example: "123e4567-e89b-12d3-a456-426614174000"
 *       404:
 *         description: 영상을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/:videoId', videoController.deleteVideo);

/**
 * @swagger
 * /api/videos/highlight/extract/{roomCode}:
 *   post:
 *     summary: 하이라이트 추출 시작
 *     description: 방의 모든 영상을 하이라이트 추출 서버로 전송하여 하이라이트 영상 생성을 시작합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 코드
 *         example: "ABCD12"
 *     responses:
 *       200:
 *         description: 하이라이트 추출 시작 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       description: 하이라이트 추출 작업 ID
 *                       example: "job_123456789"
 *                     status:
 *                       type: string
 *                       description: 작업 상태
 *                       example: "accepted"
 *                     message:
 *                       type: string
 *                       example: "하이라이트 추출이 시작되었습니다."
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/highlight/extract/:roomCode', videoController.startHighlightExtraction);

/**
 * @swagger
 * /api/videos/highlight/status/{jobId}:
 *   get:
 *     summary: 하이라이트 추출 상태 조회
 *     description: 진행 중인 하이라이트 추출 작업의 상태를 조회합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 하이라이트 추출 작업 ID
 *         example: "job_123456789"
 *     responses:
 *       200:
 *         description: 상태 조회 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_123456789"
 *                     status:
 *                       type: string
 *                       enum: [accepted, processing, completed, failed]
 *                       example: "processing"
 *                     progress:
 *                       type: number
 *                       description: 진행률 (0-100)
 *                       example: 45
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/highlight/status/:jobId', videoController.getHighlightExtractionStatus);

/**
 * @swagger
 * /api/videos/highlight/list/{roomCode}:
 *   get:
 *     summary: 완성된 하이라이트 영상 목록 조회
 *     description: 특정 방의 완성된 하이라이트 영상 목록을 조회합니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 코드
 *         example: "ABCD12"
 *     responses:
 *       200:
 *         description: 목록 조회 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     roomCode:
 *                       type: string
 *                       example: "ABCD12"
 *                     highlights:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           highlightId:
 *                             type: string
 *                             example: "highlight_123456789"
 *                           title:
 *                             type: string
 *                             example: "Epic Victory Highlight"
 *                           duration:
 *                             type: number
 *                             description: 영상 길이 (초)
 *                             example: 120
 *                           downloadUrl:
 *                             type: string
 *                             description: S3 다운로드 URL
 *                             example: "https://s3.amazonaws.com/bucket/highlight.mp4"
 *                           thumbnailS3Key:
 *                             type: string
 *                             description: 썸네일 S3 키
 *                             example: "highlights/ABCD12/thumbnail_123.jpg"
 *                           processedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2023-11-15T10:30:00.000Z"
 *                     totalCount:
 *                       type: number
 *                       example: 3
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/highlight/list/:roomCode', videoController.getHighlightVideos);

/**
 * @swagger
 * /api/videos/highlight-callback/{roomCode}:
 *   post:
 *     summary: 하이라이트 추출 완료 콜백
 *     description: 하이라이트 추출 서버에서 작업 완료 시 호출하는 콜백 엔드포인트입니다.
 *     tags: [Videos]
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: 방 코드
 *         example: "ABCD12"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - roomCode
 *               - status
 *               - processedAt
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: 하이라이트 추출 작업 ID
 *                 example: "job_123456789"
 *               roomCode:
 *                 type: string
 *                 description: 방 코드
 *                 example: "ABCD12"
 *               status:
 *                 type: string
 *                 enum: [completed, failed]
 *                 description: 작업 완료 상태
 *                 example: "completed"
 *               highlightVideos:
 *                 type: array
 *                 description: 생성된 하이라이트 영상 목록
 *                 items:
 *                   type: object
 *                   properties:
 *                     s3Key:
 *                       type: string
 *                       example: "highlights/ABCD12/highlight_01.mp4"
 *                     title:
 *                       type: string
 *                       example: "Epic Victory Moment"
 *                     duration:
 *                       type: number
 *                       example: 120
 *                     thumbnailS3Key:
 *                       type: string
 *                       example: "highlights/ABCD12/thumbnail_01.jpg"
 *               error:
 *                 type: string
 *                 description: 실패 시 에러 메시지
 *                 example: "Processing failed: insufficient video quality"
 *               processedAt:
 *                 type: string
 *                 format: date-time
 *                 description: 처리 완료 시간
 *                 example: "2023-11-15T10:30:00.000Z"
 *     responses:
 *       200:
 *         description: 콜백 처리 성공
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
 *                 success:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "콜백 처리가 완료되었습니다."
 *                     jobId:
 *                       type: string
 *                       example: "job_123456789"
 *                     roomCode:
 *                       type: string
 *                       example: "ABCD12"
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/highlight-callback/:roomCode', videoController.handleHighlightCallback);

export default router;
