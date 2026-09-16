import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveSignedUrl } from './storage-url';

/**
 * อัปโหลดไฟล์ขึ้น Supabase Storage ผ่าน REST (ไม่พึ่ง SDK)
 * ต้องตั้ง env: SUPABASE_URL, SUPABASE_SERVICE_KEY, (SUPABASE_BUCKET ค่าเริ่มต้น 'attachments')
 * ถ้ายังไม่ตั้ง → โยน error ชัดเจน (dev ยังไม่ผูก Supabase จะอัปโหลดไม่ได้)
 *
 * บัคเก็ตมักเป็น private (เหมาะกับบัตรประชาชน) — ห้ามให้หน้าเว็บโหลด
 * /object/public/... โดยตรง ให้ดึงผ่าน download() ด้วย service key
 */
@Injectable()
export class StorageService {
  constructor(private config: ConfigService) {}

  get configured(): boolean {
    return !!(
      this.config.get('SUPABASE_URL') && this.config.get('SUPABASE_SERVICE_KEY')
    );
  }

  private get bucket(): string {
    return this.config.get<string>('SUPABASE_BUCKET') ?? 'attachments';
  }

  private encodedPath(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  private objectUrl(path: string): string {
    const base = this.config.get<string>('SUPABASE_URL')!.replace(/\/$/, '');
    return `${base}/storage/v1/object/${this.bucket}/${this.encodedPath(path)}`;
  }

  /** Supabase บังคับทั้ง Authorization และ apikey — ขาดตัวใดตัวหนึ่งมัก 401 */
  private authHeaders(
    extra: Record<string, string> = {},
  ): Record<string, string> {
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY')!;
    return {
      Authorization: `Bearer ${key}`,
      apikey: key,
      ...extra,
    };
  }

  async upload(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ path: string; url: string }> {
    const base = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    if (!base || !key)
      throw new BadRequestException(
        'ยังไม่ได้ตั้งค่า Supabase Storage — ใส่ SUPABASE_URL และ SUPABASE_SERVICE_KEY ใน api/.env',
      );

    const res = await fetch(this.objectUrl(path), {
      method: 'POST',
      headers: this.authHeaders({
        'Content-Type': contentType,
        'x-upsert': 'true',
      }),
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(
        `อัปโหลดไม่สำเร็จ (${res.status}): ${body}`,
      );
    }
    return {
      path,
      url: this.publicUrl(path),
    };
  }

  /** ดึงไฟล์ด้วย service key — ใช้ได้ทั้งบัคเก็ต public และ private */
  async download(
    path: string,
    fallbackUrl?: string | null,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const base = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    if (!base || !key) {
      throw new BadRequestException(
        'ยังไม่ได้ตั้งค่า Supabase Storage — ใส่ SUPABASE_URL และ SUPABASE_SERVICE_KEY',
      );
    }

    const res = await fetch(this.objectUrl(path), {
      headers: this.authHeaders(),
    });
    if (res.ok) {
      return {
        buffer: Buffer.from(await res.arrayBuffer()),
        contentType:
          res.headers.get('content-type') || 'application/octet-stream',
      };
    }

    if (fallbackUrl) {
      const fallback = await fetch(fallbackUrl, {
        headers: this.authHeaders(),
      });
      if (fallback.ok) {
        return {
          buffer: Buffer.from(await fallback.arrayBuffer()),
          contentType:
            fallback.headers.get('content-type') || 'application/octet-stream',
        };
      }
    }

    throw new NotFoundException('ไม่พบไฟล์ในคลังรูป');
  }

  /** ลิงก์ชั่วคราว เปิดได้แม้บัคเก็ตเป็น private — ใช้โชว์รูปในหน้าเว็บ */
  async signedUrl(
    path: string,
    expiresIn = 60 * 60 * 12,
  ): Promise<string | null> {
    const base = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    if (!base || !key) return null;
    const root = base.replace(/\/$/, '');
    const res = await fetch(
      `${root}/storage/v1/object/sign/${this.bucket}/${this.encodedPath(path)}`,
      {
        method: 'POST',
        headers: this.authHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ expiresIn }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      signedURL?: string;
      signedUrl?: string;
    };
    const signed = data.signedURL ?? data.signedUrl;
    if (!signed) return null;
    return resolveSignedUrl(root, signed);
  }

  private publicUrl(path: string): string {
    const base = this.config.get<string>('SUPABASE_URL')!.replace(/\/$/, '');
    return `${base}/storage/v1/object/public/${this.bucket}/${this.encodedPath(path)}`;
  }

  async remove(path: string): Promise<void> {
    const base = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    if (!base || !key) return;
    await fetch(this.objectUrl(path), {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
  }
}
