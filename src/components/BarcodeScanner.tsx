import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon, Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const BarcodeScanner = ({ onScan, onClose }: BarcodeScannerProps) => {
  const [scannerReady, setScannerReady] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [qrboxWidth, setQrboxWidth] = useState(() => {
    const savedWidth = localStorage.getItem('barcodeScannerQrboxWidth');
    return savedWidth ? parseInt(savedWidth, 10) : 250;
  });
  const [qrboxHeight, setQrboxHeight] = useState(() => {
    const savedHeight = localStorage.getItem('barcodeScannerQrboxHeight');
    return savedHeight ? parseInt(savedHeight, 10) : 250;
  });
  const qrcodeRegionId = "qr-reader";

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onScan(manualBarcode);
      onClose();
    }
  };

  // Use useRef to hold the Html5Qrcode instance
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const qrCodeSuccessCallback = useCallback((decodedText: string, decodedResult: any) => {
    console.log(`Code matched = ${decodedText}`, decodedResult);
    onScan(decodedText);
    html5QrCodeRef.current?.stop().then(() => {
      onClose();
    }).catch((err) => {
      console.error("Failed to stop scanner:", err);
      onClose();
    });
  }, [onScan, onClose]);

  const startScanner = useCallback(async (cameraId: string, width: number, height: number) => {
    if (!html5QrCodeRef.current) return;

    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: width, height: height },
        },
        qrCodeSuccessCallback,
        (errorMessage: string) => {
          // console.warn(`Code scan error = ${errorMessage}`);
        }
      );
      setScannerReady(true);
      setCurrentCameraId(cameraId);
    } catch (err) {
      console.error("Failed to start camera:", err);
      toast({
        title: "Camera access failed",
        description: "Please ensure you have granted camera permissions.",
        variant: "destructive",
      });
      onClose();
    }
  }, [onClose, qrCodeSuccessCallback]);

  useEffect(() => {
    let isMounted = true;

    // Initialize Html5Qrcode here, where the DOM element is guaranteed to exist
    if (!html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode(
        qrcodeRegionId,
        {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.EAN_8,
          ],
          verbose: false, // Added verbose property
        }
      );
    }

    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length && isMounted) {
        setCameras(devices);
        const environmentCamera = devices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('environment'));
        const initialCameraId = environmentCamera ? environmentCamera.id : devices[0].id;
        startScanner(initialCameraId, qrboxWidth, qrboxHeight);
      } else if (isMounted) {
        toast({
          title: "No cameras found",
          description: "No camera devices detected on your system.",
          variant: "destructive",
        });
        onClose();
      }
    }).catch(err => {
      console.error("Error getting cameras:", err);
      if (isMounted) {
        toast({
          title: "Camera access error",
          description: "Could not access camera devices. Please check permissions.",
          variant: "destructive",
        });
        onClose();
      }
    });

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((err) => {
          console.error("Failed to stop scanner on unmount:", err);
        });
      }
    };
  }, [onClose, startScanner, qrboxWidth, qrboxHeight]);

  useEffect(() => {
    localStorage.setItem('barcodeScannerQrboxWidth', qrboxWidth.toString());
  }, [qrboxWidth]);

  useEffect(() => {
    localStorage.setItem('barcodeScannerQrboxHeight', qrboxHeight.toString());
  }, [qrboxHeight]);

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(camera => camera.id === currentCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      startScanner(nextCamera.id, qrboxWidth, qrboxHeight);
    } else {
      toast({
        title: "No other cameras",
        description: "Only one camera device found.",
        variant: "default",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div id={qrcodeRegionId} style={{ width: "100%" }}></div>
      {!scannerReady && (
        <div className="text-center text-gray-500">
          Attempting to access camera...
        </div>
      )}
      {scannerReady && cameras.length > 1 && (
        <Button onClick={handleSwitchCamera} className="w-full mb-2">
          <CameraIcon className="w-4 h-4 mr-2" /> Switch Camera
        </Button>
      )}
      {scannerReady && (
        <div className="flex flex-col space-y-2">
          <Button onClick={() => startScanner(currentCameraId!, qrboxWidth, qrboxHeight)} className="w-full">
            Force Scan
          </Button>
          <Button onClick={() => setShowManualInput(!showManualInput)} className="w-full" variant="outline">
            <Keyboard className="w-4 h-4 mr-2" /> Manual Entry
          </Button>
        </div>
      )}
      {showManualInput && (
        <div className="flex flex-col space-y-2">
          <Input
            placeholder="Enter barcode manually"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleManualSubmit();
              }
            }}
          />
          <Button onClick={handleManualSubmit} disabled={!manualBarcode.trim()}>
            Submit Manual Barcode
          </Button>
        </div>
      )}
      <p className="text-center text-sm text-gray-600">
        Position the barcode within the scanning area.
      </p>

      {scannerReady && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="width-slider" className="text-sm font-medium w-20">Width:</label>
            <Slider
              id="width-slider"
              min={50}
              max={Math.min(window.innerWidth * 0.8, 500)}
              step={10}
              value={[qrboxWidth]}
              onValueChange={(val) => setQrboxWidth(val[0])}
              className="flex-grow"
            />
            <span className="text-sm font-medium">{qrboxWidth}px</span>
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="height-slider" className="text-sm font-medium w-20">Height:</label>
            <Slider
              id="height-slider"
              min={50}
              max={Math.min(window.innerHeight * 0.8, 500)}
              step={10}
              value={[qrboxHeight]}
              onValueChange={(val) => setQrboxHeight(val[0])}
              className="flex-grow"
            />
            <span className="text-sm font-medium">{qrboxHeight}px</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;