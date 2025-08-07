import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/room.service.js';
import { BadRequestError } from '../errors/errors.js';
import { createSuccessResponse } from '../utils/response.util.js';
import logger from '../logger.js';
import { GameSocketService } from '../services/game-socket.service.js';

export class RoomController {
  private roomService: RoomService;
  private gameSocketService?: GameSocketService;

  constructor(gameSocketService?: GameSocketService) {
    this.roomService = new RoomService();
    this.gameSocketService = gameSocketService;
  }

  /**
   * 방 생성
   * POST /api/rooms
   */
  async createRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomName, maxCapacity, roomSettings } = req.body;
      const hostSessionId = req.sessionID;
      const hostNickname = req.body.hostNickname;

      if (!hostSessionId || !hostNickname) {
        throw new BadRequestError('세션 정보와 닉네임이 필요합니다.');
      }

      logger.info('방 생성 요청', { 
        hostSessionId, 
        roomName, 
        maxCapacity,
        ip: req.ip 
      });

      const result = await this.roomService.createRoom({
        roomName,
        maxCapacity,
        hostSessionId,
        hostNickname,
        roomSettings
      });

      const response = createSuccessResponse(
        result
      );

      logger.info('방 생성 완료', { 
        roomId: result.roomId, 
        roomCode: result.roomCode 
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('방 생성 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 방 입장
   * POST /api/rooms/join
   */
  async joinRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode, nickname } = req.body;
      const sessionId = req.sessionID;

      if (!roomCode || !sessionId || !nickname) {
        throw new BadRequestError('방 코드, 세션 정보, 닉네임이 모두 필요합니다.');
      }

      logger.info('방 입장 요청', { 
        sessionId, 
        roomCode,
        nickname,
        ip: req.ip 
      });

      const result = await this.roomService.joinRoom(roomCode, sessionId, nickname);

      const response = createSuccessResponse(result);

      logger.info('방 입장 완료', { 
        sessionId, 
        roomCode, 
        guestUserId: result.guestUserId 
      });

      res.json(response);
    } catch (error) {
      logger.error('방 입장 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        roomCode: req.body.roomCode 
      });
      next(error);
    }
  }

  /**
   * 방 나가기
   * POST /api/rooms/leave
   */
  async leaveRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { guestUserId } = req.body;

      if (!guestUserId) {
        throw new BadRequestError('사용자 ID가 필요합니다.');
      }

      logger.info('방 나가기 요청', { 
        guestUserId,
        ip: req.ip 
      });

      const result = await this.roomService.leaveRoom(guestUserId);

      const response = createSuccessResponse(result);

      logger.info('방 나가기 완료', { 
        guestUserId, 
        roomCode: result.roomCode 
      });

      res.json(response);
    } catch (error) {
      logger.error('방 나가기 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 방 정보 조회 (Socket ID 정보 포함)
   * GET /api/rooms/:roomCode
   */
  async getRoomInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode } = req.params;

      logger.info('방 정보 조회 요청', { 
        roomCode,
        ip: req.ip 
      });

      const result = await this.roomService.getRoomByCode(roomCode);

      // Socket ID 정보 추가
      if (result.participants && this.gameSocketService) {
        result.participants = result.participants.map((participant: any) => {
          const socketId = this.gameSocketService?.getSocketIdByGuestUserId(participant.guestUserId);
          return {
            ...participant,
            socketId: socketId || null,
            isConnected: !!socketId,
            hasWebRTCConnection: !!socketId
          };
        });
      }

      const response = createSuccessResponse(result);

      res.json(response);
    } catch (error) {
      logger.error('방 정보 조회 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        roomCode: req.params.roomCode 
      });
      next(error);
    }
  }

  /**
   * 모든 방 목록 조회
   * GET /api/rooms
   */
  async getAllRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      logger.info('방 목록 조회 요청', { 
        page, 
        limit,
        ip: req.ip 
      });

      const result = await this.roomService.getAllRooms(page, limit);

      const response = createSuccessResponse(result);

      res.json(response);
    } catch (error) {
      logger.error('방 목록 조회 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        query: req.query 
      });
      next(error);
    }
  }

  /**
   * 준비 상태 업데이트
   * PATCH /api/rooms/preparation
   */
  async updatePreparation(req: Request, res: Response, next: NextFunction) {
    try {
      const { guestUserId, characterSetup, screenSetup } = req.body;

      if (!guestUserId) {
        throw new BadRequestError('게스트 사용자 ID가 필요합니다.');
      }

      // characterSetup 또는 screenSetup 중 최소 하나는 있어야 함
      if (!characterSetup && screenSetup === undefined) {
        throw new BadRequestError('캐릭터 설정 또는 화면 설정 중 최소 하나는 제공되어야 합니다.');
      }
      // 준비 상태 데이터 구성
      const preparationStatus: Record<string, any> = {};
      
      if (characterSetup) {
        preparationStatus.characterSetup = characterSetup;
      }
      
      if (screenSetup !== undefined) {
        preparationStatus.screenSetup = screenSetup;
      }
      
      logger.info('준비 상태 업데이트 요청', { 
        guestUserId, 
        preparationStatus,
        ip: req.ip 
      });


      const result = await this.roomService.updatePreparationStatus(guestUserId, preparationStatus);

      // Socket.IO로 실시간 준비 상태 업데이트 전송
      if (this.gameSocketService) {
        const socketId = this.gameSocketService.getSocketIdByGuestUserId(guestUserId);
        if (socketId) {
          const roomCode = this.gameSocketService.getRoomCodeBySocketId(socketId);
          if (roomCode) {
            const io = this.gameSocketService.getIO();
            io.to(roomCode).emit('participant-preparation-updated', {
              guestUserId,
              preparationStatus: result,
              socketId
            });
          }
        }
      }

      const response = createSuccessResponse({ 
        preparationStatus: result,
        message: '준비 상태가 업데이트되었습니다.'
      });

      logger.info('준비 상태 업데이트 완료', { 
        guestUserId, 
        preparationStatus: result 
      });

      res.json(response);
    } catch (error) {
      logger.error('준비 상태 업데이트 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 방 종료 (방장만)
   * DELETE /api/rooms/end
   */
  async endRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { hostGuestId } = req.body;

      if (!hostGuestId) {
        throw new BadRequestError('방장 ID가 필요합니다.');
      }

      logger.info('방 종료 요청', { 
        hostGuestId,
        ip: req.ip 
      });

      const result = await this.roomService.endRoom(hostGuestId);

      const response = createSuccessResponse(result);

      logger.info('방 종료 완료', { 
        hostGuestId, 
        roomCode: result.roomCode 
      });

      res.json(response);
    } catch (error) {
      logger.error('방 종료 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 방 상태 업데이트 (방장만)
   * PATCH /api/rooms/state
   */
  async updateRoomState(req: Request, res: Response, next: NextFunction) {
    try {
      const { hostGuestId, state } = req.body;

      if (!hostGuestId || !state) {
        throw new BadRequestError('방장 ID와 상태 정보가 필요합니다.');
      }

      logger.info('방 상태 업데이트 요청', { 
        hostGuestId, 
        state,
        ip: req.ip 
      });

      const result = await this.roomService.updateRoomState(hostGuestId, state);

      const response = createSuccessResponse(result);

      logger.info('방 상태 업데이트 완료', { 
        hostGuestId, 
        roomCode: result.roomCode,
        oldState: result.oldState,
        newState: result.newState
      });

      res.json(response);
    } catch (error) {
      logger.error('방 상태 업데이트 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 만료된 방 정리
   * DELETE /api/rooms/cleanup
   */
  async cleanupRooms(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('만료된 방 정리 요청', { ip: req.ip });

      const result = await this.roomService.cleanupExpiredRooms();

      const response = createSuccessResponse(result);

      logger.info('만료된 방 정리 완료', result);

      res.json(response);
    } catch (error) {
      logger.error('만료된 방 정리 실패', {
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 개발용: 모든 방 삭제
   * DELETE /api/rooms/dev/clear-all
   */
  async deleteAllRooms(req: Request, res: Response, next: NextFunction) {
    try {
      // 프로덕션 환경에서는 실행 금지
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestError('프로덕션 환경에서는 사용할 수 없는 기능입니다.');
      }

      logger.info('개발용: 모든 방 삭제 요청', { ip: req.ip });

      const result = await this.roomService.deleteAllRooms();

      const response = createSuccessResponse(result);

      logger.info('개발용: 모든 방 삭제 완료', result);

      res.json(response);
    } catch (error) {
      logger.error('모든 방 삭제 실패', {
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 모든 플레이어 준비 상태 확인
   * GET /api/rooms/:roomCode/ready-status
   */
  async checkAllPlayersReady(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode } = req.params;

      logger.info('준비 상태 확인 요청', { 
        roomCode,
        ip: req.ip 
      });

      const result = await this.roomService.checkAllPlayersReady(roomCode);

      const response = createSuccessResponse(result);

      res.json(response);
    } catch (error) {
      logger.error('준비 상태 확인 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        roomCode: req.params.roomCode 
      });
      next(error);
    }
  }

  /**
   * 녹화 시작 (방장 전용)
   * POST /api/rooms/start-recording
   */
  async startRecording(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode, hostGuestId } = req.body;

      if (!roomCode || !hostGuestId) {
        throw new BadRequestError('방 코드와 방장 ID가 필요합니다.');
      }

      logger.info('녹화 시작 요청', { 
        roomCode,
        hostGuestId,
        ip: req.ip 
      });

      // 방장 권한 확인
      const result = await this.roomService.startRecording(roomCode, hostGuestId);

      // Socket.IO로 모든 참여자에게 녹화 시작 알림
      if (this.gameSocketService) {
        const io = this.gameSocketService.getIO();
        io.to(roomCode).emit('recording-started', {
          startedBy: hostGuestId,
          timestamp: new Date(),
          roomCode
        });
      }

      const response = createSuccessResponse(result);

      res.json(response);
    } catch (error) {
      logger.error('녹화 시작 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 녹화 종료 (방장 전용)
   * POST /api/rooms/stop-recording
   */
  async stopRecording(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode, hostGuestId } = req.body;

      if (!roomCode || !hostGuestId) {
        throw new BadRequestError('방 코드와 방장 ID가 필요합니다.');
      }

      logger.info('녹화 종료 요청', { 
        roomCode,
        hostGuestId,
        ip: req.ip 
      });

      // 방장 권한 확인 및 녹화 종료
      const result = await this.roomService.stopRecording(roomCode, hostGuestId);

      // Socket.IO로 모든 참여자에게 녹화 종료 알림
      if (this.gameSocketService) {
        const io = this.gameSocketService.getIO();
        io.to(roomCode).emit('recording-stopped', {
          stoppedBy: hostGuestId,
          timestamp: new Date(),
          roomCode
        });
      }

      const response = createSuccessResponse(result);

      res.json(response);
    } catch (error) {
      logger.error('녹화 종료 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }

  /**
   * 방장 나가기 처리 (방 해체)
   * POST /api/rooms/host-leave
   */
  async hostLeaveRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode, hostGuestId } = req.body;

      if (!roomCode || !hostGuestId) {
        throw new BadRequestError('방 코드와 방장 ID가 필요합니다.');
      }

      logger.info('방장 나가기 요청', { 
        roomCode,
        hostGuestId,
        ip: req.ip 
      });

      // 방장 권한 확인 및 방 해체
      const result = await this.roomService.hostLeaveRoom(roomCode, hostGuestId);

      // Socket.IO로 모든 참여자에게 방 해체 알림
      if (this.gameSocketService) {
        const io = this.gameSocketService.getIO();
        io.to(roomCode).emit('room-dissolved', {
          reason: 'HOST_LEFT',
          message: '방장이 나가서 방이 종료되었습니다.',
          timestamp: new Date(),
          roomCode
        });

        // 모든 소켓을 방에서 제거
        io.in(roomCode).socketsLeave(roomCode);
      }

      const response = createSuccessResponse(result);

      res.json(response);
    } catch (error) {
      logger.error('방장 나가기 실패', { 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        body: req.body 
      });
      next(error);
    }
  }
}
