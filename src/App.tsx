import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import GalleryGlobe from './components/GalleryGlobe';
import IntroScreen from './components/IntroScreen';
import LocationDetailsScreen from './components/LocationDetailsScreen';
import { get, set } from 'idb-keyval';
import { Compass } from 'lucide-react';

export default function App() {
  // ANNIVERSARY OVERRIDE: Automatically load any photos placed in public/photos.
  // To revert to the upload screen later, comment out the import.meta.glob and change to `useState<string[]>([])`
  // @ts-ignore
  const allPhotos = import.meta.glob('/public/photos/*.{jpg,jpeg,png,JPG,JPEG,PNG}', { eager: true, query: '?url', import: 'default' });
  const rawPhotoUrls = Object.values(allPhotos) as string[];
  const photoUrls = rawPhotoUrls.map((url) => {
    if (typeof url === 'string') {
      // Remove '/public' prefix so `/public/photos/...` becomes `/photos/...` which is correctly served in production
      return url.startsWith('/public/') ? url.replace(/^\/public/, '') : url;
    }
    return '';
  }).filter(Boolean);
  
  const FALLBACK_PHOTOS = [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80',
  ];

  const [userPhotos, setUserPhotos] = useState<string[]>(
    photoUrls.length > 0 ? photoUrls : FALLBACK_PHOTOS
  );
  const [globeMode, setGlobeMode] = useState<'small' | 'repeat' | 'normal'>('repeat');
  const [selectedCard, setSelectedCard] = useState<{ image: string } | null>(null);
  const [isLoaded, setIsLoaded] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(true);

  useEffect(() => {
    // Cache loading is temporarily disabled for the anniversary override.
    // get('cachedPhotos').then((cached) => {
    //   if (cached && Array.isArray(cached) && cached.length > 0) {
    //     setUserPhotos(cached);
    //     setGlobeMode('normal');
    //   }
    //   setIsLoaded(true);
    // });
  }, []);

  const handleStart = (photos: string[], mode: 'small' | 'repeat' | 'normal') => {
    setUserPhotos(photos);
    setGlobeMode(mode);
    set('cachedPhotos', photos).catch(err => console.error('Failed to cache photos:', err));
  };

  const handleStartOver = () => {
    setUserPhotos([]);
    set('cachedPhotos', []).catch(err => console.error('Failed to clear cached photos:', err));
  };

  const toggleGyro = async () => {
    if (!gyroEnabled) {
      if (typeof (window as any).DeviceOrientationEvent !== 'undefined' && typeof (window as any).DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await (window as any).DeviceOrientationEvent.requestPermission();
          if (permission !== 'granted') {
            console.warn('Device orientation permission not granted');
            return;
          }
        } catch (err) {
          console.warn('Device orientation request failed', err);
        }
      }
    }
    setGyroEnabled(!gyroEnabled);
  };

  if (!isLoaded) return null;

  return (
    <div className="w-full h-full relative bg-white overflow-hidden">
      {userPhotos.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-50">
          <IntroScreen onStart={handleStart} />
        </div>
      ) : (
        <>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={
              { scale: selectedCard ? 0.8 : 1, opacity: selectedCard ? 0.3 : 1 }
            }
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute inset-0 ${selectedCard ? 'pointer-events-none' : ''}`}
          >
            <GalleryGlobe 
              userPhotos={userPhotos} 
              mode={globeMode}
              gyroEnabled={gyroEnabled}
              onSelect={(img) => setSelectedCard({ image: img })} 
            />
          </motion.div>

          <AnimatePresence>
            {selectedCard && (
              <LocationDetailsScreen 
                key="location-details"
                data={selectedCard} 
                onClose={() => setSelectedCard(null)} 
              />
            )}
          </AnimatePresence>

          {!selectedCard && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute bottom-8 left-0 right-0 flex justify-center z-30"
              >
                <button 
                  onClick={handleStartOver}
                  className="text-[10px] text-gray-400 hover:text-gray-900 tracking-widest uppercase transition-colors"
                >
                  START OVER
                </button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute top-6 right-6 z-30 flex flex-col items-end gap-2"
              >
                <button 
                  onClick={toggleGyro}
                  className={`p-3 rounded-full border transition-colors flex items-center justify-center shadow-sm ${gyroEnabled ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:text-gray-900'}`}
                  title={gyroEnabled ? "Disable Gyroscope" : "Enable Gyroscope"}
                >
                  <Compass className="w-5 h-5" />
                </button>
              </motion.div>
              <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
                <span className="text-xs text-gray-400 tracking-widest font-mono">By Vansh</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
