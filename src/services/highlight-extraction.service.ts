import axios from 'axios';
import logger from '../logger.js';

export interface VideoProcessingRequest {
  roomCode: string;
  gameTitle: string;
  participants: {
    userId: string;
    audio_s3_key: string;
    video_s3_key: string;
  }[];
  callbackUrl?: string; // API 서버의 콜백 엔드포인트 (선택사항)
}

export interface VideoProcessingResponse {
  jobId: string;
  status: 'accepted' | 'processing' | 'completed' | 'failed';
  estimatedTimeMinutes?: number;
  message?: string;
}

export interface HighlightResult {
  jobId: string;
  roomCode: string;
  status: 'completed' | 'failed';
  highlightVideos?: {
    s3Key: string;
    title: string;
    duration: number;
    thumbnailS3Key?: string;
  }[];
  error?: string;
  processedAt: string;
}

// 새로운 콜백 데이터 타입 정의
export interface HighlightCallbackData {
  success: boolean;
  room_code: string;
  game_title: string;
  participants_count: number;
  processing_completed_at: string;
  summary: {
    total_highlights: number;
    total_participant_clips: number;
    total_duration: number;
    average_quality: number;
  };
  participants: Array<{
    user_id: string;
    audio_s3_key: string;
    video_s3_key: string;
  }>;
  highlights: Array<{
    highlight_id: string;
    highlight_number: number;
    highlight_name: string;
    detected_by_user: string;
    timing: {
      start_time: number;
      end_time: number;
      duration: number;
    };
    emotion_info: {
      primary_emotion: string;
      emotion_distribution: Record<string, number>;
      emotion_confidence: number;
      emotion_intensity: number;
    };
    highlight_points: Array<{
      point_id: string;
      time: number;
      timestamp: string;
      relative_time: number;
      emotion: string;
      emotion_score: number;
      intensity: number;
      detected_by_user: string;
    }>;
    quality_metrics: {
      quality_score: number;
      highlight_count: number;
      categories: string[];
    };
    clip_files: {
      total_clips: number;
      successfully_created: number;
      clips_by_participant: Record<string, {
        video: {
          s3_url: string;
          s3_key: string;
          filename: string;
        };
        audio: {
          s3_url: string;
          s3_key: string;
          filename: string;
        };
        is_main_detector: boolean;
      }>;
      all_video_urls: string[];
      all_audio_urls: string[];
      s3_folder_path: string;
      main_detector_clip: {
        user_id: string;
        video: {
          s3_url: string;
          s3_key: string;
          filename: string;
        };
        audio: {
          s3_url: string;
          s3_key: string;
          filename: string;
        };
        is_main_detector: boolean;
      };
    };
    participant_clips: Array<{
      user_id: string;
      video: {
        s3_url: string;
        s3_key: string;
        filename: string;
      };
      audio: {
        s3_url: string;
        s3_key: string;
        filename: string;
      };
      is_main_detector: boolean;
    }>;
  }>;
}

export class HighlightExtractionService {
  private extractionServerUrl: string;
  private apiServerBaseUrl: string;

  constructor() {
    this.extractionServerUrl = process.env.HIGHLIGHT_EXTRACTION_SERVER_URL || 'http://localhost:9000';
    this.apiServerBaseUrl = process.env.API_SERVER_BASE_URL || 'http://localhost:8889';
    
    logger.info('하이라이트 추출 서비스 초기화', {
      extractionServerUrl: this.extractionServerUrl,
      apiServerBaseUrl: this.apiServerBaseUrl
    });
  }

  /**
   * 하이라이트 추출 작업 시작
   */
  public async startHighlightExtraction(request: VideoProcessingRequest): Promise<VideoProcessingResponse> {
    try {
      logger.info('하이라이트 추출 작업 시작 요청', {
        roomCode: request.roomCode,
        participantCount: request.participants.length
      });

      const response = await axios.post(
        `${this.extractionServerUrl}`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.EXTRACTION_API_KEY || ''
          },
          timeout: 30000 // 30초 타임아웃
        }
      );

      const result: VideoProcessingResponse = response.data;

      logger.info('하이라이트 추출 작업 시작 성공', {
        roomCode: request.roomCode,
        jobId: result.jobId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('하이라이트 추출 작업 시작 실패', {
        roomCode: request.roomCode,
        error: error
      });

      if (axios.isAxiosError(error)) {
        throw new Error(`하이라이트 추출 서버 통신 실패: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw new Error(`하이라이트 추출 작업 시작 실패: ${error}`);
    }
  }

  /**
   * 하이라이트 추출 작업 상태 조회
   */
  public async getExtractionStatus(jobId: string): Promise<VideoProcessingResponse> {
    try {
      const response = await axios.get(
        `${this.extractionServerUrl}/api/extract/status/${jobId}`,
        {
          headers: {
            'X-API-Key': process.env.EXTRACTION_API_KEY || ''
          },
          timeout: 10000
        }
      );

      const result: VideoProcessingResponse = response.data;

      logger.info('하이라이트 추출 상태 조회 성공', {
        jobId: jobId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('하이라이트 추출 상태 조회 실패', {
        jobId: jobId,
        error: error
      });

      if (axios.isAxiosError(error)) {
        throw new Error(`하이라이트 추출 서버 통신 실패: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw new Error(`하이라이트 추출 상태 조회 실패: ${error}`);
    }
  }

  /**
   * 콜백 URL 생성
   */
  public generateCallbackUrl(roomCode: string): string {
    return `${this.apiServerBaseUrl}/api/videos/highlight-callback/${roomCode}`;
  }

  /**
   * 콜백 데이터에서 프론트엔드용 하이라이트 정보 추출
   */
  public extractHighlightDataForFrontend(callbackData: HighlightCallbackData): {
    roomCode: string;
    gameTitle: string;
    participantsCount: number;
    processedAt: string;
    summary: {
      totalHighlights: number;
      totalParticipantClips: number;
      totalDuration: number;
      averageQuality: number;
    };
    highlights: Array<{
      highlightId: string;
      highlightNumber: number;
      highlightName: string;
      detectedByUser: string;
      timing: {
        startTime: number;
        endTime: number;
        duration: number;
      };
      emotionInfo: {
        primaryEmotion: string;
        emotionDistribution: Record<string, number>;
        emotionConfidence: number;
        emotionIntensity: number;
      };
      qualityMetrics: {
        qualityScore: number;
        highlightCount: number;
        categories: string[];
      };
      mediaFiles: {
        totalClips: number;
        successfullyCreated: number;
        s3FolderPath: string;
        allVideoUrls: string[];
        allAudioUrls: string[];
        participantClips: Array<{
          userId: string;
          videoUrl: string;
          audioUrl: string;
          videoFilename: string;
          audioFilename: string;
          isMainDetector: boolean;
        }>;
        mainDetectorClip: {
          userId: string;
          videoUrl: string;
          audioUrl: string;
          videoFilename: string;
          audioFilename: string;
        };
      };
    }>;
  } {
    return {
      roomCode: callbackData.room_code,
      gameTitle: callbackData.game_title,
      participantsCount: callbackData.participants_count,
      processedAt: callbackData.processing_completed_at,
      summary: {
        totalHighlights: callbackData.summary.total_highlights,
        totalParticipantClips: callbackData.summary.total_participant_clips,
        totalDuration: callbackData.summary.total_duration,
        averageQuality: callbackData.summary.average_quality
      },
      highlights: callbackData.highlights.map(highlight => ({
        highlightId: highlight.highlight_id,
        highlightNumber: highlight.highlight_number,
        highlightName: highlight.highlight_name,
        detectedByUser: highlight.detected_by_user,
        timing: {
          startTime: highlight.timing.start_time,
          endTime: highlight.timing.end_time,
          duration: highlight.timing.duration
        },
        emotionInfo: {
          primaryEmotion: highlight.emotion_info.primary_emotion,
          emotionDistribution: highlight.emotion_info.emotion_distribution,
          emotionConfidence: highlight.emotion_info.emotion_confidence,
          emotionIntensity: highlight.emotion_info.emotion_intensity
        },
        qualityMetrics: {
          qualityScore: highlight.quality_metrics.quality_score,
          highlightCount: highlight.quality_metrics.highlight_count,
          categories: highlight.quality_metrics.categories
        },
        mediaFiles: {
          totalClips: highlight.clip_files.total_clips,
          successfullyCreated: highlight.clip_files.successfully_created,
          s3FolderPath: highlight.clip_files.s3_folder_path,
          allVideoUrls: highlight.clip_files.all_video_urls,
          allAudioUrls: highlight.clip_files.all_audio_urls,
          participantClips: highlight.participant_clips.map(clip => ({
            userId: clip.user_id,
            videoUrl: clip.video.s3_url,
            audioUrl: clip.audio.s3_url,
            videoFilename: clip.video.filename,
            audioFilename: clip.audio.filename,
            isMainDetector: clip.is_main_detector
          })),
          mainDetectorClip: {
            userId: highlight.clip_files.main_detector_clip.user_id,
            videoUrl: highlight.clip_files.main_detector_clip.video.s3_url,
            audioUrl: highlight.clip_files.main_detector_clip.audio.s3_url,
            videoFilename: highlight.clip_files.main_detector_clip.video.filename,
            audioFilename: highlight.clip_files.main_detector_clip.audio.filename
          }
        }
      }))
    };
  }

  /**
   * 하이라이트 추출 완료 처리 (콜백에서 사용)
   */
  public async processHighlightResult(result: HighlightResult): Promise<void> {
    try {
      logger.info('하이라이트 추출 완료 결과 처리 시작', {
        jobId: result.jobId,
        roomCode: result.roomCode,
        status: result.status
      });

      if (result.status === 'completed' && result.highlightVideos) {
        // 하이라이트 영상 정보를 데이터베이스에 저장
        for (const highlight of result.highlightVideos) {
          await this.saveHighlightVideo({
            roomCode: result.roomCode,
            jobId: result.jobId,
            s3Key: highlight.s3Key,
            title: highlight.title,
            duration: highlight.duration,
            thumbnailS3Key: highlight.thumbnailS3Key,
            processedAt: result.processedAt
          });
        }

        logger.info('하이라이트 영상 저장 완료', {
          jobId: result.jobId,
          roomCode: result.roomCode,
          highlightCount: result.highlightVideos.length
        });
      } else {
        logger.error('하이라이트 추출 실패', {
          jobId: result.jobId,
          roomCode: result.roomCode,
          error: result.error
        });
      }

    } catch (error) {
      logger.error('하이라이트 결과 처리 실패', {
        jobId: result.jobId,
        roomCode: result.roomCode,
        error: error
      });
      throw error;
    }
  }

  /**
   * 하이라이트 영상 정보를 데이터베이스에 저장
   */
  private async saveHighlightVideo(data: {
    roomCode: string;
    jobId: string;
    s3Key: string;
    title: string;
    duration: number;
    thumbnailS3Key?: string;
    processedAt: string;
  }): Promise<void> {
    try {
      // 임시로 session 테이블에 저장 (나중에 highlight_videos 테이블로 이전)
      const { prisma } = await import('../db.config.js');
      
      await prisma.session.create({
        data: {
          id: `highlight_${data.jobId}_${Date.now()}`,
          sid: `highlight_${data.roomCode}_${data.s3Key}`,
          data: JSON.stringify({
            type: 'highlight_video',
            roomCode: data.roomCode,
            jobId: data.jobId,
            s3Key: data.s3Key,
            title: data.title,
            duration: data.duration,
            thumbnailS3Key: data.thumbnailS3Key,
            processedAt: data.processedAt,
            status: 'completed'
          }),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90일 후 만료
        }
      });

      logger.info('하이라이트 영상 데이터베이스 저장 완료', {
        roomCode: data.roomCode,
        s3Key: data.s3Key,
        title: data.title
      });

    } catch (error) {
      logger.error('하이라이트 영상 데이터베이스 저장 실패', {
        roomCode: data.roomCode,
        s3Key: data.s3Key,
        error: error
      });
      throw error;
    }
  }
}
