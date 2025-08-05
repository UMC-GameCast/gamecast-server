import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import pkg from '@prisma/client';
const { PrismaClient, RoomState } = pkg;
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

const prisma = new PrismaClient();

interface RoomUser {
  socketId: string;
  guestUserId: string;
  nickname: string;
  joinedAt: Date;
  isHost: boolean;
}

interface JoinRoomData {
  roomCode: string;
  guestUserId: string;
  nickname: string;
}

interface WebRTCSignalData {
  targetSocketId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface AudioQualityData {
  latency: number;
  packetLoss: number;
  audioLevel: number;
}

interface PreparationStatusData {
  characterSetup: boolean;
  screenSetup: boolean;
}

interface CharacterStatusData {
  selectedOptions: {
    face: string;
    hair: string;
    top: string;
    bottom: string;
    accessory: string;
  };
  selectedColors: {
    face: string;
    hair: string;
    top: string;
    bottom: string;
    accessory: string;
  };
}

export class WebRTCService {
  private io: SocketIOServer;
  private rooms: Map<string, Map<string, RoomUser>> = new Map();
  private roomService: any; // 방 서비스 인스턴스

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupSocketHandlers();
    logger.info('WebRTC 시그널링 서버가 초기화되었습니다.');
  }

  public setRoomService(roomService: any) {
    this.roomService = roomService;
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`새로운 WebSocket 연결: ${socket.id}`);

      // 방 참여
      socket.on('join-room', (data: JoinRoomData) => {
        this.handleJoinRoom(socket, data);
      });

      // WebRTC 시그널링
      socket.on('offer', (data: WebRTCSignalData) => {
        this.handleOffer(socket, data);
      });

      socket.on('answer', (data: WebRTCSignalData) => {
        this.handleAnswer(socket, data);
      });

      socket.on('ice-candidate', (data: WebRTCSignalData) => {
        this.handleIceCandidate(socket, data);
      });

      // 음성 품질 모니터링
      socket.on('audio-quality-report', (data: AudioQualityData) => {
        this.handleAudioQualityReport(socket, data);
      });

      // 녹화 시작/종료
      socket.on('start-recording', (data: { roomCode: string }) => {
        this.handleStartRecording(socket, data);
      });

      socket.on('stop-recording', (data: { roomCode: string; sessionId?: string }) => {
        this.handleStopRecording(socket, data);
      });

      // 준비 상태 업데이트
      socket.on('update-preparation-status', (data: PreparationStatusData) => {
        this.handlePreparationStatusUpdate(socket, data);
      });

      // 최종 준비 완료 (레디 버튼)
      socket.on('ready-to-start', () => {
        this.handleReadyToStart(socket);
      });

      // 캐릭터 상태 업데이트
      socket.on('update-character-status', (data: CharacterStatusData) => {
        this.handleCharacterStatusUpdate(socket, data);
      });

      // 채팅 메시지
      socket.on('chat-message', (data: { roomCode: string; message: string; timestamp: string }) => {
        this.handleChatMessage(socket, data);
      });

      // 방 사용자 목록 요청
      socket.on('request-room-users', (data: { roomCode: string }) => {
        this.handleRequestRoomUsers(socket, data);
      });

      // 연결 해제
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // 방 나가기
      socket.on('leave-room', () => {
        this.handleLeaveRoom(socket);
      });
    });
  }

  private async handleJoinRoom(socket: Socket, data: JoinRoomData) {
    try {
      const { roomCode, guestUserId, nickname } = data;

      if (!roomCode || !guestUserId || !nickname) {
        socket.emit('error', { message: '필수 정보가 누락되었습니다.' });
        return;
      }

      // 방 존재 여부 및 입장 가능 여부 확인
      const room = await prisma.room.findFirst({
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
          hostGuest: true
        }
      });

      if (!room) {
        socket.emit('join-room-error', {
          message: '존재하지 않거나 입장할 수 없는 방입니다.'
        });
        return;
      }

      // 방이 가득 찬 경우
      if (room.currentCapacity >= room.maxCapacity) {
        socket.emit('join-room-error', {
          message: '방에 입장할 수 없습니다. (인원 초과)'
        });
        return;
      }

      // 녹화 중인 경우 입장 불가
      if (room.roomState === RoomState.recording) {
        socket.emit('join-room-error', {
          message: '녹화가 진행 중이어서 입장할 수 없습니다.'
        });
        return;
      }

      // 같은 방에 닉네임 중복 확인
      const existingNickname = await prisma.guestUser.findFirst({
        where: {
          roomId: room.id,
          nickname,
          participations: {
            some: {
              isActive: true
            }
          }
        }
      });

      if (existingNickname) {
        socket.emit('join-room-error', {
          message: '이미 사용 중인 닉네임입니다.'
        });
        return;
      }

      // 소켓을 방에 추가
      socket.join(roomCode);
      (socket as any).roomCode = roomCode;
      (socket as any).roomId = room.id;
      (socket as any).guestUserId = guestUserId;
      (socket as any).nickname = nickname;

      // 방별 사용자 관리
      if (!this.rooms.has(roomCode)) {
        this.rooms.set(roomCode, new Map());
      }

      const isHost = room.hostGuest?.id === guestUserId;
      this.rooms.get(roomCode)!.set(socket.id, {
        socketId: socket.id,
        guestUserId,
        nickname,
        joinedAt: new Date(),
        isHost
      });

      // 현재 방 참여자들에게 새 참여자 알림 (캐릭터 정보 포함)
      const guestUser = await prisma.guestUser.findUnique({
        where: { id: guestUserId },
        include: { 
          characters: {
            where: { roomId: room.id },
            include: {
              customizations: {
                include: { component: true }
              }
            }
          }
        }
      });

      const newParticipantWithCharacter = await this.roomService.formatParticipantData({
        id: guestUserId,
        nickname,
        socketId: socket.id,
        joinedAt: new Date(),
        room: { code: roomCode } as any,
        user: null, // GuestUser는 User 모델과 직접 연결되지 않음
        characters: guestUser?.characters || []
      });

      socket.to(roomCode).emit('user-joined', newParticipantWithCharacter);

      // 현재 방 참여자 목록 전송 (캐릭터 정보 포함)
      const roomUsers = await this.getRoomUsersWithCharacterInfo(roomCode);
      socket.emit('room-users', roomUsers);

      // 방 참여 성공 알림
      socket.emit('joined-room-success', {
        roomCode,
        roomId: room.id,
        users: roomUsers
      });

      // 음성 세션 생성 또는 참여
      await this.createOrJoinVoiceSession(room.id, guestUserId);

      logger.info(`${nickname}이 방 ${roomCode}에 참여했습니다.`, {
        socketId: socket.id,
        guestUserId,
        roomCode
      });

    } catch (error) {
      logger.error('방 참여 오류:', error);
      socket.emit('join-room-error', {
        message: '방 참여 중 오류가 발생했습니다.'
      });
    }
  }

  private handleOffer(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, offer } = data;

    this.io.to(targetSocketId).emit('offer', {
      fromSocketId: socket.id,
      fromNickname: (socket as any).nickname,
      offer
    });

    logger.debug(`Offer sent from ${(socket as any).nickname} to ${targetSocketId}`);
  }

  private handleAnswer(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, answer } = data;

    this.io.to(targetSocketId).emit('answer', {
      fromSocketId: socket.id,
      fromNickname: (socket as any).nickname,
      answer
    });

    logger.debug(`Answer sent from ${(socket as any).nickname} to ${targetSocketId}`);
  }

  private handleIceCandidate(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, candidate } = data;

    this.io.to(targetSocketId).emit('ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });
  }

  private async handleAudioQualityReport(socket: Socket, data: AudioQualityData) {
    try {
      const { latency, packetLoss, audioLevel } = data;
      const roomId = (socket as any).roomId;

      if (!roomId) return;

      await prisma.qualityMetric.create({
        data: {
          roomId,
          metricType: 'audio_quality',
          metricValue: audioLevel,
          contextData: {
            latency,
            packetLoss,
            socketId: socket.id
          }
        }
      });

    } catch (error) {
      logger.error('음성 품질 리포트 저장 오류:', error);
    }
  }

  private async handleStartRecording(socket: Socket, data: { roomCode: string }) {
    try {
      const { roomCode } = data;
      const roomId = (socket as any).roomId;
      const guestUserId = (socket as any).guestUserId;

      if (!this.rooms.has(roomCode)) {
        socket.emit('recording-error', { message: '방을 찾을 수 없습니다.' });
        return;
      }

      // 방장 권한 확인
      const room = await prisma.room.findFirst({
        where: { roomCode },
        include: { 
          hostGuest: true,
          participants: {
            where: { isActive: true }
          }
        }
      });

      if (!room) {
        socket.emit('recording-error', { message: '방을 찾을 수 없습니다.' });
        return;
      }

      // 방장인지 확인
      if (room.hostGuest?.id !== guestUserId) {
        socket.emit('recording-error', { 
          message: '녹화 시작은 방장만 할 수 있습니다.',
          code: 'INSUFFICIENT_PERMISSION'
        });
        return;
      }

      // 모든 참여자가 준비 완료되었는지 재확인
      const allReady = room.participants.every(participant => {
        const status = participant.preparationStatus as any;
        return status && 
               status.characterSetup && 
               (typeof status.characterSetup === 'object' ? 
                 status.characterSetup.selectedOptions && 
                 status.characterSetup.selectedColors : 
                 status.characterSetup === true) &&
               status.screenSetup === true &&
               status.finalReady === true;
      });

      if (!allReady) {
        socket.emit('recording-error', { 
          message: '아직 준비되지 않은 참여자가 있습니다.',
          code: 'PARTICIPANTS_NOT_READY'
        });
        return;
      }

      // 카운트다운 시작
      await this.startCountdownAndRecording(roomCode, room.id);

      logger.info(`방장이 녹화를 시작합니다: ${roomCode}`, {
        hostId: guestUserId,
        participantCount: room.participants.length
      });

    } catch (error) {
      logger.error('녹화 시작 오류:', error);
      socket.emit('recording-error', { message: '녹화 시작 중 오류가 발생했습니다.' });
    }
  }

  private async handleStopRecording(socket: Socket, data: { roomCode: string; sessionId?: string }) {
    try {
      const { roomCode } = data;
      const roomId = (socket as any).roomId;
      const guestUserId = (socket as any).guestUserId;

      // 3. 방장 권한 확인
      const room = await prisma.room.findFirst({
        where: { roomCode },
        include: { hostGuest: true }
      });

      if (!room) {
        socket.emit('recording-error', { message: '방을 찾을 수 없습니다.' });
        return;
      }

      // 방장인지 확인
      if (room.hostGuest?.id !== guestUserId) {
        socket.emit('recording-error', { 
          message: '녹화 중단은 방장만 할 수 있습니다.',
          code: 'INSUFFICIENT_PERMISSION'
        });
        return;
      }

      // 가장 최근 녹화 세션 종료
      const recordingSession = await prisma.recordingSession.findFirst({
        where: {
          roomId,
          status: 'recording'
        },
        orderBy: {
          startedAt: 'desc'
        }
      });

      if (!recordingSession) {
        socket.emit('recording-error', { message: '진행 중인 녹화를 찾을 수 없습니다.' });
        return;
      }

      await prisma.recordingSession.update({
        where: { id: recordingSession.id },
        data: {
          endedAt: new Date(),
          status: 'processing'
        }
      });

      // 방 상태를 'processing'으로 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.processing }
      });

      // 방의 모든 사용자에게 녹화 종료 알림
      this.io.to(roomCode).emit('recording-stopped', {
        sessionId: recordingSession.id,
        stoppedBy: (socket as any).nickname,
        stoppedByHost: true,
        timestamp: new Date()
      });

      logger.info(`방장이 녹화를 중단했습니다: ${roomCode}`, {
        sessionId: recordingSession.id,
        hostId: guestUserId,
        hostNickname: (socket as any).nickname
      });

    } catch (error) {
      logger.error('녹화 종료 오류:', error);
      socket.emit('recording-error', { message: '녹화 종료 중 오류가 발생했습니다.' });
    }
  }

  private async handlePreparationStatusUpdate(socket: Socket, data: PreparationStatusData) {
    try {
      const { characterSetup, screenSetup } = data;
      const guestUserId = (socket as any).guestUserId;
      const roomCode = (socket as any).roomCode;

      // 준비 상태 업데이트
      await prisma.roomParticipant.updateMany({
        where: {
          guestUserId,
          isActive: true
        },
        data: {
          preparationStatus: {
            characterSetup,
            screenSetup
          }
        }
      });

      // 방의 모든 사용자에게 준비 상태 변경 알림
      this.io.to(roomCode).emit('preparation-status-updated', {
        guestUserId,
        nickname: (socket as any).nickname,
        characterSetup,
        screenSetup
      });

      // 준비 상태 업데이트만 수행 (자동 녹화 시작 제거)
      logger.info('준비 상태 업데이트', {
        guestUserId,
        characterSetup,
        screenSetup
      });

    } catch (error) {
      logger.error('준비 상태 업데이트 오류:', error);
    }
  }

  private async handleCharacterStatusUpdate(socket: Socket, data: CharacterStatusData) {
    try {
      const { selectedOptions, selectedColors } = data;
      const guestUserId = (socket as any).guestUserId;
      const roomCode = (socket as any).roomCode;
      const nickname = (socket as any).nickname;

      if (!roomCode) {
        logger.warn('방 코드가 없는 캐릭터 상태 업데이트 시도:', { socketId: socket.id });
        return;
      }
      // 1. DB에 캐릭터 설정 저장 (RoomService 사용)
      if (this.roomService) {
        try {
          await this.roomService.updatePreparationStatus(guestUserId, {
            characterSetup: {
              selectedOptions,
              selectedColors
            }
          });
          
          logger.info('캐릭터 상태가 DB에 저장됨', { guestUserId, roomCode });
        } catch (dbError) {
          logger.error('캐릭터 상태 DB 저장 실패:', dbError);
          // DB 저장 실패해도 브로드캐스트는 계속 진행
        }
      }
            // 방의 모든 사용자에게 캐릭터 상태 변경 알림 (본인 포함)
      this.io.to(roomCode).emit('character-status-updated', {
        guestUserId,
        nickname,
        selectedOptions,
        selectedColors,
        characterInfo: {
          selectedOptions,
          selectedColors,
          isCustomized: !!(selectedOptions && selectedColors)
        },
        updatedAt: new Date()
      });

      // 캐릭터 상태 업데이트만 수행 (자동 녹화 시작 제거)
      logger.info('캐릭터 상태 업데이트', {
        guestUserId,
        nickname,
        roomCode,
        selectedOptions,
        selectedColors
      });

    } catch (error) {
      logger.error('캐릭터 상태 업데이트 오류:', error);
      socket.emit('error', { 
        message: '캐릭터 상태 업데이트 중 오류가 발생했습니다.' 
      });
    }
  }

  private async handleReadyToStart(socket: Socket) {
    try {
      const guestUserId = (socket as any).guestUserId;
      const roomCode = (socket as any).roomCode;
      const nickname = (socket as any).nickname;

      if (!roomCode || !guestUserId) {
        logger.warn('방 코드 또는 사용자 ID가 없는 준비 완료 시도:', { socketId: socket.id });
        socket.emit('error', { message: '방 정보를 찾을 수 없습니다.' });
        return;
      }

      // DB에 최종 준비 상태 저장
      await prisma.roomParticipant.updateMany({
        where: {
          guestUserId,
          isActive: true
        },
        data: {
          preparationStatus: {
            characterSetup: true,
            screenSetup: true,
            finalReady: true // 최종 준비 완료 플래그 추가
          }
        }
      });

      // 방의 모든 사용자에게 준비 완료 알림
      this.io.to(roomCode).emit('user-ready', {
        guestUserId,
        nickname,
        isReady: true,
        timestamp: new Date()
      });

      // 모든 참여자의 준비 상태 체크 후 방장에게 알림
      await this.checkAllReadyAndNotifyHost(roomCode);

      logger.info('사용자 최종 준비 완료', {
        guestUserId,
        nickname,
        roomCode
      });

    } catch (error) {
      logger.error('준비 완료 처리 오류:', error);
      socket.emit('error', { 
        message: '준비 완료 처리 중 오류가 발생했습니다.' 
      });
    }
  }

  private handleDisconnect(socket: Socket) {
    logger.info(`WebSocket 연결 해제: ${socket.id}`);
    this.handleLeaveRoom(socket);
  }

  private async handleLeaveRoom(socket: Socket) {
    const roomCode = (socket as any).roomCode;
    const guestUserId = (socket as any).guestUserId;
    const nickname = (socket as any).nickname;

    if (roomCode && this.rooms.has(roomCode)) {
      const roomUsers = this.rooms.get(roomCode)!;
      roomUsers.delete(socket.id);

      // 세션 참여자의 leftAt 시간 업데이트
      if (guestUserId) {
        try {
          const room = await prisma.room.findUnique({
            where: { roomCode },
            include: {
              voiceSessions: {
                where: { endedAt: null },
                take: 1
              }
            }
          });

          if (room && room.voiceSessions.length > 0) {
            const voiceSession = room.voiceSessions[0];
            
            await prisma.sessionParticipant.updateMany({
              where: {
                sessionId: voiceSession.id,
                guestUserId,
                leftAt: null
              },
              data: {
                leftAt: new Date()
              }
            });

            // 음성 세션 참여자 수 감소
            await prisma.voiceSession.update({
              where: { id: voiceSession.id },
              data: {
                participantCount: {
                  decrement: 1
                }
              }
            });
          }
        } catch (error) {
          logger.error('방 떠나기 시 세션 참여자 업데이트 실패:', error);
        }
      }

      // 방의 다른 사용자들에게 퇴장 알림 (캐릭터 정보 포함)
      const leavingGuestUser = await prisma.guestUser.findUnique({
        where: { id: guestUserId },
        include: { 
          characters: {
            where: { roomId: (socket as any).roomId },
            include: {
              customizations: {
                include: { component: true }
              }
            }
          }
        }
      });

      const leavingParticipantWithCharacter = await this.roomService.formatParticipantData({
        id: guestUserId,
        nickname,
        socketId: socket.id,
        joinedAt: new Date(), // 실제로는 기존 joinedAt을 사용해야 하지만 여기서는 임시
        room: { code: roomCode } as any,
        user: null,
        characters: leavingGuestUser?.characters || []
      });

      this.io.to(roomCode).emit('user-left', leavingParticipantWithCharacter);

      // 방이 비어있으면 정리
      if (roomUsers.size === 0) {
        this.rooms.delete(roomCode);
      }

      socket.leave(roomCode);
      logger.info(`${nickname}이 방 ${roomCode}에서 나갔습니다.`);
    }
  }

  private async createOrJoinVoiceSession(roomId: string, guestUserId: string) {
    try {
      // 기존 음성 세션 확인
      let voiceSession = await prisma.voiceSession.findFirst({
        where: {
          roomId,
          endedAt: null
        }
      });

      if (!voiceSession) {
        // 새 음성 세션 생성
        voiceSession = await prisma.voiceSession.create({
          data: {
            roomId,
            sessionType: 'voice_chat',
            participantCount: 1,
            recordingEnabled: false
          }
        });
      } else {
        // 기존 세션 참여자 수 증가
        await prisma.voiceSession.update({
          where: { id: voiceSession.id },
          data: {
            participantCount: {
              increment: 1
            }
          }
        });
      }

      // 세션 참여자로 추가 (중복 방지를 위해 upsert 사용)
      await prisma.sessionParticipant.upsert({
        where: {
          sessionId_guestUserId: {
            sessionId: voiceSession.id,
            guestUserId
          }
        },
        update: {
          // 이미 존재하는 경우 leftAt을 null로 설정하여 다시 활성화
          leftAt: null
        },
        create: {
          sessionId: voiceSession.id,
          guestUserId
        }
      });

    } catch (error) {
      logger.error('음성 세션 생성/참여 오류:', error);
    }
  }

  private handleChatMessage(socket: Socket, data: { roomCode: string; message: string; timestamp: string }) {
    try {
      logger.info(`채팅 메시지 수신: ${socket.id} -> ${data.roomCode}: ${data.message}`);
      
      // 방에 있는 사용자인지 확인
      const roomUsers = this.rooms.get(data.roomCode);
      if (!roomUsers || !roomUsers.has(socket.id)) {
        logger.warn(`방에 없는 사용자가 채팅 시도: ${socket.id}`);
        return;
      }

      const sender = roomUsers.get(socket.id);
      if (!sender) {
        logger.warn(`발신자 정보를 찾을 수 없음: ${socket.id}`);
        return;
      }

      // 방의 다른 모든 사용자에게 메시지 전송 (본인 제외)
      roomUsers.forEach((user, userSocketId) => {
        if (userSocketId !== socket.id) {
          this.io.to(userSocketId).emit('chat-message', {
            roomCode: data.roomCode,
            message: data.message,
            timestamp: data.timestamp,
            senderSocketId: socket.id,
            senderNickname: sender.nickname,
            senderGuestUserId: sender.guestUserId
          });
        }
      });

      logger.info(`채팅 메시지 전송 완료: ${sender.nickname} -> ${roomUsers.size - 1}명`);

    } catch (error) {
      logger.error('채팅 메시지 처리 오류:', error);
      socket.emit('error', { message: '채팅 메시지 전송에 실패했습니다.' });
    }
  }

  private handleRequestRoomUsers(socket: Socket, data: { roomCode: string }) {
    try {
      const { roomCode } = data;
      
      if (!this.rooms.has(roomCode)) {
        socket.emit('error', { message: '방을 찾을 수 없습니다.' });
        return;
      }

      // 캐릭터 정보를 포함한 방 사용자 목록 조회
      this.getRoomUsersWithCharacterInfo(roomCode).then(users => {
        socket.emit('room-users', users);
        logger.info(`방 사용자 목록 전송: ${roomCode} -> ${users.length}명`);
      }).catch(error => {
        logger.error('방 사용자 목록 조회 오류:', error);
        socket.emit('error', { message: '사용자 목록을 가져올 수 없습니다.' });
      });

    } catch (error) {
      logger.error('방 사용자 목록 요청 처리 오류:', error);
      socket.emit('error', { message: '사용자 목록을 가져올 수 없습니다.' });
    }
  }

  /**
   * 캐릭터 정보를 포함한 방 사용자 목록 조회 (RoomService 활용)
   */
  private async getRoomUsersWithCharacterInfo(roomCode: string) {
    try {
      if (!this.roomService) {
        logger.error('RoomService가 설정되지 않음');
        return [];
      }

      // RoomService의 공통 메서드 활용
      const participants = await this.roomService.getRoomUsersForWebRTC(roomCode);
      
      // 소켓 정보 추가
      const socketRoomUsers = this.rooms.get(roomCode);
      if (!socketRoomUsers) {
        return participants;
      }

      return participants.map((participant: any) => {
        // 소켓 정보 찾기
        const socketUser = Array.from(socketRoomUsers.values()).find(
          user => user.guestUserId === participant.guestUserId
        );

        return {
          ...participant,
          socketId: socketUser?.socketId || null
        };
      });

    } catch (error) {
      logger.error('캐릭터 정보를 포함한 방 사용자 목록 조회 오류:', error);
      return [];
    }
  }

  /**
   * 방 참여자 변경 이벤트를 모든 참여자에게 전달
   */
  public emitParticipantUpdate(roomCode: string, updateData: {
    eventType: 'user-joined' | 'user-left';
    participants: Array<{
      id: string;
      guestUserId: string;
      nickname: string;
      role: string;
      joinedAt: Date;
      preparationStatus: {
        characterSetup: boolean;
        screenSetup: boolean;
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
      isHost: boolean;
    }>;
    newParticipant?: {
      guestUserId: string;
      nickname: string;
      role: string;
      joinedAt: Date;
      characterInfo?: {
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
    };
    leftParticipant?: {
      guestUserId: string;
      nickname: string;
      role: string;
    };
    currentCapacity: number;
    maxCapacity: number;
  }) {
    try {
      // 해당 방의 모든 Socket.IO 클라이언트에게 이벤트 전송
      this.io.to(roomCode).emit('participant-update', {
        roomCode,
        eventType: updateData.eventType,
        participants: updateData.participants,
        newParticipant: updateData.newParticipant,
        leftParticipant: updateData.leftParticipant,
        roomInfo: {
          currentCapacity: updateData.currentCapacity,
          maxCapacity: updateData.maxCapacity
        },
        timestamp: new Date()
      });

      logger.info(`참여자 업데이트 이벤트 전송: ${roomCode} - ${updateData.eventType}`, {
        roomCode,
        eventType: updateData.eventType,
        participantCount: updateData.participants.length,
        currentCapacity: updateData.currentCapacity
      });

    } catch (error) {
      logger.error('참여자 업데이트 이벤트 전송 오류:', error);
    }
  }

  /**
   * 모든 참여자 준비 상태 체크 및 방장에게 알림
   */
  private async checkAllReadyAndNotifyHost(roomCode: string) {
    try {
      // 방 정보 조회
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
          },
          hostGuest: {
            select: { id: true }
          }
        }
      });

      if (!room || room.participants.length < 2) {
        logger.info('준비 체크 조건 미충족: 참여자 부족', { 
          roomCode, 
          participantCount: room?.participants.length || 0 
        });
        return;
      }

      // 모든 참여자의 준비 상태 확인 (최종 준비 완료 포함)
      const allReady = room.participants.every(participant => {
        const status = participant.preparationStatus as any;
        return status && 
               status.characterSetup && 
               (typeof status.characterSetup === 'object' ? 
                 status.characterSetup.selectedOptions && 
                 status.characterSetup.selectedColors : 
                 status.characterSetup === true) &&
               status.screenSetup === true &&
               status.finalReady === true; // 최종 준비 완료 플래그 체크
      });

      // 준비 완료된 참여자 수 계산
      const readyCount = room.participants.filter(participant => {
        const status = participant.preparationStatus as any;
        return status && 
               status.characterSetup && 
               status.screenSetup === true &&
               status.finalReady === true;
      }).length;

      if (allReady) {
        // 모든 참여자가 준비 완료 - 방장에게 녹화 시작 가능 알림
        this.io.to(roomCode).emit('all-users-ready', {
          message: '모든 참여자가 준비 완료되었습니다. 녹화를 시작할 수 있습니다.',
          readyCount,
          totalCount: room.participants.length,
          canStartRecording: true,
          timestamp: new Date()
        });

        logger.info('모든 참여자 준비 완료 - 방장 알림 전송', { 
          roomCode, 
          participantCount: room.participants.length 
        });
      } else {
        // 아직 준비되지 않은 참여자 존재 - 상태 업데이트 알림
        this.io.to(roomCode).emit('ready-status-update', {
          readyCount,
          totalCount: room.participants.length,
          canStartRecording: false,
          timestamp: new Date()
        });

        logger.info('준비 상태 업데이트', { 
          roomCode,
          readyCount,
          totalCount: room.participants.length
        });
      }

    } catch (error) {
      logger.error('준비 상태 체크 오류:', error);
    }
  }

  /**
   * 전체 준비 상태 체크 및 자동 녹화 시작
   */
  private async checkAndStartRecordingIfReady(roomCode: string) {
    try {
      // 방 정보 조회
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

      if (!room || room.participants.length < 2) {
        logger.info('녹화 시작 조건 미충족: 참여자 부족', { roomCode, participantCount: room?.participants.length || 0 });
        return;
      }

      // 모든 참여자의 준비 상태 확인 (최종 준비 완료 포함)
      const allReady = room.participants.every(participant => {
        const status = participant.preparationStatus as any;
        return status && 
               status.characterSetup && 
               (typeof status.characterSetup === 'object' ? 
                 status.characterSetup.selectedOptions && 
                 status.characterSetup.selectedColors : 
                 status.characterSetup === true) &&
               status.screenSetup === true &&
               status.finalReady === true; // 최종 준비 완료 플래그 체크
      });

      if (allReady) {
        logger.info('모든 참여자 준비 완료 - 자동 녹화 시작', { 
          roomCode, 
          participantCount: room.participants.length 
        });

        // 카운트다운 시작
        await this.startCountdownAndRecording(roomCode, room.id);
      } else {
        logger.info('아직 준비되지 않은 참여자 존재', { 
          roomCode,
          readyCount: room.participants.filter(p => {
            const status = p.preparationStatus as any;
            return status && status.characterSetup && status.screenSetup;
          }).length,
          totalCount: room.participants.length
        });
      }

    } catch (error) {
      logger.error('준비 상태 체크 오류:', error);
    }
  }

  /**
   * 카운트다운 후 녹화 시작
   */
  private async startCountdownAndRecording(roomCode: string, roomId: string) {
    try {
      // 이미 녹화 중이거나 처리 중인 경우 방지
      const currentRoom = await prisma.room.findFirst({
        where: { roomCode }
      });

      if (!currentRoom || currentRoom.roomState !== RoomState.waiting && currentRoom.roomState !== RoomState.active) {
        logger.warn('녹화 시작 불가: 방 상태 부적절', { roomCode, roomState: currentRoom?.roomState });
        return;
      }

      // 방 상태를 'active'로 변경 (카운트다운 시작)
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.active }
      });

      // 카운트다운 시작 알림
      this.io.to(roomCode).emit('recording-countdown-started', {
        countdown: 3,
        message: '모든 참여자가 준비되었습니다! 녹화가 곧 시작됩니다.',
        timestamp: new Date()
      });

      // 3초 카운트다운
      for (let i = 3; i > 0; i--) {
        this.io.to(roomCode).emit('recording-countdown', {
          count: i,
          timestamp: new Date()
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 녹화 시작
      await this.autoStartRecording(roomCode, roomId);

    } catch (error) {
      logger.error('카운트다운 및 녹화 시작 오류:', error);
    }
  }

  /**
   * 자동 녹화 시작
   */
  private async autoStartRecording(roomCode: string, roomId: string) {
    try {
      // 방 상태를 'recording'으로 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.recording }
      });

      // 녹화 세션 생성
      const recordingSession = await prisma.recordingSession.create({
        data: {
          roomId,
          sessionName: `${roomCode} 자동 녹화 세션`,
          recordingSettings: {
            quality: '1080p',
            format: 'webm',
            autoStarted: true
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
        }
      });

      // 방의 모든 사용자에게 녹화 시작 알림
      this.io.to(roomCode).emit('recording-started', {
        sessionId: recordingSession.id,
        startedBy: 'SYSTEM',
        autoStarted: true,
        timestamp: new Date()
      });

      logger.info(`자동 녹화 시작: ${roomCode}`, {
        sessionId: recordingSession.id,
        roomId
      });

    } catch (error) {
      logger.error('자동 녹화 시작 오류:', error);
      
      // 오류 발생 시 방 상태 복구
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.active }
      }).catch(rollbackError => {
        logger.error('방 상태 복구 실패:', rollbackError);
      });
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}