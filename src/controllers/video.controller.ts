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
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          roomCode: req.body.roomCode,
          userId: req.body.userId,
          gameTitle: req.body.gameTitle,
          hasVideoFile: !!(req as any).files?.video?.[0],
          hasAudioFile: !!(req as any).files?.audio?.[0],
          videoFileSize: (req as any).files?.video?.[0]?.size || 0,
          audioFileSize: (req as any).files?.audio?.[0]?.size || 0,
          videoMimeType: (req as any).files?.video?.[0]?.mimetype,
          audioMimeType: (req as any).files?.audio?.[0]?.mimetype
        }
      };

      logger.error('게임 녹화 영상 업로드 실패 - 상세 정보', errorDetails);
      
      // 에러 유형에 따른 적절한 응답 코드 결정
      let statusCode = 500;
      let errorCode = 'UPLOAD_FAILED';
      let reason = '파일 업로드 중 오류가 발생했습니다.';

      if (error instanceof Error) {
        if (error.message.includes('S3')) {
          errorCode = 'S3_UPLOAD_FAILED';
          reason = 'S3 업로드 중 오류가 발생했습니다.';
        } else if (error.message.includes('파일')) {
          errorCode = 'FILE_PROCESSING_FAILED';
          reason = '파일 처리 중 오류가 발생했습니다.';
        } else if (error.message.includes('데이터베이스') || error.message.includes('prisma')) {
          errorCode = 'DATABASE_ERROR';
          reason = '데이터베이스 저장 중 오류가 발생했습니다.';
        }
      }

      res.status(statusCode).json({
        resultType: 'FAIL',
        error: {
          errorCode: errorCode,
          reason: reason,
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
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          videoId: req.params.videoId
        }
      };

      logger.error('영상 상태 조회 실패 - 상세 정보', errorDetails);
      
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'STATUS_CHECK_FAILED',
          reason: '영상 상태 확인 중 오류가 발생했습니다.',
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
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          userId: req.query.userId,
          roomCode: req.query.roomCode,
          page: req.query.page,
          limit: req.query.limit
        }
      };

      logger.error('영상 목록 조회 실패 - 상세 정보', errorDetails);
      
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
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          videoId: req.params.videoId,
          userId: req.body.userId
        }
      };

      logger.error('영상 삭제 실패 - 상세 정보', errorDetails);
      
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
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          videoId: req.params.videoId,
          hasRange: !!req.headers.range,
          userAgent: req.headers['user-agent'],
          rangeHeader: req.headers.range
        }
      };

      logger.error('영상 스트리밍 실패 - 상세 정보', errorDetails);
      
      // 스트리밍 에러는 이미 응답이 시작되었을 수 있으므로 조심스럽게 처리
      if (!res.headersSent) {
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
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          videoId: req.params.videoId,
          userId: req.query.userId
        }
      };

      logger.error('영상 다운로드 실패 - 상세 정보', errorDetails);
      
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

  /**
   * 하이라이트 추출 시작
   */
  public startHighlightExtraction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomCode } = req.params;

      if (!roomCode) {
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'MISSING_ROOM_CODE',
            reason: '방 코드가 필요합니다.',
            data: null
          },
          success: null
        });
        return;
      }

      logger.info('하이라이트 추출 시작 요청', { roomCode });

      const result = await this.videoService.startHighlightExtraction(roomCode);

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          jobId: result.jobId,
          status: result.status,
          message: '하이라이트 추출이 시작되었습니다.'
        }
      });

    } catch (error) {
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          roomCode: req.params.roomCode
        }
      };

      logger.error('하이라이트 추출 시작 실패 - 상세 정보', errorDetails);
      
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'EXTRACTION_START_FAILED',
          reason: error instanceof Error ? error.message : '하이라이트 추출 시작 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 하이라이트 추출 상태 조회
   */
  public getHighlightExtractionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'MISSING_JOB_ID',
            reason: '작업 ID가 필요합니다.',
            data: null
          },
          success: null
        });
        return;
      }

      logger.info('하이라이트 추출 상태 조회', { jobId });

      const status = await this.videoService.getHighlightExtractionStatus(jobId);

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          jobId: jobId,
          status: status.status,
          progress: status.progress
        }
      });

    } catch (error) {
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          jobId: req.params.jobId
        }
      };

      logger.error('하이라이트 추출 상태 조회 실패 - 상세 정보', errorDetails);
      
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'STATUS_CHECK_FAILED',
          reason: error instanceof Error ? error.message : '상태 조회 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 완성된 하이라이트 영상 목록 조회
   */
  public getHighlightVideos = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomCode } = req.params;

      if (!roomCode) {
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'MISSING_ROOM_CODE',
            reason: '방 코드가 필요합니다.',
            data: null
          },
          success: null
        });
        return;
      }

      logger.info('하이라이트 영상 목록 조회', { roomCode });

      const highlights = await this.videoService.getHighlightVideos(roomCode);

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          roomCode: roomCode,
          highlights: highlights,
          totalCount: highlights.length
        }
      });

    } catch (error) {
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          roomCode: req.params.roomCode
        }
      };

      logger.error('하이라이트 영상 목록 조회 실패 - 상세 정보', errorDetails);
      
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'HIGHLIGHT_LIST_FAILED',
          reason: error instanceof Error ? error.message : '하이라이트 영상 목록 조회 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 하이라이트 콜백 처리 완료 콜백 (추출 서버에서 호출)
   */
  public handleHighlightCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomCode } = req.params;
      const callbackData = req.body;

      logger.info('하이라이트 추출 완료 콜백 수신', {
        roomCode: roomCode,
        jobId: callbackData.jobId,
        status: callbackData.status
      });

      // HighlightExtractionService를 통해 콜백 데이터 처리
      const { HighlightExtractionService } = await import('../services/highlight-extraction.service.js');
      const highlightService = new HighlightExtractionService();
      
      await highlightService.processHighlightResult(callbackData);

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '콜백 처리가 완료되었습니다.',
          jobId: callbackData.jobId,
          roomCode: roomCode
        }
      });

    } catch (error) {
      const errorDetails = {
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        requestInfo: {
          roomCode: req.params.roomCode,
          callbackDataSize: JSON.stringify(req.body || {}).length,
          callbackKeys: Object.keys(req.body || {}),
          jobId: req.body?.jobId,
          status: req.body?.status
        }
      };

      logger.error('하이라이트 콜백 처리 실패 - 상세 정보', errorDetails);
      
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'CALLBACK_PROCESSING_FAILED',
          reason: error instanceof Error ? error.message : '콜백 처리 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 디버깅용: 메모리에 저장된 방별 영상 정보 조회
   */
  public getRoomVideosDebug = async (req: Request, res: Response): Promise<void> => {
    try {
      const roomVideosInfo = this.videoService.getRoomVideosInfo();
      
      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '메모리에 저장된 방별 영상 정보',
          data: roomVideosInfo,
          totalRooms: Object.keys(roomVideosInfo).length
        }
      });

    } catch (error) {
      logger.error('방별 영상 정보 조회 실패', error);
      
      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'DEBUG_INFO_FAILED',
          reason: '디버깅 정보 조회 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };
}
