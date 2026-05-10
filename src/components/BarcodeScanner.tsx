/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, Scan, Loader2, AlertCircle, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";
import { isNative } from "@/lib/capacitor";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useLanguage } from "@/contexts/LanguageContext";

interface BarcodeScannerProps {
  onScan: (product: ScannedProduct) => void;
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
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);
  
  const isScanningRef = useRef(false);
  const lastScanRef = useRef<string | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productData, setProductData] = useState<ScannedProduct | null>(null);
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);

  // Stop camera and cleanup
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraPreview(null);
    setIsScanning(false);
  }, []);

  // Start camera using Capacitor on native, browser API on web
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setProductData(null);
      isScanningRef.current = true;

      if (isNative) {
        // Use Capacitor Camera plugin
        try {
          const photo = await CapacitorCamera.getPhoto({
            source: CameraSource.Camera,
            resultType: CameraResultType.Uri,
            quality: 80,
            allowEditing: false,
          });

          if (photo?.path || photo?.webPath) {
            const imagePath = photo.webPath || photo.path;
            setCameraPreview(imagePath);
            setHasPermission(true);
            
            // Now decode the barcode from the captured image
            await decodeBarcodeFromImage(imagePath);
          }
        } catch (cameraErr: unknown) {
          if (cameraErr instanceof Error && (cameraErr.message?.includes('permission') || cameraErr.message?.includes('denied'))) {
            setHasPermission(false);
            setError("Camera permission denied. Please enable camera access in Settings.");
          } else {
            console.error("Camera error:", cameraErr);
            setError("Failed to access camera. Please try again.");
          }
        }
      } else {
        // Use browser API for web
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

          const codeReader = new BrowserMultiFormatReader();
          codeReaderRef.current = codeReader;

          const decodeLoop = async () => {
            if (!videoRef.current || !isScanningRef.current) return;
            
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

              const result = await codeReader.decodeOnceFromVideoElement(videoRef.current);
              if (result) {
                const barcode = result.getText();
                if (barcode !== lastScanRef.current) {
                  lastScanRef.current = barcode;
                  setLastScan(barcode);
                  toast.success(`Barcode detected: ${barcode}`);
                  await fetchProductData(barcode);
                }
              }
            } catch (err) {
              if (err instanceof NotFoundException) {
                // Continue scanning
              } else {
                console.error("Barcode detection error:", err);
              }
            }
            
            if (isScanningRef.current && videoRef.current?.srcObject) {
              rafRef.current = requestAnimationFrame(decodeLoop);
            }
          };

          setTimeout(() => {
            if (isScanningRef.current) {
              rafRef.current = requestAnimationFrame(decodeLoop);
            }
          }, 500);
        }
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      setError("Camera access denied. Please allow camera permissions.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decode barcode from captured image (for Capacitor)
  const decodeBarcodeFromImage = async (imagePath: string) => {
    setIsScanning(true);
    
    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      
      // Convert to data URL for decoding
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }

          // Try to decode
          const result = await codeReader.decodeFromCanvas(canvas);
          if (result) {
            const barcode = result.getText();
            if (barcode !== lastScanRef.current) {
              lastScanRef.current = barcode;
              setLastScan(barcode);
              toast.success(`Barcode detected: ${barcode}`);
              await fetchProductData(barcode);
            }
          } else {
            // No barcode found in image
            toast.error("No barcode found. Try again.");
            setIsScanning(false);
          }
        } catch (decodeErr) {
          if (decodeErr instanceof NotFoundException) {
            toast.error("No barcode found in image. Try again.");
          } else {
            console.error("Decode error:", decodeErr);
            toast.error("Could not read barcode. Try again.");
          }
          setIsScanning(false);
        }
      };

      img.onerror = () => {
        toast.error("Failed to load image");
        setIsScanning(false);
      };

      img.src = imagePath;
    } catch (err) {
      console.error("Decode barcode error:", err);
      toast.error("Failed to read barcode");
      setIsScanning(false);
    }
  };

  // Fetch product data from Open Food Facts API
  const fetchProductData = async (barcode: string) => {
    isScanningRef.current = false;
    setIsScanning(false);
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
        setTimeout(() => {
          isScanningRef.current = true;
          setIsScanning(true);
          startCamera();
        }, 1500);
      }
    } catch (err) {
      console.error("Failed to fetch product:", err);
      toast.error("Failed to lookup product");
      setTimeout(() => {
        isScanningRef.current = true;
        setIsScanning(true);
      }, 1500);
    } finally {
      setLoadingProduct(false);
    }
  };

  // Handle add product
  const handleAddProduct = () => {
    if (productData) {
      onScan(productData);
      stopCamera();
      onClose();
    }
  };

  // Handle scan another
  const handleScanAnother = () => {
    setLastScan(null);
    lastScanRef.current = null;
    setProductData(null);
    setCameraPreview(null);
    startCamera();
  };

  // Start/stop based on isOpen prop
  useEffect(() => {
    let mounted = true;
    
    const initCamera = async () => {
      if (isOpen && mounted) {
        await startCamera();
      }
    };
    
    initCamera();
    
    return () => {
      mounted = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Barcode className="h-5 w-5" />
            {t("scan_barcode") || "Scan Barcode"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
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
                {t("camera_required") || "Camera access is required to scan barcodes."}
              </p>
              <Button onClick={startCamera}>
                {t("try_again") || "Try Again"}
              </Button>
            </div>
          ) : loadingProduct ? (
            <div className="text-center py-8">
              <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground mb-2">
                {t("looking_up") || "Looking up product..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("querying_db") || "Querying Open Food Facts database"}
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
                  <p className="text-[10px] text-gray-500">{t("cal") || "cal"}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-orange-600">{productData.protein}g</p>
                  <p className="text-[10px] text-gray-500">{t("protein") || "protein"}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-yellow-600">{productData.carbs}g</p>
                  <p className="text-[10px] text-gray-500">{t("carbs") || "carbs"}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{productData.fat}g</p>
                  <p className="text-[10px] text-gray-500">{t("fat") || "fat"}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{productData.fiber}g</p>
                  <p className="text-[10px] text-gray-500">{t("fiber") || "fiber"}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleScanAnother}
                  className="flex-1"
                >
                  {t("scan_another") || "Scan Another"}
                </Button>
                <Button
                  onClick={handleAddProduct}
                  className="flex-1 gradient-primary text-white"
                >
                  {t("add_product") || "Add This Product"}
                </Button>
              </div>
            </div>
          ) : (
            // Camera view - scanning
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {cameraPreview ? (
                  // Capacitor camera preview
                  <img
                    src={cameraPreview}
                    alt="Camera preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  // Browser camera
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                )}
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
                    <span className="text-sm">{t("scanning") || "Scanning..."}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground text-center">
                {t("point_camera") || "Point your camera at a barcode to scan"}
              </p>

              {/* Re-scan button for Capacitor */}
              {cameraPreview && !isScanning && !loadingProduct && (
                <Button
                  onClick={handleScanAnother}
                  className="w-full"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {t("take_photo") || "Take Another Photo"}
                </Button>
              )}
            </>
          )}

          {/* Manual Entry */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">{t("or_enter_manually") || "Or enter barcode manually:"}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder={t("enter_barcode") || "Enter barcode number"}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
              <Button onClick={handleManualSubmit} size="sm">
                {t("search") || "Search"}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{t("supported_formats") || "Supported formats:"}</p>
            <ul className="list-disc list-inside pl-2">
              <li>UPC (Product barcodes)</li>
              <li>EAN (International barcodes)</li>
              <li>{t("data_source") || "Data source"}: Open Food Facts</li>
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