import { resolveSignedUrl } from './storage-url';

const root = 'https://xxxx.supabase.co';

describe('resolveSignedUrl', () => {
  it('ต่อ path แบบเอกสารทางการ /object/sign/...', () => {
    expect(
      resolveSignedUrl(root, '/object/sign/attachments/a.jpg?token=abc'),
    ).toBe(
      'https://xxxx.supabase.co/storage/v1/object/sign/attachments/a.jpg?token=abc',
    );
  });

  it('ถ้าได้ URL เต็มมาแล้วใช้ตามนั้น', () => {
    const full =
      'https://xxxx.supabase.co/storage/v1/object/sign/attachments/a.jpg?token=abc';
    expect(resolveSignedUrl(root, full)).toBe(full);
  });

  it('ไม่ซ้ำ /storage/v1 ถ้ามีมาแล้ว', () => {
    expect(
      resolveSignedUrl(root, '/storage/v1/object/sign/attachments/a.jpg?token=1'),
    ).toBe(
      'https://xxxx.supabase.co/storage/v1/object/sign/attachments/a.jpg?token=1',
    );
  });

  it('ตัด / ท้ายโดเมน', () => {
    expect(resolveSignedUrl(`${root}/`, '/object/sign/x')).toBe(
      'https://xxxx.supabase.co/storage/v1/object/sign/x',
    );
  });
});
