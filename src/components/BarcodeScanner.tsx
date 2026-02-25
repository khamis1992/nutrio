import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, Scan, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setIsScanning(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      setError("Camera access denied. Please allow camera permissions to scan barcodes.");
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  // Start/stop based on isOpen prop
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // Simulated barcode detection (in production, use a library like @zxing/library)
  // This is a placeholder implementation
  const simulateBarcodeDetection = useCallback(() => {
    // In production, this would use a real barcode detection library
    // For now, we'll just show the UI and simulate with manual entry
    
    // Example with jsQR or @zxing/library:
    // const code = jsQR(imageData.data, width, height);
    // if (code) {
    //   handleBarcodeDetected(code.data);
    // }
  }, []);

  const handleBarcodeDetected = useCallback((barcode: string) => {
    if (barcode !== lastScan) {
      setLastScan(barcode);
      toast.success(`Barcode detected: ${barcode}`);
      onScan(barcode);
      stopCamera();
      onClose();
    }
  }, [lastScan, onScan, stopCamera, onClose]);

  // Manual entry fallback
  const [manualBarcode, setManualBarcode] = useState("");

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Scan Barcode
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : hasPermission === false ? (
            <div className="text-center py-8">
              <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Camera access is required to scan barcodes.
              </p>
              <Button onClick={startCamera}>Try Again</Button>
            </div>
          ) : (
            <>
              {/* Camera View */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scan Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-2 border-primary/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 border-primary">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
                  </div>
                </div>

                {/* Scanning Indicator */}
                {isScanning && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 text-white px-3 py-1.5 rounded-full">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Scanning...</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Point your camera at a barcode to scan
              </p>
            </>
          )}

          {/* Manual Entry */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Or enter barcode manually:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Enter barcode number"
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
              <Button onClick={handleManualSubmit} size="sm">
                Search
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Supported formats:</p>
            <ul className="list-disc list-inside pl-2">
              <li>UPC (Product barcodes)</li>
              <li>EAN (International barcodes)</li>
              <li>QR Codes (Limited support)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for barcode scanning with nutrition lookup
export function useBarcodeScanning() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<{
    name: string;
    barcode: string;
    nutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  } | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    setIsScanning(true);
    
    try {
      // In production, this would call an API like Open Food Facts
      // const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      // const data = await response.json();
      
      // Mock response for demo
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setScannedProduct({
        name: "Scanned Product",
        barcode,
        nutrition: {
          calories: 250,
          protein: 15,
          carbs: 30,
          fat: 8,
        },
      });
      
      toast.success("Product found!");
    } catch (err) {
      toast.error("Product not found in database");
    } finally {
      setIsScanning(false);
    }
  };

  return {
    isScanning,
    scannedProduct,
    setScannedProduct,
    handleBarcodeScan,
  };
}
