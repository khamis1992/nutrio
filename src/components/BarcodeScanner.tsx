import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, Scan, Loader2, AlertCircle, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

interface OpenFoodFactsProduct {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: {
      "energy-kcal_100g"?: number;
      proteins_100g?: number;
      carbohydrates_100g?: number;
      fat_100g?: number;
      fiber_100g?: number;
    };
    image_url?: string;
    image_front_url?: string;
  };
}

export interface ScannedProduct {
  name: string;
  barcode: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  imageUrl?: string;
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productData, setProductData] = useState<ScannedProduct | null>(null);

  // Stop camera and cleanup
  const stopCamera = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Start camera and barcode detection
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setProductData(null);
      
      // Check camera permission first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
        setIsScanning(true);

        // Initialize barcode reader
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        // Start continuous detection
        const decodeLoop = async () => {
          if (!videoRef.current || !isScanning) return;
          
          try {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            
            if (canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              }
            }

            // Try to decode from video
            const result = await codeReader.decodeOnceFromVideoElement(videoRef.current);
            if (result) {
              const barcode = result.getText();
              if (barcode !== lastScan) {
                setLastScan(barcode);
                toast.success(`Barcode detected: ${barcode}`);
                
                // Fetch product data from Open Food Facts
                await fetchProductData(barcode);
              }
            }
          } catch (err) {
            // NotFoundException is normal when no barcode in frame
            if (err instanceof NotFoundException) {
              // Continue scanning
            } else {
              console.error("Barcode detection error:", err);
            }
          }
          
          // Continue loop if still scanning
          if (isScanning && videoRef.current?.srcObject) {
            requestAnimationFrame(decodeLoop);
          }
        };

        // Start decode loop after a short delay to let video initialize
        setTimeout(() => {
          if (isScanning) {
            requestAnimationFrame(decodeLoop);
          }
        }, 500);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      setError("Camera access denied. Please allow camera permissions to scan barcodes.");
    }
  }, [isScanning, lastScan]);

  // Fetch product data from Open Food Facts API
  const fetchProductData = async (barcode: string) => {
    setIsScanning(false); // Stop scanning while loading
    setLoadingProduct(true);
    
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      const data: OpenFoodFactsProduct = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        const nutriments = product.nutriments || {};

        const scannedProduct: ScannedProduct = {
          name: product.product_name_en || product.product_name || "Unknown Product",
          barcode: barcode,
          brand: product.brands,
          calories: Math.round(nutriments["energy-kcal_100g"] || 0),
          protein: Math.round(nutriments.proteins_100g || 0),
          carbs: Math.round(nutriments.carbohydrates_100g || 0),
          fat: Math.round(nutriments.fat_100g || 0),
          fiber: Math.round(nutriments.fiber_100g || 0),
          imageUrl: product.image_front_url || product.image_url,
        };

        setProductData(scannedProduct);
        toast.success(`Found: ${scannedProduct.name}`);
      } else {
        toast.error("Product not found in database");
        // Keep camera open for another try
        setTimeout(() => setIsScanning(true), 1500);
      }
    } catch (err) {
      console.error("Failed to fetch product:", err);
      toast.error("Failed to lookup product");
      setTimeout(() => setIsScanning(true), 1500);
    } finally {
      setLoadingProduct(false);
    }
  };

  // Handle confirm/add product
  const handleAddProduct = () => {
    if (productData) {
      onScan(productData.barcode);
      stopCamera();
      onClose();
    }
  };

  // Handle scan another
  const handleScanAnother = () => {
    setLastScan(null);
    setProductData(null);
    startCamera();
  };

  // Start/stop based on isOpen prop
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // Manual entry fallback
  const [manualBarcode, setManualBarcode] = useState("");

  const handleManualSubmit = async () => {
    if (manualBarcode.trim()) {
      setLoadingProduct(true);
      await fetchProductData(manualBarcode.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
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
          ) : loadingProduct ? (
            <div className="text-center py-8">
              <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground mb-2">
                Looking up product...
              </p>
              <p className="text-sm text-muted-foreground">
                Querying Open Food Facts database
              </p>
            </div>
          ) : productData ? (
            // Product found - show details
            <div className="space-y-4">
              {productData.imageUrl && (
                <div className="w-full h-32 rounded-xl overflow-hidden bg-gray-100">
                  <img 
                    src={productData.imageUrl} 
                    alt={productData.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              <div className="text-center">
                <p className="font-bold text-lg text-gray-900">{productData.name}</p>
                {productData.brand && (
                  <p className="text-sm text-gray-500">{productData.brand}</p>
                )}
              </div>

              <div className="grid grid-cols-5 gap-2 bg-gray-50 rounded-xl p-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{productData.calories}</p>
                  <p className="text-[10px] text-gray-500">cal</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-600">{productData.protein}g</p>
                  <p className="text-[10px] text-gray-500">protein</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-yellow-600">{productData.carbs}g</p>
                  <p className="text-[10px] text-gray-500">carbs</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{productData.fat}g</p>
                  <p className="text-[10px] text-gray-500">fat</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{productData.fiber}g</p>
                  <p className="text-[10px] text-gray-500">fiber</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleScanAnother}
                  className="flex-1"
                >
                  Scan Another
                </Button>
                <Button
                  onClick={handleAddProduct}
                  className="flex-1 gradient-primary text-white"
                >
                  Add This Product
                </Button>
              </div>
            </div>
          ) : (
            // Camera view - scanning
            <>
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
              <li>Data sources: Open Food Facts</li>
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
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      const data: OpenFoodFactsProduct = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        const nutriments = product.nutriments || {};

        const scanned: ScannedProduct = {
          name: product.product_name_en || product.product_name || "Unknown Product",
          barcode: barcode,
          brand: product.brands,
          calories: Math.round(nutriments["energy-kcal_100g"] || 0),
          protein: Math.round(nutriments.proteins_100g || 0),
          carbs: Math.round(nutriments.carbohydrates_100g || 0),
          fat: Math.round(nutriments.fat_100g || 0),
          fiber: Math.round(nutriments.fiber_100g || 0),
          imageUrl: product.image_front_url || product.image_url,
        };
        
        setScannedProduct(scanned);
        toast.success("Product found!");
      } else {
        setError("Product not found in database");
        toast.error("Product not found in database");
      }
    } catch (err) {
      setError("Failed to lookup product");
      toast.error("Failed to lookup product");
    } finally {
      setLoading(false);
    }
  };

  return {
    isScanning,
    scannedProduct,
    loading,
    error,
    handleBarcodeScan,
  };
}