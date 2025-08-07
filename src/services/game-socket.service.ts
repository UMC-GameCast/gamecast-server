import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import pkg from '@prisma/client';
const { PrismaClient, RoomState } = pkg;
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';
import { RoomService } from './room.service.js';
import { PreparationStatus, PreparationStatusUpdate, CharacterInfo } from '../types/preparation.types.js';

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

interface PreparationStatusData extends PreparationStatusUpdate {
  // PreparationStatusUpdate 사용 (characterReady, screenReady, finalReady)
}

interface CharacterStatusData extends CharacterInfo {
  // CharacterInfo 사용 (selectedOptions, selectedColors)
}

export class GameSocketService {
  private io: SocketIOServer;
  private rooms: Map<string, Map<string, RoomUser>> = new Map();
  private roomService: RoomService;
  
  // Socket ID 매핑을 위한 맵
  private socketToRoom = new Map<string, string>();
  private socketToUser = new Map<string, string>();
  private userToSocket = new Map<string, string>();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.roomService = new RoomService();
    this.setupSocketHandlers();
    logger.info('게임 소켓 서비스가 초기화되었습니다.');
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`새로운 게임 소켓 연결: ${socket.id}`);

      // 방 참여
      socket.on('join-room', (data: JoinRoomData) => {
        this.handleJoinRoom(socket, data);
      });

      // 준비 상태 업데이트
      socket.on('update-preparation-status', (data: PreparationStatusData) => {
        this.handlePreparationStatusUpdate(socket, data);
      });

      // 준비 상태 실시간 업데이트 (클라이언트용)
      socket.on('preparation-status-update', (data: { guestUserId: string; preparationStatus: any }) => {
        this.handlePreparationStatusRealtime(socket, data);
      });

      // 최종 준비 완료 (레디 버튼)
      socket.on('ready-to-start', () => {
        this.handleReadyToStart(socket);
      });

      // 녹화 시작 (방장 전용)
      socket.on('host-start-recording', (data: { roomCode: string }) => {
        this.handleHostStartRecording(socket, data);
      });

      // 녹화 종료 (방장 전용)
      socket.on('host-stop-recording', (data: { roomCode: string }) => {
        this.handleHostStopRecording(socket, data);
      });

      // 방장 방 나가기
      socket.on('host-leave-room', () => {
        this.handleHostLeaveRoom(socket);
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

      // Socket ID 매핑 저장
      this.socketToRoom.set(socket.id, roomCode);
      this.socketToUser.set(socket.id, guestUserId);
      this.userToSocket.set(guestUserId, socket.id);

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

      // 다른 참여자들에게 새 참여자 알림
      socket.to(roomCode).emit('user-joined', {
        socketId: socket.id,
        guestUserId,
        nickname,
        joinedAt: new Date()
      });

      // 현재 방 참여자 목록 생성
      const roomUsers = Array.from(this.rooms.get(roomCode)?.values() || []).map(user => ({
        socketId: user.socketId,
        guestUserId: user.guestUserId,
        nickname: user.nickname,
        isHost: user.isHost,
        joinedAt: user.joinedAt,
        isConnected: true,
        preparationStatus: {
          characterSetup: false,
          screenSetup: false,
          isReady: false
        },
        characterInfo: null
      }));

      // 방 참여 성공 알림
      socket.emit('joined-room-success', {
        roomCode,
        roomId: room.id,
        users: roomUsers,
        userCount: roomUsers.length
      });

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

  private async handlePreparationStatusUpdate(socket: Socket, data: PreparationStatusData) {
    try {
      const { characterReady, screenReady, finalReady } = data;
      const guestUserId = (socket as any).guestUserId;
      const roomCode = (socket as any).roomCode;

      if (!roomCode || !guestUserId) {
        socket.emit('error', { message: '방 정보를 찾을 수 없습니다.' });
        return;
      }

      // 준비 상태 업데이트 (변경된 항목만)
      const updateData: PreparationStatusUpdate = {};
      if (characterReady !== undefined) updateData.characterReady = characterReady;
      if (screenReady !== undefined) updateData.screenReady = screenReady;
      if (finalReady !== undefined) updateData.finalReady = finalReady;

      await this.roomService.updatePreparationStatus(guestUserId, updateData);

      // 방의 모든 사용자에게 준비 상태 변경 알림
      this.io.to(roomCode).emit('preparation-status-updated', {
        guestUserId,
        nickname: (socket as any).nickname,
        characterReady: characterReady ?? null,
        screenReady: screenReady ?? null,
        finalReady: finalReady ?? null,
        timestamp: new Date()
      });

      // 모든 플레이어 준비 상태 체크
      await this.checkAllReadyAndNotifyHost(roomCode);

      logger.info('준비 상태 업데이트', {
        guestUserId,
        roomCode,
        updateData
      });

    } catch (error) {
      logger.error('준비 상태 업데이트 오류:', error);
      socket.emit('error', { message: '준비 상태 업데이트 중 오류가 발생했습니다.' });
    }
  }

  private async handleCharacterStatusUpdate(socket: Socket, data: CharacterStatusData) {
    try {
      const { selectedOptions, selectedColors, isCustomized } = data;
      const guestUserId = (socket as any).guestUserId;
      const roomCode = (socket as any).roomCode;
      const nickname = (socket as any).nickname;

      if (!roomCode || !guestUserId) {
        socket.emit('error', { message: '방 정보를 찾을 수 없습니다.' });
        return;
      }

      // 캐릭터 커스터마이징 완료 여부 판단
      const hasCharacterInfo = !!(selectedOptions && selectedColors);
      
      // DB에 캐릭터 정보와 준비 상태 저장
      try {
        await this.roomService.updatePreparationStatus(guestUserId, {
          characterReady: hasCharacterInfo,  // 캐릭터 정보가 있으면 준비 완료
          characterInfo: {
            selectedOptions,
            selectedColors,
            isCustomized: hasCharacterInfo
          }
        });
        
        logger.info('캐릭터 상태가 DB에 저장됨', { guestUserId, roomCode, characterReady: hasCharacterInfo });
      } catch (dbError) {
        logger.error('캐릭터 상태 DB 저장 실패:', dbError);
        socket.emit('error', { message: '캐릭터 상태 저장 중 오류가 발생했습니다.' });
        return;
      }

      // 방의 모든 사용자에게 캐릭터 상태 변경 알림 (본인 포함)
      this.io.to(roomCode).emit('character-status-updated', {
        guestUserId,
        nickname,
        characterInfo: {
          selectedOptions,
          selectedColors,
          isCustomized: hasCharacterInfo
        },
        characterReady: hasCharacterInfo,
        updatedAt: new Date()
      });

      // 모든 플레이어 준비 상태 체크 (캐릭터 준비 상태가 변경되었으므로)
      await this.checkAllReadyAndNotifyHost(roomCode);

      logger.info('캐릭터 상태 업데이트', {
        guestUserId,
        nickname,
        roomCode,
        characterReady: hasCharacterInfo
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
        socket.emit('error', { message: '방 정보를 찾을 수 없습니다.' });
        return;
      }

      // DB에 최종 준비 상태 저장
      await this.roomService.updatePreparationStatus(guestUserId, {
        finalReady: true
      });

      // 방의 모든 사용자에게 준비 완료 알림
      this.io.to(roomCode).emit('user-ready', {
        guestUserId,
        nickname,
        finalReady: true,
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

  private async handleHostStartRecording(socket: Socket, data: { roomCode: string }) {
    try {
      const guestUserId = this.socketToUser.get(socket.id);
      const roomCode = data.roomCode;

      // 방장 권한 확인
      const room = await prisma.room.findFirst({
        where: { roomCode, hostGuest: { id: guestUserId } }
      });

      if (!room) {
        socket.emit('error', { message: '방장 권한이 없습니다.' });
        return;
      }

      // 방 상태를 recording으로 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.recording }
      });

      // 방의 모든 참여자에게 녹화 시작 알림
      this.io.to(roomCode).emit('recording-started', {
        startedBy: guestUserId,
        timestamp: new Date(),
        roomCode
      });

      logger.info(`방장 녹화 시작: ${roomCode}`, { hostId: guestUserId });

    } catch (error) {
      logger.error('방장 녹화 시작 오류:', error);
      socket.emit('error', { message: '녹화 시작에 실패했습니다.' });
    }
  }

  private async handleHostStopRecording(socket: Socket, data: { roomCode: string }) {
    try {
      const guestUserId = this.socketToUser.get(socket.id);
      const roomCode = data.roomCode;

      // 방장 권한 확인
      const room = await prisma.room.findFirst({
        where: { roomCode, hostGuest: { id: guestUserId } }
      });

      if (!room) {
        socket.emit('error', { message: '방장 권한이 없습니다.' });
        return;
      }

      // 방 상태를 processing으로 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.processing }
      });

      // 방의 모든 참여자에게 녹화 종료 알림
      this.io.to(roomCode).emit('recording-stopped', {
        stoppedBy: guestUserId,
        timestamp: new Date(),
        roomCode
      });

      logger.info(`방장 녹화 종료: ${roomCode}`, { hostId: guestUserId });

    } catch (error) {
      logger.error('방장 녹화 종료 오류:', error);
      socket.emit('error', { message: '녹화 종료에 실패했습니다.' });
    }
  }

  private async handleHostLeaveRoom(socket: Socket) {
    try {
      const guestUserId = this.socketToUser.get(socket.id);
      const roomCode = this.socketToRoom.get(socket.id);

      if (!roomCode || !guestUserId) {
        return;
      }

      // 방장 권한 확인
      const room = await prisma.room.findFirst({
        where: { roomCode, hostGuest: { id: guestUserId } }
      });

      if (!room) {
        return;
      }

      // 모든 참여자 비활성화
      await prisma.roomParticipant.updateMany({
        where: { roomId: room.id },
        data: { isActive: false }
      });

      // 방 상태 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.expired }
      });

      // 모든 참여자에게 방 해체 알림
      this.io.to(roomCode).emit('room-dissolved', {
        reason: 'HOST_LEFT',
        message: '방장이 나가서 방이 종료되었습니다.',
        timestamp: new Date(),
        roomCode
      });

      // 모든 소켓을 방에서 제거
      this.io.in(roomCode).socketsLeave(roomCode);
      this.rooms.delete(roomCode);

      // 매핑 정리
      Array.from(this.socketToRoom.entries()).forEach(([socketId, rCode]) => {
        if (rCode === roomCode) {
          const userId = this.socketToUser.get(socketId);
          this.socketToRoom.delete(socketId);
          this.socketToUser.delete(socketId);
          if (userId) {
            this.userToSocket.delete(userId);
          }
        }
      });

      logger.info(`방 해체: ${roomCode} (방장 퇴장)`, { hostId: guestUserId });

    } catch (error) {
      logger.error('방장 방 나가기 처리 오류:', error);
    }
  }

  private handleChatMessage(socket: Socket, data: { roomCode: string; message: string; timestamp: string }) {
    try {
      logger.info(`채팅 메시지 수신: ${socket.id} -> ${data.roomCode}: ${data.message}`);
      
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

  private handleDisconnect(socket: Socket) {
    const roomCode = this.socketToRoom.get(socket.id);
    const guestUserId = this.socketToUser.get(socket.id);
    
    logger.info(`게임 소켓 연결 해제: ${socket.id}`, { roomCode, guestUserId });
    
    // Socket ID 매핑 정리
    this.socketToRoom.delete(socket.id);
    this.socketToUser.delete(socket.id);
    if (guestUserId) {
      this.userToSocket.delete(guestUserId);
    }
    
    // 다른 참여자들에게 사용자 퇴장 알림
    if (roomCode && guestUserId) {
      socket.to(roomCode).emit('user-left', {
        socketId: socket.id,
        guestUserId,
        nickname: (socket as any).nickname || 'User'
      });
    }
    
    this.handleLeaveRoom(socket);
  }

  private async handleLeaveRoom(socket: Socket) {
    const roomCode = (socket as any).roomCode;
    const guestUserId = (socket as any).guestUserId;
    const nickname = (socket as any).nickname;

    if (roomCode && this.rooms.has(roomCode)) {
      const roomUsers = this.rooms.get(roomCode)!;
      roomUsers.delete(socket.id);

      // 방이 비어있으면 정리
      if (roomUsers.size === 0) {
        this.rooms.delete(roomCode);
      }

      socket.leave(roomCode);
      logger.info(`${nickname}이 방 ${roomCode}에서 나갔습니다.`);
    }
  }

  private async getRoomUsersWithCharacterInfo(roomCode: string) {
    try {
      // RoomService의 공통 메서드 활용
      const participants = await this.roomService.getRoomUsersForWebRTC(roomCode);
      
      // 소켓 정보 추가
      const socketRoomUsers = this.rooms.get(roomCode);
      if (!socketRoomUsers) {
        return participants;
      }

      return participants.map((participant: any) => {
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
        return;
      }

      // 모든 참여자의 준비 상태 확인 (단순한 Boolean 체크)
      const allReady = room.participants.every(participant => {
        const status = (participant.preparationStatus as unknown as PreparationStatus) || {
          characterReady: false,
          screenReady: false,
          finalReady: false
        };
        return status.characterReady === true &&
               status.screenReady === true &&
               status.finalReady === true;
      });

      const readyCount = room.participants.filter(participant => {
        const status = (participant.preparationStatus as unknown as PreparationStatus) || {
          characterReady: false,
          screenReady: false,
          finalReady: false
        };
        return status.characterReady === true &&
               status.screenReady === true &&
               status.finalReady === true;
      }).length;

      if (allReady) {
        // 모든 참여자가 준비 완료
        this.io.to(roomCode).emit('all-users-ready', {
          message: '모든 참여자가 준비 완료되었습니다. 녹화를 시작할 수 있습니다.',
          readyCount,
          totalCount: room.participants.length,
          canStartRecording: true,
          timestamp: new Date()
        });

        logger.info('모든 참여자 준비 완료', { 
          roomCode, 
          participantCount: room.participants.length 
        });
      } else {
        // 준비 상태 업데이트 알림
        this.io.to(roomCode).emit('ready-status-update', {
          readyCount,
          totalCount: room.participants.length,
          canStartRecording: false,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error('준비 상태 체크 오류:', error);
    }
  }

  private async handlePreparationStatusRealtime(socket: Socket, data: { guestUserId: string; preparationStatus: any }) {
    try {
      const roomCode = this.socketToRoom.get(socket.id);
      if (!roomCode) {
        socket.emit('error', { message: '방 정보를 찾을 수 없습니다.' });
        return;
      }

      // 다른 참여자들에게 준비 상태 변경 알림
      socket.to(roomCode).emit('participant-preparation-updated', {
        guestUserId: data.guestUserId,
        preparationStatus: data.preparationStatus,
        socketId: socket.id
      });

      // 모든 플레이어가 준비 완료되었는지 확인
      await this.checkAllReadyAndNotifyHost(roomCode);

      logger.info('준비 상태 실시간 업데이트', { 
        guestUserId: data.guestUserId, 
        roomCode, 
        preparationStatus: data.preparationStatus 
      });

    } catch (error) {
      logger.error('준비 상태 실시간 업데이트 오류:', error);
      socket.emit('error', { message: '준비 상태 업데이트 중 오류가 발생했습니다.' });
    }
  }

  // 외부에서 사용할 수 있는 헬퍼 메서드들
  public getSocketIdByGuestUserId(guestUserId: string): string | null {
    return this.userToSocket.get(guestUserId) || null;
  }

  public getRoomCodeBySocketId(socketId: string): string | null {
    return this.socketToRoom.get(socketId) || null;
  }

  public getRoomSockets(roomCode: string): string[] {
    const roomUsers = this.rooms.get(roomCode);
    return roomUsers ? Array.from(roomUsers.keys()) : [];
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public emitParticipantUpdate(roomCode: string, updateData: any) {
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

      logger.info(`참여자 업데이트 이벤트 전송: ${roomCode} - ${updateData.eventType}`);

    } catch (error) {
      logger.error('참여자 업데이트 이벤트 전송 오류:', error);
    }
  }
}