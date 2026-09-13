'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CameraCapture, type CapturedImage } from '@/components/camera/camera-capture';
import { loadImage, measureImageQuality } from '@/lib/client/image-quality';
import { errorMessage } from '@/lib/client/api';
import type { ImageSide, ProductImage } from '@/types';

export const IMAGE_SIDES: { value: ImageSide; label: string }[] = [
  { value: 'FRONT', label: 'Front' },
  { value: 'BACK', label: 'Back' },
  { value: 'SIDE', label: 'Side' },
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'ADDITIONAL', label: 'Additional evidence' },
];

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

type DraftImage = Omit<ProductImage, 'inspectionId'> & { previewUrl?: string };

interface ImageManagerProps {
  images: DraftImage[];
  onChange: (images: DraftImage[]) => void;
  maxImages?: number;
}

/**
 * Camera and upload produce exactly the same image object.
 * Both paths go through POST /api/images, which validates and stores the file and returns
 * the normalized record the rest of the pipeline (and any future AI model) consumes.
 */
export function ImageManager({ images, onChange, maxImages = 10 }: ImageManagerProps) {
  const [side, setSide] = useState<ImageSide>('FRONT');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const full = images.length >= maxImages;

  /**
   * Validates, stores and returns the normalized record. It deliberately does NOT
   * update the list: the caller owns that, so a batch can be committed in one update.
   */
  async function uploadBlob(
    blob: Blob,
    source: 'CAMERA' | 'UPLOAD',
    name: string,
    quality?: { brightness?: number; blurScore?: number }
  ): Promise<DraftImage | null> {
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', blob, name);
      form.append('side', side);
      form.append('source', source);
      if (quality) form.append('quality', JSON.stringify(quality));

      const res = await fetch('/api/images', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message || 'The image could not be uploaded.');
      }
      return body.data as DraftImage;
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'The image could not be uploaded.'));
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError('');

    const added: DraftImage[] = [];
    const rejected: string[] = [];
    let atCap = images.length >= maxImages;

    for (const file of Array.from(fileList)) {
      if (atCap) {
        rejected.push(`A maximum of ${maxImages} images can be attached.`);
        break;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        rejected.push(`"${file.name}" is not a JPEG, PNG or WEBP image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`"${file.name}" is larger than 10 MB.`);
        continue;
      }
      try {
        const image = await loadImage(file);
        const measured = measureImageQuality(image);
        const stored = await uploadBlob(file, 'UPLOAD', file.name, measured);
        if (stored) {
          added.push(stored);
          if (images.length + added.length >= maxImages) atCap = true;
        }
      } catch (loadError) {
        rejected.push(errorMessage(loadError, `"${file.name}" could not be read.`));
      }
    }

    // Commit the whole batch at once. Emitting per file would append to the same
    // stale snapshot on every iteration, so all but the last upload would be lost.
    if (added.length > 0) onChange([...images, ...added]);
    if (rejected.length > 0) setError(rejected.join(' '));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleCaptured(capture: CapturedImage) {
    if (full) {
      setError(`A maximum of ${maxImages} images can be attached.`);
      return;
    }
    void (async () => {
      const stored = await uploadBlob(
        capture.blob,
        'CAMERA',
        `capture-${new Date(capture.capturedAt).toISOString().replace(/[:.]/g, '-')}.jpg`,
        capture.quality
      );
      if (stored) onChange([...images, stored]);
    })();
  }

  function remove(id: string) {
    onChange(images.filter((image) => image.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function changeSide(id: string, nextSide: ImageSide) {
    onChange(images.map((image) => (image.id === id ? { ...image, side: nextSide } : image)));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="image-side" className="text-sm font-medium">
            What is this image of?
          </label>
          <select
            id="image-side"
            value={side}
            onChange={(event) => setSide(event.target.value as ImageSide)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {IMAGE_SIDES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setCameraOpen(true)} disabled={full} className="rounded-full">
            <Camera className="h-4 w-4" /> Capture from Camera
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={full || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload Images
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        JPEG, PNG or WEBP · up to 10 MB each · at least 320 px on the shortest side · {images.length} of {maxImages}{' '}
        added
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {cameraOpen && (
        <CameraCapture
          onUsePhoto={handleCaptured}
          onClose={() => setCameraOpen(false)}
          onUploadInstead={() => {
            setCameraOpen(false);
            fileInputRef.current?.click();
          }}
        />
      )}

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">No images yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture the front and back of the package. Add more sides if the declarations are spread out.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-xl border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={`${image.side} view`} className="h-36 w-full object-cover" />
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={image.side}
                    onChange={(event) => changeSide(image.id, event.target.value as ImageSide)}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    aria-label="Image position"
                  >
                    {IMAGE_SIDES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {image.source === 'CAMERA' ? 'Camera' : 'Upload'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {image.width && image.height ? `${image.width}×${image.height}` : '—'} ·{' '}
                    {Math.round((image.size || 0) / 1024)} KB
                  </span>
                  {typeof image.quality?.blurScore === 'number' && (
                    <span>{image.quality.blurScore > 0.55 ? 'Possibly blurry' : 'Sharp'}</span>
                  )}
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                      aria-label="Move earlier"
                    >
                      <RotateCw className="h-3.5 w-3.5 -scale-x-100" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === images.length - 1}
                      className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                      aria-label="Move later"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(image.id)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { DraftImage };
