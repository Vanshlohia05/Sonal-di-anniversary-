import * as THREE from 'three';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { CARD_WIDTH, CARD_HEIGHT } from '../data';

interface CardProps {
  index: number;
  position: THREE.Vector3;
  scale?: number;
  radius: number;
  imageSrc: string;
  onSelect: (image: string) => void;
}

export default function Card({ index, position, scale = 1, radius, imageSrc, onSelect }: CardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  
  // Create a default gray material
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const targetScale = hovered ? 1.15 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 10);
    }
    if (materialRef.current) {
      const targetColor = hovered ? new THREE.Color(1, 1, 1) : new THREE.Color(0.85, 0.85, 0.85);
      materialRef.current.color.lerp(targetColor, delta * 10);
    }
  });

  useEffect(() => {
    let active = true;

    // Load gray pixel as initial texture
    const grayCanvas = document.createElement('canvas');
    grayCanvas.width = 400;
    grayCanvas.height = 500;
    const gCtx = grayCanvas.getContext('2d');
    if (gCtx) {
      gCtx.fillStyle = '#E5E5E5';
      gCtx.fillRect(0, 0, 400, 500);
    }
    const initialTex = new THREE.CanvasTexture(grayCanvas);
    initialTex.minFilter = THREE.LinearMipmapLinearFilter;
    initialTex.generateMipmaps = true;
    setTexture(initialTex);
    
    // Start fetching as soon as possible, but stagger slightly to avoid slamming the server concurrently
    const delay = index * 50;

    const timer = setTimeout(() => {
      new THREE.TextureLoader().load(imageSrc, (loadedTex) => {
        loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTex.generateMipmaps = true;
        if (active) {
          setTexture(loadedTex);
        }
      });
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [index, imageSrc]);

  const rotationQuaternion = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.position.copy(position);
    // The local forward vector (+Z) points directly outward from center (0,0,0)
    dummy.lookAt(position.clone().multiplyScalar(2));
    return dummy.quaternion.clone();
  }, [position]);

  const geometry = useMemo(() => {
    // 32x32 segments for smooth curving
    // Scale the dimensions before applying the bend, so it sits perfectly curve-flush on the sphere
    const width = CARD_WIDTH * scale;
    const height = CARD_HEIGHT * scale;
    const geo = new THREE.PlaneGeometry(width, height, 32, 32);
    const pos = geo.attributes.position;
    
    // Curve the plane to match the sphere's surface
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      const theta = x / radius;
      const phi = y / radius;
      
      const newX = radius * Math.sin(theta) * Math.cos(phi);
      const newY = radius * Math.sin(phi);
      // Offset by radius so its local center remains at (0,0,0)
      const newZ = radius * Math.cos(theta) * Math.cos(phi) - radius;
      
      pos.setXYZ(i, newX, newY, newZ);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, [scale, radius]);

  return (
    <mesh 
      position={position} 
      quaternion={rotationQuaternion}
      ref={meshRef} 
      geometry={geometry} 
      onClick={(e) => {
        e.stopPropagation();
        onSelect(imageSrc);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* DoubleSide allows the interior views of the cards to be seen when passing through */}
      {texture && (
        <meshBasicMaterial 
          ref={materialRef}
          map={texture} 
          side={THREE.DoubleSide} 
          toneMapped={false} 
        />
      )}
    </mesh>
  );
}
