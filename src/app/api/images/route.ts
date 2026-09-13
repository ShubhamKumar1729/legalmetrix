import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isResponse, badRequest } from '@/lib/auth/session';
import { inspectImage, ImageValidationError, ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES } from '@/lib/images/inspect';
import { storage } from '@/lib/storage/local-storage';
import type { ImageSide, ProductImage } from '@/types';

const SIDES: ImageSide[] = ['FRONT', 'BACK', 'SIDE', 'TOP', 'BOTTOM', 'ADDITIONAL'];

function clamp01(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(num)) return undefined;
  return Math.max(0, Math.min(1, num));
}

/**
 * Accepts one package image — identical handling whether it came from the device camera
 * or a file upload. The caller receives the same normalized image object either way, so
 * the analysis stage (and any future vision model) never needs to know the source.
 *
 * multipart/form-data fields: image (File), side, source, quality (JSON, optional)
 */
export async function POST(req: NextRequest) {
  const user = requirePermission('inspection:create');
  if (isResponse(user)) return user;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest('Expected a multipart/form-data upload.');
  }

  const file = form.get('image');
  if (!file || typeof file === 'string') {
    return badRequest('No image was provided.');
  }

  const sideRaw = String(form.get('side') || 'ADDITIONAL').toUpperCase();
  const side: ImageSide = (SIDES as string[]).includes(sideRaw) ? (sideRaw as ImageSide) : 'ADDITIONAL';
  const source: ProductImage['source'] = String(form.get('source') || '').toUpperCase() === 'CAMERA' ? 'CAMERA' : 'UPLOAD';

  let clientQuality: Record<string, unknown> = {};
  const qualityRaw = form.get('quality');
  if (typeof qualityRaw === 'string' && qualityRaw) {
    try {
      clientQuality = JSON.parse(qualityRaw);
    } catch {
      clientQuality = {};
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = inspectImage(buffer, file.type);
    const stored = await storage.save(buffer, metadata.mimeType);

    const brightness = clamp01(clientQuality.brightness);
    const blurScore = clamp01(clientQuality.blurScore);
    const resolution = Math.min(metadata.width, metadata.height);
    const readability =
      brightness === undefined || blurScore === undefined
        ? undefined
        : Math.round(Math.max(0, Math.min(1, (1 - blurScore) * 0.6 + brightness * 0.4)) * 100) / 100;

    const image: ProductImage = {
      id: stored.id,
      // Attached to the inspection when it is created.
      inspectionId: '',
      side,
      url: stored.url,
      originalName: file.name || `capture.${metadata.mimeType.split('/')[1]}`,
      size: metadata.size,
      mimeType: metadata.mimeType,
      width: metadata.width,
      height: metadata.height,
      source,
      quality: { resolution, brightness, blurScore, readability },
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: image });
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: 422 }
      );
    }
    console.error('[images] upload failed:', error);
    return NextResponse.json(
      { success: false, error: { code: 'UPLOAD_FAILED', message: 'The image could not be stored. Please try again.' } },
      { status: 500 }
    );
  }
}

/** Upload constraints, so the UI can describe them accurately. */
export async function GET() {
  const user = requirePermission('inspection:create');
  if (isResponse(user)) return user;
  return NextResponse.json({
    success: true,
    data: {
      allowedFormats: ALLOWED_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      sides: SIDES,
    },
  });
}
