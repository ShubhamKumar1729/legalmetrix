'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  Loader2,
  RotateCcw,
  SwitchCamera,
  Upload,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { measureImageQuality, type MeasuredQuality } from '@/lib/client/image-quality';

export interface CapturedImage {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  quality: Pick<MeasuredQuality, 'brightness' | 'blurScore'>;
  capturedAt: string;
}

type CameraState = 'starting' | 'live' | 'review' | 'denied' | 'unavailable' | 'busy' | 'error';

interface CameraCaptureProps {
  /** Called when the officer confirms a capture. */
  onUsePhoto: (image: CapturedImage) => void;
  /** Close the camera without capturing. */
  onClose: () => void;
  /** Offered when the camera cannot be used. */
  onUploadInstead: () => void;
}

const CAPTURE_QUALITY = 0.92;

export function CameraCapture({ onUsePhoto, onClose, onUploadInstead }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureUrlRef = useRef<string | null>(null);

  const [state, setState] = useState<CameraState>('starting');
  const [message, setMessage] = useState('');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [canSwitch, setCanSwitch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const releaseCapture = useCallback(() => {
    if (captureUrlRef.current) {
      URL.revokeObjectURL(captureUrlRef.current);
      captureUrlRef.current = null;
    }
    setCaptured(null);
  }, []);

  const start = useCallback(
    async (requestedFacing: 'environment' | 'user') => {
      setState('starting');
      setMessage('');

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        setMessage(
          typeof window !== 'undefined' && window.isSecureContext === false
            ? 'Camera access requires a secure (HTTPS) connection.'
            : 'This browser does not expose a camera API.'
        );
        return;
      }

      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
        { video: { facingMode: { ideal: requestedFacing } }, audio: false },
        { video: true, audio: false },
      ];

      let lastError: DOMException | Error | null = null;

      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;

          const track = stream.getVideoTracks()[0];
          const capabilities = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean };
          setTorchSupported(Boolean(capabilities.torch));
          if (!capabilities.torch) setTorchOn(false);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }

          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
          } catch {
            setCanSwitch(false);
          }

          setState('live');
          return;
        } catch (error) {
          lastError = error as DOMException;
          const name = (error as DOMException).name;
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            setState('denied');
            setMessage('Camera access was denied.');
            return;
          }
          if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setState('unavailable');
            setMessage('Camera is not available on this device.');
            return;
          }
          if (name === 'NotReadableError' || name === 'TrackStartError') {
            setState('busy');
            setMessage('The camera is already in use by another application.');
            return;
          }
          // OverconstrainedError and anything else: try the next, looser constraint set.
        }
      }

      setState('unavailable');
      setMessage(
        lastError?.message
          ? `The camera could not be started (${lastError.message}).`
          : 'Camera is not available on this device.'
      );
    },
    []
  );

  useEffect(() => {
    void start(facing);
    return () => {
      stopStream();
      releaseCapture();
    };
    // `facing` changes restart the stream deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Capture is not supported by this browser.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', CAPTURE_QUALITY)
      );
      if (!blob) throw new Error('The captured frame could not be encoded.');

      const previewUrl = URL.createObjectURL(blob);
      const probe = new Image();
      const probeLoaded = await new Promise<boolean>((resolve) => {
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = previewUrl;
      });
      const measured = probeLoaded
        ? measureImageQuality(probe)
        : { width: canvas.width, height: canvas.height, brightness: 0.5, blurScore: 0 };

      releaseCapture();
      captureUrlRef.current = previewUrl;
      setCaptured({
        blob,
        previewUrl,
        width: canvas.width,
        height: canvas.height,
        quality: { brightness: measured.brightness, blurScore: measured.blurScore },
        capturedAt: new Date().toISOString(),
      });
      setState('review');
    } catch (error) {
      setMessage((error as Error).message);
      setState('error');
    } finally {
      setCapturing(false);
    }
  };

  const retake = () => {
    releaseCapture();
    setState('live');
    setMessage('');
  };

  const usePhoto = () => {
    if (!captured) return;
    onUsePhoto(captured);
    releaseCapture();
    setState('live');
  };

  const failed = state === 'denied' || state === 'unavailable' || state === 'busy';

  return (
    <div className="overflow-hidden rounded-2xl border bg-black">
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${state === 'review' || failed ? 'hidden' : ''}`}
        />

        {captured && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={captured.previewUrl} alt="Captured package" className="h-full w-full object-contain" />
        )}

        {state === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Requesting camera access…</p>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              {state === 'denied' ? <CameraOff className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
            </div>
            <div>
              <p className="font-semibold">{message}</p>
              <p className="mt-1 text-sm text-white/70">
                {state === 'denied'
                  ? 'Allow camera access in your browser settings, or upload a photo instead.'
                  : 'You can still add package photos from your device.'}
              </p>
            </div>
            <Button variant="secondary" onClick={onUploadInstead} className="rounded-full">
              <Upload className="h-4 w-4" /> Upload Image Instead
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <AlertTriangle className="h-7 w-7" />
            <p className="text-sm">{message}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="rounded-full" onClick={() => void start(facing)}>
                Try again
              </Button>
              <Button variant="secondary" size="sm" className="rounded-full" onClick={onUploadInstead}>
                Upload instead
              </Button>
            </div>
          </div>
        )}

        {/* Framing guide */}
        {(state === 'live' || state === 'starting') && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative h-[70%] w-[80%] max-w-md">
              {[
                'left-0 top-0 border-l-2 border-t-2 rounded-tl-lg',
                'right-0 top-0 border-r-2 border-t-2 rounded-tr-lg',
                'left-0 bottom-0 border-l-2 border-b-2 rounded-bl-lg',
                'right-0 bottom-0 border-r-2 border-b-2 rounded-br-lg',
              ].map((position) => (
                <span key={position} className={`absolute h-8 w-8 border-white/80 ${position}`} />
              ))}
            </div>
            <p className="mt-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm">
              Position the package inside the frame.
            </p>
          </div>
        )}

        {state === 'review' && captured && (
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {captured.width} × {captured.height}
          </div>
        )}

        {/* Top controls */}
        {(state === 'live' || state === 'review') && (
          <div className="absolute right-3 top-3 flex gap-2">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
              >
                {torchOn ? <Zap className="h-4 w-4" /> : <ZapOff className="h-4 w-4" />}
              </button>
            )}
            {canSwitch && state === 'live' && (
              <button
                type="button"
                onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
                aria-label="Switch camera"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
              >
                <SwitchCamera className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopStream();
                releaseCapture();
                onClose();
              }}
              aria-label="Close camera"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-900 px-4 py-3">
        <div className="min-w-0 text-xs text-slate-300">
          {state === 'live' && <span>Fill the frame with the package label, then capture.</span>}
          {state === 'review' && <span>Check the capture is readable before using it.</span>}
          {state === 'starting' && <span>Starting camera…</span>}
          {failed && <span>Camera unavailable</span>}
        </div>

        {state === 'live' && (
          <div className="flex items-center gap-2">
            <Button
              onClick={capture}
              disabled={capturing}
              className="h-12 rounded-full bg-white px-6 text-slate-900 hover:bg-slate-200"
            >
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Capture
            </Button>
          </div>
        )}

        {state === 'review' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={retake} className="h-10 rounded-full border-white/20 bg-transparent text-white hover:bg-white/10">
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
            <Button onClick={usePhoto} className="h-10 rounded-full bg-emerald-500 hover:bg-emerald-600">
              <Check className="h-4 w-4" /> Use Photo
            </Button>
          </div>
        )}

        {failed && (
          <Button variant="outline" onClick={onUploadInstead} className="h-10 rounded-full border-white/20 bg-transparent text-white hover:bg-white/10">
            <Upload className="h-4 w-4" /> Upload Image
          </Button>
        )}
      </div>
    </div>
  );
}
