import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Upload, AlertCircle, SwitchCamera } from 'lucide-react';
import { compressImageFile, compressVideoFrame } from '../utils/imageCompression';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  captureLabel?: string;
  initialFacingMode?: 'user' | 'environment';
  disabled?: boolean;
  isBusy?: boolean;
  aspectClass?: string;
  showUploadButton?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  captureLabel = 'Capture Photo',
  initialFacingMode = 'user',
  disabled = false,
  isBusy = false,
  aspectClass = 'aspect-[4/3]',
  showUploadButton = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is unavailable in this browser context.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to access camera device.';
      setCameraError(`Camera access unavailable (${message}).`);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  const handleCaptureFrame = () => {
    if (!videoRef.current || !cameraReady || disabled || isBusy) return;
    const base64 = compressVideoFrame(videoRef.current, 800, 0.7);
    onCapture(base64);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 800, 0.7);
      onCapture(compressed);
    } catch (err: unknown) {
      setCameraError(err instanceof Error ? err.message : 'Failed to process image file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative w-full ${aspectClass} bg-slate-950 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${
            facingMode === 'user' ? 'scale-x-[-1]' : ''
          } ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
        />

        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm gap-2">
            <Camera className="w-6 h-6 text-slate-400" />
            <span>Activating live camera...</span>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-200">
            <AlertCircle className="w-7 h-7 text-amber-400 mb-2" />
            <p className="text-sm text-slate-300 max-w-sm leading-relaxed mb-4">
              {cameraError}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
              {showUploadButton && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo
                </button>
              )}
            </div>
          </div>
        )}

        {cameraReady && (
          <div className="pointer-events-none absolute inset-4 border border-white/25 rounded-md" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            Switch Camera ({facingMode === 'user' ? 'Front' : 'Rear'})
          </button>

          {showUploadButton && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleCaptureFrame}
          disabled={!cameraReady || disabled || isBusy}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Camera className="w-4 h-4" />
          {isBusy ? 'Scanning...' : captureLabel}
        </button>
      </div>

      {showUploadButton && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
};
