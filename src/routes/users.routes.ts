import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';

const router = Router();

/**
 * 사용자 목록 조회 (페이지네이션)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // #swagger.tags = ['User']
  // #swagger.summary = '사용자 목록 조회'
  // #swagger.description = '페이지네이션을 통해 사용자 목록을 조회합니다.'
  // #swagger.parameters['page'] = { in: 'query', description: '페이지 번호', schema: { type: 'integer', minimum: 1, default: 1 } }
  // #swagger.parameters['size'] = { in: 'query', description: '페이지 크기', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } }
  // #swagger.responses[200] = { 
  //   description: '사용자 목록 조회 성공',
  //   content: {
  //     "application/json": {
  //       schema: { $ref: '#/definitions/PaginatedResponse' },
  //       example: {
  //         resultType: "SUCCESS",
  //         error: null,
  //         success: {
  //           data: [
  //             { id: 1, email: "user1@example.com", name: "사용자1", createdAt: "2023-01-01T00:00:00.000Z" },
  //             { id: 2, email: "user2@example.com", name: "사용자2", createdAt: "2023-01-02T00:00:00.000Z" }
  //           ],
  //           pagination: {
  //             page: 1,
  //             size: 10,
  //             totalElements: 25,
  //             totalPages: 3,
  //             hasNext: true,
  //             hasPrevious: false
  //           }
  //         }
  //       }
  //     }
  //   }
  // }
  
  const page = parseInt(req.query.page as string) || 1;
  const size = parseInt(req.query.size as string) || 10;
  
  if (page < 1 || size < 1 || size > 100) {
    throw new BadRequestError('페이지 번호는 1 이상, 크기는 1-100 사이여야 합니다.');
  }
  
  // 임시 데이터 (실제로는 데이터베이스에서 조회)
  const mockUsers = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    email: `user${i + 1}@example.com`,
    name: `사용자${i + 1}`,
    createdAt: new Date(2023, 0, i + 1).toISOString()
  }));
  
  const startIndex = (page - 1) * size;
  const endIndex = startIndex + size;
  const users = mockUsers.slice(startIndex, endIndex);
  
  res.paginated(users, page, size, mockUsers.length);
}));

/**
 * 특정 사용자 조회
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  // #swagger.tags = ['User']
  // #swagger.summary = '사용자 상세 조회'
  // #swagger.description = 'ID를 통해 특정 사용자의 정보를 조회합니다.'
  // #swagger.parameters['id'] = { in: 'path', description: '사용자 ID', required: true, schema: { type: 'integer' } }
  // #swagger.responses[200] = { 
  //   description: '사용자 조회 성공',
  //   content: {
  //     "application/json": {
  //       schema: { $ref: '#/definitions/SuccessResponse' },
  //       example: {
  //         resultType: "SUCCESS",
  //         error: null,
  //         success: {
  //           id: 1,
  //           email: "user@example.com",
  //           name: "홍길동",
  //           createdAt: "2023-01-01T00:00:00.000Z",
  //           updatedAt: "2023-01-01T00:00:00.000Z"
  //         }
  //       }
  //     }
  //   }
  // }
  // #swagger.responses[404] = { 
  //   description: '사용자를 찾을 수 없음',
  //   content: {
  //     "application/json": {
  //       schema: { $ref: '#/definitions/FailResponse' },
  //       example: {
  //         resultType: "FAIL",
  //         error: {
  //           errorCode: "NOT_FOUND",
  //           reason: "사용자를 찾을 수 없습니다.",
  //           data: null
  //         },
  //         success: null
  //       }
  //     }
  //   }
  // }
  
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId) || userId < 1) {
    throw new BadRequestError('유효하지 않은 사용자 ID입니다.');
  }
  
  // 임시 데이터 (실제로는 데이터베이스에서 조회)
  if (userId > 25) {
    throw new NotFoundError('사용자를 찾을 수 없습니다.');
  }
  
  const user = {
    id: userId,
    email: `user${userId}@example.com`,
    name: `사용자${userId}`,
    createdAt: new Date(2023, 0, userId).toISOString(),
    updatedAt: new Date(2023, 0, userId).toISOString()
  };
  
  res.success(user);
}));

/**
 * 사용자 생성
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  // #swagger.tags = ['User']
  // #swagger.summary = '사용자 생성'
  // #swagger.description = '새로운 사용자를 생성합니다.'
  // #swagger.requestBody = {
  //   required: true,
  //   content: {
  //     "application/json": {
  //       schema: {
  //         type: "object",
  //         required: ["email", "name"],
  //         properties: {
  //           email: { type: "string", format: "email", example: "newuser@example.com" },
  //           name: { type: "string", example: "새로운 사용자" }
  //         }
  //       }
  //     }
  //   }
  // }
  // #swagger.responses[201] = { 
  //   description: '사용자 생성 성공',
  //   content: {
  //     "application/json": {
  //       schema: { $ref: '#/definitions/SuccessResponse' },
  //       example: {
  //         resultType: "SUCCESS",
  //         error: null,
  //         success: {
  //           id: 26,
  //           email: "newuser@example.com",
  //           name: "새로운 사용자",
  //           createdAt: "2023-12-01T00:00:00.000Z",
  //           updatedAt: "2023-12-01T00:00:00.000Z"
  //         }
  //       }
  //     }
  //   }
  // }
  
  const { email, name } = req.body;
  
  if (!email || !name) {
    throw new BadRequestError('이메일과 이름은 필수입니다.');
  }
  
  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new BadRequestError('유효하지 않은 이메일 형식입니다.');
  }
  
  // 임시 데이터 (실제로는 데이터베이스에 저장)
  const newUser = {
    id: 26, // 임시 ID
    email,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  res.status(201).success(newUser);
}));

export default router;
