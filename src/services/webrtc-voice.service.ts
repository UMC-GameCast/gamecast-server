import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '../logger.js';

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

export class WebRTCVoiceService {
  private io: SocketIOServer;
  
  // 음성 채팅 전용 매핑 (WebRTC 피어 연결 관리)
  private voiceConnections = new Map<string, Set<string>>(); // roomCode -> Set<socketId>
  private socketToVoiceRoom = new Map<string, string>(); // socketId -> roomCode

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/webrtc-voice' // 별도 경로로 분리
    });

    this.setupVoiceHandlers();
    logger.info('WebRTC 음성채팅 서비스가 초기화되었습니다.');
  }

  private setupVoiceHandlers() {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`WebRTC 음성 연결: ${socket.id}`);

      // 음성 채팅방 참여
      socket.on('join-voice-room', (data: { roomCode: string, guestUserId: string }) => {
        this.handleJoinVoiceRoom(socket, data);
      });

      // WebRTC 시그널링 - offer
      socket.on('voice-offer', (data: WebRTCSignalData) => {
        this.handleVoiceOffer(socket, data);
      });

      // WebRTC 시그널링 - answer  
      socket.on('voice-answer', (data: WebRTCSignalData) => {
        this.handleVoiceAnswer(socket, data);
      });

      // WebRTC 시그널링 - ice candidate
      socket.on('voice-ice-candidate', (data: WebRTCSignalData) => {
        this.handleVoiceIceCandidate(socket, data);
      });

      // 음성 품질 모니터링
      socket.on('voice-quality-report', (data: AudioQualityData) => {
        this.handleVoiceQualityReport(socket, data);
      });

      // 마이크 on/off 상태 알림
      socket.on('voice-mic-toggle', (data: { isMuted: boolean }) => {
        this.handleVoiceMicToggle(socket, data);
      });

      // 스피커 on/off 상태 알림
      socket.on('voice-speaker-toggle', (data: { isMuted: boolean }) => {
        this.handleVoiceSpeakerToggle(socket, data);
      });

      // 음성 채팅방 나가기
      socket.on('leave-voice-room', () => {
        this.handleLeaveVoiceRoom(socket);
      });

      // 연결 해제
      socket.on('disconnect', () => {
        this.handleVoiceDisconnect(socket);
      });
    });
  }

  private handleJoinVoiceRoom(socket: Socket, data: { roomCode: string, guestUserId: string }) {
    try {
      const { roomCode, guestUserId } = data;

      if (!roomCode || !guestUserId) {
        socket.emit('voice-error', { message: '방 코드와 사용자 ID가 필요합니다.' });
        return;
      }

      // 기존 음성 채팅방에서 나가기
      this.handleLeaveVoiceRoom(socket);

      // 새 음성 채팅방 참여
      socket.join(roomCode);
      (socket as any).voiceRoomCode = roomCode;
      (socket as any).voiceGuestUserId = guestUserId;

      // 음성 연결 매핑 저장
      this.socketToVoiceRoom.set(socket.id, roomCode);
      
      if (!this.voiceConnections.has(roomCode)) {
        this.voiceConnections.set(roomCode, new Set());
      }
      this.voiceConnections.get(roomCode)!.add(socket.id);

      // 기존 참여자들에게 새 참여자 알림
      const existingPeers = Array.from(this.voiceConnections.get(roomCode)!)
        .filter(id => id !== socket.id);

      socket.emit('voice-room-joined', {
        roomCode,
        existingPeers,
        message: '음성 채팅방에 참여했습니다.'
      });

      // 기존 참여자들에게 새 피어 알림
      socket.to(roomCode).emit('voice-peer-joined', {
        socketId: socket.id,
        guestUserId
      });

      logger.info(`음성 채팅방 참여: ${guestUserId} -> ${roomCode}`, {
        socketId: socket.id,
        peersCount: this.voiceConnections.get(roomCode)!.size
      });

    } catch (error) {
      logger.error('음성 채팅방 참여 오류:', error);
      socket.emit('voice-error', { message: '음성 채팅방 참여 중 오류가 발생했습니다.' });
    }
  }

  private handleVoiceOffer(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, offer } = data;
    const roomCode = this.socketToVoiceRoom.get(socket.id);

    if (!roomCode) {
      socket.emit('voice-error', { message: '음성 채팅방에 참여하지 않았습니다.' });
      return;
    }

    // 같은 음성 채팅방의 피어인지 확인
    const targetRoomCode = this.socketToVoiceRoom.get(targetSocketId);
    if (targetRoomCode !== roomCode) {
      socket.emit('voice-error', { message: '다른 음성 채팅방의 사용자입니다.' });
      return;
    }

    this.io.to(targetSocketId).emit('voice-offer', {
      fromSocketId: socket.id,
      fromGuestUserId: (socket as any).voiceGuestUserId,
      offer
    });

    logger.debug(`Voice offer 전송: ${socket.id} -> ${targetSocketId}`);
  }

  private handleVoiceAnswer(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, answer } = data;
    const roomCode = this.socketToVoiceRoom.get(socket.id);

    if (!roomCode) {
      socket.emit('voice-error', { message: '음성 채팅방에 참여하지 않았습니다.' });
      return;
    }

    // 같은 음성 채팅방의 피어인지 확인
    const targetRoomCode = this.socketToVoiceRoom.get(targetSocketId);
    if (targetRoomCode !== roomCode) {
      socket.emit('voice-error', { message: '다른 음성 채팅방의 사용자입니다.' });
      return;
    }

    this.io.to(targetSocketId).emit('voice-answer', {
      fromSocketId: socket.id,
      fromGuestUserId: (socket as any).voiceGuestUserId,
      answer
    });

    logger.debug(`Voice answer 전송: ${socket.id} -> ${targetSocketId}`);
  }

  private handleVoiceIceCandidate(socket: Socket, data: WebRTCSignalData) {
    const { targetSocketId, candidate } = data;
    const roomCode = this.socketToVoiceRoom.get(socket.id);

    if (!roomCode) {
      socket.emit('voice-error', { message: '음성 채팅방에 참여하지 않았습니다.' });
      return;
    }

    // 같은 음성 채팅방의 피어인지 확인
    const targetRoomCode = this.socketToVoiceRoom.get(targetSocketId);
    if (targetRoomCode !== roomCode) {
      socket.emit('voice-error', { message: '다른 음성 채팅방의 사용자입니다.' });
      return;
    }

    this.io.to(targetSocketId).emit('voice-ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });

    logger.debug(`Voice ICE candidate 전송: ${socket.id} -> ${targetSocketId}`);
  }

  private handleVoiceQualityReport(socket: Socket, data: AudioQualityData) {
    try {
      const { latency, packetLoss, audioLevel } = data;
      const roomCode = this.socketToVoiceRoom.get(socket.id);

      if (!roomCode) {
        return;
      }

      // 음성 품질 데이터를 같은 방의 다른 참여자들에게 공유 (선택적)
      socket.to(roomCode).emit('voice-quality-update', {
        fromSocketId: socket.id,
        qualityData: {
          latency,
          packetLoss,
          audioLevel
        }
      });

      logger.debug('음성 품질 리포트 처리됨', {
        socketId: socket.id,
        roomCode,
        latency,
        packetLoss,
        audioLevel
      });

    } catch (error) {
      logger.error('음성 품질 리포트 처리 오류:', error);
    }
  }

  private handleVoiceMicToggle(socket: Socket, data: { isMuted: boolean }) {
    const roomCode = this.socketToVoiceRoom.get(socket.id);
    
    if (!roomCode) {
      return;
    }

    // 마이크 상태를 같은 방의 다른 참여자들에게 알림
    socket.to(roomCode).emit('voice-mic-status', {
      socketId: socket.id,
      guestUserId: (socket as any).voiceGuestUserId,
      isMuted: data.isMuted
    });

    logger.debug(`마이크 상태 변경: ${socket.id} -> ${data.isMuted ? 'muted' : 'unmuted'}`);
  }

  private handleVoiceSpeakerToggle(socket: Socket, data: { isMuted: boolean }) {
    const roomCode = this.socketToVoiceRoom.get(socket.id);
    
    if (!roomCode) {
      return;
    }

    // 스피커 상태를 같은 방의 다른 참여자들에게 알림
    socket.to(roomCode).emit('voice-speaker-status', {
      socketId: socket.id,
      guestUserId: (socket as any).voiceGuestUserId,
      isMuted: data.isMuted
    });

    logger.debug(`스피커 상태 변경: ${socket.id} -> ${data.isMuted ? 'muted' : 'unmuted'}`);
  }

  private handleLeaveVoiceRoom(socket: Socket) {
    const roomCode = this.socketToVoiceRoom.get(socket.id);
    
    if (!roomCode) {
      return;
    }

    // 음성 채팅방에서 나가기
    socket.leave(roomCode);
    
    // 매핑에서 제거
    this.socketToVoiceRoom.delete(socket.id);
    const roomConnections = this.voiceConnections.get(roomCode);
    if (roomConnections) {
      roomConnections.delete(socket.id);
      
      // 방이 비어있으면 정리
      if (roomConnections.size === 0) {
        this.voiceConnections.delete(roomCode);
      }
    }

    // 다른 참여자들에게 피어 나감 알림
    socket.to(roomCode).emit('voice-peer-left', {
      socketId: socket.id,
      guestUserId: (socket as any).voiceGuestUserId
    });

    logger.info(`음성 채팅방 나감: ${socket.id} <- ${roomCode}`);
  }

  private handleVoiceDisconnect(socket: Socket) {
    const roomCode = this.socketToVoiceRoom.get(socket.id);
    
    logger.info(`WebRTC 음성 연결 해제: ${socket.id}`, { roomCode });
    
    // 음성 채팅방에서 나가기
    this.handleLeaveVoiceRoom(socket);
  }

  // 외부에서 사용할 수 있는 헬퍼 메서드들
  public getVoiceRoomParticipants(roomCode: string): string[] {
    const connections = this.voiceConnections.get(roomCode);
    return connections ? Array.from(connections) : [];
  }

  public isInVoiceRoom(socketId: string): boolean {
    return this.socketToVoiceRoom.has(socketId);
  }

  public getVoiceRoomCode(socketId: string): string | null {
    return this.socketToVoiceRoom.get(socketId) || null;
  }

  // 특정 방의 모든 참여자에게 음성 관련 이벤트 전송
  public notifyVoiceRoom(roomCode: string, eventName: string, data: any) {
    this.io.to(roomCode).emit(eventName, data);
    logger.debug(`음성 이벤트 전송: ${eventName} -> ${roomCode}`, data);
  }
}