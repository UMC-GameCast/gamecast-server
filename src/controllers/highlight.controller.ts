import { Request, Response } from 'express';
import logger from '../logger.js';

export class HighlightController {
  /**
   * 디버깅용: 고정된 하이라이트 콜백 데이터 반환
   * roomCode만 요청된 값으로 교체
   */
  async getDebugHighlightCallback(req: Request, res: Response) {
    try {
      const { roomCode } = req.params;

      if (!roomCode) {
        return res.status(400).json({
          success: false,
          message: 'roomCode가 필요합니다.'
        });
      }

      // 고정된 하이라이트 콜백 데이터 (roomCode만 동적으로 교체)
      const mockHighlightData = {
        "success": true,
        "room_code": roomCode, // 요청된 roomCode로 교체
        "game_title": "League of Legends",
        "participants_count": 3,
        "processing_completed_at": new Date().toISOString(),
        "summary": {
          "total_highlights": 2,
          "total_participant_clips": 6,
          "total_duration": 300.0,
          "average_quality": 1204.0499267578125
        },
        "participants": [
          {
            "user_id": "host",
            "audio_s3_key": "EHKCSY/raw/host/audio/2025-08-21T10-37-43-789Z_edce797d-5144-4d77-af21-4b5d6fe02401_Host_Talk.MP3",
            "video_s3_key": "EHKCSY/raw/host/video/2025-08-21T10-37-39-105Z_8d3d0ce8-efda-42c8-a12d-e3932bd8fa62_Host_Play.mp4"
          },
          {
            "user_id": "user1",
            "audio_s3_key": "EHKCSY/raw/user1/audio/2025-08-21T10-38-20-462Z_c9aacf97-1ea1-4051-9c30-a3fa86ded836_Guest1_Talk.MP3",
            "video_s3_key": "EHKCSY/raw/user1/video/2025-08-21T10-38-19-128Z_0f26489f-052d-4186-a54a-bac890aa14e7_Guest1_Play.mp4"
          },
          {
            "user_id": "user2",
            "audio_s3_key": "EHKCSY/raw/user2/audio/2025-08-21T10-38-32-785Z_1d051de2-726b-4627-be31-9b92fcd8e282_Guest2_Talk.MP3",
            "video_s3_key": "EHKCSY/raw/user2/video/2025-08-21T10-38-31-532Z_59f08012-b4d8-4f5b-b005-779cd1f035d0_Guest2_Play.mp4"
          }
        ],
        "highlights": [
          {
            "highlight_id": "b6154170-036f-4861-b8f8-7b50dd76f9d7",
            "highlight_number": 1,
            "highlight_name": "Normal 하이라이트 #1 (180초)",
            "detected_by_user": "host",
            "timing": {
              "start_time": 196.32,
              "end_time": 376.32,
              "duration": 180.0
            },
            "emotion_info": {
              "primary_emotion": "normal",
              "emotion_distribution": {
                "normal": 0.82,
                "surprised": 0.328,
                "joy": 0.376
              },
              "emotion_confidence": 0.82,
              "emotion_intensity": 1146.60595703125
            },
            "highlight_points": [
              {
                "point_id": "highlight_1",
                "time": 122.4,
                "timestamp": "0:02:02.400",
                "relative_time": -73.92,
                "emotion": "joy",
                "emotion_score": 0.866,
                "intensity": 1.7330000400543213,
                "detected_by_user": "user1"
              },
              {
                "point_id": "highlight_2",
                "time": 554.4,
                "timestamp": "0:09:14.400",
                "relative_time": 358.08,
                "emotion": "joy",
                "emotion_score": 0.689,
                "intensity": 1.3769999742507935,
                "detected_by_user": "user1"
              },
              {
                "point_id": "highlight_3",
                "time": 501.12,
                "timestamp": "0:08:21.120",
                "relative_time": 304.8,
                "emotion": "surprised",
                "emotion_score": 0.851,
                "intensity": 1.2769999504089355,
                "detected_by_user": "user1"
              },
              {
                "point_id": "highlight_4",
                "time": 122.88,
                "timestamp": "0:02:02.880",
                "relative_time": -73.44,
                "emotion": "joy",
                "emotion_score": 0.399,
                "intensity": 1.184999942779541,
                "detected_by_user": "user1"
              },
              {
                "point_id": "highlight_5",
                "time": 349.92,
                "timestamp": "0:05:49.920",
                "relative_time": 153.6,
                "emotion": "joy",
                "emotion_score": 0.484,
                "intensity": 1.1749999523162842,
                "detected_by_user": "user1"
              }
            ],
            "quality_metrics": {
              "quality_score": 2293.199951171875,
              "highlight_count": 5,
              "categories": [
                "surprise",
                "laughter",
                "speech"
              ]
            },
            "clip_files": {
              "total_clips": 3,
              "successfully_created": 3,
              "clips_by_participant": {
                "host": {
                  "video": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp4",
                    "s3_key": "EHKCSY/highlights/highlight_1/host.mp4",
                    "filename": "highlight_1_host.mp4"
                  },
                  "audio": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp3",
                    "s3_key": "EHKCSY/highlights/highlight_1/host.mp3",
                    "filename": "highlight_1_host.mp3"
                  },
                  "is_main_detector": true
                },
                "user1": {
                  "video": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user1.mp4",
                    "s3_key": "EHKCSY/highlights/highlight_1/user1.mp4",
                    "filename": "highlight_1_user1.mp4"
                  },
                  "audio": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user1.mp3",
                    "s3_key": "EHKCSY/highlights/highlight_1/user1.mp3",
                    "filename": "highlight_1_user1.mp3"
                  },
                  "is_main_detector": false
                },
                "user2": {
                  "video": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user2.mp4",
                    "s3_key": "EHKCSY/highlights/highlight_1/user2.mp4",
                    "filename": "highlight_1_user2.mp4"
                  },
                  "audio": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user2.mp3",
                    "s3_key": "EHKCSY/highlights/highlight_1/user2.mp3",
                    "filename": "highlight_1_user2.mp3"
                  },
                  "is_main_detector": false
                }
              },
              "all_video_urls": [
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp4",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user1.mp4",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user2.mp4"
              ],
              "all_audio_urls": [
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp3",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user1.mp3",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user2.mp3"
              ],
              "s3_folder_path": "EHKCSY/highlights/highlight_1/",
              "main_detector_clip": {
                "user_id": "host",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_1/host.mp4",
                  "filename": "highlight_1_host.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_1/host.mp3",
                  "filename": "highlight_1_host.mp3"
                },
                "is_main_detector": true
              }
            },
            "participant_clips": [
              {
                "user_id": "host",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_1/host.mp4",
                  "filename": "highlight_1_host.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/host.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_1/host.mp3",
                  "filename": "highlight_1_host.mp3"
                },
                "is_main_detector": true
              },
              {
                "user_id": "user1",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user1.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_1/user1.mp4",
                  "filename": "highlight_1_user1.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user1.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_1/user1.mp3",
                  "filename": "highlight_1_user1.mp3"
                },
                "is_main_detector": false
              },
              {
                "user_id": "user2",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user2.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_1/user2.mp4",
                  "filename": "highlight_1_user2.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_1/user2.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_1/user2.mp3",
                  "filename": "highlight_1_user2.mp3"
                },
                "is_main_detector": false
              }
            ]
          },
          {
            "highlight_id": "1f89c8ca-09b2-4711-bc76-9bd85d78ff9e",
            "highlight_number": 2,
            "highlight_name": "Normal 하이라이트 #2 (120초)",
            "detected_by_user": "host",
            "timing": {
              "start_time": 541.92,
              "end_time": 661.92,
              "duration": 120.0
            },
            "emotion_info": {
              "primary_emotion": "normal",
              "emotion_distribution": {
                "normal": 0.806,
                "joy": 0.17
              },
              "emotion_confidence": 0.806,
              "emotion_intensity": 57.44300079345703
            },
            "highlight_points": [
              {
                "point_id": "highlight_1",
                "time": 589.44,
                "timestamp": "0:09:49.440",
                "relative_time": 47.52,
                "emotion": "normal",
                "emotion_score": 1.0,
                "intensity": 1.0,
                "detected_by_user": "host"
              },
              {
                "point_id": "highlight_2",
                "time": 600.0,
                "timestamp": "0:10:00.000",
                "relative_time": 58.08,
                "emotion": "normal",
                "emotion_score": 1.0,
                "intensity": 1.0,
                "detected_by_user": "host"
              },
              {
                "point_id": "highlight_3",
                "time": 589.92,
                "timestamp": "0:09:49.920",
                "relative_time": 48.0,
                "emotion": "normal",
                "emotion_score": 0.999,
                "intensity": 0.9990000128746033,
                "detected_by_user": "host"
              },
              {
                "point_id": "highlight_4",
                "time": 600.48,
                "timestamp": "0:10:00.480",
                "relative_time": 58.56,
                "emotion": "normal",
                "emotion_score": 0.999,
                "intensity": 0.9990000128746033,
                "detected_by_user": "host"
              },
              {
                "point_id": "highlight_5",
                "time": 590.88,
                "timestamp": "0:09:50.880",
                "relative_time": 48.96,
                "emotion": "normal",
                "emotion_score": 0.999,
                "intensity": 0.9990000128746033,
                "detected_by_user": "host"
              }
            ],
            "quality_metrics": {
              "quality_score": 114.9000015258789,
              "highlight_count": 5,
              "categories": [
                "laughter",
                "speech"
              ]
            },
            "clip_files": {
              "total_clips": 3,
              "successfully_created": 3,
              "clips_by_participant": {
                "host": {
                  "video": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp4",
                    "s3_key": "EHKCSY/highlights/highlight_2/host.mp4",
                    "filename": "highlight_2_host.mp4"
                  },
                  "audio": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp3",
                    "s3_key": "EHKCSY/highlights/highlight_2/host.mp3",
                    "filename": "highlight_2_host.mp3"
                  },
                  "is_main_detector": true
                },
                "user1": {
                  "video": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user1.mp4",
                    "s3_key": "EHKCSY/highlights/highlight_2/user1.mp4",
                    "filename": "highlight_2_user1.mp4"
                  },
                  "audio": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user1.mp3",
                    "s3_key": "EHKCSY/highlights/highlight_2/user1.mp3",
                    "filename": "highlight_2_user1.mp3"
                  },
                  "is_main_detector": false
                },
                "user2": {
                  "video": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user2.mp4",
                    "s3_key": "EHKCSY/highlights/highlight_2/user2.mp4",
                    "filename": "highlight_2_user2.mp4"
                  },
                  "audio": {
                    "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user2.mp3",
                    "s3_key": "EHKCSY/highlights/highlight_2/user2.mp3",
                    "filename": "highlight_2_user2.mp3"
                  },
                  "is_main_detector": false
                }
              },
              "all_video_urls": [
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp4",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user1.mp4",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user2.mp4"
              ],
              "all_audio_urls": [
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp3",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user1.mp3",
                "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user2.mp3"
              ],
              "s3_folder_path": "EHKCSY/highlights/highlight_2/",
              "main_detector_clip": {
                "user_id": "host",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_2/host.mp4",
                  "filename": "highlight_2_host.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_2/host.mp3",
                  "filename": "highlight_2_host.mp3"
                },
                "is_main_detector": true
              }
            },
            "participant_clips": [
              {
                "user_id": "host",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_2/host.mp4",
                  "filename": "highlight_2_host.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/host.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_2/host.mp3",
                  "filename": "highlight_2_host.mp3"
                },
                "is_main_detector": true
              },
              {
                "user_id": "user1",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user1.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_2/user1.mp4",
                  "filename": "highlight_2_user1.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user1.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_2/user1.mp3",
                  "filename": "highlight_2_user1.mp3"
                },
                "is_main_detector": false
              },
              {
                "user_id": "user2",
                "video": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user2.mp4",
                  "s3_key": "EHKCSY/highlights/highlight_2/user2.mp4",
                  "filename": "highlight_2_user2.mp4"
                },
                "audio": {
                  "s3_url": "https://gamecast-highlights.s3.amazonaws.com/EHKCSY/highlights/highlight_2/user2.mp3",
                  "s3_key": "EHKCSY/highlights/highlight_2/user2.mp3",
                  "filename": "highlight_2_user2.mp3"
                },
                "is_main_detector": false
              }
            ]
          }
        ]
      };

      logger.info(`디버깅용 하이라이트 콜백 데이터 반환: ${roomCode}`, {
        roomCode,
        highlightsCount: mockHighlightData.highlights.length,
        participantsCount: mockHighlightData.participants_count
      });

      res.json(mockHighlightData);

    } catch (error) {
      logger.error('디버깅용 하이라이트 콜백 데이터 생성 오류:', error);
      res.status(500).json({
        success: false,
        message: '디버깅용 하이라이트 데이터 생성 중 오류가 발생했습니다.'
      });
    }
  }
}
