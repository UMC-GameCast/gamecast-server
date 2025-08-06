# GameCast Server Socket.IO Integration - 완성된 수정사항

## 📋 개요

클라이언트 요구사항에 맞춰 기존 GameCast 서버에 Socket.IO 실시간 기능을 완전히 통합했습니다.

## 🔧 주요 수정사항

### 1. WebRTC Service 강화 (`src/services/webrtc.service.ts`)

**추가된 기능:**
- Socket ID 매핑 시스템 (guestUserId ↔ socketId 양방향 매핑)
- 클라이언트 기대 형식에 맞춘 이벤트 응답:
  - `joined-room-success`: 기존 참여자 목록 포함
  - `user-joined`: 새 참여자 알림
  - `user-left`: 참여자 퇴장 알림
- 준비 상태 실시간 동기화
- 자동 녹화 시작 (모든 플레이어 준비 완료 시 3초 후)
- 방장 권한 기반 녹화 제어
- 방장 나가기 시 방 해체 및 모든 참여자 강제 퇴장

**핵심 코드 추가:**
```typescript
// Socket ID 매핑 시스템
private socketToRoom = new Map<string, string>();
private socketToUser = new Map<string, string>();
private userToSocket = new Map<string, string>();

// 클라이언트 기대 형식 응답
socket.emit('joined-room-success', {
  roomCode,
  roomId: room.id,
  users: roomUsers,
  userCount: roomUsers.length
});
```

### 2. Room Controller 개선 (`src/controllers/room.controller.ts`)

**추가된 기능:**
- REST API 응답에 Socket ID 정보 자동 추가
- 준비 상태 업데이트 시 실시간 Socket.IO 이벤트 발송
- 새로운 게임 플로우 API 엔드포인트:
  - `GET /api/rooms/:roomCode/ready-status` - 모든 플레이어 준비 상태 확인
  - `POST /api/rooms/start-recording` - 방장 녹화 시작
  - `POST /api/rooms/stop-recording` - 방장 녹화 종료
  - `POST /api/rooms/host-leave` - 방장 나가기 (방 해체)

**핵심 수정:**
```typescript
// Socket ID 정보 자동 추가
if (result.participants && this.webrtcService) {
  result.participants = result.participants.map((participant: any) => {
    const socketId = this.webrtcService?.getSocketIdByGuestUserId(participant.guestUserId);
    return {
      ...participant,
      socketId: socketId || null,
      isConnected: !!socketId,
      hasWebRTCConnection: !!socketId
    };
  });
}
```

### 3. 새로운 API 라우트 (`src/routes/room.routes.ts`)

추가된 엔드포인트:
```typescript
router.get('/:roomCode/ready-status', roomController.checkAllPlayersReady);
router.post('/start-recording', roomController.startRecording);
router.post('/stop-recording', roomController.stopRecording);
router.post('/host-leave', roomController.hostLeaveRoom);
```

## 📡 Socket.IO 이벤트 목록

### 클라이언트 → 서버
- `join-room`: 방 참여 요청
- `offer`, `answer`, `ice-candidate`: WebRTC 시그널링
- `request-room-users`: 방 사용자 목록 요청
- `preparation-status-update`: 준비 상태 실시간 업데이트
- `host-start-recording`: 방장 녹화 시작
- `host-stop-recording`: 방장 녹화 종료
- `host-leave-room`: 방장 방 나가기

### 서버 → 클라이언트
- `joined-room-success`: 방 참여 성공 (참여자 목록 포함)
- `user-joined`: 새 참여자 입장 알림
- `user-left`: 참여자 퇴장 알림
- `participant-preparation-updated`: 참여자 준비 상태 변경
- `all-players-ready`: 모든 플레이어 준비 완료
- `recording-started`: 녹화 시작 알림
- `recording-stopped`: 녹화 종료 알림
- `room-dissolved`: 방 해체 알림

## 🎯 구현된 게임 플로우

### 1. 방 참여 플로우
1. 클라이언트가 `join-room` 이벤트 발송
2. 서버에서 Socket ID ↔ guestUserId 매핑 생성
3. `joined-room-success`로 기존 참여자 목록 응답
4. 다른 참여자들에게 `user-joined` 이벤트 브로드캐스트

### 2. 준비 상태 동기화
1. REST API로 준비 상태 업데이트
2. 서버에서 자동으로 `participant-preparation-updated` 이벤트 발송
3. 모든 플레이어 준비 완료 시 `all-players-ready` 이벤트

### 3. 자동 녹화 시작
1. 모든 플레이어 준비 완료 감지
2. `all-players-ready` 이벤트로 3초 카운트다운 시작
3. 3초 후 자동으로 `recording-started` 이벤트 발송

### 4. 방장 권한 제어
- 녹화 시작/종료는 방장만 가능
- 방장 나가기 시 모든 참여자 강제 퇴장 및 방 해체

## 🔄 클라이언트 연동 확인사항

### 필수 이벤트 리스너
```typescript
// 방 참여 성공
socket.on('joined-room-success', (data) => {
  console.log('참여 성공:', data.users);
});

// 실시간 참여자 변경
socket.on('user-joined', (data) => {
  console.log('새 참여자:', data.nickname);
});

socket.on('user-left', (data) => {
  console.log('퇴장:', data.nickname);
});

// 준비 상태 변경
socket.on('participant-preparation-updated', (data) => {
  console.log('준비 상태 변경:', data.guestUserId, data.preparationStatus);
});

// 모든 플레이어 준비 완료
socket.on('all-players-ready', (data) => {
  console.log('3초 후 녹화 시작:', data.countdown);
});

// 녹화 상태 변경
socket.on('recording-started', (data) => {
  console.log('녹화 시작:', data.startedBy);
});

socket.on('recording-stopped', (data) => {
  console.log('녹화 종료:', data.stoppedBy);
});

// 방 해체
socket.on('room-dissolved', (data) => {
  console.log('방 종료:', data.reason);
});
```

### API 응답 변경사항
모든 방 정보 API 응답에 `socketId`, `isConnected`, `hasWebRTCConnection` 필드 추가:

```json
{
  "participants": [
    {
      "guestUserId": "user123",
      "nickname": "플레이어1",
      "socketId": "socket_abc123",
      "isConnected": true,
      "hasWebRTCConnection": true,
      "preparationStatus": {
        "characterSetup": false,
        "screenSetup": false,
        "isReady": false
      }
    }
  ]
}
```

## ✅ 완료된 요구사항

- ✅ Socket ID 매핑 시스템
- ✅ `joined-room-success` 기존 참여자 목록 포함
- ✅ `user-joined`/`user-left` 실시간 알림
- ✅ 준비 상태 실시간 동기화
- ✅ 모든 플레이어 준비 완료 시 자동 녹화 시작 (3초 카운트다운)
- ✅ 방장 권한 기반 녹화 시작/종료 동기화
- ✅ 방장 나가기 시 방 해체 및 모든 참여자 강제 퇴장
- ✅ REST API 응답에 Socket ID 정보 추가

## 🚀 배포 준비사항

1. **의존성 확인**: Socket.IO 4.7.4 이미 설치됨
2. **환경변수**: 기존 CORS 설정 그대로 사용
3. **데이터베이스**: 기존 Prisma 스키마 그대로 사용
4. **테스트**: 모든 Socket.IO 이벤트 및 API 엔드포인트 동작 확인

## 📝 주의사항

- Socket ID 매핑은 서버 메모리에 저장되므로 서버 재시작 시 초기화됨
- 실제 배포에서는 Redis Adapter 사용 권장 (다중 서버 환경)
- 모든 실시간 이벤트는 방 단위로 브로드캐스트
- 방장 권한 확인은 데이터베이스 기반으로 구현됨

이제 클라이언트와 완전히 연동되어 실시간 WebRTC 음성 채팅과 게임 플로우 관리가 가능합니다!