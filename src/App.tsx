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
  const photoUrls = Object.values(allPhotos) as string[];
  
  const [userPhotos, setUserPhotos] = useState<string[]>(
    photoUrls.length > 0 ? photoUrls : ['/photos/1.jpg', '/photos/2.jpg', '/photos/3.jpg']
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
