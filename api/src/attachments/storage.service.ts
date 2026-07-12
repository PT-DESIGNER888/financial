import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * อัปโหลดไฟล์ขึ้น Supabase Storage ผ่าน REST (ไม่พึ่ง SDK)
 * ต้องตั้ง env: SUPABASE_URL, SUPABASE_SERVICE_KEY, (SUPABASE_BUCKET ค่าเริ่มต้น 'attachments')
 * ถ้ายังไม่ตั้ง → โยน error ชัดเจน (dev ยังไม่ผูก Supabase จะอัปโหลดไม่ได้)
 */
@Injectable()
export class StorageService {
  constructor(private config: ConfigService) {}

  get configured(): boolean {
    return !!(
      this.config.get('SUPABASE_URL') &&
      this.config.get('SUPABASE_SERVICE_KEY')
    );
  }

  private get bucket(): string {
    return this.config.get<string>('SUPABASE_BUCKET') ?? 'attachments';
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

    const res = await fetch(
      `${base}/storage/v1/object/${this.bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`อัปโหลดไม่สำเร็จ (${res.status}): ${body}`);
    }
    return {
      path,
      url: `${base}/storage/v1/object/public/${this.bucket}/${path}`,
    };
  }

  async remove(path: string): Promise<void> {
    const base = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_KEY');
    if (!base || !key) return;
    await fetch(`${base}/storage/v1/object/${this.bucket}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
    });
  }
}
