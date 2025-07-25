import { PrismaClient, Room, GuestUser, RoomState, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestError, NotFoundError, ConflictError } from '../errors/errors.js';

const prisma = new PrismaClient();

interface CreateRoomRequest {
  roomName: string;
  maxCapacity?: number;
  hostSessionId: string;
  hostNickname: string;
  roomSettings?: Record<string, any>;
}

interface RoomWithParticipants extends Room {
  participants: Array<{
    id: string;
    nickname: string;
    role: string;
    joinedAt: Date;
    preparationStatus: any;
  }>;
  hostGuest: {
    nickname: string;
  } | null;
}

export class RoomService {
  
  /**
   * 6자리 영문자+숫자 입장코드 생성
      return {
        roomCode: result.roomCode,
        roomName: result.roomName,
        oldState,
        newState
      };
    });
  }

  /**
   * 개발용: 모든 방 삭제 (개발 환경에서만 사용)
   */
  async deleteAllRooms(): Promise<{
    deletedRooms: number;
    deletedParticipants: number;
    deletedGuests: number;
    message: string;
  }> {
    // 프로덕션 환경에서는 실행 금지
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestError('프로덕션 환경에서는 사용할 수 없는 기능입니다.');
    }

    return await prisma.$transaction(async (tx) => {
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
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 중복되지 않는 입장코드 생성
   */
  private async generateUniqueRoomCode(): Promise<string> {
    let roomCode: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      roomCode = this.generateRoomCode();
      
      const existingRoom = await prisma.room.findFirst({
        where: {
          roomCode,
          roomState: {
            not: RoomState.expired
          },
          expiresAt: {
            gt: new Date()
          }
        }
      });
      
      if (!existingRoom) {
        return roomCode;
      }
      
      attempts++;
    } while (attempts < maxAttempts);
    
    throw new Error('입장코드 생성에 실패했습니다. 다시 시도해주세요.');
  }

  /**
   * 방 생성
   */
  async createRoom(data: CreateRoomRequest) {
    // 입력 값 검증
    if (!data.roomName?.trim()) {
      throw new BadRequestError('방 이름을 입력해주세요.');
    }

    if (!data.hostSessionId || !data.hostNickname) {
      throw new BadRequestError('세션 정보와 닉네임이 필요합니다.');
    }

    // 인원 수 제한 검증 (2-5명)
    const maxCapacity = data.maxCapacity || 5;
    if (maxCapacity < 2 || maxCapacity > 5) {
      throw new BadRequestError('방 인원은 2명 이상 5명 이하로 설정해주세요.');
    }

    // 방 이름 길이 검증
    if (data.roomName.length > 100) {
      throw new BadRequestError('방 이름은 100자 이하로 입력해주세요.');
    }

    // 닉네임 길이 검증
    if (data.hostNickname.length > 50) {
      throw new BadRequestError('닉네임은 50자 이하로 입력해주세요.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 고유한 입장코드 생성
        const roomCode = await this.generateUniqueRoomCode();
        
        // 방 만료 시간 설정 (12시간 후)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 12);
        
        // 게스트 사용자 만료 시간 설정 (24시간 후)
        const guestExpiresAt = new Date();
        guestExpiresAt.setHours(guestExpiresAt.getHours() + 24);

        // 방 생성
        const room = await tx.room.create({
          data: {
            roomCode,
            roomName: data.roomName,
            maxCapacity,
            currentCapacity: 1,
            roomState: RoomState.waiting,
            expiresAt,
            roomSettings: data.roomSettings || {}
          }
        });

        // 기존 세션 ID로 된 게스트 사용자가 있는지 확인
        const existingGuest = await tx.guestUser.findUnique({
          where: { sessionId: data.hostSessionId }
        });

        let hostGuest;
        if (existingGuest) {
          // 기존 게스트 사용자 업데이트
          hostGuest = await tx.guestUser.update({
            where: { id: existingGuest.id },
            data: {
              nickname: data.hostNickname,
              roomId: room.id,
              expiresAt: guestExpiresAt,
              lastActiveAt: new Date()
            }
          });
        } else {
          // 새 방장 게스트 사용자 생성
          hostGuest = await tx.guestUser.create({
            data: {
              sessionId: data.hostSessionId,
              nickname: data.hostNickname,
              roomId: room.id,
              expiresAt: guestExpiresAt,
              userSettings: {}
            }
          });
        }

        // 방장 정보 업데이트
        await tx.room.update({
          where: { id: room.id },
          data: { hostGuestId: hostGuest.id }
        });

        // 방장을 참여자로 추가
        await tx.roomParticipant.create({
          data: {
            roomId: room.id,
            guestUserId: hostGuest.id,
            role: 'host',
            preparationStatus: {
              characterSetup: false,
              screenSetup: false
            }
          }
        });

        return {
          roomId: room.id,
          roomCode: room.roomCode,
          roomName: room.roomName,
          maxCapacity: room.maxCapacity,
          currentCapacity: room.currentCapacity,
          roomState: room.roomState,
          hostGuestId: hostGuest.id,
          expiresAt: room.expiresAt,
          createdAt: room.createdAt
        };
      });
    } catch (error) {
      console.error('방 생성 오류 상세:', error);
      if (error instanceof Error && error.message.includes('입장코드 생성')) {
        throw error;
      }
      throw new Error(`방 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 방 정보 조회
   */
  async getRoomByCode(roomCode: string): Promise<RoomWithParticipants> {
    const room = await prisma.room.findFirst({
      where: {
        roomCode,
        roomState: {
          not: RoomState.expired
        },
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        hostGuest: {
          select: {
            nickname: true
          }
        },
        participants: {
          where: {
            isActive: true
          },
          include: {
            guestUser: {
              select: {
                id: true,
                nickname: true
              }
            }
          },
          orderBy: {
            joinedAt: 'asc'
          }
        }
      }
    });

    if (!room) {
      throw new NotFoundError('존재하지 않는 입장코드입니다.');
    }

    // 응답 형태 변환
    const participants = room.participants.map(p => ({
      id: p.guestUser.id,
      nickname: p.guestUser.nickname,
      role: p.role,
      joinedAt: p.joinedAt,
      preparationStatus: p.preparationStatus
    }));

    return {
      ...room,
      participants
    };
  }

  /**
   * 방 참여 가능 여부 확인
   */

  /**
   * 방 참여
   */
  async joinRoom(roomCode: string, sessionId: string, nickname: string) {
    // 트랜잭션으로 방 참여 처리
    return await prisma.$transaction(async (tx) => {
      // 1. 방 존재 및 참여 가능 여부 확인
      const room = await tx.room.findFirst({
        where: {
          roomCode,
          roomState: {
            in: [RoomState.waiting, RoomState.active]
          },
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          participants: {
            where: {
              isActive: true
            }
          }
        }
      });

      if (!room) {
        throw new NotFoundError('존재하지 않거나 참여할 수 없는 방입니다.');
      }

      // 2. 방 인원 초과 확인
      if (room.participants.length >= room.maxCapacity) {
        throw new ConflictError('방 인원이 가득 찼습니다.');
      }

      // 3. 이미 참여 중인지 확인 (세션 ID 기준)
      const existingParticipant = await tx.roomParticipant.findFirst({
        where: {
          roomId: room.id,
          isActive: true,
          guestUser: {
            sessionId: sessionId
          }
        }
      });

      if (existingParticipant) {
        throw new ConflictError('이미 이 방에 참여 중입니다.');
      }

      // 4. 닉네임 중복 확인
      const nicknameExists = await tx.roomParticipant.findFirst({
        where: {
          roomId: room.id,
          isActive: true,
          guestUser: {
            nickname: nickname
          }
        }
      });

      if (nicknameExists) {
        throw new ConflictError('이미 사용 중인 닉네임입니다.');
      }

      // 5. 게스트 사용자 생성 또는 조회
      let guestUser = await tx.guestUser.findFirst({
        where: {
          sessionId: sessionId
        }
      });

      if (!guestUser) {
        guestUser = await tx.guestUser.create({
          data: {
            id: uuidv4(),
            sessionId: sessionId,
            nickname: nickname,
            createdAt: new Date()
          }
        });
      } else {
        // 기존 사용자의 닉네임 업데이트
        guestUser = await tx.guestUser.update({
          where: {
            id: guestUser.id
          },
          data: {
            nickname: nickname
          }
        });
      }

      // 6. 방 참여자로 추가
      const participant = await tx.roomParticipant.create({
        data: {
          id: uuidv4(),
          roomId: room.id,
          guestUserId: guestUser.id,
          role: UserRole.participant,
          joinedAt: new Date(),
          isActive: true,
          preparationStatus: {
            characterSetup: false,
            screenSetup: false
          }
        }
      });

      // 7. 방의 현재 인원 수 업데이트
      await tx.room.update({
        where: {
          id: room.id
        },
        data: {
          currentCapacity: room.participants.length + 1
        }
      });

      return {
        guestUserId: guestUser.id,
        participantId: participant.id,
        nickname: guestUser.nickname,
        role: UserRole.participant,
        joinedAt: participant.joinedAt,
        roomInfo: {
          roomId: room.id,
          roomCode: room.roomCode,
          roomName: room.roomName,
          currentCapacity: room.participants.length + 1,
          maxCapacity: room.maxCapacity,
          roomState: room.roomState
        }
      };
    });
  }

  /**
   * 모든 방 목록 조회 (페이지네이션 포함)
   */
  async getAllRooms(page: number = 1, limit: number = 10): Promise<{
    rooms: RoomWithParticipants[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * limit;

    // 전체 방 개수 조회
    const totalCount = await prisma.room.count();

    // 페이지네이션된 방 목록 조회
    const rooms = await prisma.room.findMany({
      skip,
      take: limit,
      include: {
        participants: {
          where: {
            isActive: true
          },
          include: {
            guestUser: {
              select: {
                nickname: true
              }
            }
          }
        },
        hostGuest: {
          select: {
            nickname: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const roomsWithParticipants = rooms.map(room => ({
      ...room,
      participants: room.participants.map(participant => ({
        id: participant.id,
        nickname: participant.guestUser.nickname,
        role: participant.role,
        joinedAt: participant.joinedAt,
        preparationStatus: participant.preparationStatus
      }))
    }));

    return {
      rooms: roomsWithParticipants,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  /**
   * 만료된 방과 게스트 정리
   */
  async cleanupExpiredRooms(): Promise<{
    deletedRooms: number;
    deletedGuests: number;
  }> {
    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // 1. 만료된 방 조회
      const expiredRooms = await tx.room.findMany({
        where: {
          expiresAt: {
            lt: now
          }
        },
        select: {
          id: true,
          roomCode: true
        }
      });

      let deletedRooms = 0;
      let deletedGuests = 0;

      if (expiredRooms.length > 0) {
        const expiredRoomIds = expiredRooms.map(room => room.id);

        // 2. 만료된 방의 참여자들 삭제
        await tx.roomParticipant.deleteMany({
          where: {
            roomId: {
              in: expiredRoomIds
            }
          }
        });

        // 3. 만료된 방들 삭제
        const deletedRoomsResult = await tx.room.deleteMany({
          where: {
            id: {
              in: expiredRoomIds
            }
          }
        });

        deletedRooms = deletedRoomsResult.count;
      }

      // 4. 만료된 게스트 사용자 정리 (24시간 후)
      const guestExpireTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const deletedGuestsResult = await tx.guestUser.deleteMany({
        where: {
          expiresAt: {
            lt: guestExpireTime
          }
        }
      });

      deletedGuests = deletedGuestsResult.count;

      return {
        deletedRooms,
        deletedGuests
      };
    });
  }

  /**
   * 준비 상태 업데이트
   */
  async updatePreparationStatus(
    guestUserId: string, 
    preparationStatus: Record<string, any>
  ): Promise<Record<string, any>> {
    const participant = await prisma.roomParticipant.findFirst({
      where: {
        guestUserId: guestUserId,
        isActive: true
      }
    });

    if (!participant) {
      throw new NotFoundError('참여자를 찾을 수 없습니다.');
    }

    const currentStatus = participant.preparationStatus as Record<string, any> || {};
    const updatedStatus = { ...currentStatus, ...preparationStatus };

    await prisma.roomParticipant.update({
      where: {
        id: participant.id
      },
      data: {
        preparationStatus: updatedStatus
      }
    });

    return updatedStatus;
  }

  /**
   * 방 나가기
   */
  async leaveRoom(guestUserId: string): Promise<{
    roomCode: string;
    nickname: string;
    message: string;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 1. 참여자 정보 조회
      const participant = await tx.roomParticipant.findFirst({
        where: {
          guestUserId: guestUserId,
          isActive: true
        },
        include: {
          room: true,
          guestUser: true
        }
      });

      if (!participant) {
        throw new NotFoundError('참여 중인 방을 찾을 수 없습니다.');
      }

      // 2. 참여자를 비활성화
      await tx.roomParticipant.update({
        where: {
          id: participant.id
        },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      // 3. 방의 현재 인원 수 업데이트
      const activeParticipants = await tx.roomParticipant.count({
        where: {
          roomId: participant.room.id,
          isActive: true
        }
      });

      await tx.room.update({
        where: {
          id: participant.room.id
        },
        data: {
          currentCapacity: activeParticipants
        }
      });

      return {
        roomCode: participant.room.roomCode,
        nickname: participant.guestUser.nickname,
        message: '방을 나갔습니다.'
      };
    });
  }

  /**
   * 방 종료 (방장만 가능)
   */
  async endRoom(hostGuestId: string): Promise<{
    roomCode: string;
    roomName: string;
    message: string;
    participantCount: number;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 1. 방장 권한 확인
      const room = await tx.room.findFirst({
        where: {
          hostGuestId: hostGuestId,
          roomState: {
            in: [RoomState.waiting, RoomState.active]
          }
        },
        include: {
          participants: {
            where: {
              isActive: true
            }
          }
        }
      });

      if (!room) {
        throw new NotFoundError('방장 권한이 없거나 종료할 수 있는 방이 없습니다.');
      }

      // 2. 모든 참여자를 비활성화
      await tx.roomParticipant.updateMany({
        where: {
          roomId: room.id,
          isActive: true
        },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      // 3. 방 상태를 종료로 변경
      await tx.room.update({
        where: {
          id: room.id
        },
        data: {
          roomState: RoomState.expired,
          currentCapacity: 0,
          expiresAt: new Date() // 즉시 만료
        }
      });

      return {
        roomCode: room.roomCode,
        roomName: room.roomName,
        message: '방이 종료되었습니다.',
        participantCount: room.participants.length
      };
    });
  }

  /**
   * 방 상태 변경 (방장만 가능)
   */
  async updateRoomState(
    hostGuestId: string, 
    newState: RoomState
  ): Promise<{
    roomCode: string;
    roomName: string;
    oldState: RoomState;
    newState: RoomState;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 1. 방장 권한 확인
      const room = await tx.room.findFirst({
        where: {
          hostGuestId: hostGuestId,
          roomState: {
            not: RoomState.expired
          }
        }
      });

      if (!room) {
        throw new NotFoundError('방장 권한이 없거나 존재하지 않는 방입니다.');
      }

      // 2. 상태 변경 가능 여부 확인
      if (room.roomState === RoomState.expired) {
        throw new ConflictError('이미 종료된 방의 상태는 변경할 수 없습니다.');
      }

      const oldState = room.roomState;

      // 3. 방 상태 업데이트
      await tx.room.update({
        where: {
          id: room.id
        },
        data: {
          roomState: newState
        }
      });

      return {
        roomCode: room.roomCode,
        roomName: room.roomName,
        oldState,
        newState
      };
    });
  }
}