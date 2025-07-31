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

export class WebRTCService {
  private io: SocketIOServer;
  private rooms: Map<string, Map<string, RoomUser>> = new Map();

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

      // 현재 방 참여자들에게 새 참여자 알림
      socket.to(roomCode).emit('user-joined', {
        socketId: socket.id,
        guestUserId,
        nickname,
        joinedAt: new Date()
      });

      // 현재 방 참여자 목록 전송
      const roomUsers = Array.from(this.rooms.get(roomCode)!.values());
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

    socket.to(targetSocketId).emit('offer', {
      fromSocketId: socket.id,
      fromNickname: (socket as any).nickname,
      offer
    });

    logger.debug(`Offer sent from ${(socket as any).nickname} to ${targetSocketId}`);
  }

  private handleAnswer(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, answer } = data;

    socket.to(targetSocketId).emit('answer', {
      fromSocketId: socket.id,
      fromNickname: (socket as any).nickname,
      answer
    });

    logger.debug(`Answer sent from ${(socket as any).nickname} to ${targetSocketId}`);
  }

  private handleIceCandidate(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, candidate } = data;

    socket.to(targetSocketId).emit('ice-candidate', {
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

      // 방 상태를 'recording'으로 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.recording }
      });

      // 녹화 세션 생성
      const recordingSession = await prisma.recordingSession.create({
        data: {
          roomId,
          initiatorGuestId: guestUserId,
          sessionName: `${roomCode} 녹화 세션`,
          recordingSettings: {
            quality: '1080p',
            format: 'webm'
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24시간 후
        }
      });

      // 방의 모든 사용자에게 녹화 시작 알림
      this.io.to(roomCode).emit('recording-started', {
        sessionId: recordingSession.id,
        startedBy: (socket as any).nickname,
        timestamp: new Date()
      });

      logger.info(`방 ${roomCode}에서 녹화가 시작되었습니다.`, {
        sessionId: recordingSession.id,
        initiator: guestUserId
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

      if (recordingSession) {
        await prisma.recordingSession.update({
          where: { id: recordingSession.id },
          data: {
            endedAt: new Date(),
            status: 'processing'
          }
        });
      }

      // 방 상태를 'processing'으로 변경
      await prisma.room.update({
        where: { roomCode },
        data: { roomState: RoomState.processing }
      });

      // 방의 모든 사용자에게 녹화 종료 알림
      this.io.to(roomCode).emit('recording-stopped', {
        sessionId: recordingSession?.id,
        stoppedBy: (socket as any).nickname,
        timestamp: new Date()
      });

      logger.info(`방 ${roomCode}에서 녹화가 종료되었습니다.`, {
        sessionId: recordingSession?.id
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
      socket.to(roomCode).emit('preparation-status-updated', {
        guestUserId,
        nickname: (socket as any).nickname,
        characterSetup,
        screenSetup
      });

      logger.info('준비 상태 업데이트', {
        guestUserId,
        characterSetup,
        screenSetup
      });

    } catch (error) {
      logger.error('준비 상태 업데이트 오류:', error);
    }
  }

  private handleDisconnect(socket: Socket) {
    logger.info(`WebSocket 연결 해제: ${socket.id}`);
    this.handleLeaveRoom(socket);
  }

  private handleLeaveRoom(socket: Socket) {
    const roomCode = (socket as any).roomCode;
    const guestUserId = (socket as any).guestUserId;
    const nickname = (socket as any).nickname;

    if (roomCode && this.rooms.has(roomCode)) {
      const roomUsers = this.rooms.get(roomCode)!;
      roomUsers.delete(socket.id);

      // 방의 다른 사용자들에게 퇴장 알림
      socket.to(roomCode).emit('user-left', {
        socketId: socket.id,
        guestUserId,
        nickname
      });

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

      // 세션 참여자로 추가
      await prisma.sessionParticipant.create({
        data: {
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
      const roomUsers = this.rooms.get(roomCode);
      
      if (!roomUsers) {
        socket.emit('error', { message: '방을 찾을 수 없습니다.' });
        return;
      }

      // 현재 방의 사용자 목록을 배열로 변환
      const users = Array.from(roomUsers.values()).map(user => ({
        socketId: user.socketId,
        guestUserId: user.guestUserId,
        nickname: user.nickname,
        isHost: user.isHost,
        joinedAt: user.joinedAt
      }));

      // 요청한 클라이언트에게 사용자 목록 전송
      socket.emit('room-users', users);
      
      logger.info(`방 사용자 목록 전송: ${roomCode} -> ${users.length}명`);

    } catch (error) {
      logger.error('방 사용자 목록 요청 처리 오류:', error);
      socket.emit('error', { message: '사용자 목록을 가져올 수 없습니다.' });
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
      preparationStatus: any;
      isHost: boolean;
    }>;
    newParticipant?: {
      guestUserId: string;
      nickname: string;
      role: string;
      joinedAt: Date;
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

  public getIO(): SocketIOServer {
    return this.io;
  }
}