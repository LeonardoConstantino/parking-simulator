/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { Level, Vec2, GhostFrame, CNHState, GhostRecord } from '../types';
import { updateVehicleKinematics, getOBBPoints, isColliding, Vec, isPointInPolygon } from '../utils/physics';
import { AudioManager } from '../utils/audio';
import { DialogueEngine } from '../utils/dialogue';
import { StorageService } from '../utils/storage';
import { Volume2, VolumeX, Eye, HelpCircle, RotateCcw, Play, Compass } from 'lucide-react';

interface GameCanvasProps {
  key?: string;
  level: Level;
  mode: 'play' | 'replay';
  replayFrames?: GhostFrame[];
  cnh: CNHState;
  onUpdateCNH: (event: string, delta: number) => void;
  onWin: (duration: number, moves: number, frames: GhostFrame[]) => void;
  onLose: (reason: string) => void;
  onExit: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export default function GameCanvas({
  level,
  mode,
  replayFrames = [],
  cnh,
  onUpdateCNH,
  onWin,
  onLose,
  onExit,
  isMuted,
  onToggleMute
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasWonRef = useRef(false);

  // Vehicle state
  const [car, setCar] = useState({
    x: level.startX,
    y: level.startY,
    heading: level.startHeading,
    velocity: 0,
    steerAngle: 0
  });

  const [steerInput, setSteerInput] = useState(0);
  const [throttleInput, setThrottleInput] = useState(0);
  const [perspective, setPerspective] = useState<'topdown' | 'driver'>('topdown');

  // Interactive details
  const [timeLeft, setTimeLeft] = useState<number | null>(level.timeLimit || null);
  const [patienceLeft, setPatienceLeft] = useState<number | null>(level.patienceTime || null);
  const [isStableInSpot, setIsStableInSpot] = useState(false);
  const [stabilityTimer, setStabilityTimer] = useState(0); // in seconds
  const [moveCount, setMoveCount] = useState(0);
  const [lastDirection, setLastDirection] = useState<'forward' | 'reverse' | 'idle'>('idle');

  // Camera Shake
  const [cameraShake, setCameraShake] = useState(0);

  // Debug mode
  const [isDebug, setIsDebug] = useState(false);

  // Ghost Run Support
  const [personalGhost, setPersonalGhost] = useState<GhostRecord | null>(null);
  const recordedFramesRef = useRef<GhostFrame[]>([]);
  const gameTimeRef = useRef(0);

  // Dynamic obstacles state
  const [obstacles, setObstacles] = useState(level.obstacles);

  // Particle Effects (dust, spark collision)
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number; decay: number }[]>([]);

  // Rain Ripples (Level 5)
  const rainRipplesRef = useRef<{ x: number; y: number; r: number; maxR: number; alpha: number }[]>([]);

  // Dialogue engine state
  const [activeDialogue, setActiveDialogue] = useState<{
    id: string;
    text: string[];
    currentIdx: number;
    timer: number;
    speakerName: string;
    speakerPos: Vec2;
    mood: string;
  } | null>(null);

  // Keys active
  const keysPressed = useRef<Record<string, boolean>>({});

  // Car specs
  const carWidth = 50;
  const carHeight = 24;
  const wheelBase = 46;

  // Track initial CNH points to show updates
  const cnhPointsRef = useRef(cnh.points);

  useEffect(() => {
    cnhPointsRef.current = cnh.points;
  }, [cnh.points]);

  // Load Personal Ghost
  useEffect(() => {
    if (mode === 'play') {
      const ghost = StorageService.getGhost(level.id);
      setPersonalGhost(ghost);
    }
    // Start engine sounds
    AudioManager.setMute(isMuted);
    AudioManager.startEngine();
    if (level.weather === 'rain') {
      AudioManager.startRain();
    } else {
      AudioManager.stopRain();
    }

    return () => {
      AudioManager.stopEngine();
      AudioManager.stopRain();
    };
  }, [level.id, isMuted, mode, level.weather]);

  // Timers & Dynamic Actions
  useEffect(() => {
    if (mode !== 'play') return;

    const timer = setInterval(() => {
      if (hasWonRef.current) return;

      // 1. Level time limit
      if (level.timeLimit !== undefined) {
        setTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            onLose('O tempo regulamentar esgotou!');
            onUpdateCNH('Estouro de tempo regulamentar (-1 pt)', -1);
            return 0;
          }
          if (prev <= 6) {
            AudioManager.playTick();
          }
          return prev - 1;
        });
      }

      // 2. Patience timer for F5 Tight Squeeze
      if (level.patienceTime !== undefined) {
        setPatienceLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Honk and penalty
            AudioManager.playHonk();
            onUpdateCNH('Impaciência extrema do trânsito traseiro (-2 pts)', -2);
            // Trigger impatient dialogue
            const line = DialogueEngine.selectLine('too_slow', level.timeOfDay, cnhPointsRef.current, 'dramatic');
            if (line) {
              const speaker = obstacles.find(o => o.type === 'pedestrian' || o.id === 'obs_5_impatient_driver');
              triggerDialogue(line.id, line.text, speaker?.pedestrianName || 'Motorista Apressado', {
                x: speaker?.x || 200,
                y: speaker?.y || 240
              }, line.mood);
            }
            return level.patienceTime || 40; // resets
          }
          // Periodic light honking when patience is low
          if (prev < 15 && prev % 5 === 0) {
            AudioManager.playHonk();
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [level, mode, obstacles]);

  // Handle Dialogue Bubble Timing
  useEffect(() => {
    if (!activeDialogue) return;

    const interval = setInterval(() => {
      setActiveDialogue((prev) => {
        if (!prev) return null;
        if (prev.timer <= 0) {
          // Go to next speech balloon
          if (prev.currentIdx + 1 < prev.text.length) {
            return {
              ...prev,
              currentIdx: prev.currentIdx + 1,
              timer: 2.2 // 2.2s for next balloon
            };
          } else {
            return null; // end dialogue
          }
        }
        return { ...prev, timer: prev.timer - 0.1 };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeDialogue]);

  const triggerDialogue = (id: string, text: string[], speakerName: string, pos: Vec2, mood: string) => {
    setActiveDialogue({
      id,
      text,
      currentIdx: 0,
      timer: 3.0, // 3s for first bubble
      speakerName,
      speakerPos: pos,
      mood
    });
  };

  // Keyboard Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed.current[k] = true;

      if (k === 'v') {
        setPerspective((p) => (p === 'topdown' ? 'driver' : 'topdown'));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysPressed.current[k] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Frame loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1); // cap dt at 100ms
      lastTime = time;

      if (mode === 'play') {
        if (!hasWonRef.current) {
          gameTimeRef.current += dt;
        }
      } else {
        gameTimeRef.current += dt;
      }

      // Ensure Audio volume is correct
      AudioManager.setMute(isMuted);

      if (mode === 'play') {
        // Read Keyboard Inputs
        let throttle = 0;
        let steer = 0;

        if (keysPressed.current['w'] || keysPressed.current['arrowup']) throttle = 1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) throttle = -1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) steer = -1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) steer = 1;

        // Apply touch/UI controls if they are active
        if (throttleInput !== 0) throttle = throttleInput;
        if (steerInput !== 0) steer = steerInput;

        // Count moves (F / R shifts)
        let currentDir: 'forward' | 'reverse' | 'idle' = 'idle';
        if (throttle > 0) currentDir = 'forward';
        else if (throttle < 0) currentDir = 'reverse';

        if (currentDir !== 'idle' && currentDir !== lastDirection) {
          if (lastDirection !== 'idle') {
            setMoveCount((c) => c + 1);
          }
          setLastDirection(currentDir);
        }

        // Apply Slope effect on acceleration for Level 6
        let gravityEffect = 0;
        if (level.slope) {
          // gravity = 0.3 * sin(slope)
          const slopeRad = (level.slope * Math.PI) / 180;
          // Pull down along the slope. Let's pull left-downward (e.g. at angle -Math.PI / 6)
          // To make it fun, let's pull the car backwards when heading up the ramp, or simply pull leftwards (X coordinate)
          // Let's affect the acceleration along the car's heading if we are angled on the ramp:
          // pulling toward X=150, Y=420 (the bottom ramp entrance)
          const rampCenter = { x: 350, y: 285 };
          const distToRamp = Vec.dist({ x: car.x, y: car.y }, rampCenter);
          if (distToRamp < 200) {
            // Player is on the ramp! Pull downwards (facing -Math.PI / 6 slope)
            gravityEffect = -15 * Math.sin(slopeRad); // pulling back
          }
        }

        // 1. Update vehicle kinematics
        const updatedCar = updateVehicleKinematics(
          car,
          { throttle, steer },
          dt,
          {
            wheelBase,
            maxSteerAngle: 0.6,
            maxSpeed: 80, // pixels per second (4m/s * 20px)
            maxReverseSpeed: 40,
            acceleration: 45,
            brakeForce: level.slope ? 60 : 90, // brake force -20% on Level 6
            friction: 0.92,
            gravityEffect
          }
        );

        // Check if car moves out of bounds
        let outOfBounds = false;
        if (updatedCar.x < 10 || updatedCar.x > 790 || updatedCar.y < 10 || updatedCar.y > 490) {
          outOfBounds = true;
        }

        // 2. Collision Detection against obstacles
        const carPoly = getOBBPoints(updatedCar.x, updatedCar.y, carWidth, carHeight, updatedCar.heading);
        let collisionOccurred = false;
        let colliderObj: any = null;

        if (!outOfBounds) {
          for (const obs of obstacles) {
            let obsPoly: Vec2[] = [];
            if (obs.type === 'pilar' || obs.type === 'pedestrian') {
              obsPoly = getOBBPoints(obs.x, obs.y, obs.width, obs.height, obs.heading);
            } else {
              obsPoly = getOBBPoints(obs.x, obs.y, obs.width, obs.height, obs.heading);
            }

            if (isColliding(carPoly, obsPoly)) {
              collisionOccurred = true;
              colliderObj = obs;
              break;
            }
          }
        }

        if (collisionOccurred || outOfBounds) {
          // Play crash sound
          AudioManager.playCrash();
          setCameraShake(15);

          // Spawn collision spark particles
          const collisionPt = { x: (car.x + updatedCar.x) / 2, y: (car.y + updatedCar.y) / 2 };
          for (let i = 0; i < 20; i++) {
            particlesRef.current.push({
              x: collisionPt.x + (Math.random() * 10 - 5),
              y: collisionPt.y + (Math.random() * 10 - 5),
              vx: (Math.random() * 2 - 1) * 80,
              vy: (Math.random() * 2 - 1) * 80,
              color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
              size: Math.random() * 4 + 2,
              alpha: 1,
              decay: 1.5 + Math.random() * 2
            });
          }

          // CNH Points deductions based on obstacle type
          let penalty = -3;
          let eventMsg = 'Colisão com obstáculo fixo (-3 pts)';

          if (colliderObj) {
            if (colliderObj.type === 'car') {
              penalty = -4;
              eventMsg = 'Colisão com veículo estacionado (-4 pts)';
            } else if (colliderObj.type === 'pedestrian') {
              penalty = -5;
              eventMsg = 'Atropelamento violento (-5 pts)';
            }
          }

          onUpdateCNH(eventMsg, penalty);

          // NPC reactions
          if (colliderObj && (colliderObj.type === 'pedestrian' || colliderObj.type === 'car')) {
            const lineTrigger = colliderObj.type === 'pedestrian' ? 'near_pedestrian' : 'hard_hit';
            const line = DialogueEngine.selectLine(lineTrigger, level.timeOfDay, cnhPointsRef.current, colliderObj.mood);
            if (line) {
              triggerDialogue(line.id, line.text, colliderObj.pedestrianName || 'Espectador', {
                x: colliderObj.x,
                y: colliderObj.y
              }, line.mood);
            }
          } else {
            // hit a wall
            const line = DialogueEngine.selectLine('hard_hit', level.timeOfDay, cnhPointsRef.current, 'ironic');
            if (line) {
              // find nearest NPC to speak
              const nearestNpc = obstacles.find(o => o.type === 'pedestrian');
              if (nearestNpc) {
                triggerDialogue(line.id, line.text, nearestNpc.pedestrianName || 'Marcio', {
                  x: nearestNpc.x,
                  y: nearestNpc.y
                }, line.mood);
              }
            }
          }

          // Elastic bounce effect (reverse direction and cut velocity)
          setCar((prev) => ({
            ...prev,
            velocity: -prev.velocity * 0.4, // Bounce back
            steerAngle: prev.steerAngle
          }));
        } else {
          // No collision: apply kinematics to state
          setCar(updatedCar);

          // Update audio pitch based on velocity
          AudioManager.updateEnginePitch(updatedCar.velocity, 80);

          // Dynamic pedestrian / NPC movement (Guarda Nunes, Carlos, Aline)
          setObstacles((prev) =>
            prev.map((obs) => {
              if (obs.type === 'pedestrian' && obs.waypoints && obs.waypoints.length > 0 && obs.speed) {
                const target = obs.waypoints[obs.currentWaypointIdx || 0];
                const d = Vec.dist({ x: obs.x, y: obs.y }, target);
                if (d < 5) {
                  // Next waypoint
                  const nextIdx = ((obs.currentWaypointIdx || 0) + 1) % obs.waypoints.length;
                  return { ...obs, currentWaypointIdx: nextIdx };
                } else {
                  const dir = Vec.normalize(Vec.sub(target, { x: obs.x, y: obs.y }));
                  const dx = dir.x * obs.speed * dt;
                  const dy = dir.y * obs.speed * dt;
                  const heading = Math.atan2(dir.y, dir.x);

                  // Trigger pedestrian near-miss warning
                  const pDist = Vec.dist({ x: updatedCar.x, y: updatedCar.y }, { x: obs.x + dx, y: obs.y + dy });
                  if (pDist < 45) { // < 2.2 meters approx
                    // Trigger near-miss once
                    const roll = Math.random();
                    if (roll < 0.05) {
                      const line = DialogueEngine.selectLine('near_miss', level.timeOfDay, cnhPointsRef.current, obs.mood);
                      if (line) {
                        triggerDialogue(line.id, line.text, obs.pedestrianName || 'Pedestre', {
                          x: obs.x,
                          y: obs.y
                        }, line.mood);
                        onUpdateCNH('Quase atropelamento de pedestre (-3 pts)', -3);
                        AudioManager.playHonk();
                      }
                    }
                  }

                  return {
                    ...obs,
                    x: obs.x + dx,
                    y: obs.y + dy,
                    heading
                  };
                }
              }
              return obs;
            })
          );

          // Check Success conditions
          const spot = level.spot;
          const distToSpot = Vec.dist({ x: updatedCar.x, y: updatedCar.y }, { x: spot.x, y: spot.y });

          // Spot geometry
          const spotPoly = getOBBPoints(spot.x, spot.y, spot.width, spot.height, spot.heading);
          const carInsideSpot = isPointInPolygon({ x: updatedCar.x, y: updatedCar.y }, spotPoly);

          // Speed check
          const speedCheck = Math.abs(updatedCar.velocity) < 2;

          // Heading/Angle alignment check
          let headingDiff = Math.abs(updatedCar.heading - spot.heading);
          headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff));

          // In reverse parking, car can be rotated 180 degrees (heading diff of PI)
          const headingDiffRev = Math.abs(headingDiff - Math.PI);
          const aligned = headingDiff < spot.toleranceHeading || headingDiffRev < spot.toleranceHeading;

          if (carInsideSpot && speedCheck && aligned) {
            setIsStableInSpot(true);
            setStabilityTimer((prev) => {
              const next = prev + dt;
              if (next >= 1.0) {
                if (!hasWonRef.current) {
                  hasWonRef.current = true;
                  // Success!
                  AudioManager.playWinChime();
                  onWin(gameTimeRef.current, moveCount, recordedFramesRef.current);
                }
              }
              return next;
            });
          } else {
            setIsStableInSpot(false);
            setStabilityTimer(0);
          }

          // Record frame for replay and ghost
          recordedFramesRef.current.push({
            x: updatedCar.x,
            y: updatedCar.y,
            heading: updatedCar.heading,
            t: gameTimeRef.current
          });
        }
      } else {
        // REPLAY MODE: follow pre-recorded frames
        const frameIdx = Math.floor(gameTimeRef.current * 30); // 30fps recorded frames
        if (frameIdx < replayFrames.length) {
          const f = replayFrames[frameIdx];
          setCar((prev) => ({
            ...prev,
            x: f.x,
            y: f.y,
            heading: f.heading,
            velocity: 0
          }));
        } else {
          // loop replay
          gameTimeRef.current = 0;
        }
      }

      // Camera shake decay
      setCameraShake((prev) => Math.max(0, prev - dt * 45));

      // 3. Update active particles
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          alpha: Math.max(0, p.alpha - dt * p.decay)
        }))
        .filter((p) => p.alpha > 0);

      // Rain ripples update (Level 5 Squeeze)
      if (level.weather === 'rain') {
        if (Math.random() < 0.15) {
          rainRipplesRef.current.push({
            x: Math.random() * 800,
            y: Math.random() * 500,
            r: 1,
            maxR: 12 + Math.random() * 15,
            alpha: 0.6
          });
        }
        rainRipplesRef.current = rainRipplesRef.current
          .map((r) => ({
            ...r,
            r: r.r + dt * 25,
            alpha: Math.max(0, r.alpha - dt * 1.5)
          }))
          .filter((r) => r.alpha > 0);
      }

      // Render Canvas
      drawCanvas();

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [car, steerInput, throttleInput, mode, replayFrames, obstacles, lastDirection, moveCount, level, isMuted]);

  // Drawing pipeline
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // 1. Apply Camera Shake
    if (cameraShake > 0) {
      const dx = (Math.random() * 2 - 1) * cameraShake;
      const dy = (Math.random() * 2 - 1) * cameraShake;
      ctx.translate(dx, dy);
    }

    // Apply Cinematic Camera Angles if in Replay Mode
    if (mode === 'replay') {
      const cycle = Math.floor(gameTimeRef.current / 4) % 3;
      ctx.translate(400, 250); // Translate origin to center of canvas
      if (cycle === 0) {
        // Angle 1: Focus on the Parking Spot success zone
        ctx.scale(1.3, 1.3);
        ctx.translate(-level.spot.x, -level.spot.y);
      } else if (cycle === 1) {
        // Angle 2: Tight zoom tracking the car bumper
        ctx.scale(1.5, 1.5);
        ctx.translate(-car.x, -car.y);
      } else {
        // Angle 3: Clean overhead widescreen overview
        ctx.scale(0.9, 0.9);
        ctx.translate(-400, -250);
      }
    }

    // 2. Clear & Draw Asphalt background
    ctx.fillStyle = level.timeOfDay === 'night' ? '#0f172a' : '#1e293b'; // Slate background
    ctx.fillRect(0, 0, 800, 500);

    // Grid lines
    ctx.strokeStyle = level.timeOfDay === 'night' ? '#1e293b' : '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    for (let y = 0; y < 500; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // Draw decorations (aesthetic elements) below everything else
    if (level.decorations && level.decorations.length > 0) {
      level.decorations.forEach((decor) => {
        ctx.save();
        ctx.translate(decor.x, decor.y);
        ctx.rotate(decor.heading);
        if (decor.opacity !== undefined) {
          ctx.globalAlpha = decor.opacity;
        }

        if (decor.type === 'line') {
          ctx.strokeStyle = decor.color || '#ffffff';
          ctx.lineWidth = decor.height || 4;
          ctx.beginPath();
          ctx.moveTo(-decor.width / 2, 0);
          ctx.lineTo(decor.width / 2, 0);
          ctx.stroke();
        } else if (decor.type === 'dashed-line') {
          ctx.strokeStyle = decor.color || '#ffffff';
          ctx.lineWidth = decor.height || 4;
          ctx.setLineDash([12, 8]);
          ctx.beginPath();
          ctx.moveTo(-decor.width / 2, 0);
          ctx.lineTo(decor.width / 2, 0);
          ctx.stroke();
        } else if (decor.type === 'area') {
          ctx.fillStyle = decor.color || 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(-decor.width / 2, -decor.height / 2, decor.width, decor.height);
        }

        ctx.restore();
      });
    }

    // Draw Garage Ramp slope indicator (Level 6)
    if (level.slope) {
      ctx.save();
      ctx.fillStyle = 'rgba(75, 85, 99, 0.4)';
      ctx.fillRect(150, 220, 400, 150);

      // Yellow ramp caution arrows showing slope pulling car back/down
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      for (let x = 180; x < 500; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 260);
        ctx.lineTo(x - 15, 295);
        ctx.lineTo(x, 330);
        ctx.stroke();
      }
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('RAMPA ÍNGREME - GRAVIDADE', 230, 250);
      ctx.restore();
    }

    // Draw curbs and sidewalks
    ctx.fillStyle = '#475569';
    // Draw curb line (yellow and black stripes)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;

    // 3. Draw Parking spot (Success Zone)
    const spot = level.spot;
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.heading);

    // VIP Spot color if CNH is maximum
    const isVIP = cnh.status === 'maximum';
    if (isVIP) {
      ctx.strokeStyle = '#fbbf24'; // Premium Gold
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
    } else {
      ctx.strokeStyle = isStableInSpot ? '#10b981' : '#3b82f6'; // Pulsing green / standard blue
      ctx.fillStyle = isStableInSpot ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.08)';
    }

    ctx.lineWidth = 3;
    if (isStableInSpot) {
      // pulsing animation
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#10b981';
    }
    ctx.setLineDash([6, 4]);
    ctx.fillRect(-spot.width / 2, -spot.height / 2, spot.width, spot.height);
    ctx.strokeRect(-spot.width / 2, -spot.height / 2, spot.width, spot.height);

    // Text on the parking spot
    ctx.restore();

    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.heading);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = isVIP ? '#fbbf24' : '#60a5fa';
    ctx.fillText(isVIP ? 'VAGA VIP' : 'ESTACIONAR', -30, 3);
    ctx.restore();

    // 4. Draw Personal Ghost if active
    if (personalGhost && mode === 'play') {
      const frameIdx = Math.floor(gameTimeRef.current * 30);
      if (frameIdx < personalGhost.frames.length) {
        const gf = personalGhost.frames[frameIdx];
        drawCarBody(ctx, gf.x, gf.y, carWidth, carHeight, gf.heading, 0, 'rgba(14, 165, 233, 0.4)', 'rgba(255, 255, 255, 0.2)');
        // Label above ghost
        ctx.fillStyle = 'rgba(14, 165, 233, 0.7)';
        ctx.font = '9px monospace';
        ctx.fillText(`Você (${personalGhost.timestamp})`, gf.x - 35, gf.y - 20);
      }
    }

    // 5. Draw Obstacles (walls, other cars, pillars, pedestrians)
    for (const obs of obstacles) {
      ctx.save();
      if (obs.type === 'car') {
        // Draw other cars
        drawCarBody(ctx, obs.x, obs.y, obs.width, obs.height, obs.heading, 0, obs.color || '#94a3b8', '#000000');
      } else if (obs.type === 'pilar') {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);
        // Pilar
        ctx.fillStyle = obs.color || '#d1d5db';
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        // concrete hatch lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.moveTo(-obs.width / 2, -obs.height / 2);
        ctx.lineTo(obs.width / 2, obs.height / 2);
        ctx.stroke();
        ctx.restore();
      } else if (obs.type === 'pedestrian') {
        // Pedestrian represented by high-polished circle & details
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(2, 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Shoulders
        ctx.fillStyle = obs.color || '#ec4899';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#fed7aa'; // Peach skin tone
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Hair / Cap
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-1, 0, 4, Math.PI / 2, -Math.PI / 2);
        ctx.fill();

        // Name Tag (if warning/critical or near pedestre)
        ctx.restore();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(obs.pedestrianName || 'Pedestre', obs.x - 20, obs.y - 12);
      } else if (obs.type === 'wall') {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);

        // Wall boundaries
        ctx.fillStyle = obs.color || '#475569';
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

        // Diagonal stripes on wall
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = -obs.width / 2; j < obs.width / 2; j += 15) {
          ctx.moveTo(j, -obs.height / 2);
          ctx.lineTo(j + 10, obs.height / 2);
        }
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // 6. Draw Player Car
    drawCarBody(ctx, car.x, car.y, carWidth, carHeight, car.heading, car.steerAngle, '#e11d48', '#ffffff', true);

    // Headlight cones for Night Drive (Level 4)
    if (level.timeOfDay === 'night') {
      ctx.save();
      // Blackout masking layer overlay except headlights
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 800;
      maskCanvas.height = 500;
      const maskCtx = maskCanvas.getContext('2d')!;

      // Ambient night darkness (very opaque black)
      maskCtx.fillStyle = 'rgba(3, 7, 18, 0.88)';
      maskCtx.fillRect(0, 0, 800, 500);

      // Cut out headlight cones from the mask
      maskCtx.globalCompositeOperation = 'destination-out';

      // Function to draw a headlight cone
      const drawCone = (hx: number, hy: number, hAngle: number) => {
        maskCtx.beginPath();
        maskCtx.moveTo(hx, hy);
        const coneLength = 180;
        const spread = 0.45; // rad
        const p1x = hx + coneLength * Math.cos(hAngle - spread);
        const p1y = hy + coneLength * Math.sin(hAngle - spread);
        const p2x = hx + coneLength * Math.cos(hAngle + spread);
        const p2y = hy + coneLength * Math.sin(hAngle + spread);
        maskCtx.lineTo(p1x, p1y);
        maskCtx.lineTo(p2x, p2y);
        maskCtx.closePath();
        maskCtx.fill();

        // Blend glow around the headlights
        const gradient = maskCtx.createRadialGradient(hx, hy, 5, hx, hy, 45);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        maskCtx.fillStyle = gradient;
        maskCtx.beginPath();
        maskCtx.arc(hx, hy, 45, 0, Math.PI * 2);
        maskCtx.fill();
      };

      // Headlight positions in local car coordinates
      const cos = Math.cos(car.heading);
      const sin = Math.sin(car.heading);

      const hLeftLocal = { x: carWidth / 2, y: -carHeight / 3 };
      const hRightLocal = { x: carWidth / 2, y: carHeight / 3 };

      const hLeftWorld = {
        x: car.x + (hLeftLocal.x * cos - hLeftLocal.y * sin),
        y: car.y + (hLeftLocal.x * sin + hLeftLocal.y * cos)
      };
      const hRightWorld = {
        x: car.x + (hRightLocal.x * cos - hRightLocal.y * sin),
        y: car.y + (hRightLocal.x * sin + hRightLocal.y * cos)
      };

      drawCone(hLeftWorld.x, hLeftWorld.y, car.heading);
      drawCone(hRightWorld.x, hRightWorld.y, car.heading);

      // Draw the night mask over the game
      ctx.drawImage(maskCanvas, 0, 0);

      // Draw yellow semi-transparent light cones on top for rendering visual glow
      ctx.fillStyle = 'rgba(254, 240, 138, 0.15)';
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.3)';
      ctx.lineWidth = 1;

      const drawGlowCone = (hx: number, hy: number, hAngle: number) => {
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        const coneLength = 180;
        const spread = 0.45;
        const p1x = hx + coneLength * Math.cos(hAngle - spread);
        const p1y = hy + coneLength * Math.sin(hAngle - spread);
        const p2x = hx + coneLength * Math.cos(hAngle + spread);
        const p2y = hy + coneLength * Math.sin(hAngle + spread);
        ctx.lineTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      drawGlowCone(hLeftWorld.x, hLeftWorld.y, car.heading);
      drawGlowCone(hRightWorld.x, hRightWorld.y, car.heading);

      ctx.restore();
    }

    // 7. Draw rain particles and ripples (Level 5)
    if (level.weather === 'rain') {
      ctx.save();
      // Draw falling rain streaks
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 25; i++) {
        const rx = Math.random() * 800;
        const ry = Math.random() * 500;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 10, ry + 25); // slanted rain
        ctx.stroke();
      }

      // Draw ripples
      ctx.lineWidth = 1;
      for (const r of rainRipplesRef.current) {
        ctx.strokeStyle = `rgba(186, 230, 253, ${r.alpha})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 8. Draw particles (sparks, dust)
    ctx.save();
    for (const p of particlesRef.current) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 9. Draw Dialogue Balloons
    if (activeDialogue) {
      ctx.save();
      const bubbleX = activeDialogue.speakerPos.x;
      const bubbleY = activeDialogue.speakerPos.y - 25;
      const text = activeDialogue.text[activeDialogue.currentIdx];

      ctx.font = '11px sans-serif';
      const textWidth = ctx.measureText(text).width;
      const bubbleWidth = textWidth + 16;
      const bubbleHeight = 24;

      // Draw Speech Bubble box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';

      ctx.beginPath();
      ctx.roundRect(bubbleX - bubbleWidth / 2, bubbleY - bubbleHeight / 2, bubbleWidth, bubbleHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Tail triangle pointing downwards to speaker
      ctx.beginPath();
      ctx.moveTo(bubbleX - 6, bubbleY + bubbleHeight / 2);
      ctx.lineTo(bubbleX, bubbleY + bubbleHeight / 2 + 6);
      ctx.lineTo(bubbleX + 6, bubbleY + bubbleHeight / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bubbleX - 6, bubbleY + bubbleHeight / 2);
      ctx.lineTo(bubbleX, bubbleY + bubbleHeight / 2 + 6);
      ctx.stroke();

      // Draw Dialogue Text
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(activeDialogue.speakerName.toUpperCase(), bubbleX - bubbleWidth / 2 + 8, bubbleY - 4);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(text, bubbleX - textWidth / 2, bubbleY + 7);

      ctx.restore();
    }

    // 10. Draw patience timer visual (Level 5 Tight Squeeze)
    if (level.patienceTime && patienceLeft !== null) {
      // Impatient car is at x: 220, y: 280
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(170, 230, 100, 6);
      // Patience progress
      const pRatio = patienceLeft / level.patienceTime;
      ctx.fillStyle = pRatio > 0.4 ? '#10b981' : pRatio > 0.15 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(170, 230, 100 * pRatio, 6);

      // Icon
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('PACIÊNCIA ATRÁS', 170, 224);
      ctx.restore();
    }

    // 11. Custom mirror rendering for Driver Perspective
    if (perspective === 'driver') {
      drawDriverPerspectiveOverlay(ctx);
    }

    // 12. Draw Debug Overlay if enabled
    if (isDebug) {
      drawDebugOverlay(ctx);
    }

    ctx.restore();
  };

  const drawCarBody = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    heading: number,
    steerAngle: number,
    color: string,
    strokeColor: string,
    isPlayer = false
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);

    // 1. Draw Wheels
    ctx.fillStyle = '#1e293b'; // wheel black
    const wheelW = Math.max(6, w * 0.2);
    const wheelH = Math.max(3, h * 0.16);
    const wheelBaseToUse = w * 0.92;

    // Rear Left Wheel (fixed)
    ctx.fillRect(-wheelBaseToUse / 2, -h / 2 + 1, wheelW, wheelH);
    // Rear Right Wheel (fixed)
    ctx.fillRect(-wheelBaseToUse / 2, h / 2 - wheelH - 1, wheelW, wheelH);

    // Front Left Wheel (steerable)
    ctx.save();
    ctx.translate(wheelBaseToUse / 2, -h / 2 + 1);
    ctx.rotate(steerAngle);
    ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
    ctx.restore();

    // Front Right Wheel (steerable)
    ctx.save();
    ctx.translate(wheelBaseToUse / 2, h / 2 - wheelH - 1);
    ctx.rotate(steerAngle);
    ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
    ctx.restore();

    // 2. Draw Car Chassis Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w, h, 4);
    ctx.fill();

    // 3. Draw Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 4. Draw Windows
    ctx.fillStyle = '#0f172a'; // Glass black
    // Windshield
    ctx.fillRect(w / 6, -h / 2.3, w / 7, h / 1.2);
    // Side Windows
    ctx.fillRect(-w / 6, -h / 2.2, w / 4, 2);
    ctx.fillRect(-w / 6, h / 2.2 - 2, w / 4, 2);
    // Rear Windshield
    ctx.fillRect(-w / 3, -h / 2.3, w / 10, h / 1.2);

    // 5. Headlights
    ctx.fillStyle = '#fef08a'; // bright yellow headlights
    ctx.fillRect(w / 2 - 2, -h / 3 - 1, 3, 2);
    ctx.fillRect(w / 2 - 2, h / 3 - 1, 3, 2);

    // 6. Tail lights / Brake lights
    const isBraking = isPlayer && (keysPressed.current['s'] || throttleInput < 0 || car.velocity === 0);
    ctx.fillStyle = isBraking ? '#ef4444' : '#b91c1c'; // Bright red when braking
    ctx.fillRect(-w / 2 - 1, -h / 3 - 1, 2, 2);
    ctx.fillRect(-w / 2 - 1, h / 3 - 1, 2, 2);

    // License Plate
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-w / 2 - 1, -3, 2, 6);

    ctx.restore();
  };

  const drawDebugOverlay = (ctx: CanvasRenderingContext2D) => {
    ctx.save();

    // 1. Draw Player Car Hitbox
    const carPoly = getOBBPoints(car.x, car.y, carWidth, carHeight, car.heading);
    ctx.strokeStyle = '#f43f5e'; // Bright Rose/Pink
    ctx.lineWidth = 2;
    ctx.beginPath();
    carPoly.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Fill semi-transparent
    ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
    ctx.fill();

    // Draw center point
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(car.x, car.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw front heading line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(car.x, car.y);
    ctx.lineTo(car.x + Math.cos(car.heading) * 40, car.y + Math.sin(car.heading) * 40);
    ctx.stroke();

    // 2. Draw Obstacle Hitboxes
    for (const obs of obstacles) {
      const obsPoly = getOBBPoints(obs.x, obs.y, obs.width, obs.height, obs.heading);
      ctx.strokeStyle = '#e11d48'; // Red
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      obsPoly.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(225, 29, 72, 0.15)';
      ctx.fill();

      // Draw obstacle info text
      ctx.fillStyle = '#ef4444';
      ctx.font = '9px monospace';
      ctx.fillText(`${obs.type.toUpperCase()} [${obs.id}]`, obs.x - 20, obs.y - obs.height / 2 - 4);

      // If pedestrian, draw waypoints and path
      if (obs.type === 'pedestrian' && obs.waypoints && obs.waypoints.length > 0) {
        ctx.strokeStyle = '#a855f7'; // Purple waypoints path
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        obs.waypoints.forEach((wp, idx) => {
          if (idx === 0) ctx.moveTo(wp.x, wp.y);
          else ctx.lineTo(wp.x, wp.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw individual waypoints as small purple dots
        ctx.fillStyle = '#c084fc';
        obs.waypoints.forEach((wp) => {
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // 3. Draw Spot Hitbox explicitly
    const spot = level.spot;
    const spotPoly = getOBBPoints(spot.x, spot.y, spot.width, spot.height, spot.heading);
    ctx.strokeStyle = '#38bdf8'; // Cyan
    ctx.lineWidth = 2;
    ctx.beginPath();
    spotPoly.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fill();

    // 4. Print general telemetry text overlay in top-left
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, 50, 240, 150);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(10, 50, 240, 150);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('=== TELEMETRIA DEBUG ===', 20, 68);

    ctx.fillStyle = '#ffffff';
    ctx.font = '9px monospace';
    ctx.fillText(`CAR_X: ${car.x.toFixed(2)}px`, 20, 85);
    ctx.fillText(`CAR_Y: ${car.y.toFixed(2)}px`, 20, 97);
    ctx.fillText(`VELOCIDADE: ${car.velocity.toFixed(2)} px/s`, 20, 109);
    ctx.fillText(`ÂNGULO (HEADING): ${car.heading.toFixed(3)} rad (${Math.round((car.heading * 180) / Math.PI)}°)`, 20, 121);
    ctx.fillText(`ESTERÇAMENTO: ${car.steerAngle.toFixed(3)} rad`, 20, 133);

    // Alignment and success checks
    let headingDiff = Math.abs(car.heading - spot.heading);
    headingDiff = Math.atan2(Math.sin(headingDiff), Math.cos(headingDiff));
    const headingDiffRev = Math.abs(headingDiff - Math.PI);
    const angleAligned = headingDiff < spot.toleranceHeading || headingDiffRev < spot.toleranceHeading;
    const centerInSpot = isPointInPolygon({ x: car.x, y: car.y }, spotPoly);

    ctx.fillText(`VAGA_X: ${spot.x} | VAGA_Y: ${spot.y}`, 20, 150);
    ctx.fillText(`DIF_ÂNGULO: ${headingDiff.toFixed(3)} rad (Tol: ${spot.toleranceHeading})`, 20, 162);
    
    // Status badges
    ctx.fillStyle = centerInSpot ? '#10b981' : '#f43f5e';
    ctx.fillText(`DENTRO DA VAGA: ${centerInSpot ? 'SIM' : 'NÃO'}`, 20, 175);
    ctx.fillStyle = angleAligned ? '#10b981' : '#f43f5e';
    ctx.fillText(`ALINHADO: ${angleAligned ? 'SIM' : 'NÃO'}`, 20, 187);

    ctx.restore();
  };

  const drawDriverPerspectiveOverlay = (ctx: CanvasRenderingContext2D) => {
    // Under Driver Perspective, the user sees mirrors reflecting the rear view.
    // Let's render three mirror overlays at the top of the screen:
    // Left mirror, center rearview mirror, and right mirror.
    ctx.save();

    // Draw Dark dashboard borders at bottom/sides
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    // HUD dash border
    ctx.fillRect(0, 440, 800, 60);

    // Draw Left Mirror (top-left)
    drawMirror(ctx, 40, 60, 100, 45, 'ESQUERDO', car.heading + Math.PI - 0.25);
    // Draw Center Mirror (top-center)
    drawMirror(ctx, 330, 20, 140, 45, 'RETROVISOR INTERNO', car.heading + Math.PI);
    // Draw Right Mirror (top-right)
    drawMirror(ctx, 660, 60, 100, 45, 'DIREITO', car.heading + Math.PI + 0.25);

    ctx.restore();
  };

  const drawMirror = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    reflectionHeading: number
  ) => {
    ctx.save();

    // Draw Mirror frame
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Clip to mirror content
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.clip();

    // Draw mirror background (slate-blue reflective tint)
    ctx.fillStyle = '#334155';
    ctx.fillRect(x, y, w, h);

    // Draw simplified reflection
    // We render relative lines representing the road, obstacles behind the player
    ctx.translate(x + w / 2, y + h / 2);

    const cos = Math.cos(reflectionHeading);
    const sin = Math.sin(reflectionHeading);

    // Draw simplified parked cars behind
    for (const obs of obstacles) {
      if (obs.type === 'car') {
        const dx = obs.x - car.x;
        const dy = obs.y - car.y;

        // Project relative to reflection angle
        const rx = dx * cos + dy * sin;
        const ry = -dx * sin + dy * cos;

        // Draw in mirror coordinates (scaled down)
        if (Math.abs(rx) < 180 && Math.abs(ry) < 100) {
          ctx.fillStyle = obs.color || '#94a3b8';
          ctx.fillRect(ry * 0.4 - 15, rx * 0.4 - 10, 30, 20);
        }
      }
    }

    // Draw spot reflection in mirror
    const sdx = level.spot.x - car.x;
    const sdy = level.spot.y - car.y;
    const srx = sdx * cos + sdy * sin;
    const sry = -sdx * sin + sdy * cos;

    if (Math.abs(srx) < 180 && Math.abs(sry) < 100) {
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sry * 0.4 - 15, srx * 0.4 - 10, 30, 20);
    }

    ctx.restore();

    // Draw Label above/inside mirror
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(label, x + 5, y + 12);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl relative w-full select-none" id="game-canvas-container">
      {/* HUD Top panel */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-slate-100 z-10 gap-2">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded bg-rose-600 text-xs font-bold uppercase tracking-wider">
            FASE {level.phaseIndex}
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-none">{level.phaseName}</h3>
            <p className="text-[10px] text-slate-400 mt-1">{level.description}</p>
          </div>
        </div>

        {/* Dynamic status indicators */}
        <div className="flex items-center gap-4 text-xs">
          {timeLeft !== null && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase text-slate-400">Tempo</span>
              <span className={`font-mono text-sm font-bold ${timeLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-slate-200'}`}>
                {timeLeft}s
              </span>
            </div>
          )}

          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase text-slate-400">Manobras</span>
            <span className="font-mono text-sm font-bold text-sky-400">{moveCount}</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase text-slate-400">Estabilidade</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, stabilityTimer * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-slate-300">{Math.floor(stabilityTimer * 100)}%</span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-slate-400">Sua CNH</span>
            <span className={`font-bold tracking-tight uppercase ${
              cnh.points > 14 ? 'text-emerald-400' : cnh.points > 9 ? 'text-sky-400' : cnh.points > 4 ? 'text-amber-400 animate-pulse' : 'text-rose-500 font-black animate-bounce'
            }`}>
              {cnh.points} PONTOS ({cnh.points === 20 ? 'MÁX' : cnh.points >= 10 ? 'OK' : cnh.points >= 5 ? 'AVISO' : 'CRÍTICA'})
            </span>
          </div>
        </div>
      </div>

      {/* Actual Game Canvas viewport with Overlay widgets */}
      <div className="relative flex items-center justify-center bg-slate-950 min-h-[300px] md:min-h-[480px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="bg-slate-900 shadow-inner w-full max-w-[800px] h-auto object-contain aspect-[800/500]"
        />

        {/* Stability Success Prompt overlay inside Canvas */}
        {isStableInSpot && mode === 'play' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-500/90 border border-emerald-400 rounded-lg text-white font-bold text-center tracking-wider text-xs animate-bounce pointer-events-none uppercase">
            Mantenha o Carro Estável! 1s para confirmar...
          </div>
        )}

        {/* Rain and Climate banner */}
        {level.weather === 'rain' && (
          <div className="absolute top-14 left-4 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-md text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 shadow backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            TEMPO DE CHUVA - ADERÊNCIA −15%
          </div>
        )}

        {/* Help controls indicator overlay on top right */}
        {mode === 'play' && (
          <div className="absolute top-14 right-4 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-md text-[10px] font-mono text-slate-300 shadow backdrop-blur-sm pointer-events-none hidden sm:block">
            <span className="font-bold text-white uppercase">CONTROLES TECLADO:</span>
            <div className="mt-1 flex flex-col gap-0.5">
              <div>Acelerar/Ré: <span className="text-yellow-400">W / S</span> ou <span className="text-yellow-400">↑ / ↓</span></div>
              <div>Direção: <span className="text-yellow-400">A / D</span> ou <span className="text-yellow-400">← / →</span></div>
              <div>Câmera: <span className="text-yellow-400">V</span> (Dupla Perspectiva)</div>
            </div>
          </div>
        )}
      </div>

      {/* Control Actions Bottom Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Mudar Som"
            id="toggle-sound-btn"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setPerspective((p) => (p === 'topdown' ? 'driver' : 'topdown'))}
            className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1.5 text-xs font-semibold transition-colors"
            id="toggle-cam-btn"
          >
            <Eye className="w-3.5 h-3.5" />
            {perspective === 'topdown' ? 'Visão Motorista (V)' : 'Visão Aérea (V)'}
          </button>

          <button
            onClick={() => setIsDebug((d) => !d)}
            className={`px-3 py-2 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isDebug ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            id="toggle-debug-btn"
            title="Mudar Modo Debug"
          >
            <Compass className="w-3.5 h-3.5" />
            Debug: {isDebug ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Touch controls panel: responsive, visible when user wants or on touch screens */}
        {mode === 'play' && (
          <div className="flex items-center gap-4 py-1" id="touch-controls-hud">
            {/* Steering wheel joystick simulator */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">VOLANTE</span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={steerInput}
                onChange={(e) => setSteerInput(parseFloat(e.target.value))}
                onMouseUp={() => setSteerInput(0)}
                onTouchEnd={() => setSteerInput(0)}
                className="w-24 md:w-32 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 border border-slate-700"
              />
            </div>

            {/* Throttle Pedals */}
            <div className="flex items-center gap-1.5">
              <button
                onTouchStart={() => setThrottleInput(-1)}
                onTouchEnd={() => setThrottleInput(0)}
                onMouseDown={() => setThrottleInput(-1)}
                onMouseUp={() => setThrottleInput(0)}
                className="px-3.5 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow transition-colors active:scale-95"
                title="Pedal de Ré / Freio"
                id="pedal-reverse-btn"
              >
                RÉ / FREIO
              </button>

              <button
                onTouchStart={() => setThrottleInput(1)}
                onTouchEnd={() => setThrottleInput(0)}
                onMouseDown={() => setThrottleInput(1)}
                onMouseUp={() => setThrottleInput(0)}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase shadow transition-colors active:scale-95"
                title="Pedal de Aceleração"
                id="pedal-forward-btn"
              >
                GAS
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {mode === 'play' && (
            <button
              onClick={() => {
                // restart physics/car state
                hasWonRef.current = false;
                setCar({
                  x: level.startX,
                  y: level.startY,
                  heading: level.startHeading,
                  velocity: 0,
                  steerAngle: 0
                });
                setMoveCount(0);
                setLastDirection('idle');
                setIsStableInSpot(false);
                setStabilityTimer(0);
                setTimeLeft(level.timeLimit || null);
                setPatienceLeft(level.patienceTime || null);
              }}
              className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1 text-xs font-semibold transition-colors"
              id="restart-phase-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          )}

          <button
            onClick={onExit}
            className="px-3 py-2 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold transition-colors"
            id="exit-game-btn"
          >
            Sair do Jogo
          </button>
        </div>
      </div>
    </div>
  );
}
