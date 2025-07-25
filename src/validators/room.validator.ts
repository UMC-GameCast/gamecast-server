import Joi from 'joi';

// 방 생성 요청 검증 스키마
export const createRoomSchema = Joi.object({
  roomName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': '방 이름을 입력해주세요.',
      'string.max': '방 이름은 100자 이하로 입력해주세요.',
      'any.required': '방 이름은 필수입니다.'
    }),
  
  maxCapacity: Joi.number()
    .integer()
    .min(2)
    .max(5)
    .default(5)
    .messages({
      'number.min': '최소 인원은 2명입니다.',
      'number.max': '최대 인원은 5명입니다.',
      'number.integer': '인원 수는 정수여야 합니다.'
    }),
  
  hostSessionId: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .messages({
      'string.empty': '세션 ID를 입력해주세요.',
      'string.max': '세션 ID가 너무 깁니다.'
    }),
  
  hostNickname: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': '닉네임을 입력해주세요.',
      'string.max': '닉네임은 50자 이하로 입력해주세요.',
      'any.required': '닉네임은 필수입니다.'
    }),
  
  roomSettings: Joi.object()
    .optional()
    .default({})
});

// 방 참여 요청 검증 스키마
export const joinRoomSchema = Joi.object({
  roomCode: Joi.string()
    .trim()
    .uppercase()
    .length(6)
    .pattern(/^[A-Z0-9]{6}$/)
    .optional()
    .messages({
      'string.empty': '방 코드를 입력해주세요.',
      'string.length': '방 코드는 6자리여야 합니다.',
      'string.pattern.base': '방 코드는 영문자와 숫자만 포함할 수 있습니다.'
    }),
  
  sessionId: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .messages({
      'string.empty': '세션 ID를 입력해주세요.',
      'string.max': '세션 ID가 너무 깁니다.'
    }),
  
  nickname: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': '닉네임을 입력해주세요.',
      'string.max': '닉네임은 50자 이하로 입력해주세요.',
      'any.required': '닉네임은 필수입니다.'
    })
});

// 방 나가기 요청 검증 스키마
export const leaveRoomSchema = Joi.object({
  guest_user_id: Joi.string()
    .guid({ version: 'uuidv4' })
    .required()
    .messages({
      'string.guid': '올바른 게스트 사용자 ID 형식이 아닙니다.',
      'any.required': '게스트 사용자 ID는 필수입니다.'
    })
});

// 준비 상태 업데이트 요청 검증 스키마
export const updatePreparationSchema = Joi.object({
  guest_user_id: Joi.string()
    .guid({ version: 'uuidv4' })
    .required()
    .messages({
      'string.guid': '올바른 게스트 사용자 ID 형식이 아닙니다.',
      'any.required': '게스트 사용자 ID는 필수입니다.'
    }),
  
  character_setup: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '캐릭터 설정 상태는 true 또는 false여야 합니다.'
    }),
  
  screen_setup: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': '화면 설정 상태는 true 또는 false여야 합니다.'
    })
}).min(2); // guest_user_id 외에 최소 하나의 설정값이 있어야 함

// 방 목록 조회 쿼리 검증 스키마
export const getRoomsQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': '페이지 번호는 1 이상이어야 합니다.',
      'number.integer': '페이지 번호는 정수여야 합니다.'
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': '페이지 크기는 1 이상이어야 합니다.',
      'number.max': '페이지 크기는 100 이하여야 합니다.',
      'number.integer': '페이지 크기는 정수여야 합니다.'
    })
});