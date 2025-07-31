import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/room.service.js';
import { BadRequestError } from '../errors/errors.js';
import { createSuccessResponse } from '../utils/response.util.js';
import logger from '../logger.js';
import { WebRTCService } from '../services/webrtc.service.js';

export class RoomController {
  private roomService: RoomService;

  constructor(webrtcService?: WebRTCService) {
    this.roomService = new RoomService(webrtcService);
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
   * 방 정보 조회
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
      const { guestUserId, preparationStatus } = req.body;

      if (!guestUserId || !preparationStatus) {
        throw new BadRequestError('사용자 ID와 준비 상태 정보가 필요합니다.');
      }

      logger.info('준비 상태 업데이트 요청', { 
        guestUserId, 
        preparationStatus,
        ip: req.ip 
      });

      const result = await this.roomService.updatePreparationStatus(guestUserId, preparationStatus);

      const response = createSuccessResponse({ preparationStatus: result });

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
}
