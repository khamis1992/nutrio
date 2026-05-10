import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ScanLine, X, CheckCircle, Camera } from "lucide-react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { toast } from "sonner";

interface DriverQRScannerProps {
  onScan: (qrData: string) => void;
  onClose: () => void;
  isScanning: boolean;
  scanResult: { success: boolean; message: string } | null;
  deliveryJobId?: string;
}

export function DriverQRScanner({
  onScan,
  onClose,
  isScanning,
  scanResult,
}: DriverQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string | null>(null);
  const cameraTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [scanningActive, setScanningActive] = useState(false);

  const stopCamera = useCallback(() => {
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanningActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera API not available on this device.");
        setHasCamera(false);
        return;
      }

      // Set camera timeout - if no image within 30 seconds, show error
      cameraTimeoutRef.current = setTimeout(() => {
        if (scanningActive) {
          setCameraError("Camera is taking too long. Please try again or use manual entry.");
          stopCamera();
        }
      }, 30000);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize ZXing code reader
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      setScanningActive(true);

      // Decode loop
      const decodeLoop = async () => {
        if (!videoRef.current || !scanningActive || !codeReaderRef.current) return;

        try {
          const result = await codeReader.decodeOnceFromVideoElement(videoRef.current);
          if (result) {
            const text = result.getText();
            // Prevent duplicate scans
            if (text !== lastScanRef.current) {
              lastScanRef.current = text;
              toast.success(`QR Code detected!`);
              onScan(text);
              stopCamera();
              return;
            }
          }
        } catch (err) {
          if (!(err instanceof NotFoundException)) {
            console.error("QR detection error:", err);
          }
        }

        if (scanningActive && streamRef.current) {
          rafRef.current = requestAnimationFrame(decodeLoop);
        }
      };

      // Start decode loop after video is ready
      videoRef.current.onloadedmetadata = () => {
        if (cameraTimeoutRef.current) {
          clearTimeout(cameraTimeoutRef.current);
        }
        decodeLoop();
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error("Camera access error:", error);
      setHasCamera(false);
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in your device settings, then try again.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Could not access camera. Use manual code entry below.");
      }
    }
  }, [onScan, stopCamera, scanningActive]);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle manual code entry
  const handleManualSubmit = () => {
    if (manualCode.length === 6) {
      onScan(manualCode);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <ScanLine className="w-5 h-5" />
          Scan QR Code
        </h2>
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-white">
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!showManualEntry ? (
          <>
            {/* Camera View */}
            <div className="relative w-full max-w-sm aspect-square mb-6">
              {hasCamera ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Scan Overlay */}
                  <div className="absolute inset-0 border-2 border-white/30 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary" />
                  </div>
                  
                  {/* Scanning indicator */}
                  {scanningActive && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 text-white px-3 py-1.5 rounded-full">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Scanning...</span>
                    </div>
                  )}
                </>
              ) : (
                <Card className="w-full h-full flex items-center justify-center bg-muted">
                  <CardContent className="text-center p-4 space-y-3">
                    <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      {cameraError || "Camera not available"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowManualEntry(true)}
                    >
                      Enter Code Manually
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Instructions */}
            <p className="text-white/80 text-center mb-6">
              Point your camera at the QR code shown by the restaurant
            </p>

            {/* Result */}
            {scanResult && (
              <div
                className={`p-4 rounded-lg mb-4 w-full max-w-sm ${
                  scanResult.success ? "bg-green-500/20" : "bg-red-500/20"
                }`}
              >
                <div className="flex items-center gap-2 justify-center">
                  {scanResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                  <span className={scanResult.success ? "text-green-400" : "text-red-400"}>
                    {scanResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Manual Entry Option */}
            <Button
              variant="outline"
              className="w-full max-w-sm"
              onClick={() => setShowManualEntry(true)}
            >
              Enter Code Manually
            </Button>
          </>
        ) : (
          /* Manual Entry */
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-center">Enter 6-Digit Code</h3>
              <p className="text-sm text-muted-foreground text-center">
                Ask the restaurant for the verification code displayed on their screen
              </p>

              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-3xl font-bold tracking-widest p-4 border-2 rounded-lg focus:border-primary focus:outline-none"
                maxLength={6}
              />

              <Button
                className="w-full"
                onClick={handleManualSubmit}
                disabled={manualCode.length !== 6 || isScanning}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowManualEntry(false);
                  setManualCode("");
                }}
              >
                Back to Scanner
              </Button>

              {/* Result */}
              {scanResult && (
                <div
                  className={`p-3 rounded-lg text-center ${
                    scanResult.success ? "bg-green-500/10" : "bg-red-500/10"
                  }`}
                >
                  <span className={scanResult.success ? "text-green-600" : "text-red-600"}>
                    {scanResult.message}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
