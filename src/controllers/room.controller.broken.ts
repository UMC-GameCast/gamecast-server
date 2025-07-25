import { Request, Response, NextFunction } from 'express';
// import { RoomService } from '../services/room.service.js';
import { BadRequestError } from '../errors/errors.js';
import logger from '../logger.js';

// const roomService = new RoomService();

interface CreateRoomBody {
  room_name: string;
  max_capacity?: number;
  host_session_id: string;
  host_nickname: string;
  room_settings?: Record<string, any>;
}

interface JoinRoomBody {
  room_code: string;
  session_id: string;
  nickname: string;
}

export class RoomController {
  
  /**
   * 방 생성
   * 
   * @swagger
   * /api/rooms:
   *   post:
   *     tags: [Rooms]
   *     summary: 새로운 게임 방 생성
   *     description: |
   *       새로운 게임 방을 생성합니다. 방장이 되어 다른 사용자들을 초대할 수 있습니다.
   *       
   *       ### 주요 기능
   *       - 고유한 6자리 방 코드 자동 생성
   *       - 방장 자동 등록 및 참여자로 추가
   *       - 방 만료 시간 12시간 설정
   *       - 게스트 사용자 24시간 유효
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateRoomRequest'
   *           examples:
   *             example1:
   *               summary: 기본 방 생성
   *               value:
   *                 room_name: "친구들과 함께하는 게임"
   *                 max_capacity: 4
   *                 host_session_id: "session_12345"
   *                 host_nickname: "게임마스터"
   *                 room_settings: {}
   *     responses:
   *       200:
   *         description: 방 생성 성공
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     success:
   *                       $ref: '#/components/schemas/Room'
   *             examples:
   *               success:
   *                 summary: 성공 응답
   *                 value:
   *                   resultType: "SUCCESS"
   *                   error: null
   *                   success:
   *                     roomId: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
   *                     roomCode: "QN5IFN"
   *                     roomName: "친구들과 함께하는 게임"
   *                     maxCapacity: 4
   *                     currentCapacity: 1
   *                     roomState: "waiting"
   *                     hostGuestId: "e7b5ae58-3e99-40cc-96ad-cebd3881e357"
   *                     expiresAt: "2025-07-25T17:26:56.260Z"
   *                     createdAt: "2025-07-25T05:26:56.262Z"
   *       400:
   *         description: 잘못된 요청
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FailResponse'
   *             examples:
   *               empty_room_name:
   *                 summary: 방 이름 누락
   *                 value:
   *                   resultType: "FAIL"
   *                   error:
   *                     errorCode: "BAD_REQUEST"
   *                     reason: "방 이름을 입력해주세요."
   *                     data: null
   *                   success: null
   *               invalid_capacity:
   *                 summary: 잘못된 인원 수
   *                 value:
   *                   resultType: "FAIL"
   *                   error:
   *                     errorCode: "BAD_REQUEST"
   *                     reason: "방 인원은 2명 이상 5명 이하로 설정해주세요."
   *                     data: null
   *                   success: null
   *       500:
   *         description: 서버 오류
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FailResponse'
   */
  async createRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        room_name,
        max_capacity,
        host_session_id,
        host_nickname,
        room_settings
      }: CreateRoomBody = req.body;

      // 요청 로깅
      logger.info('방 생성 요청', {
        room_name,
        max_capacity,
        host_nickname,
        ip: req.ip
      });

      const result = await roomService.createRoom({
        roomName: room_name,
        maxCapacity: max_capacity,
        hostSessionId: host_session_id,
        hostNickname: host_nickname,
        roomSettings: room_settings
      });

      logger.info('방 생성 성공', {
        roomId: result.roomId,
        roomCode: result.roomCode,
        hostNickname: host_nickname
      });

      return res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: result
      });
    } catch (error) {
      logger.error('방 생성 실패', {
        error: error instanceof Error ? error.message : error,
        body: req.body,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 방 정보 조회
   * 
   * @swagger
   * /api/rooms/{roomCode}:
   *   get:
   *     tags: [Rooms]
   *     summary: 방 코드로 방 정보 조회
   *     description: |
   *       6자리 방 코드를 사용하여 방의 상세 정보를 조회합니다.
   *       
   *       ### 반환 정보
   *       - 방 기본 정보 (이름, 인원수, 상태 등)
   *       - 방장 정보
   *       - 현재 참여자 목록
   *       - 각 참여자의 준비 상태
   *     parameters:
   *       - in: path
   *         name: roomCode
   *         required: true
   *         schema:
   *           type: string
   *           pattern: "^[A-Z0-9]{6}$"
   *         description: 6자리 방 코드 (대소문자 구분 없음)
   *         example: "QN5IFN"
   *     responses:
   *       200:
   *         description: 방 정보 조회 성공
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     success:
   *                       $ref: '#/components/schemas/RoomWithParticipants'
   *             examples:
   *               success:
   *                 summary: 성공 응답
   *                 value:
   *                   resultType: "SUCCESS"
   *                   error: null
   *                   success:
   *                     room_id: "f8a6aadf-aa19-4d5e-9026-aff1ae920033"
   *                     room_code: "QN5IFN"
   *                     room_name: "친구들과 함께하는 게임"
   *                     max_capacity: 4
   *                     current_capacity: 2
   *                     room_state: "waiting"
   *                     host_nickname: "게임마스터"
   *                     created_at: "2025-07-25T05:26:56.262Z"
   *                     expires_at: "2025-07-25T17:26:56.260Z"
   *                     room_settings: {}
   *                     participants:
   *                       - id: "e7b5ae58-3e99-40cc-96ad-cebd3881e357"
   *                         nickname: "게임마스터"
   *                         role: "host"
   *                         joined_at: "2025-07-25T05:26:56.262Z"
   *                         preparation_status:
   *                           characterSetup: false
   *                           screenSetup: false
   *                       - id: "participant-id-2"
   *                         nickname: "참여자1"
   *                         role: "guest"
   *                         joined_at: "2025-07-25T05:30:15.123Z"
   *                         preparation_status:
   *                           characterSetup: true
   *                           screenSetup: false
   *       400:
   *         description: 잘못된 요청
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FailResponse'
   *             examples:
   *               missing_room_code:
   *                 summary: 방 코드 누락
   *                 value:
   *                   resultType: "FAIL"
   *                   error:
   *                     errorCode: "BAD_REQUEST"
   *                     reason: "방 코드가 필요합니다."
   *                     data: null
   *                   success: null
   *       404:
   *         description: 방을 찾을 수 없음
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FailResponse'
   *             examples:
   *               room_not_found:
   *                 summary: 존재하지 않는 방
   *                 value:
   *                   resultType: "FAIL"
   *                   error:
   *                     errorCode: "NOT_FOUND"
   *                     reason: "존재하지 않는 입장코드입니다."
   *                     data: null
   *                   success: null
   */
  async getRoomInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { roomCode } = req.params;

      if (!roomCode) {
        throw new BadRequestError('방 코드가 필요합니다.');
      }

      logger.info('방 정보 조회 요청', { roomCode, ip: req.ip });

      const room = await roomService.getRoomByCode(roomCode.toUpperCase());

      const response = {
        room_id: room.id,
        room_code: room.roomCode,
        room_name: room.roomName,
        max_capacity: room.maxCapacity,
        current_capacity: room.currentCapacity,
        room_state: room.roomState,
        host_nickname: room.hostGuest?.nickname,
        created_at: room.createdAt,
        expires_at: room.expiresAt,
        room_settings: room.roomSettings,
        participants: room.participants.map(p => ({
          id: p.id,
          nickname: p.nickname,
          role: p.role,
          joined_at: p.joinedAt,
          preparation_status: p.preparationStatus
        }))
      };

      return res.status(200).json({
        resultType: 'SUCCESS',
        error: null,
        success: response
      });
    } catch (error) {
      logger.error('방 정보 조회 실패', {
        error: error instanceof Error ? error.message : error,
        roomCode: req.params.roomCode,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 방 참여
   * POST /api/rooms/join
   */
  async joinRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { room_code, session_id, nickname }: JoinRoomBody = req.body;

      if (!room_code || !session_id || !nickname) {
        throw new BadRequestError('방 코드, 세션 ID, 닉네임이 모두 필요합니다.');
      }

      logger.info('방 참여 요청', {
        room_code,
        nickname,
        ip: req.ip
      });

      const result = await roomService.joinRoom(
        room_code.toUpperCase(),
        session_id,
        nickname
      );

      logger.info('방 참여 성공', {
        guestUserId: result.guestUserId,
        roomCode: result.roomCode,
        nickname
      });

      return res.success(result);
    } catch (error) {
      logger.error('방 참여 실패', {
        error: error instanceof Error ? error.message : error,
        body: req.body,
        ip: req.ip
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
      const { guest_user_id } = req.body;

      if (!guest_user_id) {
        throw new BadRequestError('게스트 사용자 ID가 필요합니다.');
      }

      logger.info('방 나가기 요청', {
        guestUserId: guest_user_id,
        ip: req.ip
      });

      const result = await roomService.leaveRoom(guest_user_id);

      logger.info('방 나가기 성공', {
        guestUserId: guest_user_id,
        roomCode: result.roomCode,
        nickname: result.nickname
      });

      return res.success(result);
    } catch (error) {
      logger.error('방 나가기 실패', {
        error: error instanceof Error ? error.message : error,
        guestUserId: req.body.guest_user_id,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 준비 상태 업데이트
   * PUT /api/rooms/preparation
   */
  async updatePreparation(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        guest_user_id,
        character_setup,
        screen_setup
      } = req.body;

      if (!guest_user_id) {
        throw new BadRequestError('게스트 사용자 ID가 필요합니다.');
      }

      const preparationStatus: any = {};
      if (typeof character_setup === 'boolean') {
        preparationStatus.characterSetup = character_setup;
      }
      if (typeof screen_setup === 'boolean') {
        preparationStatus.screenSetup = screen_setup;
      }

      logger.info('준비 상태 업데이트 요청', {
        guestUserId: guest_user_id,
        preparationStatus,
        ip: req.ip
      });

      const result = await roomService.updatePreparationStatus(
        guest_user_id,
        preparationStatus
      );

      return res.success({
        guest_user_id,
        preparation_status: result
      });
    } catch (error) {
      logger.error('준비 상태 업데이트 실패', {
        error: error instanceof Error ? error.message : error,
        body: req.body,
        ip: req.ip
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
      logger.info('방 정리 작업 시작', { ip: req.ip });

      const result = await roomService.cleanupExpiredRooms();

      logger.info('방 정리 작업 완료', {
        deletedRooms: result.deletedRooms,
        deletedGuests: result.deletedGuests
      });

      return res.success({
        message: `${result.deletedRooms}개의 만료된 방과 ${result.deletedGuests}명의 게스트가 정리되었습니다.`,
        deleted_rooms: result.deletedRooms,
        deleted_guests: result.deletedGuests
      });
    } catch (error) {
      logger.error('방 정리 작업 실패', {
        error: error instanceof Error ? error.message : error,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 방 목록 조회 (관리자용)
   * GET /api/rooms
   */
  async getAllRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (page < 1 || limit < 1 || limit > 100) {
        throw new BadRequestError('잘못된 페이지네이션 파라미터입니다.');
      }

      logger.info('방 목록 조회 요청', { page, limit, ip: req.ip });

      const result = await roomService.getAllRooms(page, limit);

      const response = {
        rooms: result.rooms.map(room => ({
          id: room.id,
          room_code: room.roomCode,
          room_name: room.roomName,
          max_capacity: room.maxCapacity,
          current_capacity: room.currentCapacity,
          room_state: room.roomState,
          host_nickname: room.hostGuest?.nickname,
          participant_count: room.participants.length,
          created_at: room.createdAt,
          expires_at: room.expiresAt
        })),
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalCount: result.totalCount,
          limit: limit
        }
      };

      return res.success(response);
    } catch (error) {
      logger.error('방 목록 조회 실패', {
        error: error instanceof Error ? error.message : error,
        query: req.query,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 방 종료 (방장만 가능)
   * DELETE /api/rooms/end
   */
  async endRoom(req: Request, res: Response, next: NextFunction) {
    try {
      const { host_guest_id } = req.body;

      if (!host_guest_id) {
        throw new BadRequestError('방장 게스트 ID가 필요합니다.');
      }

      logger.info('방 종료 요청', {
        hostGuestId: host_guest_id,
        ip: req.ip
      });

      const result = await roomService.endRoom(host_guest_id);

      logger.info('방 종료 성공', {
        roomCode: result.roomCode,
        roomName: result.roomName,
        participantCount: result.participantCount
      });

      return res.success(result);
    } catch (error) {
      logger.error('방 종료 실패', {
        error: error instanceof Error ? error.message : error,
        hostGuestId: req.body.host_guest_id,
        ip: req.ip
      });
      next(error);
    }
  }

  /**
   * 방 상태 변경 (방장만 가능)
   * PUT /api/rooms/state
   */
  async updateRoomState(req: Request, res: Response, next: NextFunction) {
    try {
      const { host_guest_id, room_state } = req.body;

      if (!host_guest_id || !room_state) {
        throw new BadRequestError('방장 게스트 ID와 방 상태가 필요합니다.');
      }

      // 유효한 방 상태 확인
      const validStates = ['waiting', 'active', 'recording', 'expired'];
      if (!validStates.includes(room_state)) {
        throw new BadRequestError('유효하지 않은 방 상태입니다.');
      }

      logger.info('방 상태 변경 요청', {
        hostGuestId: host_guest_id,
        newState: room_state,
        ip: req.ip
      });

      const result = await roomService.updateRoomState(host_guest_id, room_state);

      logger.info('방 상태 변경 성공', {
        roomCode: result.roomCode,
        oldState: result.oldState,
        newState: result.newState
      });

      return res.success(result);
    } catch (error) {
      logger.error('방 상태 변경 실패', {
        error: error instanceof Error ? error.message : error,
        body: req.body,
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

      // 임시로 직접 구현 (서비스 파일 복구 후 이동)
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
}
