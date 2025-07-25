import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Prisma Client 인스턴스 생성
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 앱 종료 시 Prisma Client 연결 해제
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
