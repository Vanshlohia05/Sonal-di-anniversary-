import React, { useEffect, useRef, useState } from 'react';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import { Hand, ZoomIn, ZoomOut, Move, Rotate3D, Pause } from 'lucide-react';

export type HandAction = 
  | { type: 'move'; dx: number; dy: number }
  | { type: 'zoom'; delta: number }
  | { type: 'pause' }
  | { type: 'resume' };

interface HandTrackerProps {
  onHandAction: (action: HandAction) => void;
}

const distance = (p1: {x: number, y: number}, p2: {x: number, y: number}) => 
  Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);

export default function HandTracker({ onHandAction }: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modeText, setModeText] = useState('Air Control Ready');
  
  const detectorRef = useRef<handPoseDetection.HandDetector | null>(null);
  const requestRef = useRef<number>(0);
  const lastPosition = useRef<{ x: number; y: number } | null>(null);
  const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  useEffect(() => {
    async function loadModel() {
      await tf.ready();
      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      const detectorConfig = {
        runtime: 'tfjs',
        modelType: 'lite',
        maxHands: 1,
      };
      try {
        const detector = await handPoseDetection.createDetector(model, detectorConfig as any);
        detectorRef.current = detector;
        setIsModelLoaded(true);
      } catch (err) {
        console.error('Failed to load hand pose model', err);
      }
    }
    loadModel();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const startTracking = async () => {
    if (!isModelLoaded || !detectorRef.current) return;
    setIsTracking(true);
    setModeText('Starting Camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        videoRef.current.onloadeddata = () => {
          setModeText('Air Control Active');
          detectHands();
        };
      }
    } catch (err) {
      console.error('Camera access denied', err);
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    lastPosition.current = null;
    lastPinchDist.current = null;
    lastPinchCenter.current = null;
  };

  const drawHand = (keypoints: any[]) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.fillStyle = 'red';
    
    // Draw all points
    keypoints.forEach((kp) => {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const detectHands = async () => {
    if (!detectorRef.current || !videoRef.current || !isTracking) return;

    if (videoRef.current.readyState === 4) {
      const video = videoRef.current;
      if (canvasRef.current && (canvasRef.current.width !== video.videoWidth)) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }

      const hands = await detectorRef.current.estimateHands(video);
      if (hands.length > 0) {
        const hand = hands[0];
        const keypoints = hand.keypoints;
        drawHand(keypoints);

        const wrist = keypoints.find(k => k.name === 'wrist') || keypoints[0];
        const indexTip = keypoints.find(k => k.name === 'index_finger_tip') || keypoints[8];
        const thumbTip = keypoints.find(k => k.name === 'thumb_tip') || keypoints[4];
        const middleTip = keypoints.find(k => k.name === 'middle_finger_tip') || keypoints[12];
        const indexMCP = keypoints.find(k => k.name === 'index_finger_mcp') || keypoints[5];
        const middleMCP = keypoints.find(k => k.name === 'middle_finger_mcp') || keypoints[9];
        const ringTip = keypoints.find(k => k.name === 'ring_finger_tip') || keypoints[16];
        const ringMCP = keypoints.find(k => k.name === 'ring_finger_mcp') || keypoints[13];

        if (indexTip && thumbTip && middleTip && middleMCP && wrist) {
          // Check if fingers are "up" by comparing their tip Y to MCP Y
          // (In video coordinates, Y is 0 at top, so tip.y < mcp.y means pointing UP)
          const isIndexUp = indexTip.y < indexMCP.y;
          const isMiddleUp = middleTip.y < middleMCP.y;
          const isRingUp = ringTip.y < ringMCP.y;
          
          const pinchDist = distance(indexTip, thumbTip);
          const isPinching = pinchDist < 40;

          // Open Hand = all fingers up -> Pause
          if (isIndexUp && isMiddleUp && isRingUp) {
            onHandAction({ type: 'pause' });
            lastPosition.current = null;
            lastPinchDist.current = null;
            lastPinchCenter.current = null;
            setModeText('Paused (Open Hand)');
          } 
          // Pinching = zoom / move
          else if (isPinching) {
            onHandAction({ type: 'resume' });
            const cx = (indexTip.x + thumbTip.x) / 2;
            const cy = (indexTip.y + thumbTip.y) / 2;
            
            if (lastPinchDist.current !== null) {
              const delta = pinchDist - lastPinchDist.current;
              // Larger pinch -> zoom in (negative Z delta)
              onHandAction({ type: 'zoom', delta: -delta * 0.15 });
            }
            if (lastPinchCenter.current !== null) {
              const dx = cx - lastPinchCenter.current.x;
              const dy = cy - lastPinchCenter.current.y;
              // Movement logic: moving pinch moves globe
              onHandAction({ type: 'move', dx: -dx * 0.05, dy: dy * 0.05 });
            }
            lastPinchDist.current = pinchDist;
            lastPinchCenter.current = { x: cx, y: cy };
            lastPosition.current = null;
            setModeText('Pinching (Zoom/Drag)');
          } 
          // Just Index Up -> Rotate
          else if (isIndexUp && !isMiddleUp) {
            onHandAction({ type: 'resume' });
            if (lastPosition.current !== null) {
              const dx = indexTip.x - lastPosition.current.x;
              const dy = indexTip.y - lastPosition.current.y;
              onHandAction({ type: 'move', dx: -dx * 0.05, dy: dy * 0.05 });
            }
            lastPosition.current = { x: indexTip.x, y: indexTip.y };
            lastPinchCenter.current = null;
            lastPinchDist.current = null;
            setModeText('Pointing (Rotate)');
          } else {
             // Default tracking loss protection
             lastPosition.current = null;
             lastPinchDist.current = null;
             lastPinchCenter.current = null;
             setModeText('Air Control Active');
          }
        }
      } else {
        lastPosition.current = null;
        lastPinchDist.current = null;
        lastPinchCenter.current = null;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
           ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        setModeText('Looking for hand...');
      }
    }
    if (isTracking) {
      requestRef.current = requestAnimationFrame(detectHands);
    }
  };

  useEffect(() => {
    if (!isTracking && requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, [isTracking]);

  return (
    <div className="absolute top-20 right-6 z-30 flex flex-col items-end gap-2">
      <button
        onClick={isTracking ? stopTracking : startTracking}
        disabled={!isModelLoaded}
        className={`p-3 rounded-full border transition-colors flex items-center justify-center shadow-sm ${
          isTracking
            ? 'bg-blue-500 text-white border-blue-600'
            : isModelLoaded
            ? 'bg-white text-gray-400 border-gray-200 hover:text-gray-900'
            : 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
        }`}
        title={isTracking ? 'Disable Air Tracking' : 'Enable Air Tracking'}
      >
        <Hand className="w-5 h-5" />
      </button>
      {isTracking && (
        <div className="w-40 h-32 bg-black rounded-lg overflow-hidden border border-gray-700 shadow-lg relative">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-60"
            playsInline
            muted
          />
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full transform -scale-x-100"
          />
          <div className="absolute bottom-1 left-1 right-1 text-[10px] text-center text-white bg-black/60 px-1 py-0.5 rounded backdrop-blur-sm truncate">
            {modeText}
          </div>
        </div>
      )}
    </div>
  );
}
