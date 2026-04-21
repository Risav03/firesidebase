import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import config from '../config';
import crypto from 'crypto';

export class S3UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
    this.bucketName = config.s3BucketName;
  }

  async uploadFile(file: File, folder: string = 'advertisements'): Promise<string> {
    try {
      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `${folder}/${crypto.randomUUID()}.${fileExtension}`;

      // Convert file to buffer - handle both browser File and Node.js file-like objects
      let buffer: Buffer;
      
      if (file.arrayBuffer) {
        // Browser File API
        const arrayBuffer = await file.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (file.stream) {
        // Node.js file-like object with stream
        const chunks: Uint8Array[] = [];
        const reader = file.stream().getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        buffer = Buffer.alloc(totalLength);
        let position = 0;
        
        for (const chunk of chunks) {
          buffer.set(chunk, position);
          position += chunk.length;
        }
      } else {
        // Fallback: treat as buffer-like object
        buffer = Buffer.from(file as any);
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: file.type || 'image/jpeg',
      });

      console.log(`Uploading file to S3: ${fileName}, size: ${buffer.length} bytes`);
      await this.s3Client.send(command);

      // Return the public URL
      const url = `https://${this.bucketName}.s3.${config.awsRegion}.amazonaws.com/${fileName}`;
      console.log(`File uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload an audio file for a user under `intro-outro/<userId>/<kind>-<uuid>.<ext>`.
   * Returns the public URL of the uploaded object.
   */
  async uploadUserAudio(file: File, userId: string, kind: 'intro' | 'outro'): Promise<string> {
    try {
      const fileExtension = (file.name?.split('.').pop() || 'mp3').toLowerCase();
      const key = `intro-outro/${userId}/${kind}-${crypto.randomUUID()}.${fileExtension}`;

      let buffer: Buffer;
      if (file.arrayBuffer) {
        const arrayBuffer = await file.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (file.stream) {
        const chunks: Uint8Array[] = [];
        const reader = file.stream().getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        buffer = Buffer.alloc(totalLength);
        let position = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, position);
          position += chunk.length;
        }
      } else {
        buffer = Buffer.from(file as any);
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'audio/mpeg',
      });

      console.log(`Uploading user audio to S3: ${key}, size: ${buffer.length} bytes`);
      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${config.awsRegion}.amazonaws.com/${key}`;
      console.log(`User audio uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      console.error('S3 user audio upload error:', error);
      throw new Error(`Failed to upload user audio to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Best-effort delete of an object by its public URL.
   * Silently returns false on any error (logs internally).
   */
  async deleteObjectByUrl(url: string): Promise<boolean> {
    try {
      if (!url) return false;
      const prefix = `https://${this.bucketName}.s3.${config.awsRegion}.amazonaws.com/`;
      if (!url.startsWith(prefix)) {
        console.warn('deleteObjectByUrl: URL does not match configured bucket, skipping', { url });
        return false;
      }
      const key = url.slice(prefix.length);
      if (!key) return false;

      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      console.log(`Deleted S3 object: ${key}`);
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      return false;
    }
  }

  async uploadBuffer(buffer: Buffer, fileName: string, contentType: string, folder: string = 'advertisements'): Promise<string> {
    try {
      const fileExtension = fileName.split('.').pop() || 'jpg';
      const uniqueFileName = `${folder}/${crypto.randomUUID()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueFileName,
        Body: buffer,
        ContentType: contentType,
      });

      console.log(`Uploading buffer to S3: ${uniqueFileName}, size: ${buffer.length} bytes`);
      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${config.awsRegion}.amazonaws.com/${uniqueFileName}`;
      console.log(`Buffer uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      console.error('S3 buffer upload error:', error);
      throw new Error(`Failed to upload buffer to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const s3UploadService = new S3UploadService();