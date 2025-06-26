import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, Result } from '@zxing/library';
import { Scan, Camera, Flashlight, FlashlightOff, Keyboard, Sparkles, Eye } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Quagga from 'quagga';
import jsQR from 'jsqr';

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void;
  onClose: () => void;
isActive: boolean;
  cameraFacing: 'front' | 'back';
  initialContinuousMode: boolean; // Renamed prop to avoid conflict with internal state
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeDetected,
  onClose,
isActive,
  cameraFacing,
  initialContinuousMode,
}) => {
  const [continuousMode, setContinuousMode] = useState(initialContinuousMode); // Internal state for continuous mode
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [codeReader] = useState(() => new BrowserMultiFormatReader());
  const [isScanning, setIsScanning] = useState(false);
  const [scanLine, setScanLine] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null); // New state for scan feedback
  const [enableImageEnhancement, setEnableImageEnhancement] = useState(false); // New state for image enhancement toggle, default to false
  const [enableClarityCheck, setEnableClarityCheck] = useState(false); // New state for clarity check toggle, default to true
  const [isLoadingCamera, setIsLoadingCamera] = useState(false); // New state for camera loading
  const [scanAreaSize, setScanAreaSize] = useState(() => {
    try {
      const savedSize = localStorage.getItem('barcodeScanAreaSize');
      return savedSize ? JSON.parse(savedSize) : { width: 280, height: 140 };
    } catch (error) {
      console.error("Failed to parse scan area size from localStorage", error);
      return { width: 280, height: 140 };
    }
  });
  const lastScanTime = useRef(0);
  const scanCooldown = 1000; // Cooldown period between successful scans
  const animationFrameRef = useRef<number>();
  const lastDetectedBarcode = useRef<string>('');
  const currentTrack = useRef<MediaStreamTrack | null>(null);
  const instructionTimeoutRef = useRef<NodeJS.Timeout>();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [barcodeEngine, setBarcodeEngine] = useState<'zxing' | 'quagga' | 'jsqr'>('zxing');

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onBarcodeDetected(manualBarcode);
      onClose();
    }
  };

  const resetLastBarcode = useCallback(() => {
    lastDetectedBarcode.current = '';
  }, []);

  const turnOffTorch = useCallback(async () => {
    if (!currentTrack.current || !torchSupported || !torchEnabled) return;

    try {
      await currentTrack.current.applyConstraints({
        advanced: [{ torch: false } as any]
      });
      setTorchEnabled(false);
    } catch (error) {
      console.error('Error turning off torch:', error);
    }
  }, [torchEnabled, torchSupported]);

  // Function to preprocess image (grayscale and contrast enhancement)
  const preprocessImage = useCallback((context: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Grayscale conversion (luminosity method)
      const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      data[i] = avg; // Red
      data[i + 1] = avg; // Green
      data[i + 2] = avg; // Blue

      // Simple contrast enhancement (adjust factor as needed)
      if (enableImageEnhancement) {
        const factor = 2.0; // Increased for more aggressive contrast
        data[i] = factor * (data[i] - 128) + 128;
        data[i + 1] = factor * (data[i + 1] - 128) + 128;
        data[i + 2] = factor * (data[i + 2] - 128) + 128;
      }
    }
    context.putImageData(imageData, 0, 0);
  }, []);

  // Function to estimate image clarity based on pixel variance
  const calculateImageClarity = useCallback((context: CanvasRenderingContext2D, width: number, height: number): number => {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += gray;
      sumSq += gray * gray;
      count++;
    }

    if (count === 0) return 0;

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    return variance; // Higher variance indicates higher clarity
  }, []);

  // Helper function to draw video frame to canvas and preprocess
  const drawAndPreprocessFrame = useCallback((
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    scanArea: { width: number; height: number }
  ) => {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Calculate crop region to be centered
    const cropX = (videoWidth - scanArea.width) / 2;
    const cropY = (videoHeight - scanArea.height) / 2;

    // Set canvas size to the scan area size
    canvas.width = scanArea.width;
    canvas.height = scanArea.height;

    // Draw the cropped video frame to canvas
    context.drawImage(
      video,
      cropX,
      cropY,
      scanArea.width,
      scanArea.height,
      0,
      0,
      scanArea.width,
      scanArea.height
    );

    // Preprocess the image
    preprocessImage(context, canvas.width, canvas.height);
  }, [preprocessImage]);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    drawAndPreprocessFrame(video, canvas, context, scanAreaSize);

    // Calculate image clarity
    if (enableClarityCheck) {
      const clarity = calculateImageClarity(context, canvas.width, canvas.height);
      const clarityThreshold = 1000; // Adjust as needed

      if (clarity < clarityThreshold) {
        setScanFeedback("Image blurry. Please adjust focus or distance.");
      } else {
        setScanFeedback(null);
      }
    } else {
      setScanFeedback(null); // Clear feedback if clarity check is disabled
    }

    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');

      if (barcodeEngine === 'zxing') {
        // ZXing decoding logic
        // Create promises for original and rotated image decoding
        const decodePromises = [
          codeReader.decodeFromImage(undefined, dataUrl),
          // Rotate image 90 degrees for another decode attempt
          new Promise<Result>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const rotatedCanvas = document.createElement('canvas');
              const rotatedContext = rotatedCanvas.getContext('2d');
              if (!rotatedContext) {
                return reject(new Error("Could not get rotated canvas context"));
              }
              rotatedCanvas.width = canvas.height;
              rotatedCanvas.height = canvas.width;
              rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
              rotatedContext.rotate(Math.PI / 2);
              rotatedContext.drawImage(img, -canvas.width / 2, -canvas.height / 2);
              
              // Preprocess the rotated image as well
              preprocessImage(rotatedContext, rotatedCanvas.width, rotatedCanvas.height);

              codeReader.decodeFromImage(undefined, rotatedCanvas.toDataURL('image/png'))
                .then(resolve)
                .catch(reject);
            };
            img.onerror = reject;
            img.src = dataUrl;
          })
        ];

        Promise.any(decodePromises)
          .then((result: Result) => {
            if (result) {
              const barcode = result.getText();
              const now = Date.now();

              if (barcode !== lastDetectedBarcode.current ||
                (!continuousMode || now - lastScanTime.current > scanCooldown)) {

                console.log('Barcode detected:', barcode);
                setScanLine(true);
                setShowInstructions(false);
                setScanFeedback(null); // Clear feedback on successful scan

                turnOffTorch();

                setTimeout(() => setScanLine(false), 500);

                onBarcodeDetected(barcode);
                lastScanTime.current = now;
                lastDetectedBarcode.current = barcode;

                if (!continuousMode) {
                  setIsScanning(false);
                  return;
                }
              }
            }
          })
          .catch((error) => {
            if (error instanceof AggregateError && error.errors.every((e: any) => e instanceof NotFoundException)) {
              // All decode attempts failed to find a barcode
              setScanFeedback("No barcode found. Try adjusting position or lighting.");
            } else if (!(error instanceof NotFoundException)) {
              console.error('Scanning error:', error);
              toast({
                title: "Scanning Error",
                description: `An error occurred during scanning: ${error.message}`,
                variant: "destructive",
              });
              setScanFeedback(`Scanning error: ${error.message}`);
            }
          });
      } else if (barcodeEngine === 'quagga') {
        // Use Quagga for 1D barcodes
        Quagga.decodeSingle({
          src: dataUrl,
          numOfWorkers: 0,
          inputStream: { size: scanAreaSize },
          decoder: { readers: ['ean_reader', 'code_128_reader', 'upc_reader', 'upc_e_reader'] },
          locate: true
        }, (result) => {
          if (result && result.codeResult) {
            const barcode = result.codeResult.code;
            const now = Date.now();

            if (barcode !== lastDetectedBarcode.current ||
              (!continuousMode || now - lastScanTime.current > scanCooldown)) {

              setScanLine(true);
              setShowInstructions(false);
              setScanFeedback(null); // Clear feedback on successful scan

              turnOffTorch();

              setTimeout(() => setScanLine(false), 500);

              onBarcodeDetected(barcode);
              lastScanTime.current = now;
              lastDetectedBarcode.current = barcode;

              if (!continuousMode) {
                setIsScanning(false);
                return;
              }
            }
          } else {
            setScanFeedback("No barcode found. Try adjusting position or lighting.");
          }
        });
      } else if (barcodeEngine === 'jsqr') {
        // Use jsQR for QR codes
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code && code.data) {
          const barcode = code.data;
          const now = Date.now();

          if (barcode !== lastDetectedBarcode.current ||
            (!continuousMode || now - lastScanTime.current > scanCooldown)) {

            setScanLine(true);
            setShowInstructions(false);
            setScanFeedback(null); // Clear feedback on successful scan

            turnOffTorch();

            setTimeout(() => setScanLine(false), 500);

            onBarcodeDetected(barcode);
            lastScanTime.current = now;
            lastDetectedBarcode.current = barcode;

            if (!continuousMode) {
              setIsScanning(false);
              return;
            }
          }
        } else {
          setScanFeedback("No QR code found. Try adjusting position or lighting.");
        }
      }
    } catch (error) {
      console.error('Canvas decode error:', error);
      toast({
        title: "Canvas Decode Error",
        description: `An error occurred during canvas decoding: ${error.message}`,
        variant: "destructive",
      });
      setScanFeedback(`Canvas error: ${error.message}`);
    }

    if (continuousMode && isScanning) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [isScanning, continuousMode, onBarcodeDetected, codeReader, scanCooldown, turnOffTorch, scanAreaSize, preprocessImage, calculateImageClarity, enableImageEnhancement, enableClarityCheck, barcodeEngine, drawAndPreprocessFrame]);

  const toggleTorch = useCallback(async () => {
    if (!currentTrack.current || !torchSupported) return;

    try {
      await currentTrack.current.applyConstraints({
        advanced: [{ torch: !torchEnabled } as any]
      });
      setTorchEnabled(!torchEnabled);
    } catch (error) {
      console.error('Error toggling torch:', error);
    }
  }, [torchEnabled, torchSupported]);

  const handleVideoTap = useCallback(async () => {
    if (!currentTrack.current) return;

    try {
      // Try to refocus
      await currentTrack.current.applyConstraints({
        focusMode: 'single-shot'
      } as any);
    } catch (error) {
      console.error('Error applying focus:', error);
    }
  }, []);

  const handleCornerDrag = useCallback((corner: string, deltaX: number, deltaY: number) => {
    setScanAreaSize(prev => {
      let newWidth = prev.width;
      let newHeight = prev.height;
      
      if (corner.includes('right')) {
        newWidth = Math.max(100, Math.min(400, prev.width + deltaX)); // Reduced min width to 100
      }
      if (corner.includes('left')) {
        newWidth = Math.max(100, Math.min(400, prev.width - deltaX)); // Reduced min width to 100
      }
      if (corner.includes('bottom')) {
        newHeight = Math.max(50, Math.min(200, prev.height + deltaY)); // Reduced min height to 50
      }
      if (corner.includes('top')) {
        newHeight = Math.max(50, Math.min(200, prev.height - deltaY)); // Reduced min height to 50
      }
      
      const newSize = { width: newWidth, height: newHeight };
      localStorage.setItem('barcodeScanAreaSize', JSON.stringify(newSize));
      return newSize;
    });
  }, []);

  useEffect(() => {
    if (isActive && videoRef.current) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isActive, cameraFacing]);

  useEffect(() => {
    if (isScanning && continuousMode) {
      resetLastBarcode();
      setShowInstructions(true); // Show instructions when scanning starts in continuous mode
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      
      // Auto-hide instructions after 3 seconds
      instructionTimeoutRef.current = setTimeout(() => {
        setShowInstructions(false);
      }, 3000);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (instructionTimeoutRef.current) {
        clearTimeout(instructionTimeoutRef.current);
      }
    };
  }, [isScanning, continuousMode, scanFrame, resetLastBarcode]);

  const startScanning = async () => {
    if (!videoRef.current || isScanning) return;

    try {
      setIsLoadingCamera(true); // Set loading state
      setIsScanning(true);
      resetLastBarcode();
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing === 'front' ? 'user' : { ideal: 'environment' },
          // Dynamically adjust resolution based on device capabilities
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 60 },
          focusMode: { ideal: 'continuous' },
          zoom: true
        } as any
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      
      // Get the video track to control torch and focus
      const videoTrack = stream.getVideoTracks()[0];
      currentTrack.current = videoTrack;
      
      // Check torch support
      const capabilities = videoTrack.getCapabilities();
      setTorchSupported('torch' in capabilities);
      
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play();
          if (continuousMode) {
            animationFrameRef.current = requestAnimationFrame(scanFrame);
          }
        }
      };

    } catch (error: any) {
      console.error('Error accessing camera:', error);
      let errorMessage = `Could not access camera: ${error.message}.`;
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please grant camera permissions in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please ensure a camera is connected and enabled.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is already in use or not accessible. Please close other applications using the camera.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints could not be satisfied. Your device might not support the requested resolution or frame rate.';
      }
      toast({
        title: "Camera Access Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsScanning(false);
    } finally {
      setIsLoadingCamera(false); // Clear loading state
    }
  };

  const stopScanning = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (instructionTimeoutRef.current) {
      clearTimeout(instructionTimeoutRef.current);
    }
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    currentTrack.current = null;
    setIsScanning(false);
    setTorchEnabled(false);
    resetLastBarcode();
  };

  const forceScan = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    setScanLine(true);
    setShowInstructions(false);
    setScanFeedback(null); // Clear feedback on force scan
    setTimeout(() => setScanLine(false), 500);

    drawAndPreprocessFrame(video, canvas, context, scanAreaSize);

    try {
      const dataUrl = canvas.toDataURL('image/png');
      codeReader.decodeFromImage(undefined, dataUrl)
        .then((result: Result) => {
          if (result) {
            console.log('Force scan result:', result.getText());
            onBarcodeDetected(result.getText());
            lastDetectedBarcode.current = result.getText();
            lastScanTime.current = Date.now();
            
            // Turn off torch after successful scan
            turnOffTorch();
          }
        })
        .catch((error) => {
          if (!(error instanceof NotFoundException)) {
            console.error('Force scan error:', error);
            toast({
              title: "Force Scan Error",
              description: `An error occurred during force scan: ${error.message}`,
              variant: "destructive",
            });
            setScanFeedback(`Force scan error: ${error.message}`);
          } else {
            setScanFeedback("No barcode found on force scan.");
          }
        });
    } catch (error) {
      console.error('Force scan canvas error:', error);
      toast({
        title: "Force Scan Canvas Error",
        description: `An error occurred during force scan canvas processing: ${error.message}`,
        variant: "destructive",
      });
      setScanFeedback(`Force scan canvas error: ${error.message}`);
    }
  }, [onBarcodeDetected, codeReader, turnOffTorch, scanAreaSize, drawAndPreprocessFrame, enableImageEnhancement]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative bg-black rounded-lg overflow-hidden shadow-lg w-full">
        <video
          ref={videoRef}
          className={`w-full h-64 object-cover cursor-pointer ${isLoadingCamera ? 'hidden' : ''}`}
          playsInline
          muted
          onClick={handleVideoTap}
        />
        {isLoadingCamera && (
          <div className="absolute inset-0 flex items-center justify-center text-white bg-black bg-opacity-75">
            Loading camera...
          </div>
        )}
        
        {/* Hidden canvas for processing */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Scanner Overlay */}
        {!isLoadingCamera && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative" style={{ width: scanAreaSize.width, height: scanAreaSize.height }}>
              {/* Scanner Frame */}
              <div className="w-full h-full border-2 border-white border-dashed rounded-lg"></div>
              
              {/* Animated Scan Line */}
              {scanLine && (
                <div className="absolute top-0 left-0 w-full h-1 bg-green-400 animate-pulse"></div>
              )}
              
              {/* Resizable Corner Indicators */}
              <ResizableCorner
                position="top-left"
                onDrag={(deltaX, deltaY) => handleCornerDrag('top-left', deltaX, deltaY)}
              />
              <ResizableCorner
                position="top-right"
                onDrag={(deltaX, deltaY) => handleCornerDrag('top-right', deltaX, deltaY)}
              />
              <ResizableCorner
                position="bottom-left"
                onDrag={(deltaX, deltaY) => handleCornerDrag('bottom-left', deltaX, deltaY)}
              />
              <ResizableCorner
                position="bottom-right"
                onDrag={(deltaX, deltaY) => handleCornerDrag('bottom-right', deltaX, deltaY)}
              />
            </div>
          </div>
        )}

        {/* Instructions Overlay - Auto-hide after 3 seconds */}
        {showInstructions && (
          <div className="absolute top-4 left-4 right-4 bg-black bg-opacity-80 rounded-lg p-2 text-white text-xs">
            <div className="space-y-1">
              <p>📷 Point camera steadily at barcode</p>
              <p>↔️ Move back if image is blurry</p>
              <p>👆 Tap screen to refocus</p>
              <p>📐 Drag green corners to resize scan area</p>
              {torchSupported && <p>💡 Use flashlight in low light</p>}
            </div>
          </div>
        )}

        {/* Scan Status */}
        {!isLoadingCamera && (
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white text-sm bg-black bg-opacity-50 rounded px-3 py-1 inline-block">
              <Scan className="inline w-4 h-4 mr-1" />
              {continuousMode ? 'Scanning continuously...' : 'Align barcode within the frame'}
            </p>
            {scanFeedback && (
              <p className="text-red-400 text-xs mt-1 bg-black bg-opacity-50 rounded px-2 py-1 inline-block">
                {scanFeedback}
              </p>
            )}
          </div>
        )}

        {/* Continuous Scan Toggle */}
        {!isLoadingCamera && (
          <div className="absolute top-4 left-4">
            <button
              onClick={() => setContinuousMode(prev => !prev)}
              className={`p-2 rounded-full transition-colors text-xs ${
                continuousMode
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
              title={continuousMode ? 'Disable Continuous Scan' : 'Enable Continuous Scan'}
            >
              {continuousMode ? 'Continuous ON' : 'Continuous OFF'}
            </button>
          </div>
        )}

        {/* Control Buttons */}
        {!isLoadingCamera && (
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            {/* Force Scan Button */}
            <button
              onClick={forceScan}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors"
              title="Force Scan"
            >
              <Camera className="w-5 h-5" />
            </button>

          {/* Torch Toggle */}
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full transition-colors ${
                torchEnabled
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
              title={torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
            >
              {torchEnabled ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
            </button>
          )}
          {/* Image Enhancement Toggle */}
          <button
            onClick={() => setEnableImageEnhancement(prev => !prev)}
            className={`p-2 rounded-full transition-colors ${
              enableImageEnhancement
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
            title={enableImageEnhancement ? 'Disable Image Enhancement' : 'Enable Image Enhancement'}
          >
            <Sparkles className="w-5 h-5" />
            </button>
            {/* Clarity Check Toggle */}
            <button
              onClick={() => setEnableClarityCheck(prev => !prev)}
              className={`p-2 rounded-full transition-colors ${
                enableClarityCheck
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
              title={enableClarityCheck ? 'Disable Clarity Check' : 'Enable Clarity Check'}
            >
              <Eye className="w-5 h-5" />
            </button>
            </div>
  
          )}
      </div>

      {/* Manual Entry Button and Input */}
      {!isLoadingCamera && (
        <div className="p-4 flex flex-col items-center space-y-2 mt-4 w-full">
          {showManualInput && (
            <div className="w-full flex flex-col space-y-2 bg-black bg-opacity-80 p-4 rounded-lg">
              <Input
                placeholder="Enter barcode manually"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSubmit();
                  }
                }}
                className="w-full bg-gray-700 text-white border-gray-600"
              />
              <Button onClick={handleManualSubmit} disabled={!manualBarcode.trim()} className="w-full">
                Submit Manual Barcode
              </Button>
              <Button onClick={() => setShowManualInput(false)} variant="ghost" className="w-full text-white">
                Cancel
              </Button>
            </div>
          )}
          <Button onClick={() => setShowManualInput(!showManualInput)} className="w-fit px-4 py-2 text-sm" variant="outline">
            <Keyboard className="w-4 h-4 mr-2" /> Manual Entry
          </Button>
        </div>
      )}

      {/* Barcode Engine Selection */}
      {!isLoadingCamera && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
          <select
            value={barcodeEngine}
            onChange={e => setBarcodeEngine(e.target.value as 'zxing' | 'quagga' | 'jsqr')}
            className="bg-gray-800 text-white rounded px-2 py-1 border border-gray-600 text-xs"
            title="Select Barcode Engine"
          >
            <option value="zxing">ZXing (Default, 1D/2D)</option>
            <option value="quagga">Quagga (1D only)</option>
            <option value="jsqr">jsQR (QR only)</option>
          </select>
        </div>
      )}
    </div>
  );
};

// Resizable Corner Component
interface ResizableCornerProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onDrag: (deltaX: number, deltaY: number) => void;
}

const ResizableCorner: React.FC<ResizableCornerProps> = ({ position, onDrag }) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    lastPos.current = { x: touch.clientX, y: touch.clientY };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      
      const deltaX = clientX - lastPos.current.x;
      const deltaY = clientY - lastPos.current.y;
      
      onDrag(deltaX, deltaY);
      lastPos.current = { x: clientX, y: clientY };
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onDrag]);

  const getPositionClasses = () => {
    const base = "absolute w-6 h-6 cursor-pointer touch-none";
    const corner = "border-4 border-green-400";
    
    switch (position) {
      case 'top-left':
        return `${base} -top-3 -left-3 ${corner} border-r-0 border-b-0`;
      case 'top-right':
        return `${base} -top-3 -right-3 ${corner} border-l-0 border-b-0`;
      case 'bottom-left':
        return `${base} -bottom-3 -left-3 ${corner} border-r-0 border-t-0`;
      case 'bottom-right':
        return `${base} -bottom-3 -right-3 ${corner} border-l-0 border-t-0`;
      default:
        return base;
    }
  };

  return (
    <div
      className={getPositionClasses()}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    />
  );
};

export default BarcodeScanner;