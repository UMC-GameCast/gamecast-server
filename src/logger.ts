import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 로그 디렉토리 확인 및 생성
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log('로그 디렉토리 생성:', logDir);
}

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
  // 환경변수 LOG_LEVEL이 있으면 우선 사용
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  
  // 환경변수가 없으면 기본값 사용
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info'; // 프로덕션에서도 info 로그 표시
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
  winston.format.timestamp({ 
    format: () => {
      return new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\. /g, '-').replace(/\./g, '').replace(/ /g, ' ');
    }
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...extra } = info;
    let log = `${timestamp} ${level}: ${message}`;
    
    // 추가 정보가 있으면 JSON 형태로 출력
    if (Object.keys(extra).length > 0) {
      log += ` ${JSON.stringify(extra, null, 2)}`;
    }
    
    return log;
  }),
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
