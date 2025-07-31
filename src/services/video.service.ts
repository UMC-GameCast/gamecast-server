import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db.config.js';
import logger from '../logger.js';

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
  private readonly allowedVideoTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov'];
  private readonly allowedAudioTypes = ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/webm'];

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
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
   * 게임 녹화 영상 처리
   */
  public async processGameRecording(data: GameRecordingData): Promise<VideoResult> {
    const videoId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      // 파일 저장 경로 생성
      const videoExtension = path.extname(data.videoFile.originalname);
      const audioExtension = data.audioFile ? path.extname(data.audioFile.originalname) : null;
      
      const videoFileName = `${videoId}_video_${timestamp}${videoExtension}`;
      const audioFileName = audioExtension ? `${videoId}_audio_${timestamp}${audioExtension}` : null;
      
      const videoPath = path.join(this.uploadDir, videoFileName);
      const audioPath = audioFileName ? path.join(this.uploadDir, audioFileName) : undefined;

      // 파일 저장
      await fs.writeFile(videoPath, data.videoFile.buffer);
      logger.info('비디오 파일 저장 완료:', videoPath);

      if (data.audioFile && audioPath) {
        await fs.writeFile(audioPath, data.audioFile.buffer);
        logger.info('오디오 파일 저장 완료:', audioPath);
      }

      // 임시로 session 테이블에 저장 (나중에 적절한 video 테이블로 변경)
      const uploadRecord = await prisma.session.create({
        data: {
          id: videoId,
          sid: `video_${videoId}`,
          data: JSON.stringify({
            roomCode: data.metadata.roomCode,
            userId: data.metadata.userId,
            gameTitle: data.metadata.gameTitle,
            videoPath: videoPath,
            audioPath: audioPath,
            duration: data.metadata.duration,
            resolution: data.metadata.resolution,
            fps: data.metadata.fps,
            description: data.metadata.description,
            tags: data.metadata.tags,
            status: 'completed',
            fileSize: data.videoFile.size + (data.audioFile?.size || 0),
            type: 'game_recording'
          }),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30일 후 만료
        }
      });

      const result: VideoResult = {
        videoId: uploadRecord.id,
        videoPath: videoPath,
        audioPath: audioPath,
        metadata: data.metadata,
        uploadedAt: new Date(),
        status: 'completed'
      };

      logger.info('게임 녹화 업로드 처리 완료:', { videoId });
      
      return result;

    } catch (error) {
      logger.error('게임 녹화 업로드 처리 실패:', error);
      
      // 실패시 업로드된 파일 정리
      try {
        const videoPath = path.join(this.uploadDir, `${videoId}_video_${timestamp}`);
        const audioPath = path.join(this.uploadDir, `${videoId}_audio_${timestamp}`);
        
        await fs.unlink(videoPath).catch(() => {});
        if (data.audioFile) {
          await fs.unlink(audioPath).catch(() => {});
        }
      } catch (cleanupError) {
        logger.error('파일 정리 실패:', cleanupError);
      }

      throw new Error('파일 업로드 처리 중 오류가 발생했습니다.');
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
}
