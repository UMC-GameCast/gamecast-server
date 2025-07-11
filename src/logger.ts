import * as winston from 'winston';
import * as path from 'path';

// 로그 레벨 정의
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 환경에 따른 로그 레벨 설정
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// 로그 색상 정의
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// 로그 포맷 정의
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// 로그 저장 위치 설정
const transports = [
  // 콘솔 출력
  new winston.transports.Console(),
  // 에러 로그 파일
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
  }),
  // 모든 로그 파일
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'all.log'),
  }),
];

// Winston 로거 생성
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Morgan과 함께 사용하기 위한 스트림
export const stream = {
  write: (message: string) => {
    logger.http(message.substring(0, message.lastIndexOf('\n')));
  },
};

export default logger;
