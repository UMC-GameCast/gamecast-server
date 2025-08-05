import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db.config.js';
import logger from '../logger.js';
import { S3Service } from './s3.service.js';
import { HighlightExtractionService, VideoProcessingRequest } from './highlight-extraction.service.js';

export interface GameRecordingData {
  videoFile: MulterFile;
  audioFile?: MulterFile;
  metadata: VideoMetadata;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename?: string;
  path?: string;
}

export interface VideoMetadata {
  roomCode: string;
  userId: string;
  gameTitle: string;
  duration: number;
  resolution: string;
  fps: number;
  description?: string;
  tags: string[];
}


export interface VideoResult {
  videoId: string;
  videoPath: string;
  audioPath?: string;
  thumbnailPath?: string;
  metadata: VideoMetadata;
  uploadedAt: Date;
  status: 'processing' | 'completed' | 'failed';
}

export interface VideoStatus {
  videoId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  videoPath?: string;
  audioPath?: string;
  thumbnailPath?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileValidation {
  isValid: boolean;
  message: string;
}

export interface VideoListQuery {
  userId?: string;
  roomCode?: string;
  page: number;
  limit: number;
}

export interface VideoListResult {
  videos: VideoResult[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StreamResult {
  statusCode: number;
  headers: { [key: string]: string };
  stream: NodeJS.ReadableStream;
}

export interface DownloadResult {
  filename: string;
  contentType: string;
  size: number;
  stream: NodeJS.ReadableStream;
}

export class VideoService {
  private readonly uploadDir: string;
  private readonly maxFileSize = 500 * 1024 * 1024; // 500MB
  private readonly allowedVideoTypes = [
    'video/mp4', 
    'video/webm', 
    'video/avi', 
    'video/mov',
    'video/quicktime',
    'video/x-msvideo'
  ];
  private readonly allowedAudioTypes = [
    'audio/mp3',
    'audio/mpeg',   // MP3 파일 지원 추가
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/aac',
    'audio/webm',
    'audio/ogg'
  ];
  private readonly s3Service: S3Service;
  private readonly highlightService: HighlightExtractionService;
  
  // 방별 영상 정보를 임시 저장할 Map (실제로는 Redis 등을 사용하는 것이 좋음)
  private roomVideos: Map<string, Array<{
    userId: string;
    videoS3Key: string;
    audioS3Key?: string;
    metadata: {
      gameTitle: string;
      duration: number;
      resolution: string;
      fps: number;
    }
  }>> = new Map();

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.s3Service = new S3Service();
    this.highlightService = new HighlightExtractionService();
    this.ensureUploadDirectory();
  }

  /**
   * 업로드 디렉토리 확인 및 생성
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info('업로드 디렉토리 생성:', this.uploadDir);
    }
  }

  /**
   * 파일 검증
   */
  public validateFiles(videoFile: MulterFile, audioFile?: MulterFile): FileValidation {
    // 비디오 파일 검증
    if (videoFile.size > this.maxFileSize) {
      return {
        isValid: false,
        message: `비디오 파일 크기가 너무 큽니다. 최대 ${this.maxFileSize / 1024 / 1024}MB까지 허용됩니다.`
      };
    }

    if (!this.allowedVideoTypes.includes(videoFile.mimetype)) {
      return {
        isValid: false,
        message: `지원하지 않는 비디오 형식입니다. 허용된 형식: ${this.allowedVideoTypes.join(', ')}`
      };
    }

    // 오디오 파일 검증 (선택사항)
    if (audioFile) {
      if (audioFile.size > this.maxFileSize) {
        return {
          isValid: false,
          message: `오디오 파일 크기가 너무 큽니다. 최대 ${this.maxFileSize / 1024 / 1024}MB까지 허용됩니다.`
        };
      }

      if (!this.allowedAudioTypes.includes(audioFile.mimetype)) {
        return {
          isValid: false,
          message: `지원하지 않는 오디오 형식입니다. 허용된 형식: ${this.allowedAudioTypes.join(', ')}`
        };
      }
    }

    return { isValid: true, message: 'Valid' };
  }

  /**
   * 게임 녹화 영상 처리 (S3 업로드 및 하이라이트 추출 포함)
   */
  public async processGameRecording(data: GameRecordingData): Promise<VideoResult> {
    const videoId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      logger.info('게임 녹화 영상 처리 시작', {
        videoId,
        roomCode: data.metadata.roomCode,
        userId: data.metadata.userId,
        videoSize: data.videoFile.size,
        audioSize: data.audioFile?.size || 0
      });

      // 1. S3에 원본 영상 업로드
      const videoS3Key = this.s3Service.generateOriginalVideoKey(
        data.metadata.roomCode,
        data.metadata.userId,
        data.videoFile.originalname
      );

      const videoUploadResult = await this.s3Service.uploadBuffer(
        data.videoFile.buffer,
        videoS3Key,
        data.videoFile.mimetype
      );

      logger.info('비디오 파일 S3 업로드 완료', {
        videoId,
        s3Key: videoS3Key,
        etag: videoUploadResult.etag
      });

      // 2. S3에 오디오 파일 업로드 (선택사항)
      let audioS3Key: string | undefined;
      let audioUploadResult: any = null;
      if (data.audioFile) {
        audioS3Key = this.s3Service.generateOriginalAudioKey(
          data.metadata.roomCode,
          data.metadata.userId,
          data.audioFile.originalname
        );

        audioUploadResult = await this.s3Service.uploadBuffer(
          data.audioFile.buffer,
          audioS3Key,
          data.audioFile.mimetype
        );

        logger.info('오디오 파일 S3 업로드 완료', {
          videoId,
          s3Key: audioS3Key,
          etag: audioUploadResult.etag
        });
      }

      // 3. 로컬에도 임시 저장 (백업 및 즉시 스트리밍용) - S3 업로드 성공시 선택적으로 저장
      let videoPath: string | undefined;
      let audioPath: string | undefined;
      
      try {
        const videoExtension = path.extname(data.videoFile.originalname);
        const audioExtension = data.audioFile ? path.extname(data.audioFile.originalname) : null;
        
        const videoFileName = `${videoId}_video_${timestamp}${videoExtension}`;
        const audioFileName = audioExtension ? `${videoId}_audio_${timestamp}${audioExtension}` : null;
        
        videoPath = path.join(this.uploadDir, videoFileName);
        audioPath = audioFileName ? path.join(this.uploadDir, audioFileName) : undefined;

        // uploads 디렉토리 권한 확인
        await fs.access(this.uploadDir, fs.constants.W_OK);
        
        await fs.writeFile(videoPath, data.videoFile.buffer);
        if (data.audioFile && audioPath) {
          await fs.writeFile(audioPath, data.audioFile.buffer);
        }
        
        logger.info('로컬 파일 저장 완료', { videoPath, audioPath });
      } catch (localSaveError) {
        logger.warn('로컬 파일 저장 실패 - S3 업로드는 성공했으므로 계속 진행', {
          error: localSaveError instanceof Error ? localSaveError.message : String(localSaveError),
          videoId
        });
        // 로컬 저장 실패시 S3 URL을 경로로 사용
        videoPath = videoUploadResult.location;
        audioPath = audioUploadResult?.location;
      }

      // 3. 방별 영상 정보를 메모리에 저장 (하이라이트 추출용)
      const videoInfo = {
        userId: data.metadata.userId,
        videoS3Key: videoS3Key,
        audioS3Key: audioS3Key,
        metadata: {
          gameTitle: data.metadata.gameTitle,
          duration: data.metadata.duration,
          resolution: data.metadata.resolution,
          fps: data.metadata.fps
        }
      };

      // 해당 방의 영상 목록에 추가
      if (!this.roomVideos.has(data.metadata.roomCode)) {
        this.roomVideos.set(data.metadata.roomCode, []);
      }
      this.roomVideos.get(data.metadata.roomCode)!.push(videoInfo);

      logger.info('게임 녹화 S3 업로드 완료', {
        videoId,
        roomCode: data.metadata.roomCode,
        userId: data.metadata.userId,
        videoS3Key: videoS3Key,
        audioS3Key: audioS3Key,
        videoSize: data.videoFile.size,
        audioSize: data.audioFile?.size || 0,
        status: 'completed',
        roomVideoCount: this.roomVideos.get(data.metadata.roomCode)!.length
      });

      const result: VideoResult = {
        videoId: videoId,
        videoPath: videoUploadResult.location, // S3 URL 사용
        audioPath: audioUploadResult?.location, // S3 URL 사용
        metadata: data.metadata,
        uploadedAt: new Date(),
        status: 'completed'
      };
      
      return result;

    } catch (error) {
      logger.error('게임 녹화 업로드 처리 실패 - 상세 정보', {
        videoId,
        roomCode: data.metadata.roomCode,
        userId: data.metadata.userId,
        videoFileSize: data.videoFile.size,
        audioFileSize: data.audioFile?.size || 0,
        videoMimeType: data.videoFile.mimetype,
        audioMimeType: data.audioFile?.mimetype || 'none',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        timestamp: new Date().toISOString()
      });
      
      // 실패시 업로드된 파일 정리
      try {
        const videoPath = path.join(this.uploadDir, `${videoId}_video_${timestamp}`);
        const audioPath = path.join(this.uploadDir, `${videoId}_audio_${timestamp}`);
        
        await fs.unlink(videoPath).catch(() => {});
        if (data.audioFile) {
          await fs.unlink(audioPath).catch(() => {});
        }
        logger.info('실패한 업로드 파일 정리 완료', { videoId });
      } catch (cleanupError) {
        logger.error('파일 정리 실패 - 상세 정보', {
          videoId,
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          cleanupErrorStack: cleanupError instanceof Error ? cleanupError.stack : undefined
        });
      }

      // 원본 에러 정보를 포함한 새로운 에러 던지기
      const originalError = error instanceof Error ? error.message : String(error);
      throw new Error(`파일 업로드 처리 실패: ${originalError}`);
    }
  }

  /**
   * 영상 상태 조회
   */
  public async getVideoStatus(videoId: string): Promise<VideoStatus | null> {
    try {
      const video = await prisma.session.findUnique({
        where: { id: videoId }
      });

      if (!video || !video.data) {
        return null;
      }

      const videoData = JSON.parse(video.data);
      if (videoData.type !== 'game_recording') {
        return null;
      }

      return {
        videoId: video.id,
        status: videoData.status || 'completed',
        progress: videoData.status === 'completed' ? 100 : videoData.status === 'failed' ? 0 : 50,
        videoPath: videoData.videoPath,
        audioPath: videoData.audioPath || undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

    } catch (error) {
      logger.error('영상 상태 조회 실패:', error);
      throw new Error('영상 상태 조회 중 오류가 발생했습니다.');
    }
  }

  /**
   * 영상 목록 조회
   */
  public async getVideos(query: VideoListQuery): Promise<VideoListResult> {
    try {
      const { userId, roomCode, page, limit } = query;
      const skip = (page - 1) * limit;

      // session 테이블에서 game_recording 타입의 데이터만 조회
      const [sessions, totalCount] = await Promise.all([
        prisma.session.findMany({
          skip,
          take: limit,
          orderBy: { expiresAt: 'desc' }
        }),
        prisma.session.count()
      ]);

      // game_recording 타입만 필터링하고 조건에 맞는 것만 선택
      const videos = sessions
        .filter(session => {
          if (!session.data) return false;
          try {
            const data = JSON.parse(session.data);
            if (data.type !== 'game_recording') return false;
            if (userId && data.userId !== userId) return false;
            if (roomCode && data.roomCode !== roomCode) return false;
            return true;
          } catch {
            return false;
          }
        })
        .map(session => {
          const data = JSON.parse(session.data);
          return {
            videoId: session.id,
            videoPath: data.videoPath,
            audioPath: data.audioPath || undefined,
            metadata: {
              roomCode: data.roomCode,
              userId: data.userId,
              gameTitle: data.gameTitle,
              duration: data.duration,
              resolution: data.resolution,
              fps: data.fps,
              description: data.description,
              tags: data.tags || []
            },
            uploadedAt: new Date(),
            status: data.status as 'processing' | 'completed' | 'failed'
          };
        });

      const filteredTotal = videos.length;
      const totalPages = Math.ceil(filteredTotal / limit);

      const result: VideoListResult = {
        videos,
        totalCount: filteredTotal,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };

      return result;

    } catch (error) {
      logger.error('영상 목록 조회 실패:', error);
      throw new Error('영상 목록 조회 중 오류가 발생했습니다.');
    }
  }

  /**
   * 영상 삭제
   */
  public async deleteVideo(videoId: string, userId: string): Promise<boolean> {
    try {
      const video = await prisma.session.findFirst({
        where: { id: videoId }
      });

      if (!video || !video.data) {
        return false;
      }

      const videoData = JSON.parse(video.data);
      if (videoData.type !== 'game_recording' || videoData.userId !== userId) {
        return false;
      }

      // 파일 삭제
      try {
        if (videoData.videoPath) {
          await fs.unlink(videoData.videoPath);
          logger.info('비디오 파일 삭제 완료:', videoData.videoPath);
        }
        if (videoData.audioPath) {
          await fs.unlink(videoData.audioPath);
          logger.info('오디오 파일 삭제 완료:', videoData.audioPath);
        }
      } catch (fileError) {
        logger.warn('파일 삭제 실패 (이미 삭제됨):', fileError);
      }

      // 데이터베이스 레코드 삭제
      await prisma.session.delete({
        where: { id: videoId }
      });

      logger.info('영상 레코드 삭제 완료:', videoId);
      return true;

    } catch (error) {
      logger.error('영상 삭제 실패:', error);
      throw new Error('영상 삭제 중 오류가 발생했습니다.');
    }
  }

  /**
   * 영상 스트리밍을 위한 데이터 조회
   */
  public async streamVideo(videoId: string, range?: string): Promise<StreamResult | null> {
    try {
      const video = await prisma.session.findUnique({
        where: { id: videoId }
      });

      if (!video || !video.data) {
        return null;
      }

      const videoData = JSON.parse(video.data);
      if (videoData.type !== 'game_recording' || !videoData.videoPath) {
        return null;
      }

      const videoPath = videoData.videoPath;
      const stat = await fs.stat(videoPath);
      const fileSize = stat.size;

      if (range) {
        // Range 요청 처리 (HTTP 206 Partial Content)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const stream = fsSync.createReadStream(videoPath, { start, end });

        return {
          statusCode: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': 'video/mp4'
          },
          stream
        };
      } else {
        // 전체 파일 스트리밍
        const stream = fsSync.createReadStream(videoPath);

        return {
          statusCode: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': 'video/mp4'
          },
          stream
        };
      }

    } catch (error) {
      logger.error('영상 스트리밍 데이터 조회 실패:', error);
      throw new Error('영상 스트리밍 데이터 조회 중 오류가 발생했습니다.');
    }
  }

  /**
   * 영상 다운로드를 위한 데이터 조회
   */
  public async getVideoForDownload(videoId: string, userId: string): Promise<DownloadResult | null> {
    try {
      const video = await prisma.session.findFirst({
        where: { id: videoId }
      });

      if (!video || !video.data) {
        return null;
      }

      const videoData = JSON.parse(video.data);
      if (videoData.type !== 'game_recording' || videoData.userId !== userId || !videoData.videoPath) {
        return null;
      }

      const videoPath = videoData.videoPath;
      const stat = await fs.stat(videoPath);
      const stream = fsSync.createReadStream(videoPath);

      const filename = `${videoData.gameTitle}_${videoId}.${path.extname(videoPath).slice(1)}`;

      return {
        filename,
        contentType: 'video/mp4',
        size: stat.size,
        stream
      };

    } catch (error) {
      logger.error('영상 다운로드 데이터 조회 실패:', error);
      throw new Error('영상 다운로드 데이터 조회 중 오류가 발생했습니다.');
    }
  }

  /**
   * 방의 모든 영상을 하이라이트 추출 서버로 전송
   */
  public async startHighlightExtraction(roomCode: string): Promise<{ jobId: string; status: string }> {
    try {
      logger.info('하이라이트 추출 프로세스 시작', { 
        roomCode,
        memoryKeysCount: this.roomVideos.size,
        allRoomCodes: Array.from(this.roomVideos.keys())
      });

      // 메모리에서 해당 방의 영상 정보 조회
      const videos = this.roomVideos.get(roomCode) || [];

      logger.info('방별 영상 정보 조회 결과', {
        roomCode,
        videosFound: videos.length,
        videoDetails: videos.map(v => ({
          userId: v.userId,
          videoS3Key: v.videoS3Key,
          audioS3Key: v.audioS3Key,
          gameTitle: v.metadata.gameTitle
        }))
      });

      if (videos.length === 0) {
        throw new Error('해당 방에 업로드된 영상이 없습니다.');
      }

      // 하이라이트 추출 요청 데이터 구성
      const extractionRequest: VideoProcessingRequest = {
        roomCode: roomCode,
        gameTitle: videos.length > 0 ? videos[0].metadata.gameTitle : 'Unknown Game',
        participants: videos.map(video => ({
          userId: video.userId,
          audio_s3_key: video.audioS3Key || '',
          video_s3_key: video.videoS3Key
        })),
        callbackUrl: this.highlightService.generateCallbackUrl(roomCode)
      };

      // 하이라이트 추출 서버에 요청
      const response = await this.highlightService.startHighlightExtraction(extractionRequest);

      logger.info('하이라이트 추출 요청 성공', {
        roomCode: roomCode,
        jobId: response.jobId,
        participantCount: videos.length
      });

      return {
        jobId: response.jobId,
        status: response.status
      };

    } catch (error) {
      logger.error('하이라이트 추출 프로세스 시작 실패', {
        roomCode: roomCode,
        error: error
      });
      throw error;
    }
  }

  /**
   * 디버깅용: 메모리에 저장된 방별 영상 정보 조회
   */
  public getRoomVideosInfo(): { [roomCode: string]: any[] } {
    const result: { [roomCode: string]: any[] } = {};
    for (const [roomCode, videos] of this.roomVideos.entries()) {
      result[roomCode] = videos.map(v => ({
        userId: v.userId,
        videoS3Key: v.videoS3Key,
        audioS3Key: v.audioS3Key,
        gameTitle: v.metadata.gameTitle,
        duration: v.metadata.duration
      }));
    }
    return result;
  }

  /**
   * 하이라이트 추출 상태 조회
   */
  public async getHighlightExtractionStatus(jobId: string): Promise<{ status: string; progress?: number }> {
    try {
      const response = await this.highlightService.getExtractionStatus(jobId);

      return {
        status: response.status,
        progress: response.estimatedTimeMinutes ? 100 - response.estimatedTimeMinutes : undefined
      };

    } catch (error) {
      logger.error('하이라이트 추출 상태 조회 실패', {
        jobId: jobId,
        error: error
      });
      throw error;
    }
  }

  /**
   * 완성된 하이라이트 영상 목록 조회
   */
  public async getHighlightVideos(roomCode: string): Promise<any[]> {
    try {
      // Room 테이블에서 roomCode로 roomId 조회
      const room = await prisma.room.findUnique({
        where: { roomCode: roomCode }
      });

      if (!room) {
        logger.warn('Room not found for roomCode', { roomCode });
        return [];
      }

      // RecordingSession 테이블에서 하이라이트 정보가 있는 방 조회
      const recordingSessions = await prisma.recordingSession.findMany({
        where: {
          roomId: room.id,
          status: 'completed'
        },
        include: {
          highlightAnalyses: {
            include: {
              highlightClips: true
            }
          },
          mediaAssets: true
        },
        orderBy: {
          endedAt: 'desc'
        }
      });

      const highlights = recordingSessions
        .map((session: any) => {
          if (!session.highlightAnalyses || session.highlightAnalyses.length === 0) return null;
          
          // 각 하이라이트 분석에서 클립들을 가져와서 참가자별로 매핑
          return session.highlightAnalyses.flatMap((analysis: any) => {
            return analysis.highlightClips.map((clip: any) => {
              // detectionFeatures에서 정보 추출
              const features = clip.detectionFeatures || {};
              
              return {
                highlightId: clip.id,
                roomCode: roomCode,
                gameTitle: session.recordingSettings?.gameTitle || 'League of Legends',
                participantName: features.guestUserId || 'unknown',
                videoStartTime: parseFloat(clip.startTimestamp.toString()),
                videoEndTime: parseFloat(clip.endTimestamp.toString()),
                description: features.description || clip.clipName || '',
                videoUrl: features.s3Url || clip.mainSourceFilePath,
                audioUrl: null, // 오디오는 별도 처리 필요시 추가
                thumbnailUrl: null,
                score: features.score || parseFloat(clip.confidenceScore?.toString() || '0'),
                createdAt: session.startedAt,
                tags: features.tags || [],
                highlightNumber: features.highlightNumber,
                emotion: features.emotion,
                emotionIntensity: features.emotionIntensity,
                detectedByUser: features.detectedByUser,
                isMainDetector: features.isMainDetector,
                filename: features.filename,
                s3Key: features.s3Key,
                totalClips: features.totalClips,
                allClipUrls: features.allClipUrls,
                s3FolderPath: features.s3FolderPath,
                duration: parseFloat(clip.endTimestamp.toString()) - parseFloat(clip.startTimestamp.toString())
              };
            });
          });
        })
        .flat()
        .filter((highlight: any): highlight is NonNullable<typeof highlight> => highlight !== null);

      logger.info('하이라이트 영상 목록 조회 결과', {
        roomCode: roomCode,
        foundHighlights: highlights.length
      });

      return highlights;

      logger.info('하이라이트 영상 목록 조회 완료', {
        roomCode: roomCode,
        highlightCount: highlights.length
      });
      return highlights;

    } catch (error) {
      logger.error('하이라이트 영상 목록 조회 실패', {
        roomCode: roomCode,
        error: error
      });
      throw error;
    }
  }
}
