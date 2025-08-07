/**
 * 단순화된 Boolean 기반 준비 상태 인터페이스
 */
export interface PreparationStatus {
  characterReady: boolean;    // 캐릭터 커스터마이징 완료
  screenReady: boolean;       // 화면 설정 완료  
  finalReady: boolean;        // 최종 준비 완료 ("준비 완료" 버튼 클릭)
  [key: string]: any;         // Prisma JSON 호환성을 위한 인덱스 시그니처
}

/**
 * 캐릭터 정보 (선택사항)
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
  characterReady?: boolean;
  screenReady?: boolean;
  finalReady?: boolean;
  characterInfo?: CharacterInfo;  // 캐릭터 정보는 별도로 관리
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