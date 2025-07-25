// 게스트 기반 실시간 게임 녹화/편집 플랫폼 DBML 스키마
Project Gamecast {
  database_type: 'MySQL'
  Note: '''
    - 입장코드 기반 방 시스템
    - 실시간 음성 채팅 (WebRTC)
    - 캐릭터 커스터마이징
    - 하이라이트 자동 추출
    - FFmpeg 기반 영상 편집
    
    MySQL 5.7+ 필요 (JSON 타입 지원)
  '''
}
Table guest_users {
  id VARCHAR(36) [pk, note: '게스트 사용자 고유 ID (UUID)']
  session_id VARCHAR(255) [unique, not null, note: '브라우저 세션 ID']
  nickname VARCHAR(50) [not null, note: '방 내 닉네임']
  room_id VARCHAR(36) [ref: > rooms.id, note: '현재 참여 중인 방']
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '생성 시간']
  last_active_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '마지막 활동 시간']
  expires_at DATETIME [note: '24시간 후 자동 삭제']
  user_settings JSON [note: '임시 설정 (마이크, 스피커 등)']

  indexes {
    expires_at [name: 'idx_guest_users_expires_at']
    (room_id, nickname) [unique, name: 'idx_room_unique_nickname']
  }

  Note: '세션 기반 임시 게스트 사용자. 24시간 후 자동 삭제됨'
}

// 방 테이블
Table rooms {
  id VARCHAR(36) [pk, note: '방 고유 ID (UUID)']
  room_code VARCHAR(8) [unique, not null, note: '6자리 입장코드']
  host_guest_id VARCHAR(36) [ref: > guest_users.id, note: '방장 게스트 ID']
  room_name VARCHAR(100) [not null, note: '방 이름']
  max_capacity INTEGER [default: 5, note: '최대 5명으로 제한']
  current_capacity INTEGER [default: 0, note: '현재 참여 인원']
  room_state ENUM('waiting', 'active', 'recording', 'processing', 'completed', 'expired') [default: 'waiting', note: '방 상태']
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '방 생성 시간']
  expires_at DATETIME [note: '12시간 후 자동 삭제']
  room_settings JSON [note: '방 설정']

  indexes {
    room_code [name: 'idx_rooms_code']
    expires_at [name: 'idx_rooms_expires_at']
  }

  Note: '입장코드 기반 방 시스템. 12시간 후 자동 삭제됨'
}

// 방 참여자 테이블
Table room_participants {
  id VARCHAR(36) [pk, note: '참여자 기록 ID (UUID)']
  room_id VARCHAR(36) [ref: > rooms.id, note: '방 ID']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '게스트 사용자 ID']
  role ENUM('host', 'participant') [default: 'participant', note: '역할']
  joined_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '입장 시간']
  left_at DATETIME [note: '퇴장 시간']
  is_active BOOLEAN [default: true, note: '활성 상태']
  preparation_status JSON [note: '캐릭터/화면 설정 완료 여부']

  indexes {
    (room_id, guest_user_id) [unique]
  }

  Note: '방 참여자 관리. CASCADE 삭제로 방 종료시 자동 삭제'
}

// 음성 세션 테이블
Table voice_sessions {
  id VARCHAR(36) [pk, note: '음성 세션 ID (UUID)']
  room_id VARCHAR(36) [ref: > rooms.id, note: '방 ID']
  session_type VARCHAR(20) [default: 'voice_chat', note: '세션 타입']
  started_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '시작 시간']
  ended_at DATETIME [note: '종료 시간']
  participant_count INTEGER [note: '참여자 수']
  session_metadata JSON [note: '세션 메타데이터']
  recording_enabled BOOLEAN [default: false, note: '녹화 활성화 여부']

  Note: 'WebRTC 음성 채팅 세션 관리'
}

// 세션 참여자 테이블
Table session_participants {
  session_id VARCHAR(36) [ref: > voice_sessions.id, note: '세션 ID']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '게스트 사용자 ID']
  joined_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '참여 시간']
  left_at DATETIME [note: '나간 시간']
  audio_quality_stats JSON [note: '음성 품질 통계']

  indexes {
    (session_id, guest_user_id) [pk]
  }

  Note: '음성 세션 참여자 기록'
}

// 캐릭터 카테고리 테이블
Table character_categories {
  id VARCHAR(36) [pk, note: '카테고리 ID (UUID)']
  name VARCHAR(50) [not null, note: '카테고리 명 (hair, face, tops, bottoms, shoes)']
  display_order INTEGER [not null, note: '표시 순서']
  is_required BOOLEAN [default: false, note: '필수 카테고리 여부']

  Note: '캐릭터 커스터마이징 카테고리 (머리, 얼굴, 상의, 하의, 신발)'
}

// 캐릭터 구성요소 테이블
Table character_components {
  id VARCHAR(36) [pk, note: '구성요소 ID (UUID)']
  category_id VARCHAR(36) [ref: > character_categories.id, note: '카테고리 ID']
  name VARCHAR(100) [not null, note: '구성요소 이름']
  asset_file_path VARCHAR(512) [not null, note: '에셋 파일 경로']
  preview_image_path VARCHAR(512) [note: '미리보기 이미지 경로']
  is_default BOOLEAN [default: false, note: '기본 구성요소 여부']
  metadata JSON [note: '색상 지원, 애니메이션 정보 등']

  Note: '캐릭터 구성요소 마스터 데이터'
}

// 게스트 캐릭터 테이블
Table guest_characters {
  id VARCHAR(36) [pk, note: '게스트 캐릭터 ID (UUID)']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '게스트 사용자 ID']
  room_id VARCHAR(36) [ref: > rooms.id, note: '방 ID']
  character_name VARCHAR(100) [note: '캐릭터 이름']
  is_setup_complete BOOLEAN [default: false, note: '설정 완료 여부']
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '생성 시간']

  indexes {
    (guest_user_id, room_id) [unique]
  }

  Note: '게스트의 임시 캐릭터 설정. 방 종료시 삭제됨'
}

// 게스트 캐릭터 커스터마이징 테이블
Table guest_character_customizations {
  character_id VARCHAR(36) [ref: > guest_characters.id, note: '캐릭터 ID']
  component_id VARCHAR(36) [ref: > character_components.id, note: '구성요소 ID']
  customization_data JSON [note: '색상, 크기, 위치 등 커스터마이징 데이터']
  applied_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '적용 시간']

  indexes {
    (character_id, component_id) [pk]
  }

  Note: '게스트 캐릭터의 구성요소별 커스터마이징 설정'
}

// 녹화 세션 테이블
Table recording_sessions {
  id VARCHAR(36) [pk, note: '녹화 세션 ID (UUID)']
  room_id VARCHAR(36) [ref: > rooms.id, note: '방 ID']
  initiator_guest_id VARCHAR(36) [ref: > guest_users.id, note: '녹화 시작한 게스트 ID']
  session_name VARCHAR(255) [note: '세션 이름']
  started_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '녹화 시작 시간']
  ended_at DATETIME [note: '녹화 종료 시간']
  duration_seconds INTEGER [note: '녹화 시간(초)']
  status ENUM('recording', 'processing', 'completed', 'failed', 'expired') [default: 'recording', note: '처리 상태']
  storage_path VARCHAR(1024) [note: '저장 경로']
  total_file_size_bytes BIGINT [default: 0, note: '총 파일 크기']
  expires_at DATETIME [note: '24시간 후 자동 삭제']
  recording_settings JSON [note: '녹화 설정']

  indexes {
    expires_at [name: 'idx_recording_sessions_expires_at']
  }

  Note: '게임 녹화 세션. 24시간 후 자동 삭제됨'
}

// 미디어 자산 테이블
Table media_assets {
  id VARCHAR(36) [pk, note: '미디어 자산 ID (UUID)']
  recording_session_id VARCHAR(36) [ref: > recording_sessions.id, note: '녹화 세션 ID']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '게스트 사용자 ID (어떤 게스트의 영상/음성인지)']
  asset_type VARCHAR(50) [not null, note: '자산 타입 (screen_recording, audio, highlight, subtitle)']
  original_filename VARCHAR(512) [note: '원본 파일명']
  file_path VARCHAR(1024) [not null, note: '파일 경로']
  mime_type VARCHAR(100) [note: 'MIME 타입']
  file_size_bytes BIGINT [note: '파일 크기']
  duration_seconds INTEGER [note: '재생 시간(초)']
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '생성 시간']
  processing_status ENUM('pending', 'processing', 'completed', 'failed') [default: 'pending', note: '처리 상태']
  technical_metadata JSON [note: '기술적 메타데이터']

  Note: '녹화된 미디어 파일들 (영상, 음성, 하이라이트, 자막)'
}

// 하이라이트 분석 테이블
Table highlight_analysis {
  id VARCHAR(36) [pk, note: '하이라이트 분석 ID (UUID)']
  recording_session_id VARCHAR(36) [ref: > recording_sessions.id, note: '녹화 세션 ID']
  analysis_algorithm VARCHAR(100) [not null, note: '분석 알고리즘 (laughter_detection, voice_spike)']
  analysis_parameters JSON [note: '분석 파라미터']
  started_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '분석 시작 시간']
  completed_at DATETIME [note: '분석 완료 시간']
  status ENUM('queued', 'processing', 'completed', 'failed') [default: 'queued', note: '분석 상태']

  Note: '웃음 감지 및 목소리 스파이크 분석'
}

// 하이라이트 클립 테이블
Table highlight_clips {
  id VARCHAR(36) [pk, note: '하이라이트 클립 ID (UUID)']
  analysis_id VARCHAR(36) [ref: > highlight_analysis.id, note: '분석 ID']
  clip_name VARCHAR(255) [note: '클립 이름']
  start_timestamp DECIMAL(10,3) [not null, note: '시작 타임스탬프(초)']
  end_timestamp DECIMAL(10,3) [not null, note: '종료 타임스탬프(초)']
  confidence_score DECIMAL(3,2) [note: '신뢰도 점수']
  highlight_type ENUM('voice_spike', 'laughter') [not null, note: '하이라이트 타입']
  detection_features JSON [note: '감지 특징']
  main_source_file_path VARCHAR(1024) [note: '방장 시점 영상 경로']
  is_selected BOOLEAN [default: false, note: '자막 생성용으로 선택되었는지']
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '생성 시간']

  Note: '추출된 하이라이트 클립들 (1분 앞 + 10초 뒤)'
}

// 추가 소스 클립 테이블
Table additional_source_clips {
  id VARCHAR(36) [pk, note: '추가 소스 클립 ID (UUID)']
  highlight_clip_id VARCHAR(36) [ref: > highlight_clips.id, note: '하이라이트 클립 ID']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '게스트 사용자 ID']
  source_file_path VARCHAR(1024) [not null, note: '소스 파일 경로']
  added_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '추가된 시간']

  Note: '선택된 클립의 추가 게스트 영상들'
}

// 자막 세션 테이블
Table subtitle_sessions {
  id VARCHAR(36) [pk, note: '자막 세션 ID (UUID)']
  highlight_clip_id VARCHAR(36) [ref: > highlight_clips.id, note: '하이라이트 클립 ID']
  language_code VARCHAR(10) [default: 'ko', note: '언어 코드']
  stt_provider VARCHAR(50) [default: 'RTZR', note: 'STT 제공업체 (리턴제로)']
  processing_status ENUM('pending', 'processing', 'completed', 'failed') [default: 'pending', note: '처리 상태']
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '생성 시간']

  Note: 'STT API를 통한 자막 생성 세션'
}

// 자막 세그먼트 테이블
Table subtitle_segments {
  id VARCHAR(36) [pk, note: '자막 세그먼트 ID (UUID)']
  subtitle_session_id VARCHAR(36) [ref: > subtitle_sessions.id, note: '자막 세션 ID']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '발화자 게스트 ID']
  start_timestamp DECIMAL(10,3) [not null, note: '시작 타임스탬프(초)']
  end_timestamp DECIMAL(10,3) [not null, note: '종료 타임스탬프(초)']
  original_text TEXT [note: 'STT 원본 텍스트']
  edited_text TEXT [note: '사용자가 수정한 텍스트']
  confidence_score DECIMAL(3,2) [note: '신뢰도 점수']
  sequence_number INTEGER [not null, note: '순서 번호']
  subtitle_style ENUM('standard', 'character', 'emotional') [default: 'standard', note: '자막 스타일']
  emotion_type ENUM('joy', 'sad', 'angry', 'frustrated') [note: '감정 타입 (격한 자막용)']
  is_main_speaker BOOLEAN [default: false, note: '영상 시점자인지 여부']

  Note: '개별 자막 세그먼트. 발화자별로 구분되어 저장'
}

// FFmpeg 처리 작업 테이블
Table video_processing_jobs {
  id VARCHAR(36) [pk, note: '처리 작업 ID (UUID)']
  recording_session_id VARCHAR(36) [ref: > recording_sessions.id, note: '녹화 세션 ID']
  job_type VARCHAR(50) [not null, note: '작업 타입 (render, compress, highlight_extract, subtitle_overlay)']
  input_file_paths JSON [not null, note: '입력 파일들의 경로 배열']
  output_file_path VARCHAR(1024) [note: '출력 파일 경로']
  ffmpeg_command TEXT [note: 'FFmpeg 명령어']
  processing_preset VARCHAR(100) [note: '처리 프리셋']
  status VARCHAR(20) [default: 'queued', note: '처리 상태']
  progress_percentage INTEGER [default: 0, note: '진행률 (%)']
  started_at DATETIME [note: '시작 시간']
  completed_at DATETIME [note: '완료 시간']
  client_session_id VARCHAR(255) [note: '클라이언트 세션 식별자']
  error_log TEXT [note: '에러 로그']
  processing_metadata JSON [note: '처리 메타데이터']

  Note: 'FFmpeg.wasm을 통한 클라이언트 측 비디오 처리'
}

// FFmpeg 프리셋 테이블
Table ffmpeg_presets {
  id VARCHAR(36) [pk, note: '프리셋 ID (UUID)']
  preset_name VARCHAR(100) [not null, note: '프리셋 이름']
  description TEXT [note: '설명']
  command_template TEXT [not null, note: '명령어 템플릿']
  output_format VARCHAR(20) [not null, note: '출력 포맷']
  quality_profile VARCHAR(50) [note: '품질 프로필']
  estimated_processing_ratio DECIMAL(4,2) [note: '비디오 1분당 처리 시간']
  is_client_side BOOLEAN [default: true, note: '클라이언트에서 처리 가능한지']

  Note: 'FFmpeg 처리 프리셋 마스터 데이터'
}

// 서비스 평가 테이블
Table service_evaluations {
  id VARCHAR(36) [pk, note: '평가 ID (UUID)']
  room_id VARCHAR(36) [ref: > rooms.id, note: '방 ID']
  guest_user_id VARCHAR(36) [ref: > guest_users.id, note: '평가자 게스트 ID (익명)']
  evaluator_role ENUM('host', 'participant') [not null, note: '평가자 역할 (방장 vs 게스트)']
  
  // 5단계 이모지 평가
  overall_satisfaction INTEGER [note: '전체 만족도 (1-5)']
  
  // 세부 평가 항목
  audio_quality_rating INTEGER [note: '음성 품질 평가 (1-5)']
  video_quality_rating INTEGER [note: '영상 품질 평가 (1-5)']
  ease_of_use_rating INTEGER [note: '사용 편의성 평가 (1-5)']
  
  // 방장만 해당하는 평가 (영상 편집 경험)
  editing_experience_rating INTEGER [note: '편집 경험 평가 (1-5, 방장만)']
  highlight_detection_accuracy INTEGER [note: '하이라이트 감지 정확도 (1-5, 방장만)']
  subtitle_quality_rating INTEGER [note: '자막 품질 평가 (1-5, 방장만)']
  
  // 텍스트 피드백
  positive_feedback TEXT [note: '긍정적 피드백']
  improvement_suggestions TEXT [note: '개선 제안사항']
  
  // 세션 관련 정보
  session_duration_minutes INTEGER [note: '세션 지속 시간(분)']
  total_participants INTEGER [note: '총 참여자 수']
  technical_issues_encountered JSON [note: '발생한 기술적 문제들']
  
  created_at DATETIME [default: `CURRENT_TIMESTAMP`, note: '평가 시간']

  Note: '익명 서비스 평가. 방장과 게스트 경험을 구분하여 수집'
}

// 품질 메트릭 테이블
Table quality_metrics {
  id VARCHAR(36) [pk, note: '메트릭 ID (UUID)']
  room_id VARCHAR(36) [ref: > rooms.id, note: '방 ID']
  recording_session_id VARCHAR(36) [ref: > recording_sessions.id, note: '녹화 세션 ID']
  metric_type VARCHAR(50) [not null, note: '메트릭 타입 (latency, packet_loss, audio_quality, processing_time)']
  metric_value DECIMAL(10,3) [not null, note: '메트릭 값']
  measurement_timestamp DATETIME [default: `CURRENT_TIMESTAMP`, note: '측정 시간']
  context_data JSON [note: '컨텍스트 데이터']

  Note: '품질 메트릭 (익명 수집)'
}

// IP 접속 로그 테이블 (보안용)
Table ip_access_log {
  ip_address VARCHAR(45) [not null, note: 'IP 주소 (IPv6 지원)']
  room_code VARCHAR(8) [note: '접속한 방 코드']
  access_count INTEGER [default: 1, note: '접속 횟수']
  first_access DATETIME [default: `CURRENT_TIMESTAMP`, note: '첫 접속 시간']
  last_access DATETIME [default: `CURRENT_TIMESTAMP`, note: '마지막 접속 시간']
  is_blocked BOOLEAN [default: false, note: '차단 여부']

  Note: 'IP 기반 접속 제한 및 DDoS 방지'
}