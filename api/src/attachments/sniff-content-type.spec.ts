import { sniffContentType } from './sniff-content-type';

describe('sniffContentType', () => {
  it('จับ JPEG', () => {
    expect(sniffContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
  });

  it('จับ PNG', () => {
    expect(
      sniffContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
  });

  it('จับ PDF', () => {
    expect(sniffContentType(Buffer.from('%PDF-1.4'))).toBe('application/pdf');
  });

  it('ถ้าไม่รู้จักใช้ fallback', () => {
    expect(sniffContentType(Buffer.from('hello'), 'application/octet-stream')).toBe(
      'application/octet-stream',
    );
  });
});
