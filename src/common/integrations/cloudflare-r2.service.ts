import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadGatewayException, Injectable } from '@nestjs/common';

@Injectable()
export class CloudflareR2Service {
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: `https://${this.getRequiredEnvironment('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: this.getRequiredEnvironment('R2_ACCESS_KEY_ID'),
      secretAccessKey: this.getRequiredEnvironment('R2_SECRET_ACCESS_KEY'),
    },
  });

  async uploadObject(key: string, body: Buffer, contentType: string) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.getRequiredEnvironment('R2_BUCKET'),
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch {
      throw new BadGatewayException(
        'Foto profil gagal diunggah. Silakan coba lagi.',
      );
    }

    const publicUrl = this.getRequiredEnvironment('R2_PUBLIC_URL').replace(
      /\/$/,
      '',
    );
    return `${publicUrl}/${key}`;
  }

  async getObject(publicUrl: string) {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.getRequiredEnvironment('R2_BUCKET'),
          Key: this.getObjectKey(publicUrl),
        }),
      );

      if (!response.Body) {
        throw new Error('Object body tidak tersedia.');
      }

      return {
        body: Buffer.from(await response.Body.transformToByteArray()),
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } catch {
      throw new BadGatewayException('Foto profil gagal dimuat.');
    }
  }

  async deleteObject(publicUrl: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.getRequiredEnvironment('R2_BUCKET'),
          Key: this.getObjectKey(publicUrl),
        }),
      );
    } catch {
      throw new BadGatewayException(
        'Foto profil gagal dihapus. Silakan coba lagi.',
      );
    }
  }

  private getObjectKey(publicUrl: string) {
    const configuredPublicUrl = new URL(
      this.getRequiredEnvironment('R2_PUBLIC_URL'),
    );
    const objectUrl = new URL(publicUrl);

    if (configuredPublicUrl.origin !== objectUrl.origin) {
      throw new Error('URL object R2 tidak valid.');
    }

    const basePath = configuredPublicUrl.pathname.replace(/\/$/, '');
    const objectKey = objectUrl.pathname
      .slice(basePath.length)
      .replace(/^\//, '');

    if (!objectKey) {
      throw new Error('Object key R2 tidak valid.');
    }

    return decodeURIComponent(objectKey);
  }

  private getRequiredEnvironment(name: string) {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} wajib diisi.`);
    }

    return value;
  }
}
