import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import Globe from './Globe';
import HandTracker from './HandTracker';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

function CameraController({ targetZ }: { targetZ: React.MutableRefObject<number> }) {
  useFrame((state) => {
    // Smooth camera Z penetration
    state.camera.position.z = THREE.MathUtils.lerp(
      state.camera.position.z, 
      targetZ.current, 
      0.05
    );
  });
  return null;
}

export default function GalleryGlobe({ userPhotos, mode, gyroEnabled = true, onSelect }: { userPhotos: string[], mode: 'small' | 'repeat' | 'normal', gyroEnabled?: boolean, onSelect: (image: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMobileDevice, setIsMobileDevice] = useState(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    return isMobileUA || window.innerWidth < 1024;
  });

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isSmallScreen = window.innerWidth < 1024 || window.innerHeight < 1024;
      const hasTouch = navigator.maxTouchPoints > 0;
      setIsMobileDevice(isMobileUA || (isSmallScreen && hasTouch));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  let totalCards = 48;
  let dynamicRadius = 6.0;

  if (mode === 'small') {
    totalCards = userPhotos.length;
    dynamicRadius = Math.max(2.0, Math.sqrt(totalCards / 48) * 6.0);
  } else if (mode === 'repeat') {
    totalCards = Math.max(48, userPhotos.length);
    dynamicRadius = Math.max(6.0, Math.sqrt(totalCards / 48) * 6.0);
  } else {
    totalCards = userPhotos.length;
    dynamicRadius = Math.max(2.0, Math.sqrt(totalCards / 48) * 6.0);
  }

  const defaultCameraZ = isMobileDevice ? dynamicRadius * 4.8 : dynamicRadius * 3.3;

  // Interaction State Maps
  const targetZ = useRef(defaultCameraZ);
  const rotationState = useRef({ x: 0, y: 0 });
  const velocityState = useRef({ x: 0, y: 0.002 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastInteractionTime = useRef(Date.now() - 3000);
  const pointerPos = useRef({ x: 0, y: 0 });
  const gyroValues = useRef({ x: 0, y: 0 });

  // Cursor UI state
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [handPaused, setHandPaused] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);

  useEffect(() => {
    // Reset camera position when globe size changes drastically
    targetZ.current = defaultCameraZ;
  }, [defaultCameraZ]);

  useEffect(() => {
    if (!gyroEnabled) {
      gyroValues.current = { x: 0, y: 0 };
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // Try to only influence when not actively dragging
      if (isDragging.current) return;

      const { beta, gamma } = event; // beta is front-to-back tilt in degrees (-180 to 180), gamma is left-to-right tilt in degrees (-90 to 90)
      if (beta === null || gamma === null) return;

      // Calculate gyroscope velocity based on device tilt. Adjust these multipliers to tune the feel.
      const gyroVelocityX = (gamma / 90) * 0.05; 
      
      // For beta, assume neutral holding is around 45 to 60 degrees.
      const normalizedBeta = Math.max(-90, Math.min(90, beta - 60));
      const gyroVelocityY = (normalizedBeta / 90) * 0.05;

      // Store in ref to apply exactly once per frame inside useFrame loop
      gyroValues.current = { x: gyroVelocityX, y: gyroVelocityY };
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      gyroValues.current = { x: 0, y: 0 };
    };
  }, [gyroEnabled]);

  useEffect(() => {
    // Non-passive wheel event to capture pinch & scroll reliably outside React rendering
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastInteractionTime.current = Date.now();
      
      const delta = e.deltaY;
      
      // Scaling down zoom interaction slightly and applying
      targetZ.current += delta * 0.015;
      
      // Clamp values so user can't zoom out infinitely.
      targetZ.current = Math.max(-dynamicRadius * 0.8, Math.min(dynamicRadius * (isMobileDevice ? 5.8 : 4.6), targetZ.current));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [dynamicRadius]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    setIsMouseDown(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
    lastInteractionTime.current = Date.now();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    pointerPos.current = { x: e.clientX, y: e.clientY };

    if (!isDragging.current) return;
    
    const deltaX = e.clientX - lastMouse.current.x;
    const deltaY = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    
    // Map screen cartesian coordinates to rotation
    velocityState.current.y += deltaX * 0.005;
    velocityState.current.x += deltaY * 0.005;
    
    lastInteractionTime.current = Date.now();
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    setIsMouseDown(false);
    lastInteractionTime.current = Date.now();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length >= 2 && initialPinchDistance.current !== null) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const delta = initialPinchDistance.current - dist;
      targetZ.current += delta * 0.05;
      targetZ.current = Math.max(-dynamicRadius * 0.8, Math.min(dynamicRadius * (isMobileDevice ? 5.8 : 4.6), targetZ.current));
      
      initialPinchDistance.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full relative ${isMouseDown ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <HandTracker onHandAction={(action) => {
        if (action.type === 'move') {
          velocityState.current.x += action.dx;
          velocityState.current.y += action.dy;
        } else if (action.type === 'zoom') {
          targetZ.current = Math.max(dynamicRadius * 2, Math.min(dynamicRadius * 8, targetZ.current + action.delta));
        } else if (action.type === 'pause') {
          setHandPaused(true);
        } else if (action.type === 'resume') {
          setHandPaused(false);
        }
        lastInteractionTime.current = Date.now();
      }} />
      <Canvas 
        camera={{ position: [0, 0, defaultCameraZ], fov: 45, near: 0.1 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <CameraController targetZ={targetZ} />
        <Suspense fallback={null}>
          <Sparkles count={isMobileDevice ? 100 : 500} scale={dynamicRadius * 3} size={isMobileDevice ? 1 : 2} speed={0.1} opacity={isMobileDevice ? 0.1 : 0.3} color="#ffffff" />
          <Globe 
            userPhotos={userPhotos}
            totalCards={totalCards}
            radius={dynamicRadius}
            rotationState={rotationState}
            velocityState={velocityState}
            isDragging={isDragging}
            lastInteraction={lastInteractionTime}
            handPaused={handPaused}
            onSelect={onSelect}
            gyroValues={gyroValues}
          />
          {!isMobileDevice && (
            <EffectComposer>
            <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.8} />
          </EffectComposer>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
