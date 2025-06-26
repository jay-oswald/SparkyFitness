import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, Result } from '@zxing/library';
import { Scan, Camera, Flashlight, FlashlightOff, Keyboard } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void;
  onClose: () => void;
  isActive: boolean;
  cameraFacing: 'front' | 'back';
  continuousMode: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeDetected,
  onClose,
  isActive,
  cameraFacing,
  continuousMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [codeReader] = useState(() => new BrowserMultiFormatReader());
  const [isScanning, setIsScanning] = useState(false);
  const [scanLine, setScanLine] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [scanAreaSize, setScanAreaSize] = useState({ width: 280, height: 140 });
  const lastScanTime = useRef(0);
  const scanCooldown = 2000;
  const animationFrameRef = useRef<number>();
  const lastDetectedBarcode = useRef<string>('');
  const currentTrack = useRef<MediaStreamTrack | null>(null);
  const instructionTimeoutRef = useRef<NodeJS.Timeout>();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

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

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Convert canvas to data URL and decode
      const dataUrl = canvas.toDataURL('image/png');
      codeReader.decodeFromImage(undefined, dataUrl)
        .then((result: Result) => {
          if (result) {
            const barcode = result.getText();
            const now = Date.now();
            
            // Check if this is a new barcode or enough time has passed
            if (barcode !== lastDetectedBarcode.current || 
                (!continuousMode || now - lastScanTime.current > scanCooldown)) {
              
              console.log('Barcode detected:', barcode);
              setScanLine(true);
              setShowInstructions(false);
              
              // Turn off torch after successful scan
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
          // Only log non-NotFoundException errors
          if (!(error instanceof NotFoundException)) {
            console.error('Scanning error:', error);
          }
        });
    } catch (error) {
      console.error('Canvas decode error:', error);
    }

    if (continuousMode && isScanning) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  }, [isScanning, continuousMode, onBarcodeDetected, codeReader, scanCooldown, turnOffTorch]);

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
        newWidth = Math.max(200, Math.min(400, prev.width + deltaX));
      }
      if (corner.includes('left')) {
        newWidth = Math.max(200, Math.min(400, prev.width - deltaX));
      }
      if (corner.includes('bottom')) {
        newHeight = Math.max(100, Math.min(200, prev.height + deltaY));
      }
      if (corner.includes('top')) {
        newHeight = Math.max(100, Math.min(200, prev.height - deltaY));
      }
      
      return { width: newWidth, height: newHeight };
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
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      
      // Auto-hide instructions after 3 seconds
      setShowInstructions(true);
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
      setIsScanning(true);
      resetLastBarcode();
      setShowInstructions(true);
      
      const constraints = {
        video: {
          facingMode: cameraFacing === 'front' ? 'user' : { ideal: 'environment' },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
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

    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsScanning(false);
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

  const forceScan = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    setScanLine(true);
    setShowInstructions(false);
    setTimeout(() => setScanLine(false), 500);

    // Set canvas size and draw current frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

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
          }
        });
    } catch (error) {
      console.error('Force scan canvas error:', error);
    }
  };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden shadow-lg">
      <video
        ref={videoRef}
        className="w-full h-64 object-cover cursor-pointer"
        playsInline
        muted
        onClick={handleVideoTap}
      />
      
      {/* Hidden canvas for processing */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />
      
      {/* Scanner Overlay */}
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
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white text-sm bg-black bg-opacity-50 rounded px-3 py-1 inline-block">
          <Scan className="inline w-4 h-4 mr-1" />
          {continuousMode ? 'Scanning continuously...' : 'Align barcode within the frame'}
        </p>
      </div>

      {/* Control Buttons */}
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
      </div>

      {/* Manual Entry Button and Input */}
      <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col items-center space-y-2">
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
          </div>
        )}
        <Button onClick={() => setShowManualInput(!showManualInput)} className="w-full" variant="outline">
          <Keyboard className="w-4 h-4 mr-2" /> Manual Entry
        </Button>
      </div>
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