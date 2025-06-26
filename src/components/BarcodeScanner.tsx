import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const BarcodeScanner = ({ onScan, onClose }: BarcodeScannerProps) => {
  const [scannerReady, setScannerReady] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const qrcodeRegionId = "qr-reader";

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

  const startScanner = useCallback(async (cameraId: string) => {
    if (!html5QrCodeRef.current) return;

    try {
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
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
        startScanner(initialCameraId);
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
  }, [onClose, startScanner]);

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(camera => camera.id === currentCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      startScanner(nextCamera.id);
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
        <Button onClick={handleSwitchCamera} className="w-full">
          <CameraIcon className="w-4 h-4 mr-2" /> Switch Camera
        </Button>
      )}
      <p className="text-center text-sm text-gray-600">
        Position the barcode within the scanning area.
      </p>
    </div>
  );
};

export default BarcodeScanner;