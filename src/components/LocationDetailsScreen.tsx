import { X, Share } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface LocationDetailsProps {
  data: { image: string };
  onClose: () => void;
}

export default function LocationDetailsScreen({ data, onClose }: LocationDetailsProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      // Convert the current canvas state to a blob
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'lumina-sphere.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Lumina Sphere',
          text: 'Check out my Lumina photo sphere!',
          files: [file],
        });
      } else {
        // Fallback for desktop/unsupported browsers: download the image
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'lumina-sphere.png';
        link.click();
      }
    } catch (e) {
      console.error('Sharing failed:', e);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 z-50 flex items-center justify-center p-0 sm:p-12"
    >
      {/* Background click listener */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="bg-black sm:bg-white shadow-[0_0_80px_rgba(0,0,0,0.25)] flex flex-col w-full h-full sm:h-auto max-w-2xl relative sm:rounded-xl z-10 overflow-hidden"
      >
        <div className="absolute top-4 right-4 flex gap-3 z-20">
          <button 
            onClick={handleShare} 
            disabled={isSharing}
            className="p-2 bg-black/50 hover:bg-black/70 transition-colors shadow-sm border border-white/20 rounded-full flex items-center justify-center text-white disabled:opacity-50"
            title="Share Sphere Snapshot"
          >
            <Share className="w-5 h-5" />
          </button>
          <button 
            onClick={onClose} 
            className="p-2 bg-black/50 hover:bg-black/70 transition-colors shadow-sm border border-white/20 rounded-full flex items-center justify-center text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="w-full h-full sm:h-[80vh] bg-black sm:bg-gray-100 flex-shrink-0 relative overflow-hidden group flex items-center justify-center">
          <img 
            src={data.image} 
            alt="Selected Photo" 
            className="w-full h-full object-contain sm:object-cover transition-transform duration-[20s] ease-linear sm:hover:scale-105" 
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
