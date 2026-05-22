import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FieldCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('FIELD_ENCRYPTION_KEY');
    if (!raw && config.get<string>('NODE_ENV') === 'production') {
      throw new InternalServerErrorException('FIELD_ENCRYPTION_KEY es obligatoria en produccion.');
    }
    this.key = createHash('sha256').update(raw ?? 'development-only-change-this-key').digest();
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
