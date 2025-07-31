import { Request, Response } from 'express';
import { VideoService } from '../services/video.service.js';
import logger from '../logger.js';

// Multer 파일 타입 정의
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename?: string;
  path?: string;
}

// Express Request 확장 (multer 사용시)
interface MulterRequest extends Request {
  files?: { [fieldname: string]: MulterFile[] } | MulterFile[];
}

export class VideoController {
  private videoService: VideoService;

  constructor() {
    this.videoService = new VideoService();
  }

  /**
   * 게임 녹화 영상 업로드
   */
  public uploadGameRecording = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('게임 녹화 영상 업로드 요청');

      const files = (req as any).files as { [fieldname: string]: MulterFile[] };
      const metadata = req.body;

      if (!files?.video || !files.video[0]) {
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'MISSING_VIDEO_FILE',
            reason: '게임 녹화 영상 파일이 필요합니다.',
            data: null
          },
          success: null
        });
        return;
      }

      const videoFile = files.video[0];
      const audioFile = files.audio ? files.audio[0] : undefined;

      // 파일 검증
      const validation = this.videoService.validateFiles(videoFile, audioFile);
      if (!validation.isValid) {
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'INVALID_FILE',
            reason: validation.message,
            data: null
          },
          success: null
        });
        return;
      }

      // 업로드 처리
      const result = await this.videoService.processGameRecording({
        videoFile,
        audioFile,
        metadata: {
          roomCode: metadata.roomCode,
          userId: metadata.userId,
          gameTitle: metadata.gameTitle,
          duration: parseInt(metadata.duration) || 0,
          resolution: metadata.resolution,
          fps: parseInt(metadata.fps) || 30,
          description: metadata.description,
          tags: metadata.tags ? JSON.parse(metadata.tags) : []
        }
      });

      logger.info('게임 녹화 영상 업로드 완료', { videoId: result.videoId });

      res.status(201).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '게임 녹화 영상이 성공적으로 업로드되었습니다.',
          data: result
        }
      });

    } catch (error) {
      logger.error('게임 녹화 영상 업로드 실패:', error);
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'UPLOAD_FAILED',
          reason: '파일 업로드 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 영상 상태 확인
   */
  public getVideoStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;

      const status = await this.videoService.getVideoStatus(videoId);

      if (!status) {
        res.status(404).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'VIDEO_NOT_FOUND',
            reason: '영상 정보를 찾을 수 없습니다.',
            data: null
          },
          success: null
        });
        return;
      }

      res.json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '영상 상태 조회 성공',
          data: status
        }
      });

    } catch (error) {
      logger.error('영상 상태 조회 실패:', error);
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'STATUS_CHECK_FAILED',
          reason: '영상 상태 조회 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 영상 목록 조회
   */
  public getVideos = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, roomCode, page = '1', limit = '10' } = req.query;

      const result = await this.videoService.getVideos({
        userId: userId as string,
        roomCode: roomCode as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '영상 목록 조회 성공',
          data: result
        }
      });

    } catch (error) {
      logger.error('영상 목록 조회 실패:', error);
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'LIST_FETCH_FAILED',
          reason: '영상 목록 조회 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 영상 삭제
   */
  public deleteVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;
      const { userId } = req.body;

      const result = await this.videoService.deleteVideo(videoId, userId);

      if (!result) {
        res.status(404).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'VIDEO_NOT_FOUND',
            reason: '삭제할 영상을 찾을 수 없습니다.',
            data: null
          },
          success: null
        });
        return;
      }

      res.json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '영상이 성공적으로 삭제되었습니다.',
          data: { videoId }
        }
      });

    } catch (error) {
      logger.error('영상 삭제 실패:', error);
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'DELETE_FAILED',
          reason: '영상 삭제 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 영상 스트리밍 (클라이언트로 영상 전달)
   */
  public streamVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;
      const range = req.headers.range;

      const streamResult = await this.videoService.streamVideo(videoId, range);

      if (!streamResult) {
        res.status(404).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'VIDEO_NOT_FOUND',
            reason: '영상을 찾을 수 없습니다.',
            data: null
          },
          success: null
        });
        return;
      }

      // HTTP 206 Partial Content for video streaming
      res.writeHead(streamResult.statusCode, streamResult.headers);
      streamResult.stream.pipe(res);

    } catch (error) {
      logger.error('영상 스트리밍 실패:', error);
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'STREAM_FAILED',
          reason: '영상 스트리밍 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 영상 다운로드
   */
  public downloadVideo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { videoId } = req.params;
      const { userId } = req.query;

      const downloadResult = await this.videoService.getVideoForDownload(videoId, userId as string);

      if (!downloadResult) {
        res.status(404).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'VIDEO_NOT_FOUND',
            reason: '다운로드할 영상을 찾을 수 없습니다.',
            data: null
          },
          success: null
        });
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
      res.setHeader('Content-Type', downloadResult.contentType);
      res.setHeader('Content-Length', downloadResult.size);

      downloadResult.stream.pipe(res);

    } catch (error) {
      logger.error('영상 다운로드 실패:', error);
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'DOWNLOAD_FAILED',
          reason: '영상 다운로드 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };
}
