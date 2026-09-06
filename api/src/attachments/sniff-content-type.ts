/** Guess a browser-displayable type from magic bytes when Storage sends octet-stream. */
export function sniffContentType(
  buffer: Buffer,
  fallback = 'application/octet-stream',
): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }
  return fallback.split(';')[0].trim() || 'application/octet-stream';
}
