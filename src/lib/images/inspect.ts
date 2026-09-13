/**
 * Server-side image inspection.
 *
 * Reads the real file header to confirm the bytes are a genuine, decodable image and to
 * extract true pixel dimensions. No external image library is required.
 */

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_DIMENSION_PX = 320;

export interface ImageMetadata {
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

export class ImageValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // Standalone markers without a payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    // Start-of-frame markers carry the dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function webpDimensions(buffer: Buffer): { width: number; height: number } | null {
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }
  return null;
}

/**
 * Validates an uploaded buffer and returns its real dimensions.
 * Throws ImageValidationError with a user-friendly message when the file is unusable.
 */
export function inspectImage(buffer: Buffer, declaredType?: string): ImageMetadata {
  if (!buffer || buffer.length === 0) {
    throw new ImageValidationError('EMPTY_FILE', 'The image file is empty.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      'FILE_TOO_LARGE',
      `The image is ${(buffer.length / 1024 / 1024).toFixed(1)} MB. The maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`
    );
  }

  const mimeType = detectMimeType(buffer);
  if (!mimeType) {
    throw new ImageValidationError(
      'UNSUPPORTED_FORMAT',
      'Unsupported file type. Please use a JPEG, PNG or WEBP image.'
    );
  }
  if (declaredType && declaredType !== 'application/octet-stream' && !ALLOWED_MIME_TYPES.includes(declaredType)) {
    throw new ImageValidationError(
      'UNSUPPORTED_FORMAT',
      'Unsupported file type. Please use a JPEG, PNG or WEBP image.'
    );
  }

  const dimensions =
    mimeType === 'image/png'
      ? pngDimensions(buffer)
      : mimeType === 'image/jpeg'
        ? jpegDimensions(buffer)
        : webpDimensions(buffer);

  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new ImageValidationError(
      'UNREADABLE_IMAGE',
      'This image could not be read. It may be corrupted — please capture it again.'
    );
  }

  if (mimeType === 'image/jpeg' && buffer.subarray(buffer.length - 2).toString('hex') !== 'ffd9') {
    throw new ImageValidationError(
      'TRUNCATED_IMAGE',
      'This image appears to be incomplete. Please capture or upload it again.'
    );
  }
  if (mimeType === 'image/png' && !buffer.subarray(buffer.length - 8).includes(Buffer.from('IEND'))) {
    throw new ImageValidationError(
      'TRUNCATED_IMAGE',
      'This image appears to be incomplete. Please capture or upload it again.'
    );
  }

  if (Math.min(dimensions.width, dimensions.height) < MIN_DIMENSION_PX) {
    throw new ImageValidationError(
      'LOW_RESOLUTION',
      `Image resolution is too low (${dimensions.width}×${dimensions.height}). The minimum is ${MIN_DIMENSION_PX}px on the shortest side.`
    );
  }

  return { mimeType, width: dimensions.width, height: dimensions.height, size: buffer.length };
}

export function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}
