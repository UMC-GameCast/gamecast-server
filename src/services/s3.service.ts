import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import logger from '../logger.js';

export interface S3UploadResult {
  key: string;
  bucket: string;
  location: string;
  etag: string;
}

export interface S3DownloadUrl {
  url: string;
  expiresIn: number;
}

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private bucketPrefix: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-northeast-2';
    
    // S3 버킷 이름과 접두사 분리
    const bucketConfig = process.env.AWS_S3_BUCKET || 'gamecast-videos';
    if (bucketConfig.includes('/')) {
      const [bucket, ...prefixParts] = bucketConfig.split('/');
      this.bucketName = bucket;
      this.bucketPrefix = prefixParts.join('/');
    } else {
      this.bucketName = bucketConfig;
      this.bucketPrefix = '';
    }
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    logger.info('S3 서비스 초기화 완료', {
      region: this.region,
      bucket: this.bucketName,
      prefix: this.bucketPrefix,
      accessKeyIdPresent: !!process.env.AWS_ACCESS_KEY_ID,
      secretAccessKeyPresent: !!process.env.AWS_SECRET_ACCESS_KEY,
      fullBucketConfig: process.env.AWS_S3_BUCKET
    });
  }

  /**
   * 로컬 파일을 S3에 업로드
   */
  public async uploadFile(localFilePath: string, s3Key: string, contentType: string = 'video/mp4'): Promise<S3UploadResult> {
    try {
      const fileBuffer = fs.readFileSync(localFilePath);
      
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString(),
          originalPath: localFilePath
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const response = await this.s3Client.send(command);

      const result: S3UploadResult = {
        key: s3Key,
        bucket: this.bucketName,
        location: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`,
        etag: response.ETag || ''
      };

      logger.info('S3 업로드 성공', {
        localPath: localFilePath,
        s3Key: s3Key,
        location: result.location
      });

      return result;

    } catch (error) {
      logger.error('S3 업로드 실패', {
        localPath: localFilePath,
        s3Key: s3Key,
        error: error
      });
      throw new Error(`S3 업로드 실패: ${error}`);
    }
  }

  /**
   * 버퍼를 S3에 직접 업로드
   */
  public async uploadBuffer(buffer: Buffer, s3Key: string, contentType: string = 'video/mp4'): Promise<S3UploadResult> {
    try {
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          uploadedAt: new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      const response = await this.s3Client.send(command);

      const result: S3UploadResult = {
        key: s3Key,
        bucket: this.bucketName,
        location: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`,
        etag: response.ETag || ''
      };

      logger.info('S3 버퍼 업로드 성공', {
        s3Key: s3Key,
        bufferSize: buffer.length,
        location: result.location
      });

      return result;

    } catch (error) {
      logger.error('S3 버퍼 업로드 실패', {
        s3Key: s3Key,
        bufferSize: buffer.length,
        contentType: contentType,
        bucket: this.bucketName,
        region: this.region,
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorCode: (error as any)?.code,
        errorStatusCode: (error as any)?.$metadata?.httpStatusCode,
        errorRequestId: (error as any)?.$metadata?.requestId,
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`S3 버퍼 업로드 실패: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * S3에서 파일 다운로드용 Signed URL 생성
   */
  public async getDownloadUrl(s3Key: string, expiresIn: number = 3600): Promise<S3DownloadUrl> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.info('S3 다운로드 URL 생성 성공', {
        s3Key: s3Key,
        expiresIn: expiresIn
      });

      return {
        url,
        expiresIn
      };

    } catch (error) {
      logger.error('S3 다운로드 URL 생성 실패', {
        s3Key: s3Key,
        error: error
      });
      throw new Error(`S3 다운로드 URL 생성 실패: ${error}`);
    }
  }

  /**
   * S3에서 파일 삭제
   */
  public async deleteFile(s3Key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(command);

      logger.info('S3 파일 삭제 성공', {
        s3Key: s3Key
      });

      return true;

    } catch (error) {
      logger.error('S3 파일 삭제 실패', {
        s3Key: s3Key,
        error: error
      });
      throw new Error(`S3 파일 삭제 실패: ${error}`);
    }
  }

  /**
   * S3 키 생성 헬퍼 함수
   */
  public generateS3Key(prefix: string, fileName: string, extension?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = uuidv4();
    
    // 버킷 접두사와 함께 키 생성
    const basePrefix = this.bucketPrefix ? `${this.bucketPrefix}/${prefix}` : prefix;
    
    if (extension) {
      return `${basePrefix}/${timestamp}/${uuid}.${extension}`;
    }
    
    return `${basePrefix}/${timestamp}/${uuid}_${fileName}`;
  }

  /**
   * 원본 영상용 S3 키 생성
   */
  public generateOriginalVideoKey(roomCode: string, userId: string, fileName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = uuidv4();
    
    // 버킷 접두사와 함께 키 생성
    const basePrefix = this.bucketPrefix ? `${this.bucketPrefix}/${roomCode}/raw/${userId}` : `${roomCode}/raw/${userId}`;
    
    return `${basePrefix}/video/${timestamp}_${uuid}_${fileName}`;
  }

  /**
   * 원본 오디오용 S3 키 생성
   */
  public generateOriginalAudioKey(roomCode: string, userId: string, fileName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = uuidv4();
    
    // 버킷 접두사와 함께 키 생성
    const basePrefix = this.bucketPrefix ? `${this.bucketPrefix}/${roomCode}/raw/${userId}` : `${roomCode}/raw/${userId}`;
    
    return `${basePrefix}/audio/${timestamp}_${uuid}_${fileName}`;
  }

  /**
   * 하이라이트 영상용 S3 키 생성
   */
  public generateHighlightVideoKey(roomCode: string, fileName: string): string {
    return this.generateS3Key(`highlight-videos/${roomCode}/raw`, fileName);
  }
}
