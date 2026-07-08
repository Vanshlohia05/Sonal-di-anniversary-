import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { generateFibonacciSphere } from '../utils/math';
import Card from './Card';

interface GlobeProps {
  userPhotos: string[];
  totalCards: number;
  radius: number;
  rotationState: React.MutableRefObject<{ x: number, y: number }>;
  velocityState: React.MutableRefObject<{ x: number, y: number }>;
  isDragging: React.MutableRefObject<boolean>;
  lastInteraction: React.MutableRefObject<number>;
  handPaused?: boolean;
  onSelect: (image: string) => void;
}

export default function Globe({ userPhotos, totalCards, radius, rotationState, velocityState, isDragging, lastInteraction, handPaused = false, onSelect }: GlobeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredText1, setHoveredText1] = useState(false);
  const [hoveredText2, setHoveredText2] = useState(false);
  
  // Precalculate the spherical grid positions and apply random scales
  const cardData = useMemo(() => {
    const rawPositions = generateFibonacciSphere(totalCards, radius);
    return rawPositions.map((pos, i) => ({
      position: pos,
      // Random scale between 0.6x and 1.3x to make size uneven but keeping orientation
      scale: 0.6 + Math.random() * 0.7,
      imageSrc: userPhotos[i % userPhotos.length],
      radius
    }));
  }, [userPhotos, totalCards, radius]);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Continuously apply velocity to rotation
    rotationState.current.x += velocityState.current.x;
    rotationState.current.y += velocityState.current.y;

    // Limit X axis rotation (pitch) heavily to prevent gimbal lock or uncomfortable viewing
    rotationState.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotationState.current.x));

    if (handPaused) {
      velocityState.current.x = 0;
      velocityState.current.y = 0;
    } else if (!isDragging.current) {
      // Apply momentum decay (friction/damping)
      velocityState.current.x *= 0.92;
      velocityState.current.y *= 0.92;

      // Ambient Idle Rotation
      if (Date.now() - lastInteraction.current > 2000) {
        // Gently inject velocity for gradual smooth spinning
        // This yields a steady state velocity of roughly 0.002 radians/frame
        velocityState.current.y += 0.00015; 
      }
    } else {
      // While grabbed and dragging, velocity decays sharply unless actively fueled by delta pointer moves
      velocityState.current.x *= 0.3;
      velocityState.current.y *= 0.3;
    }

    groupRef.current.rotation.x = rotationState.current.x;
    groupRef.current.rotation.y = rotationState.current.y;
  });

  return (
    <group ref={groupRef}>
      <Text
        position={[0, radius * 0.1, 0]}
        fontSize={radius * 0.25}
        color={hoveredText1 ? "rgba(255, 255, 255, 0.8)" : "rgba(100, 100, 100, 0.2)"}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
        onPointerOver={() => setHoveredText1(true)}
        onPointerOut={() => setHoveredText1(false)}
        onClick={() => {
          velocityState.current.x = 0;
          velocityState.current.y = 0;
        }}
      >
        Happy Anniversary
      </Text>
      <Text
        position={[0, -radius * 0.3, 0]}
        fontSize={radius * 0.15}
        color={hoveredText2 ? "rgba(255, 255, 255, 0.8)" : "rgba(100, 100, 100, 0.2)"}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
        onPointerOver={() => setHoveredText2(true)}
        onPointerOut={() => setHoveredText2(false)}
      >
        Sonal di and Ankit Jiju
      </Text>
      {cardData.map((data, i) => (
        <Card 
          key={i} 
          index={i} 
          position={data.position} 
          scale={data.scale} 
          radius={data.radius}
          imageSrc={data.imageSrc} 
          onSelect={(img) => {
            if (!isDragging.current) {
              onSelect(img);
            }
          }}
        />
      ))}
    </group>
  );
}
