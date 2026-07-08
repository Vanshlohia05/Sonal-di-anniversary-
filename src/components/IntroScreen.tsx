import { Upload, ArrowRight, MinusCircle, Copy, Camera } from 'lucide-react';
import { useRef, useState } from 'react';

interface IntroScreenProps {
  onStart: (photoBase64s: string[], mode: 'small' | 'repeat' | 'normal') => void;
}

const processDataUrlTo3x4 = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetRatio = 3 / 4;
      const imgRatio = img.width / img.height;
      
      let drawWidth = img.width;
      let drawHeight = img.height;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > targetRatio) {
        drawWidth = img.height * targetRatio;
        offsetX = (img.width - drawWidth) / 2;
      } else {
        drawHeight = img.width / targetRatio;
        offsetY = (img.height - drawHeight) / 2;
      }

      canvas.width = 600;
      canvas.height = 800;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};

const processImageTo3x4 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(processDataUrlTo3x4(event.target?.result as string));
    };
    reader.readAsDataURL(file);
  });
};

export default function IntroScreen({ onStart }: IntroScreenProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [useCamera, setUseCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      setUseCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.error("Camera access denied", e);
      setUseCamera(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        processDataUrlTo3x4(dataUrl).then((cropped) => {
           setPreviewUrls(prev => [...prev, cropped]);
        });
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setUseCamera(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const processed = await Promise.all(files.map(processImageTo3x4));
      setPreviewUrls((prev) => [...prev, ...processed]);
    }
  };

  const handleStart = async (urls: string[], mode: 'small' | 'repeat' | 'normal') => {
    if (typeof (window as any).DeviceOrientationEvent !== 'undefined' && typeof (window as any).DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await (window as any).DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          console.log('Device orientation granted');
        }
      } catch (err) {
        console.warn('Device orientation permission not granted', err);
      }
    }
    onStart(urls, mode);
  };

  return (
    <div className="flex flex-col items-center w-full h-full max-w-2xl mx-auto p-6 font-sans text-center overflow-y-auto">
      <div className="flex-grow flex-shrink-0 flex flex-col items-center justify-center w-full py-4">
        <h1 className="text-[55px] font-bold font-display tracking-tight mb-2 text-gray-900 leading-none">anywhere</h1>
        <p className="text-sm text-gray-500 mb-8 lowercase tracking-wide">add your photos and visualize them in a globe</p>
        
        {!useCamera && (
          <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
            <button 
              onClick={startCamera}
              className="flex items-center justify-center gap-3 w-full py-4 px-6 border border-solid border-gray-900 text-gray-900 bg-white hover:bg-gray-50 transition-colors uppercase tracking-widest text-sm font-medium rounded-none"
            >
              <Camera className="w-5 h-5" />
              Open Camera
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 w-full py-4 px-6 border border-solid border-gray-900 text-gray-900 bg-white hover:bg-gray-50 transition-colors uppercase tracking-widest text-sm font-medium rounded-none"
            >
              <Upload className="w-5 h-5" />
              Upload photos
            </button>
            
            <input 
              type="file" 
              accept="image/*" 
              multiple
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
          </div>
        )}

        {useCamera && (
          <div className="flex flex-col items-center gap-4 w-full max-w-md mx-auto">
            <div className="relative w-full aspect-[3/4] max-h-[50vh] bg-gray-100 border border-gray-900 overflow-hidden rounded-none">
              <video ref={videoRef} className="object-cover w-full h-full" playsInline muted />
            </div>
            <button 
              onClick={takePhoto}
              className="flex items-center justify-center gap-3 w-full py-4 px-6 border border-solid border-gray-900 text-white bg-gray-900 hover:bg-black transition-colors uppercase tracking-widest text-sm font-medium rounded-none"
            >
              <Camera className="w-5 h-5" />
              Capture
            </button>
            <button 
              onClick={stopCamera}
              className="text-xs uppercase tracking-widest text-gray-500 hover:text-gray-900 mt-2"
            >
              Cancel
            </button>
          </div>
        )}

      {previewUrls.length > 0 && (
        <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in duration-500 mt-8">
          <div className="text-sm font-medium text-gray-600 uppercase tracking-widest">{previewUrls.length} Photos Selected</div>
          <div className="flex flex-wrap justify-center gap-2 max-w-xl max-h-[30vh] overflow-y-auto p-2">
             {previewUrls.map((url, i) => (
                <div key={i} className="w-16 h-20 border border-gray-900 overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                </div>
             ))}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xl justify-center mt-4">
            {previewUrls.length < 48 ? (
              <>
                <button 
                  onClick={() => handleStart(previewUrls, 'small')}
                  className="flex items-center justify-center gap-3 w-full py-4 px-6 border border-solid border-gray-900 text-white bg-gray-900 hover:bg-black transition-colors uppercase tracking-widest text-sm font-medium rounded-none"
                >
                  <MinusCircle className="w-4 h-4" />
                  Small Globe
                </button>
                <button 
                  onClick={() => handleStart(previewUrls, 'repeat')}
                  className="flex items-center justify-center gap-3 w-full py-4 px-6 border border-solid border-gray-900 text-white bg-gray-900 hover:bg-black transition-colors uppercase tracking-widest text-sm font-medium rounded-none"
                >
                  <Copy className="w-4 h-4" />
                  Full Globe (Repeat)
                </button>
              </>
            ) : (
              <button 
                onClick={() => handleStart(previewUrls, 'normal')}
                className="flex items-center justify-center gap-3 w-full py-4 px-6 border border-solid border-gray-900 text-white bg-gray-900 hover:bg-black transition-colors uppercase tracking-widest text-sm font-medium rounded-none"
              >
                Let's go
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          <button 
            onClick={() => setPreviewUrls([])}
            className="text-xs uppercase tracking-widest text-gray-500 hover:text-gray-900 mt-2"
          >
            Clear Photos
          </button>
        </div>
      )}

      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
