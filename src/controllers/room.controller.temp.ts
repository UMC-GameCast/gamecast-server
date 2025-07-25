import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../errors/errors.js';
import logger from '../logger.js';

export class RoomController {
  
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

      // Prisma 직접 임포트
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const result = await prisma.$transaction(async (tx) => {
        // 1. 모든 참여자 삭제
        const deletedParticipantsResult = await tx.roomParticipant.deleteMany({});
        
        // 2. 모든 방 삭제
        const deletedRoomsResult = await tx.room.deleteMany({});
        
        // 3. 모든 게스트 사용자 삭제
        const deletedGuestsResult = await tx.guestUser.deleteMany({});

        return {
          deletedRooms: deletedRoomsResult.count,
          deletedParticipants: deletedParticipantsResult.count,
          deletedGuests: deletedGuestsResult.count,
          message: `개발용 데이터 정리 완료: 방 ${deletedRoomsResult.count}개, 참여자 ${deletedParticipantsResult.count}명, 게스트 ${deletedGuestsResult.count}명이 삭제되었습니다.`
        };
      });

      await prisma.$disconnect();

      logger.info('개발용: 모든 방 삭제 완료', result);

      return res.success(result);
    } catch (error) {
      logger.error('개발용: 모든 방 삭제 실패', {
        error: error instanceof Error ? error.message : error,
        ip: req.ip
      });
      next(error);
    }
  }

  // 임시로 다른 메소드들은 503 에러 반환
  async createRoom(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async getRoomInfo(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async joinRoom(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async leaveRoom(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async updatePreparation(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async cleanupRooms(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async getAllRooms(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async endRoom(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }

  async updateRoomState(req: Request, res: Response, next: NextFunction) {
    return res.status(503).json({
      resultType: 'FAIL',
      error: {
        errorCode: 'SERVICE_UNAVAILABLE',
        reason: '서비스 파일 복구 중입니다.',
        data: null
      },
      success: null
    });
  }
}
