import pkg from '@prisma/client';
const { PrismaClient, RoomState, UserRole } = pkg;
import type { Room, GuestUser, RoomState as RoomStateType, UserRole as UserRoleType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestError, NotFoundError, ConflictError } from '../errors/errors.js';
import type { WebRTCService } from './webrtc.service.js';
import logger from '../logger.js';
import { PreparationStatus, PreparationStatusUpdate, ReadyCheckResult } from '../types/preparation.types.js';

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
    guestUserId: string;
    nickname: string;
    role: string;
    joinedAt: Date;
    preparationStatus: {
      characterSetup: boolean;
      screenSetup: boolean;
      isReady: boolean;
    };
    characterInfo: {
      selectedOptions: {
        face: string;
        hair: string;
        top: string;
        bottom: string;
        accessory: string;
      } | null;
      selectedColors: {
        face: string;
        hair: string;
        top: string;
        bottom: string;
        accessory: string;
      } | null;
      isCustomized: boolean;
    } | null;
  }>;
  hostGuest: {
    nickname: string;
  } | null;
}

export class RoomService {
  private webrtcService?: WebRTCService;

  constructor(webrtcService?: WebRTCService) {
    this.webrtcService = webrtcService;
  }
  
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

    // 인원 수 제한 검증 (2-6명)
    const maxCapacity = data.maxCapacity || 6;
    if (maxCapacity < 2 || maxCapacity > 6) {
      throw new BadRequestError('방 인원은 2명 이상 6명 이하로 설정해주세요.');
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
              screenSetup: false,
              isReady: false
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

    // 응답 형태 변환 - 캐릭터 정보 포함
    const participants = room.participants.map(p => this.formatParticipantData(p));

    return {
      ...room,
      participants
    };
  }

  /**
   * 공통: 참여자 정보 포맷팅 (캐릭터 정보 포함)
   */
  private formatParticipantData(participant: any, hostGuestId?: string | null) {
    const status = participant.preparationStatus as any;
    const characterSetup = status?.characterSetup || null;
    
    return {
      guestUserId: participant.guestUser?.id || participant.guestUserId,
      nickname: participant.guestUser?.nickname || participant.nickname,
      role: participant.role,
      joinedAt: participant.joinedAt,
      preparationStatus: {
        characterSetup: characterSetup ? true : false,
        screenSetup: status?.screenSetup || false,
        isReady: status?.isReady || false
      },
      characterInfo: characterSetup ? {
        selectedOptions: characterSetup.selectedOptions || null,
        selectedColors: characterSetup.selectedColors || null,
        isCustomized: !!(characterSetup.selectedOptions && characterSetup.selectedColors)
      } : null,
      isHost: hostGuestId ? hostGuestId === participant.guestUserId : false
    };
  }

  /**
   * WebRTC용: 소켓 정보가 포함된 방 사용자 목록 조회
   */
  async getRoomUsersForWebRTC(roomCode: string): Promise<Array<{
    socketId: string | null;
    guestUserId: string;
    nickname: string;
    isHost: boolean;
    joinedAt: Date;
    preparationStatus: {
      characterSetup: boolean;
      screenSetup: boolean;
      isReady: boolean;
    };
    characterInfo: {
      selectedOptions: {
        face: string;
        hair: string;
        top: string;
        bottom: string;
        accessory: string;
      } | null;
      selectedColors: {
        face: string;
        hair: string;
        top: string;
        bottom: string;
        accessory: string;
      } | null;
      isCustomized: boolean;
    } | null;
  }>> {
    try {
      const room = await prisma.room.findFirst({
        where: { roomCode },
        include: {
          participants: {
            where: { isActive: true },
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
          },
          hostGuest: {
            select: {
              id: true
            }
          }
        }
      });

      if (!room) {
        return [];
      }

      // WebRTC 서비스에서 소켓 정보를 추가할 수 있도록 기본 구조 반환
      return room.participants.map(participant => {
        const formattedData = this.formatParticipantData(participant, room.hostGuest?.id);
        
        return {
          socketId: null, // WebRTC 서비스에서 설정
          ...formattedData
        };
      });

    } catch (error) {
      logger.error('WebRTC용 방 사용자 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 방 참여 가능 여부 확인
   */

  /**
   * 방 참여
   */
  async joinRoom(roomCode: string, sessionId: string, nickname: string) {
    console.log(`🎯 joinRoom 호출 - roomCode: "${roomCode}", sessionId: "${sessionId}", nickname: "${nickname}"`);
    
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

      console.log(`🔍 DB 조회 결과 - roomCode: "${room?.roomCode}", participants: ${room?.participants.length || 0}, maxCapacity: ${room?.maxCapacity || 0}`);

      if (!room) {
        throw new NotFoundError('존재하지 않거나 참여할 수 없는 방입니다.');
      }

      // 2. 방 인원 초과 확인
      console.log(`🔍 방 인원 확인 - roomCode: ${roomCode}, participants: ${room.participants.length}, maxCapacity: ${room.maxCapacity}`);
      console.log('참여자 목록:', room.participants.map(p => ({ id: p.id, isActive: p.isActive })));
      
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
            screenSetup: false,
            isReady: false
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

      // 8. 현재 방의 참여자 정보 조회 (실시간 업데이트용)
      const updatedParticipants = await tx.roomParticipant.findMany({
        where: {
          roomId: room.id,
          isActive: true
        },
        include: {
          guestUser: true
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });

      const participantInfo = updatedParticipants.map(p => {
        const formattedData = this.formatParticipantData(p, room.hostGuestId);
        return {
          id: p.id,
          ...formattedData
        };
      });

      // 9. Socket.IO를 통해 방의 모든 참여자에게 업데이트 알림
      if (this.webrtcService) {
        this.webrtcService.emitParticipantUpdate(room.roomCode, {
          eventType: 'user-joined',
          participants: participantInfo,
          newParticipant: {
            guestUserId: guestUser.id,
            nickname: guestUser.nickname,
            role: UserRole.participant,
            joinedAt: participant.joinedAt
          },
          currentCapacity: room.participants.length + 1,
          maxCapacity: room.maxCapacity
        });
      }

      return {
        guestUserId: guestUser.id,
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
      participants: room.participants.map(participant => 
        this.formatParticipantData(participant, room.hostGuestId)
      )
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

      // 4. 현재 방의 남은 참여자 정보 조회 (실시간 업데이트용)
      const remainingParticipants = await tx.roomParticipant.findMany({
        where: {
          roomId: participant.room.id,
          isActive: true
        },
        include: {
          guestUser: true
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });

      const participantInfo = remainingParticipants.map(p => {
        const formattedData = this.formatParticipantData(p, participant.room.hostGuestId);
        return {
          id: p.id,
          ...formattedData
        };
      });

      // 5. Socket.IO를 통해 방의 모든 참여자에게 업데이트 알림
      if (this.webrtcService) {
        this.webrtcService.emitParticipantUpdate(participant.room.roomCode, {
          eventType: 'user-left',
          participants: participantInfo,
          leftParticipant: {
            guestUserId: participant.guestUserId,
            nickname: participant.guestUser.nickname,
            role: participant.role
          },
          currentCapacity: activeParticipants,
          maxCapacity: participant.room.maxCapacity
        });
      }

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
    newState: RoomStateType
  ): Promise<{
    roomCode: string;
    roomName: string;
    oldState: RoomStateType;
    newState: RoomStateType;
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

  /**
   * 준비 상태 업데이트 (Boolean 기반)
   */
  async updatePreparationStatus(
    guestUserId: string, 
    updateData: any // characterSetup과 screenSetup을 포함할 수 있도록 any 타입으로 변경
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 현재 참여자 정보 조회
      const participant = await tx.roomParticipant.findFirst({
        where: {
          guestUserId,
          isActive: true
        }
      });

      if (!participant) {
        throw new NotFoundError('활성화된 참여자를 찾을 수 없습니다.');
      }

      // 현재 준비 상태 가져오기 (기본값 설정)
      const currentStatus = (participant.preparationStatus as any) || {
        characterSetup: null,
        screenSetup: false
      };

      // 업데이트할 상태 병합
      const newStatus: any = {
        ...currentStatus
      };

      // characterSetup이 제공된 경우 업데이트
      if (updateData.characterSetup) {
        newStatus.characterSetup = updateData.characterSetup;
        logger.info('캐릭터 정보 업데이트', { 
          guestUserId, 
          characterSetup: updateData.characterSetup 
        });
      }

      // screenSetup이 제공된 경우 업데이트
      if (updateData.screenSetup !== undefined) {
        newStatus.screenSetup = updateData.screenSetup;
      }

      // isReady가 제공된 경우 업데이트
      if (updateData.isReady !== undefined) {
        newStatus.isReady = updateData.isReady;
        logger.info('준비 상태 업데이트', { 
          guestUserId, 
          isReady: updateData.isReady 
        });
      }

      // DB 업데이트
      await tx.roomParticipant.update({
        where: { id: participant.id },
        data: {
          preparationStatus: newStatus as any
        }
      });

      logger.info('준비 상태 업데이트 완료', {
        guestUserId,
        oldStatus: currentStatus,
        newStatus,
        updateData
      });

      return newStatus;
    });
  }

  /**
   * 모든 플레이어 준비 상태 확인
   */
  async checkAllPlayersReady(roomCode: string): Promise<{
    roomCode: string;
    allReady: boolean;
    readyCount: number;
    totalCount: number;
    participants: any[];
  }> {
    const room = await prisma.room.findFirst({
      where: {
        roomCode,
        roomState: {
          in: [RoomState.waiting, RoomState.active]
        }
      },
      include: {
        participants: {
          where: { isActive: true },
          include: { guestUser: true }
        }
      }
    });

    if (!room) {
      throw new NotFoundError('방을 찾을 수 없습니다.');
    }

    const participants = room.participants.map(participant => {
      const status = (participant.preparationStatus as any) || {
        characterSetup: null,
        screenSetup: false,
        isReady: false
      };

      // 새로운 데이터 구조에 맞춰 준비 상태 확인
      const characterReady = status.characterSetup ? true : false;
      const screenReady = status.screenSetup || false;
      const isReady = status.isReady || false;
      
      // 모든 조건이 만족되어야 완전히 준비된 상태
      const isFullyReady = characterReady && screenReady && isReady;

      return {
        guestUserId: participant.guestUserId,
        nickname: participant.guestUser.nickname,
        characterReady,
        screenReady,
        isReady,
        isFullyReady,
        preparationStatus: {
          characterSetup: characterReady,
          screenSetup: screenReady,
          isReady: isReady
        }
      };
    });

    const readyCount = participants.filter(p => p.isFullyReady).length;
    const allReady = readyCount === participants.length && participants.length >= 2;

    return {
      roomCode,
      allReady,
      readyCount,
      totalCount: participants.length,
      participants
    };
  }

  /**
   * 녹화 시작 (방장 전용)
   */
  async startRecording(roomCode: string, hostGuestId: string): Promise<{
    sessionId: string;
    roomCode: string;
    message: string;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 방장 권한 확인
      const room = await tx.room.findFirst({
        where: {
          roomCode,
          hostGuestId: hostGuestId
        },
        include: {
          participants: {
            where: { isActive: true }
          }
        }
      });

      if (!room) {
        throw new NotFoundError('방장 권한이 없거나 존재하지 않는 방입니다.');
      }

      if (room.roomState === RoomState.recording) {
        throw new ConflictError('이미 녹화가 진행 중입니다.');
      }

      // 모든 참여자 준비 완료 확인 (단순한 Boolean 체크)
      const allReady = room.participants.every(participant => {
        const status = (participant.preparationStatus as unknown as PreparationStatus) || {
          characterReady: false,
          screenReady: false,
          finalReady: false
        };
        return status.characterReady && status.screenReady && status.finalReady;
      });

      if (!allReady) {
        throw new ConflictError('아직 준비되지 않은 참여자가 있습니다.');
      }

      // 방 상태를 recording으로 변경
      await tx.room.update({
        where: { roomCode },
        data: { roomState: RoomState.recording }
      });

      // 녹화 세션 생성
      const recordingSession = await tx.recordingSession.create({
        data: {
          roomId: room.id,
          sessionName: `${roomCode} 녹화 세션`,
          recordingSettings: {
            quality: '1080p',
            format: 'webm',
            startedByHost: true
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
        }
      });

      return {
        sessionId: recordingSession.id,
        roomCode,
        message: '녹화가 시작되었습니다.'
      };
    });
  }

  /**
   * 녹화 종료 (방장 전용)
   */
  async stopRecording(roomCode: string, hostGuestId: string): Promise<{
    sessionId: string;
    roomCode: string;
    message: string;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 방장 권한 확인
      const room = await tx.room.findFirst({
        where: {
          roomCode,
          hostGuestId: hostGuestId
        }
      });

      if (!room) {
        throw new NotFoundError('방장 권한이 없거나 존재하지 않는 방입니다.');
      }

      if (room.roomState !== RoomState.recording) {
        throw new ConflictError('녹화가 진행 중이지 않습니다.');
      }

      // 가장 최근 녹화 세션 종료
      const recordingSession = await tx.recordingSession.findFirst({
        where: {
          roomId: room.id,
          status: 'recording'
        },
        orderBy: {
          startedAt: 'desc'
        }
      });

      if (!recordingSession) {
        throw new NotFoundError('진행 중인 녹화를 찾을 수 없습니다.');
      }

      await tx.recordingSession.update({
        where: { id: recordingSession.id },
        data: {
          endedAt: new Date(),
          status: 'processing'
        }
      });

      // 방 상태를 processing으로 변경
      await tx.room.update({
        where: { roomCode },
        data: { roomState: RoomState.processing }
      });

      return {
        sessionId: recordingSession.id,
        roomCode,
        message: '녹화가 종료되었습니다.'
      };
    });
  }

  /**
   * 방장 나가기 처리 (방 해체)
   */
  async hostLeaveRoom(roomCode: string, hostGuestId: string): Promise<{
    roomCode: string;
    message: string;
    participantCount: number;
  }> {
    return await prisma.$transaction(async (tx) => {
      // 방장 권한 확인
      const room = await tx.room.findFirst({
        where: {
          roomCode,
          hostGuestId: hostGuestId
        },
        include: {
          participants: {
            where: { isActive: true }
          }
        }
      });

      if (!room) {
        throw new NotFoundError('방장 권한이 없거나 존재하지 않는 방입니다.');
      }

      // 모든 참여자 비활성화
      await tx.roomParticipant.updateMany({
        where: { roomId: room.id },
        data: { isActive: false }
      });

      // 방 상태 변경
      await tx.room.update({
        where: { roomCode },
        data: { roomState: RoomState.expired }
      });

      // 진행 중인 음성 세션 종료
      await tx.voiceSession.updateMany({
        where: {
          roomId: room.id,
          endedAt: null
        },
        data: {
          endedAt: new Date()
        }
      });

      return {
        roomCode,
        message: '방장이 나가서 방이 종료되었습니다.',
        participantCount: room.participants.length
      };
    });
  }
}