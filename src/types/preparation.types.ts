/**
 * 준비 상태 인터페이스 (캐릭터 정보 포함)
 */
export interface PreparationStatus {
  characterSetup?: CharacterSetup;  // 캐릭터 커스터마이징 데이터
  screenSetup?: boolean;            // 화면 설정 완료
  isReady?: boolean;                // 준비 버튼 누른 상태
  [key: string]: any;               // Prisma JSON 호환성을 위한 인덱스 시그니처
}

/**
 * 캐릭터 설정 정보
 */
export interface CharacterSetup {
  selectedOptions?: {
    face: string;
    hair: string;
    top: string;
    bottom: string;
    accessory: string;
  };
  selectedColors?: {
    face: string;
    hair: string;
    top: string;
    bottom: string;
    accessory: string;
  };
}

/**
 * 구 버전 캐릭터 정보 (하위 호환성)
 */
export interface CharacterInfo {
  selectedOptions?: {
    face: string;
    hair: string;
    top: string;
    bottom: string;
    accessory: string;
  };
  selectedColors?: {
    face: string;
    hair: string;
    top: string;
    bottom: string;
    accessory: string;
  };
  isCustomized?: boolean;
}

/**
 * 준비 상태 업데이트 요청 데이터
 */
export interface PreparationStatusUpdate {
  characterSetup?: CharacterSetup;  // 캐릭터 설정
  screenSetup?: boolean;            // 화면 설정
  isReady?: boolean;                // 준비 버튼 누른 상태
  characterReady?: boolean;         // 구 버전 호환성
  screenReady?: boolean;            // 구 버전 호환성
  finalReady?: boolean;             // 구 버전 호환성
  characterInfo?: CharacterInfo;    // 구 버전 호환성
}

/**
 * 준비 상태 확인 결과
 */
export interface ReadyCheckResult {
  guestUserId: string;
  nickname: string;
  characterReady: boolean;
  screenReady: boolean;
  finalReady: boolean;
  isFullyReady: boolean;  // characterReady && screenReady && finalReady
}