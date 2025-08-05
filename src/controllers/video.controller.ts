import { Request, Response } from 'express';
import { VideoService } from '../services/video.service.js';
import { HighlightCallbackData } from '../services/highlight-extraction.service.js';
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

      // 수신된 콜백 데이터의 기본 정보 로깅
      logger.info('하이라이트 추출 콜백 데이터 수신', {
        roomCode: roomCode,
        requestMethod: req.method,
        requestHeaders: req.headers,
        bodySize: JSON.stringify(req.body || {}).length,
        bodyKeys: Object.keys(req.body || {}),
        rawBodyType: typeof req.body,
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type']
      });

      // 요청 본문이 비어있거나 유효하지 않은 경우 처리
      if (!callbackData || Object.keys(callbackData).length === 0) {
        logger.error('콜백 데이터가 비어있음', {
          roomCode: roomCode,
          bodyContent: req.body,
          bodyString: JSON.stringify(req.body)
        });
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'EMPTY_CALLBACK_DATA',
            reason: '콜백 데이터가 비어있습니다.',
            data: null
          },
          success: null
        });
        return;
      }

      // 타입 캐스팅 전에 필수 필드 검증
      const requiredFields = ['room_code', 'success'];
      const missingFields = requiredFields.filter(field => !(field in callbackData));
      
      if (missingFields.length > 0) {
        logger.error('콜백 데이터에 필수 필드 누락', {
          roomCode: roomCode,
          missingFields: missingFields,
          receivedFields: Object.keys(callbackData),
          callbackData: callbackData
        });
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'MISSING_REQUIRED_FIELDS',
            reason: `필수 필드가 누락되었습니다: ${missingFields.join(', ')}`,
            data: { missingFields, receivedFields: Object.keys(callbackData) }
          },
          success: null
        });
        return;
      }

      // 안전한 타입 캐스팅
      const typedCallbackData = callbackData as HighlightCallbackData;

      logger.info('하이라이트 추출 완료 콜백 처리 시작', {
        roomCode: roomCode,
        success: typedCallbackData.success,
        gameTitle: typedCallbackData.game_title,
        participantsCount: typedCallbackData.participants_count,
        totalHighlights: typedCallbackData.summary?.total_highlights,
        completedAt: typedCallbackData.processing_completed_at
      });

      // 콜백 데이터 검증
      if (!typedCallbackData.room_code || typedCallbackData.room_code !== roomCode) {
        logger.warn('콜백 데이터의 룸 코드가 일치하지 않음', {
          expectedRoomCode: roomCode,
          receivedRoomCode: typedCallbackData.room_code
        });
        res.status(400).json({
          resultType: 'FAIL',
          error: {
            errorCode: 'INVALID_ROOM_CODE',
            reason: '룸 코드가 일치하지 않습니다.',
            data: {
              expected: roomCode,
              received: typedCallbackData.room_code
            }
          },
          success: null
        });
        return;
      }

      // 성공/실패에 따른 처리
      if (typedCallbackData.success) {
        logger.info('하이라이트 추출 성공', {
          roomCode: roomCode,
          gameTitle: typedCallbackData.game_title,
          highlights: typedCallbackData.highlights?.length,
          participants: typedCallbackData.participants?.length,
          totalDuration: typedCallbackData.summary?.total_duration,
          averageQuality: typedCallbackData.summary?.average_quality
        });

        // 하이라이트 정보 로깅
        if (typedCallbackData.highlights && typedCallbackData.highlights.length > 0) {
          typedCallbackData.highlights.forEach((highlight: any, index: number) => {
            logger.info(`하이라이트 ${index + 1} 상세 정보`, {
              highlightId: highlight.highlight_id,
              name: highlight.highlight_name,
              detectedBy: highlight.detected_by_user,
              duration: highlight.timing?.duration,
              emotion: highlight.emotion_info?.primary_emotion,
              emotionConfidence: highlight.emotion_info?.emotion_confidence,
              qualityScore: highlight.quality_metrics?.quality_score,
              participantClips: highlight.participant_clips?.length
            });
          });
        }

        // 참여자 클립 정보 로깅
        if (typedCallbackData.participants && typedCallbackData.participants.length > 0) {
          typedCallbackData.participants.forEach((participant: any, index: number) => {
            logger.info(`참여자 ${index + 1} 클립 정보`, {
              userId: participant.user_id,
              hasAudio: !!participant.audio_s3_key,
              hasVideo: !!participant.video_s3_key
            });
          });
        }

      } else {
        logger.error('하이라이트 추출 실패', {
          roomCode: roomCode,
          gameTitle: typedCallbackData.game_title,
          completedAt: typedCallbackData.processing_completed_at
        });
      }

      // 콜백 데이터를 데이터베이스에 저장
      await this.saveHighlightCallbackData(typedCallbackData);

      logger.info('콜백 처리 완료, 응답 전송', {
        roomCode: roomCode,
        success: typedCallbackData.success,
        responseData: {
          highlightsProcessed: typedCallbackData.highlights?.length || 0,
          participantsProcessed: typedCallbackData.participants?.length || 0
        }
      });

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '콜백 처리가 완료되었습니다.',
          roomCode: roomCode,
          success: typedCallbackData.success,
          highlightsProcessed: typedCallbackData.highlights?.length || 0,
          participantsProcessed: typedCallbackData.participants?.length || 0,
          gameTitle: typedCallbackData.game_title,
          completedAt: typedCallbackData.processing_completed_at
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
          success: req.body?.success,
          gameTitle: req.body?.game_title,
          participantsCount: req.body?.participants_count,
          totalHighlights: req.body?.summary?.total_highlights
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
   * 하이라이트 콜백 데이터를 데이터베이스에 저장
   */
  private async saveHighlightCallbackData(callbackData: HighlightCallbackData): Promise<void> {
    try {
      const { prisma } = await import('../db.config.js');

      // 1. 룸 정보 확인
      const room = await prisma.room.findFirst({
        where: { roomCode: callbackData.room_code }
      });

      if (!room) {
        logger.warn('콜백에서 룸을 찾을 수 없음', { roomCode: callbackData.room_code });
        return;
      }

      // 2. 녹화 세션 생성 또는 업데이트
      let recordingSession = await prisma.recordingSession.findFirst({
        where: {
          roomId: room.id,
          status: 'recording'
        }
      });

      if (!recordingSession) {
        recordingSession = await prisma.recordingSession.create({
          data: {
            roomId: room.id,
            sessionName: `${callbackData.game_title} - ${callbackData.room_code}`,
            status: callbackData.success ? 'completed' : 'failed',
            endedAt: new Date(callbackData.processing_completed_at),
            recordingSettings: {
              gameTitle: callbackData.game_title,
              participantsCount: callbackData.participants_count,
              callbackReceived: true
            }
          }
        });
      } else {
        // 기존 세션 업데이트
        recordingSession = await prisma.recordingSession.update({
          where: { id: recordingSession.id },
          data: {
            status: callbackData.success ? 'completed' : 'failed',
            endedAt: new Date(callbackData.processing_completed_at)
          }
        });
      }

      // 3. 성공한 경우 하이라이트 분석 및 클립 저장
      if (callbackData.success && callbackData.highlights && callbackData.highlights.length > 0) {
        // 하이라이트 분석 레코드 생성
        const highlightAnalysis = await prisma.highlightAnalysis.create({
          data: {
            recordingSessionId: recordingSession.id,
            analysisAlgorithm: 'external_highlight_extraction',
            analysisParameters: {
              summary: callbackData.summary,
              participantsCount: callbackData.participants_count
            },
            status: 'completed',
            completedAt: new Date(callbackData.processing_completed_at)
          }
        });

        // 각 하이라이트 클립 저장
        for (const highlight of callbackData.highlights) {
          // 각 하이라이트의 참가자별 클립 저장
          for (const participantClip of highlight.participant_clips) {
            await prisma.highlightClip.create({
              data: {
                analysisId: highlightAnalysis.id,
                clipName: highlight.highlight_name || `하이라이트 ${highlight.highlight_number}`,
                startTimestamp: highlight.timing.start_time,
                endTimestamp: highlight.timing.end_time,
                confidenceScore: highlight.emotion_info.emotion_confidence,
                highlightType: 'voice_spike',
                mainSourceFilePath: participantClip.s3_url,
                detectionFeatures: {
                  highlightId: highlight.highlight_id,
                  highlightNumber: highlight.highlight_number,
                  guestUserId: participantClip.user_id,
                  s3Url: participantClip.s3_url,
                  s3Key: participantClip.s3_key,
                  filename: participantClip.filename,
                  description: highlight.highlight_name,
                  score: highlight.quality_metrics.quality_score,
                  emotion: highlight.emotion_info.primary_emotion,
                  emotionConfidence: highlight.emotion_info.emotion_confidence,
                  emotionIntensity: highlight.emotion_info.emotion_intensity,
                  isMainDetector: participantClip.is_main_detector,
                  detectedByUser: highlight.detected_by_user,
                  tags: highlight.quality_metrics.categories || [],
                  // 새로운 clip_files 정보 추가
                  totalClips: highlight.clip_files.total_clips,
                  successfullyCreated: highlight.clip_files.successfully_created,
                  allClipUrls: highlight.clip_files.all_clip_urls,
                  s3FolderPath: highlight.clip_files.s3_folder_path,
                  mainDetectorClip: highlight.clip_files.main_detector_clip,
                  clipsbyParticipant: highlight.clip_files.clips_by_participant,
                  highlightPoints: highlight.highlight_points
                },
                isSelected: true
              }
            });
          }
        }

        // 4. WebRTC를 통해 방 참여자들에게 하이라이트 완성 알림 전송
        await this.notifyHighlightCompletion(callbackData.room_code, highlightAnalysis.id, callbackData.highlights.length);

        logger.info('하이라이트 콜백 데이터 저장 완료', {
          roomCode: callbackData.room_code,
          recordingSessionId: recordingSession.id,
          analysisId: highlightAnalysis.id,
          highlightsCount: callbackData.highlights.length
        });
      }

    } catch (error) {
      logger.error('하이라이트 콜백 데이터 저장 실패', {
        roomCode: callbackData.room_code,
        error: error
      });
      // 저장 실패해도 응답은 성공으로 처리 (콜백 자체는 정상 처리됨)
    }
  }

  /**
   * 하이라이트 완성 알림을 방 참여자들에게 전송
   */
  private async notifyHighlightCompletion(roomCode: string, analysisId: string, highlightCount: number): Promise<void> {
    try {
      // WebRTC 서비스를 통해 Socket.IO로 알림 전송
      const { WebRTCService } = await import('../services/webrtc.service.js');
      
      // 글로벌 WebRTC 서비스 인스턴스 가져오기 (실제 구현에서는 DI 컨테이너 사용)
      const io = (global as any).webrtcService?.getIO();
      
      if (io) {
        io.to(roomCode).emit('highlight-clips-ready', {
          roomCode,
          analysisId,
          highlightCount,
          message: `${highlightCount}개의 하이라이트 클립이 완성되었습니다!`,
          downloadAvailable: true,
          timestamp: new Date().toISOString()
        });

        logger.info('하이라이트 완성 알림 전송 완료', {
          roomCode,
          analysisId,
          highlightCount
        });
      } else {
        logger.warn('WebRTC 서비스를 찾을 수 없어 알림 전송 실패', { roomCode });
      }
    } catch (error) {
      logger.error('하이라이트 완성 알림 전송 실패', {
        roomCode,
        error
      });
    }
  }

  /**
   * 방의 하이라이트 클립 목록 조회
   */
  public getHighlightClips = async (req: Request, res: Response): Promise<void> => {
    try {
      const { roomCode } = req.params;

      logger.info('하이라이트 클립 목록 조회 요청', { roomCode });

      const result = await this.videoService.getHighlightClipsByRoom(roomCode);

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '하이라이트 클립 목록을 성공적으로 조회했습니다.',
          data: result
        }
      });

    } catch (error) {
      logger.error('하이라이트 클립 목록 조회 실패', {
        roomCode: req.params.roomCode,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'HIGHLIGHT_CLIPS_FETCH_FAILED',
          reason: error instanceof Error ? error.message : '하이라이트 클립 조회 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 하이라이트 클립 다운로드 링크 생성
   */
  public generateDownloadLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { clipId } = req.params;
      const { expiresIn = 3600 } = req.query; // 기본 1시간

      logger.info('하이라이트 클립 다운로드 링크 생성 요청', { 
        clipId, 
        expiresIn: Number(expiresIn) 
      });

      const result = await this.videoService.generateClipDownloadLink(
        clipId, 
        Number(expiresIn)
      );

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '다운로드 링크가 성공적으로 생성되었습니다.',
          data: result
        }
      });

    } catch (error) {
      logger.error('하이라이트 클립 다운로드 링크 생성 실패', {
        clipId: req.params.clipId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'DOWNLOAD_LINK_GENERATION_FAILED',
          reason: error instanceof Error ? error.message : '다운로드 링크 생성 중 오류가 발생했습니다.',
          data: null
        },
        success: null
      });
    }
  };

  /**
   * 사용자별 하이라이트 클립 조회
   */
  public getUserHighlightClips = async (req: Request, res: Response): Promise<void> => {
    try {
      const { guestUserId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      logger.info('사용자별 하이라이트 클립 조회 요청', { 
        guestUserId, 
        page: Number(page), 
        limit: Number(limit) 
      });

      const result = await this.videoService.getUserHighlightClips(
        guestUserId,
        Number(page),
        Number(limit)
      );

      res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: {
          message: '사용자 하이라이트 클립을 성공적으로 조회했습니다.',
          data: result
        }
      });

    } catch (error) {
      logger.error('사용자별 하이라이트 클립 조회 실패', {
        guestUserId: req.params.guestUserId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        resultType: 'FAIL',
        error: {
          errorCode: 'USER_HIGHLIGHT_CLIPS_FETCH_FAILED',
          reason: error instanceof Error ? error.message : '사용자 하이라이트 클립 조회 중 오류가 발생했습니다.',
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
