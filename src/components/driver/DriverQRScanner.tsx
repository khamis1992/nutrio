import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ScanLine, X, CheckCircle, Camera } from "lucide-react";

interface DriverQRScannerProps {
  onScan: (qrData: string) => void;
  onClose: () => void;
  isScanning: boolean;
  scanResult: { success: boolean; message: string } | null;
}

export function DriverQRScanner({
  onScan,
  onClose,
  isScanning,
  scanResult,
}: DriverQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Camera API not available on this device.");
          setHasCamera(false);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setHasCamera(false);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setCameraError("Camera permission denied. Please allow camera access in your device settings, then try again.");
        } else if (err.name === "NotFoundError") {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError("Could not access camera. Use manual code entry below.");
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Simple QR detection using canvas
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || showManualEntry) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const scanFrame = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data for QR detection
        // In production, use a library like jsQR or zxing
        // For now, we'll rely on manual entry
      }

      requestAnimationFrame(scanFrame);
    };

    const animationId = requestAnimationFrame(scanFrame);

    return () => cancelAnimationFrame(animationId);
  }, [showManualEntry]);

  const handleManualSubmit = () => {
    if (manualCode.length === 6) {
      onScan(manualCode);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <ScanLine className="w-5 h-5" />
          Scan QR Code
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
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
