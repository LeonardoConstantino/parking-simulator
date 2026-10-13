/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Level, ParkingSpot, Obstacle, TimeSlot, NPCMood, Decoration } from '../types';
import { LEVELS } from '../data';
import { StorageService } from '../utils/storage';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  Play,
  FileJson,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  Settings,
  Car,
  Flag,
  Target,
  Palette,
  User,
  Smile,
  Compass,
  MapPin,
  ChevronUp,
  ChevronDown,
  Trash
} from 'lucide-react';

interface LevelEditorProps {
  onBack: () => void;
  onPlayLevel: (level: Level) => void;
  initialLevel?: Level | null;
}

const PRESET_COLORS = [
  '#e11d48', // Rose
  '#2563eb', // Blue
  '#16a34a', // Green
  '#ea580c', // Orange
  '#7c3aed', // Purple
  '#0d9488', // Teal
  '#475569', // Slate
  '#d1d5db', // Silver
];

export default function LevelEditor({ onBack, onPlayLevel, initialLevel }: LevelEditorProps) {
  // All default + custom levels for selection
  const [baseLevels, setBaseLevels] = useState<Level[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string>('level_1');

  // Custom level state
  const [levelName, setLevelName] = useState('Fase Customizada');
  const [levelDesc, setLevelDesc] = useState('Minha fase criada no editor! Estacione com precisão.');
  const [timeOfDay, setTimeOfDay] = useState<TimeSlot>('afternoon');
  const [weather, setWeather] = useState<'clear' | 'rain'>('clear');
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [slope, setSlope] = useState<number>(0);

  // Player Start State
  const [startX, setStartX] = useState(150);
  const [startY, setStartY] = useState(250);
  const [startHeading, setStartHeading] = useState(0); // in radians

  // Parking Spot State
  const [spot, setSpot] = useState<ParkingSpot>({
    x: 650,
    y: 250,
    width: 90,
    height: 48,
    heading: Math.PI / 2,
    toleranceHeading: 0.15,
    toleranceOffset: 12
  });

  // Obstacles State
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  // Decorations State (aesthetic elements)
  const [decorations, setDecorations] = useState<Decoration[]>([]);

  // Selection & drag state
  // selectedId can be: 'player' | 'spot' | string (obstacle id) | null
  const [selectedId, setSelectedId] = useState<'player' | 'spot' | string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedWaypointIdx, setDraggedWaypointIdx] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // JSON Import/Export state
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-clear toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Load levels lists and set Level 1 as initial base
  useEffect(() => {
    const builtIn = LEVELS;
    const custom = StorageService.getCustomLevels();
    const all = [...builtIn, ...custom];
    setBaseLevels(all);

    if (initialLevel) {
      loadBaseLevel(initialLevel, true);
      setSelectedBaseId(initialLevel.id);
    } else {
      // Default to Level 1
      const l1 = builtIn.find((l) => l.id === 'level_1') || builtIn[0];
      if (l1) {
        loadBaseLevel(l1, false);
      }
    }
  }, [initialLevel]);

  // Sync custom level list when changed
  const refreshCustomLevelsList = () => {
    const builtIn = LEVELS;
    const custom = StorageService.getCustomLevels();
    setBaseLevels([...builtIn, ...custom]);
  };

  const loadBaseLevel = (l: Level, isDirectEdit: boolean = false) => {
    setLevelName(isDirectEdit ? l.phaseName : `${l.phaseName} (Cópia)`);
    setLevelDesc(l.description || 'Fase baseada em outra existente.');
    setTimeOfDay(l.timeOfDay || 'afternoon');
    setWeather(l.weather || 'clear');
    setTimeLimit(l.timeLimit || 60);
    setSlope(l.slope || 0);

    setStartX(l.startX);
    setStartY(l.startY);
    setStartHeading(l.startHeading);

    setSpot({ ...l.spot });
    // Deep clone obstacles
    setObstacles(
      l.obstacles.map((obs) => ({
        ...obs,
        waypoints: obs.waypoints ? obs.waypoints.map((w) => ({ ...w })) : undefined
      }))
    );
    // Deep clone decorations
    setDecorations(
      l.decorations
        ? l.decorations.map((decor) => ({
            ...decor
          }))
        : []
    );
    setSelectedId(null);
  };

  // Keyboard nudge support for currently selected asset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;

      // Do not move elements if user is typing in an input, textarea or select
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!keys.includes(e.key)) return;

      // Prevent page/canvas scrolling
      e.preventDefault();

      const delta = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -delta;
      if (e.key === 'ArrowRight') dx = delta;
      if (e.key === 'ArrowUp') dy = -delta;
      if (e.key === 'ArrowDown') dy = delta;

      if (selectedId === 'player') {
        setStartX((prev) => Math.max(0, Math.min(800, prev + dx)));
        setStartY((prev) => Math.max(0, Math.min(500, prev + dy)));
      } else if (selectedId === 'spot') {
        setSpot((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(800, prev.x + dx)),
          y: Math.max(0, Math.min(500, prev.y + dy))
        }));
      } else {
        setObstacles((prev) => {
          if (!prev.some((obs) => obs.id === selectedId)) return prev;
          return prev.map((obs) => {
            if (obs.id === selectedId) {
              const nextX = Math.max(0, Math.min(800, obs.x + dx));
              const nextY = Math.max(0, Math.min(500, obs.y + dy));
              const waypoints = obs.waypoints
                ? obs.waypoints.map((wp) => ({
                    x: Math.max(0, Math.min(800, wp.x + dx)),
                    y: Math.max(0, Math.min(500, wp.y + dy))
                  }))
                : undefined;
              return { ...obs, x: nextX, y: nextY, waypoints };
            }
            return obs;
          });
        });

        setDecorations((prev) => {
          if (!prev.some((decor) => decor.id === selectedId)) return prev;
          return prev.map((decor) => {
            if (decor.id === selectedId) {
              const nextX = Math.max(0, Math.min(800, decor.x + dx));
              const nextY = Math.max(0, Math.min(500, decor.y + dy));
              return { ...decor, x: nextX, y: nextY };
            }
            return decor;
          });
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId]);

  const handleBaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedBaseId(id);
    const found = baseLevels.find((l) => l.id === id);
    if (found) {
      loadBaseLevel(found);
    }
  };

  // Helper to draw a generic car body
  const drawEditorCar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    heading: number,
    color: string,
    label: string,
    isSelected: boolean
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
      ctx.setLineDash([]);
    }

    // Wheels
    ctx.fillStyle = '#1e293b';
    const wheelW = w * 0.2;
    const wheelH = h * 0.16;
    ctx.fillRect(-w / 2 + 5, -h / 2 - 1, wheelW, wheelH);
    ctx.fillRect(-w / 2 + 5, h / 2 - wheelH + 1, wheelW, wheelH);
    ctx.fillRect(w / 2 - wheelW - 5, -h / 2 - 1, wheelW, wheelH);
    ctx.fillRect(w / 2 - wheelW - 5, h / 2 - wheelH + 1, wheelW, wheelH);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w, h);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Windshield
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(w / 6, -h / 2.3, w / 6, h / 1.2);

    // Headlights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(w / 2 - 2, -h / 3, 2, 2);
    ctx.fillRect(w / 2 - 2, h / 3 - 2, 2, 2);

    ctx.restore();

    // Text Label above car
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px monospace';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(label, cx - ctx.measureText(label).width / 2, cy - h / 2 - 12);
    ctx.restore();
  };

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = timeOfDay === 'night' ? '#0f172a' : '#1e293b';
    ctx.fillRect(0, 0, 800, 500);

    // Grid lines
    ctx.strokeStyle = timeOfDay === 'night' ? '#1e293b' : '#334155';
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

    // Draw decorations (aesthetic elements) below other assets in their stack order
    decorations.forEach((decor) => {
      const isDecorSelected = selectedId === decor.id;
      ctx.save();
      ctx.translate(decor.x, decor.y);
      ctx.rotate(decor.heading);
      if (decor.opacity !== undefined) {
        ctx.globalAlpha = decor.opacity;
      }

      // Selection indicator / ring
      if (isDecorSelected) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);
        // Draw selection box around the decoration bounds
        ctx.strokeRect(-decor.width / 2 - 4, -decor.height / 2 - 4, decor.width + 8, decor.height + 8);
        ctx.restore();
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

    // Draw Slope / Ramp indicator if present
    if (slope !== 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(75, 85, 99, 0.25)';
      ctx.fillRect(150, 220, 400, 150);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(150, 220, 400, 150);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`RAMPA DE GARAGEM (${slope}°)`, 230, 235);
      ctx.restore();
    }

    // Draw Parking Spot
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.heading);
    const isSpotSelected = selectedId === 'spot';

    if (isSpotSelected) {
      ctx.strokeStyle = '#f59e0b'; // Gold
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    } else {
      ctx.strokeStyle = '#38bdf8'; // Cyan
      ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
    }
    ctx.lineWidth = isSpotSelected ? 3 : 2;
    ctx.setLineDash([6, 4]);
    ctx.fillRect(-spot.width / 2, -spot.height / 2, spot.width, spot.height);
    ctx.strokeRect(-spot.width / 2, -spot.height / 2, spot.width, spot.height);
    ctx.restore();

    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.heading);
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = isSpotSelected ? '#f59e0b' : '#38bdf8';
    ctx.fillText('ESTACIONAR', -30, 3);
    ctx.restore();

    // Draw Obstacles
    obstacles.forEach((obs) => {
      const isObsSelected = selectedId === obs.id;
      ctx.save();

      // Selection ring
      if (isObsSelected) {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 2]);
        ctx.strokeRect(-obs.width / 2 - 4, -obs.height / 2 - 4, obs.width + 8, obs.height + 8);
        ctx.restore();
      }

      if (obs.type === 'car') {
        drawEditorCar(ctx, obs.x, obs.y, obs.width, obs.height, obs.heading, obs.color || '#94a3b8', 'CARRO', isObsSelected);
      } else if (obs.type === 'pilar') {
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);
        ctx.fillStyle = obs.color || '#d1d5db';
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = isObsSelected ? '#f59e0b' : '#4b5563';
        ctx.lineWidth = 2;
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.moveTo(-obs.width / 2, -obs.height / 2);
        ctx.lineTo(obs.width / 2, obs.height / 2);
        ctx.stroke();
      } else if (obs.type === 'wall' || obs.type === 'construction') {
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);
        ctx.fillStyle = obs.color || '#475569';
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = isObsSelected ? '#f59e0b' : '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

        // stripes
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        for (let j = -obs.width / 2; j < obs.width / 2; j += 15) {
          ctx.moveTo(j, -obs.height / 2);
          ctx.lineTo(j + 10, obs.height / 2);
        }
        ctx.stroke();
      } else if (obs.type === 'pedestrian') {
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);
        ctx.fillStyle = obs.color || '#a855f7';
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isObsSelected ? '#f59e0b' : '#6b21a8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // head details
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'sweeper') {
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.heading);
        ctx.fillStyle = obs.color || '#e2e8f0';
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = isObsSelected ? '#f59e0b' : '#475569';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        // sweeping brush indicators
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-obs.width / 2, -obs.height / 2 - 3, 5, 3);
        ctx.fillRect(obs.width / 2 - 5, -obs.height / 2 - 3, 5, 3);
      }

      ctx.restore();
    });

    // Draw Waypoints / Trajectories for moving obstacles
    obstacles.forEach((obs) => {
      if (!obs.waypoints || obs.waypoints.length === 0) return;
      const isSelected = selectedId === obs.id;

      ctx.save();
      if (isSelected) {
        // Draw bold, fully-visible path
        ctx.strokeStyle = '#a855f7'; // Purple
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        // Draw path line
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y);
        obs.waypoints.forEach((wp) => {
          ctx.lineTo(wp.x, wp.y);
        });
        // Close patrol loop back to current obstacle position
        ctx.lineTo(obs.x, obs.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw numbered waypoint nodes
        obs.waypoints.forEach((wp, wpIdx) => {
          const isBeingDragged = draggedWaypointIdx === wpIdx;
          
          // Outer glow
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 11, 0, Math.PI * 2);
          ctx.fillStyle = isBeingDragged ? 'rgba(245, 158, 11, 0.4)' : 'rgba(168, 85, 247, 0.3)';
          ctx.fill();

          // Core circle
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = isBeingDragged ? '#f59e0b' : '#a855f7';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((wpIdx + 1).toString(), wp.x, wp.y + 0.5);
        });
      } else {
        // Draw subtle, non-selected path
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);

        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y);
        obs.waypoints.forEach((wp) => {
          ctx.lineTo(wp.x, wp.y);
        });
        ctx.lineTo(obs.x, obs.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw small waypoint nodes
        obs.waypoints.forEach((wp) => {
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
      ctx.restore();
    });

    // Draw Player start position
    // Default size is 80x40 (width, height)
    drawEditorCar(
      ctx,
      startX,
      startY,
      80,
      40,
      startHeading,
      'rgba(225, 29, 72, 0.65)',
      'LARGADA JOGADOR',
      selectedId === 'player'
    );
  }, [startX, startY, startHeading, spot, obstacles, decorations, selectedId, draggedWaypointIdx, timeOfDay, weather, slope]);

  // Click & drag handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 0. Check waypoints of currently selected obstacle first
    if (selectedId) {
      const selectedObs = obstacles.find((obs) => obs.id === selectedId);
      if (selectedObs && selectedObs.waypoints && selectedObs.waypoints.length > 0) {
        for (let idx = 0; idx < selectedObs.waypoints.length; idx++) {
          const wp = selectedObs.waypoints[idx];
          if (Math.hypot(clickX - wp.x, clickY - wp.y) < 12) {
            setDraggedWaypointIdx(idx);
            setIsDragging(true);
            dragOffset.current = { x: clickX - wp.x, y: clickY - wp.y };
            return;
          }
        }
      }
    }

    // 1. Player
    if (Math.hypot(clickX - startX, clickY - startY) < 30) {
      setSelectedId('player');
      setIsDragging(true);
      dragOffset.current = { x: clickX - startX, y: clickY - startY };
      return;
    }

    // 2. Spot
    if (Math.hypot(clickX - spot.x, clickY - spot.y) < 35) {
      setSelectedId('spot');
      setIsDragging(true);
      dragOffset.current = { x: clickX - spot.x, y: clickY - spot.y };
      return;
    }

    // 3. Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      const radius = Math.max(20, Math.min(obs.width, obs.height) / 2 + 5);
      if (Math.hypot(clickX - obs.x, clickY - obs.y) < radius) {
        setSelectedId(obs.id);
        setIsDragging(true);
        dragOffset.current = { x: clickX - obs.x, y: clickY - obs.y };
        return;
      }
    }

    // 4. Decorations (Aesthetic Elements)
    for (let i = decorations.length - 1; i >= 0; i--) {
      const decor = decorations[i];
      const radius = Math.max(15, Math.min(decor.width, decor.height) / 2 + 5);
      if (Math.hypot(clickX - decor.x, clickY - decor.y) < radius) {
        setSelectedId(decor.id);
        setIsDragging(true);
        dragOffset.current = { x: clickX - decor.x, y: clickY - decor.y };
        return;
      }
    }

    // Clicked background -> clear selection
    setSelectedId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const targetX = Math.max(5, Math.min(795, currentX - dragOffset.current.x));
    const targetY = Math.max(5, Math.min(495, currentY - dragOffset.current.y));

    // Snap to grid (optional shift key)
    const snapGrid = e.shiftKey;
    const finalX = snapGrid ? Math.round(targetX / 10) * 10 : targetX;
    const finalY = snapGrid ? Math.round(targetY / 10) * 10 : targetY;

    // Handle dragging a waypoint
    if (draggedWaypointIdx !== null && selectedId) {
      setObstacles((prev) =>
        prev.map((obs) => {
          if (obs.id === selectedId && obs.waypoints) {
            const nextWaypoints = [...obs.waypoints];
            nextWaypoints[draggedWaypointIdx] = { x: finalX, y: finalY };
            return { ...obs, waypoints: nextWaypoints };
          }
          return obs;
        })
      );
      return;
    }

    if (!selectedId) return;

    if (selectedId === 'player') {
      setStartX(finalX);
      setStartY(finalY);
    } else if (selectedId === 'spot') {
      setSpot((prev) => ({ ...prev, x: finalX, y: finalY }));
    } else {
      if (obstacles.some((obs) => obs.id === selectedId)) {
        setObstacles((prev) =>
          prev.map((obs) => {
            if (obs.id === selectedId) {
              const dx = finalX - obs.x;
              const dy = finalY - obs.y;
              const waypoints = obs.waypoints
                ? obs.waypoints.map((wp) => ({
                    x: Math.max(0, Math.min(800, wp.x + dx)),
                    y: Math.max(0, Math.min(500, wp.y + dy))
                  }))
                : undefined;
              return { ...obs, x: finalX, y: finalY, waypoints };
            }
            return obs;
          })
        );
      } else if (decorations.some((decor) => decor.id === selectedId)) {
        setDecorations((prev) =>
          prev.map((decor) => (decor.id === selectedId ? { ...decor, x: finalX, y: finalY } : decor))
        );
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setDraggedWaypointIdx(null);
  };

  // Touch support
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = touch.clientX - rect.left;
    const clickY = touch.clientY - rect.top;

    // 0. Check waypoints of currently selected obstacle first
    if (selectedId) {
      const selectedObs = obstacles.find((obs) => obs.id === selectedId);
      if (selectedObs && selectedObs.waypoints && selectedObs.waypoints.length > 0) {
        for (let idx = 0; idx < selectedObs.waypoints.length; idx++) {
          const wp = selectedObs.waypoints[idx];
          if (Math.hypot(clickX - wp.x, clickY - wp.y) < 15) {
            setDraggedWaypointIdx(idx);
            setIsDragging(true);
            dragOffset.current = { x: clickX - wp.x, y: clickY - wp.y };
            return;
          }
        }
      }
    }

    if (Math.hypot(clickX - startX, clickY - startY) < 30) {
      setSelectedId('player');
      setIsDragging(true);
      dragOffset.current = { x: clickX - startX, y: clickY - startY };
      return;
    }

    if (Math.hypot(clickX - spot.x, clickY - spot.y) < 35) {
      setSelectedId('spot');
      setIsDragging(true);
      dragOffset.current = { x: clickX - spot.x, y: clickY - spot.y };
      return;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      const radius = Math.max(20, Math.min(obs.width, obs.height) / 2 + 5);
      if (Math.hypot(clickX - obs.x, clickY - obs.y) < radius) {
        setSelectedId(obs.id);
        setIsDragging(true);
        dragOffset.current = { x: clickX - obs.x, y: clickY - obs.y };
        return;
      }
    }

    for (let i = decorations.length - 1; i >= 0; i--) {
      const decor = decorations[i];
      const radius = Math.max(15, Math.min(decor.width, decor.height) / 2 + 5);
      if (Math.hypot(clickX - decor.x, clickY - decor.y) < radius) {
        setSelectedId(decor.id);
        setIsDragging(true);
        dragOffset.current = { x: clickX - decor.x, y: clickY - decor.y };
        return;
      }
    }

    setSelectedId(null);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    const targetX = Math.max(5, Math.min(795, currentX - dragOffset.current.x));
    const targetY = Math.max(5, Math.min(495, currentY - dragOffset.current.y));

    // Handle dragging a waypoint
    if (draggedWaypointIdx !== null && selectedId) {
      setObstacles((prev) =>
        prev.map((obs) => {
          if (obs.id === selectedId && obs.waypoints) {
            const nextWaypoints = [...obs.waypoints];
            nextWaypoints[draggedWaypointIdx] = { x: targetX, y: targetY };
            return { ...obs, waypoints: nextWaypoints };
          }
          return obs;
        })
      );
      return;
    }

    if (!selectedId) return;

    if (selectedId === 'player') {
      setStartX(targetX);
      setStartY(targetY);
    } else if (selectedId === 'spot') {
      setSpot((prev) => ({ ...prev, x: targetX, y: targetY }));
    } else {
      if (obstacles.some((obs) => obs.id === selectedId)) {
        setObstacles((prev) =>
          prev.map((obs) => {
            if (obs.id === selectedId) {
              const dx = targetX - obs.x;
              const dy = targetY - obs.y;
              const waypoints = obs.waypoints
                ? obs.waypoints.map((wp) => ({
                    x: Math.max(0, Math.min(800, wp.x + dx)),
                    y: Math.max(0, Math.min(500, wp.y + dy))
                  }))
                : undefined;
              return { ...obs, x: targetX, y: targetY, waypoints };
            }
            return obs;
          })
        );
      } else if (decorations.some((decor) => decor.id === selectedId)) {
        setDecorations((prev) =>
          prev.map((decor) => (decor.id === selectedId ? { ...decor, x: targetX, y: targetY } : decor))
        );
      }
    }
  };

  // Obstacle management
  const handleAddObstacle = (type: 'car' | 'wall' | 'pilar' | 'pedestrian' | 'sweeper') => {
    const id = `obs_${Date.now()}`;
    let newObs: Obstacle;

    if (type === 'car') {
      newObs = {
        id,
        type: 'car',
        x: 400,
        y: 250,
        width: 90,
        height: 44,
        heading: Math.PI / 2,
        color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
      };
    } else if (type === 'wall') {
      newObs = {
        id,
        type: 'wall',
        x: 400,
        y: 250,
        width: 120,
        height: 20,
        heading: 0,
        color: '#475569'
      };
    } else if (type === 'pilar') {
      newObs = {
        id,
        type: 'pilar',
        x: 400,
        y: 250,
        width: 30,
        height: 30,
        heading: 0,
        color: '#d1d5db'
      };
    } else if (type === 'pedestrian') {
      newObs = {
        id,
        type: 'pedestrian',
        x: 400,
        y: 250,
        width: 20,
        height: 20,
        heading: 0,
        color: '#a855f7',
        speed: 40,
        waypoints: [
          { x: 350, y: 250 },
          { x: 450, y: 250 }
        ],
        pedestrianName: 'Pedestre'
      };
    } else {
      newObs = {
        id,
        type: 'sweeper',
        x: 400,
        y: 250,
        width: 60,
        height: 35,
        heading: 0,
        color: '#e2e8f0',
        speed: 50,
        waypoints: [
          { x: 200, y: 250 },
          { x: 600, y: 250 }
        ]
      };
    }

    setObstacles((prev) => [...prev, newObs]);
    setSelectedId(id);
  };

  const handleAddDecoration = (type: 'line' | 'dashed-line' | 'area') => {
    const id = `decor_${Date.now()}`;
    let newDecor: Decoration;

    if (type === 'line' || type === 'dashed-line') {
      newDecor = {
        id,
        type,
        x: 400,
        y: 250,
        width: 100,
        height: 4, // thickness
        heading: 0,
        color: '#ffffff',
        opacity: 1
      };
    } else {
      newDecor = {
        id,
        type: 'area',
        x: 400,
        y: 250,
        width: 80,
        height: 60,
        heading: 0,
        color: '#ffffff',
        opacity: 0.3
      };
    }

    setDecorations((prev) => [...prev, newDecor]);
    setSelectedId(id);
  };

  const handleDeleteSelected = () => {
    if (!selectedId || selectedId === 'player' || selectedId === 'spot') return;
    setObstacles((prev) => prev.filter((obs) => obs.id !== selectedId));
    setDecorations((prev) => prev.filter((decor) => decor.id !== selectedId));
    setSelectedId(null);
  };

  const handleDuplicateSelected = () => {
    if (!selectedId || selectedId === 'player' || selectedId === 'spot') return;
    
    const targetObs = obstacles.find((obs) => obs.id === selectedId);
    if (targetObs) {
      const id = `obs_${Date.now()}`;
      const duplicate: Obstacle = {
        ...targetObs,
        id,
        x: Math.min(780, targetObs.x + 30),
        y: Math.min(480, targetObs.y + 30),
        waypoints: targetObs.waypoints ? targetObs.waypoints.map((wp) => ({ x: wp.x + 30, y: wp.y + 30 })) : undefined
      };
      setObstacles((prev) => [...prev, duplicate]);
      setSelectedId(id);
      return;
    }

    const targetDecor = decorations.find((decor) => decor.id === selectedId);
    if (targetDecor) {
      const id = `decor_${Date.now()}`;
      const duplicate: Decoration = {
        ...targetDecor,
        id,
        x: Math.min(780, targetDecor.x + 30),
        y: Math.min(480, targetDecor.y + 30),
      };
      setDecorations((prev) => [...prev, duplicate]);
      setSelectedId(id);
      return;
    }
  };

  // Property edit bindings
  const updateSelectedObstacle = (fields: Partial<Obstacle>) => {
    if (!selectedId || selectedId === 'player' || selectedId === 'spot') return;
    setObstacles((prev) =>
      prev.map((obs) => (obs.id === selectedId ? { ...obs, ...fields } : obs))
    );
  };

  const updateSelectedDecoration = (fields: Partial<Decoration>) => {
    if (!selectedId || selectedId === 'player' || selectedId === 'spot') return;
    setDecorations((prev) =>
      prev.map((decor) => (decor.id === selectedId ? { ...decor, ...fields } : decor))
    );
  };

  const selectedObstacle = obstacles.find((obs) => obs.id === selectedId);
  const selectedDecoration = decorations.find((decor) => decor.id === selectedId);

  // Package Level Assembly
  const buildLevelObject = (customId?: string): Level => {
    const id = customId || (initialLevel && initialLevel.id.startsWith('custom_') ? initialLevel.id : `custom_${Date.now()}`);
    return {
      id,
      phaseName: levelName.trim() || 'Fase Customizada',
      description: levelDesc.trim() || 'Desafio criado no editor.',
      phaseIndex: 99, // Custom indices are always high
      timeOfDay,
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
      weather,
      startX,
      startY,
      startHeading,
      spot,
      obstacles,
      decorations,
      slope: slope > 0 ? slope : undefined
    };
  };

  // Save level
  const handleSaveLevel = () => {
    const customLevel = buildLevelObject();
    StorageService.saveCustomLevel(customLevel);
    refreshCustomLevelsList();
    setToastMessage({
      text: 'Fase Customizada salva com sucesso! Ela ficará disponível no menu principal.',
      type: 'success'
    });
  };

  // Playtest level
  const handleTestLevel = () => {
    const customLevel = buildLevelObject('custom_playtest');
    onPlayLevel(customLevel);
  };

  // Import/Export
  const handleOpenExport = () => {
    const obj = buildLevelObject('custom_export');
    setJsonText(JSON.stringify(obj, null, 2));
    setJsonError('');
    setShowJsonModal(true);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.startX || !parsed.spot || !Array.isArray(parsed.obstacles)) {
        setJsonError('JSON inválido para um nível. Certifique-se de que os campos obrigatórios existem.');
        return;
      }

      // Load imported level
      setLevelName(parsed.phaseName || 'Fase Importada');
      setLevelDesc(parsed.description || 'Importada via editor.');
      setTimeOfDay(parsed.timeOfDay || 'afternoon');
      setWeather(parsed.weather || 'clear');
      setTimeLimit(parsed.timeLimit || 60);
      setSlope(parsed.slope || 0);
      setStartX(parsed.startX);
      setStartY(parsed.startY);
      setStartHeading(parsed.startHeading || 0);
      setSpot(parsed.spot);
      setObstacles(
        parsed.obstacles.map((obs: any, idx: number) => ({
          ...obs,
          id: obs.id || `obs_imported_${idx}_${Date.now()}`
        }))
      );
      setDecorations(
        Array.isArray(parsed.decorations)
          ? parsed.decorations.map((decor: any, idx: number) => ({
              ...decor,
              id: decor.id || `decor_imported_${idx}_${Date.now()}`
            }))
          : []
      );
      setSelectedId(null);
      setShowJsonModal(false);
      setToastMessage({
        text: 'Fase importada com sucesso!',
        type: 'success'
      });
    } catch (e: any) {
      setJsonError(`Erro ao decodificar JSON: ${e.message}`);
    }
  };

  return (
    <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-6 relative" id="level-editor-container">
      {/* Toast Alert overlay */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl font-medium text-sm ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
            }`}
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <div className={`w-2 h-2 rounded-full ${toastMessage.type === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`} />
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Controls Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shrink-0">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <span className="text-xs font-mono font-bold text-slate-400">EDITOR DE FASES</span>
        </div>

        {/* Base Level Selection Loader */}
        <div className="bg-slate-950/60 p-3 rounded border border-slate-800/80">
          <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block mb-1.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-rose-500" /> Usar Fase Existente como Base
          </label>
          <select
            value={selectedBaseId}
            onChange={handleBaseChange}
            className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-medium focus:ring-1 focus:ring-rose-500 focus:outline-none"
            id="editor-base-level-select"
          >
            {baseLevels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.phaseIndex === 99 ? '⭐ ' : ''}Fase {l.phaseIndex}: {l.phaseName}
              </option>
            ))}
          </select>
        </div>

        {/* Level Settings Block */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-bold tracking-wider">CONFIGURAÇÕES DA FASE</span>

          <div>
            <label className="text-[10px] text-slate-400 font-medium block mb-1">Nome da Fase</label>
            <input
              type="text"
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100"
              placeholder="Ex: Baliza Apertada"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-medium block mb-1">Descrição</label>
            <textarea
              value={levelDesc}
              onChange={(e) => setLevelDesc(e.target.value)}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 h-16 resize-none"
              placeholder="Descreva o desafio desta vaga."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-medium block mb-1">Horário</label>
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value as TimeSlot)}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100"
              >
                <option value="morning">Manhã</option>
                <option value="afternoon">Tarde</option>
                <option value="evening">Anoitecer</option>
                <option value="night">Noite (Faróis)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-medium block mb-1">Clima</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value as 'clear' | 'rain')}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100"
              >
                <option value="clear">Ensolarado</option>
                <option value="rain">Chuva ⛈️</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-medium block mb-1">Tempo Limite (s)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100 font-mono"
                min="0"
                max="300"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-medium block mb-1">Inclinação Rampa (°)</label>
              <input
                type="number"
                value={slope}
                onChange={(e) => setSlope(Math.max(0, Math.min(15, parseInt(e.target.value) || 0)))}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100 font-mono"
                min="0"
                max="15"
                title="Insere efeito gravitacional na rampa de garagem"
              />
            </div>
          </div>
        </div>

        {/* Elements List Selection Panel */}
        <div className="flex flex-col gap-2.5 border-t border-slate-800/80 pt-4" id="editor-scene-elements-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">ELEMENTOS DA CENA</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
              {2 + obstacles.length + decorations.length} itens
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {/* Player */}
            <button
              onClick={() => setSelectedId('player')}
              className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between border transition-all ${
                selectedId === 'player'
                  ? 'bg-rose-500/10 border-rose-500 text-rose-200 font-bold'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
              id="select-item-player"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-rose-500 shrink-0" />
                <span className="truncate">🚗 Largada do Jogador</span>
              </div>
              <span className="text-[9px] text-slate-600 font-mono shrink-0">({Math.round(startX)},{Math.round(startY)})</span>
            </button>

            {/* Parking Spot */}
            <button
              onClick={() => setSelectedId('spot')}
              className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between border transition-all ${
                selectedId === 'spot'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-200 font-bold'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
              id="select-item-spot"
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-cyan-400 shrink-0" />
                <span className="truncate">🏁 Vaga de Destino</span>
              </div>
              <span className="text-[9px] text-slate-600 font-mono shrink-0">({Math.round(spot.x)},{Math.round(spot.y)})</span>
            </button>

            {/* Obstacles list */}
            {obstacles.map((obs, idx) => {
              const isSelected = selectedId === obs.id;
              const typeLabel = obs.type === 'car' ? 'Carro' : obs.type === 'wall' ? 'Parede' : obs.type === 'pilar' ? 'Pilar' : obs.type === 'pedestrian' ? 'Pedestre' : 'Varrer';
              const icon = obs.type === 'car' ? '🚗' : obs.type === 'wall' ? '🧱' : obs.type === 'pilar' ? '🗼' : obs.type === 'pedestrian' ? '🚶' : '🧹';
              return (
                <button
                  key={obs.id}
                  onClick={() => setSelectedId(obs.id)}
                  className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-200 font-bold'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                  id={`select-item-obstacle-${obs.id}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded shrink-0 border border-slate-900/30"
                      style={{ backgroundColor: obs.color || '#f59e0b' }}
                    />
                    <span className="truncate">{icon} {typeLabel} #{idx + 1}</span>
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0 ml-1">({Math.round(obs.x)},{Math.round(obs.y)})</span>
                </button>
              );
            })}

            {/* Decorations list */}
            {decorations.map((decor, idx) => {
              const isSelected = selectedId === decor.id;
              const typeLabel = decor.type === 'line' ? 'Linha Contínua' : decor.type === 'dashed-line' ? 'Linha Tracejada' : 'Área Estética';
              const icon = decor.type === 'line' ? '➖' : decor.type === 'dashed-line' ? '╍' : '⬜';
              return (
                <button
                  key={decor.id}
                  onClick={() => setSelectedId(decor.id)}
                  className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'bg-sky-500/10 border-sky-500 text-sky-200 font-bold'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                  id={`select-item-decor-${decor.id}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded shrink-0 border border-slate-900/30"
                      style={{ backgroundColor: decor.color || '#38bdf8' }}
                    />
                    <span className="truncate">{icon} {typeLabel} #{idx + 1}</span>
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0 ml-1">({Math.round(decor.x)},{Math.round(decor.y)})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Add Obstacles Buttons Panel */}
        <div className="flex flex-col gap-2.5 border-t border-slate-800/80 pt-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-bold tracking-wider">ADICIONAR OBSTÁCULOS</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddObstacle('car')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-xs font-semibold text-slate-200 flex items-center justify-center gap-1"
            >
              <Car className="w-3.5 h-3.5 text-rose-500" /> + Carro
            </button>
            <button
              onClick={() => handleAddObstacle('wall')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-xs font-semibold text-slate-200 flex items-center justify-center gap-1"
            >
              <div className="w-3.5 h-1.5 bg-slate-400 rounded-sm" /> + Parede
            </button>
            <button
              onClick={() => handleAddObstacle('pilar')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-xs font-semibold text-slate-200 flex items-center justify-center gap-1"
            >
              <div className="w-3 h-3 bg-slate-300 border border-slate-500 rounded-sm" /> + Pilar
            </button>
            <button
              onClick={() => handleAddObstacle('pedestrian')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-xs font-semibold text-slate-200 flex items-center justify-center gap-1"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" /> + Pedestre
            </button>
          </div>
        </div>

        {/* Quick Add Aesthetic Elements Panel */}
        <div className="flex flex-col gap-2.5 border-t border-slate-800/80 pt-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 font-bold tracking-wider">ELEMENTOS ESTÉTICOS</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddDecoration('line')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[11px] font-semibold text-slate-200 flex items-center justify-center gap-1.5"
            >
              <div className="w-4 h-1 bg-sky-400 rounded-sm" /> Linha Contínua
            </button>
            <button
              onClick={() => handleAddDecoration('dashed-line')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[11px] font-semibold text-slate-200 flex items-center justify-center gap-1.5"
            >
              <div className="w-4 h-1 border-t-2 border-dashed border-sky-400" /> Linha Tracejada
            </button>
            <button
              onClick={() => handleAddDecoration('area')}
              className="px-2 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-[11px] font-semibold text-slate-200 flex items-center justify-center gap-1.5 col-span-2"
            >
              <div className="w-4 h-3 bg-sky-400/30 border border-sky-400 rounded-sm" /> Área Estética
            </button>
          </div>
        </div>

        {/* Editor Main Actions */}
        <div className="flex flex-col gap-2 border-t border-slate-800/80 pt-4 mt-auto">
          <button
            onClick={handleTestLevel}
            className="w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded flex items-center justify-center gap-1.5 transition-colors shadow-lg"
          >
            <Play className="w-4 h-4 fill-white" />
            Testar Fase Criada
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSaveLevel}
              className="px-2.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase rounded flex items-center justify-center gap-1 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            <button
              onClick={handleOpenExport}
              className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold uppercase rounded flex items-center justify-center gap-1 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5" /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Editor Workspace */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Helper Banner bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-slate-300">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p>
              <strong>Arraste os elementos</strong> na tela para redefinir as posições ou <strong>use as setas do teclado</strong> para mover o elemento selecionado com precisão (use <kbd className="bg-slate-950 border border-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">Shift</kbd> para mover 10px). Clique em qualquer elemento ou use a <strong>Lista de Elementos</strong> para selecioná-lo.
            </p>
          </div>
        </div>

        {/* Live Canvas Viewport */}
        <div className="relative border-4 border-slate-900 rounded-xl bg-slate-950 overflow-hidden shadow-2xl flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasMouseUp}
            className="w-full max-w-[800px] aspect-[8/5] bg-slate-900 cursor-move"
          />
        </div>

        {/* Bottom Property Editor (Dynamic context-dependent card) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 min-h-[140px] flex flex-col justify-center">
          {selectedId === null && (
            <div className="text-center py-4">
              <span className="text-slate-400 font-medium text-xs block">Nenhum elemento selecionado</span>
              <p className="text-[10px] text-slate-500 mt-1">
                Clique na vaga de estacionamento (Cyan), na largada do carro (Vermelho), ou em qualquer obstáculo para editar suas propriedades específicas.
              </p>
            </div>
          )}

          {selectedId === 'player' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Flag className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold uppercase text-slate-200">Largada do Carro do Jogador</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição X</label>
                  <input
                    type="number"
                    value={Math.round(startX)}
                    onChange={(e) => setStartX(Math.max(0, Math.min(800, parseInt(e.target.value) || 0)))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição Y</label>
                  <input
                    type="number"
                    value={Math.round(startY)}
                    onChange={(e) => setStartY(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Direção (Ângulo: {Math.round((startHeading * 180) / Math.PI)}°)</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.PI * 2}
                    step="0.05"
                    value={startHeading}
                    onChange={(e) => setStartHeading(parseFloat(e.target.value))}
                    className="w-full accent-rose-500 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedId === 'spot' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Target className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold uppercase text-slate-200">Vaga de Estacionamento (Meta)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição X</label>
                  <input
                    type="number"
                    value={Math.round(spot.x)}
                    onChange={(e) => setSpot((prev) => ({ ...prev, x: Math.max(0, Math.min(800, parseInt(e.target.value) || 0)) }))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição Y</label>
                  <input
                    type="number"
                    value={Math.round(spot.y)}
                    onChange={(e) => setSpot((prev) => ({ ...prev, y: Math.max(0, Math.min(500, parseInt(e.target.value) || 0)) }))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Largura (px)</label>
                  <input
                    type="number"
                    value={spot.width}
                    onChange={(e) => setSpot((prev) => ({ ...prev, width: Math.max(20, parseInt(e.target.value) || 20) }))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Altura (px)</label>
                  <input
                    type="number"
                    value={spot.height}
                    onChange={(e) => setSpot((prev) => ({ ...prev, height: Math.max(20, parseInt(e.target.value) || 20) }))}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-slate-400 block mb-1">Ângulo: {Math.round((spot.heading * 180) / Math.PI)}°</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.PI * 2}
                    step="0.05"
                    value={spot.heading}
                    onChange={(e) => setSpot((prev) => ({ ...prev, heading: parseFloat(e.target.value) }))}
                    className="w-full accent-sky-400 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedId !== null && selectedId !== 'player' && selectedId !== 'spot' && selectedObstacle && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono font-bold text-amber-500 uppercase">
                    {selectedObstacle.type}
                  </span>
                  <span className="text-xs font-bold uppercase text-slate-200">Propriedades do Obstáculo</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDuplicateSelected}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Copy className="w-3 h-3 text-sky-400" /> Duplicar
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="px-2 py-1 bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900 text-slate-300 hover:text-rose-400 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" /> Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição X</label>
                  <input
                    type="number"
                    value={Math.round(selectedObstacle.x)}
                    onChange={(e) => updateSelectedObstacle({ x: Math.max(0, Math.min(800, parseInt(e.target.value) || 0)) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedObstacle.y)}
                    onChange={(e) => updateSelectedObstacle({ y: Math.max(0, Math.min(500, parseInt(e.target.value) || 0)) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Largura / Raio</label>
                  <input
                    type="number"
                    value={selectedObstacle.width}
                    onChange={(e) => updateSelectedObstacle({ width: Math.max(5, parseInt(e.target.value) || 5) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Altura</label>
                  <input
                    type="number"
                    value={selectedObstacle.height}
                    onChange={(e) => updateSelectedObstacle({ height: Math.max(5, parseInt(e.target.value) || 5) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                    disabled={selectedObstacle.type === 'pedestrian'}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-slate-400 block mb-1">Rotacionar: {Math.round((selectedObstacle.heading * 180) / Math.PI)}°</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.PI * 2}
                    step="0.05"
                    value={selectedObstacle.heading}
                    onChange={(e) => updateSelectedObstacle({ heading: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Advanced or dynamic features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-3 mt-1">
                <div>
                  <label className="text-[10px] text-slate-400 font-medium block mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-sky-400" /> Cor Visual
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateSelectedObstacle({ color: c })}
                        className={`w-6 h-6 rounded-full border transition-all ${
                          selectedObstacle.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {(selectedObstacle.type === 'pedestrian' || selectedObstacle.type === 'sweeper') && (
                  <div className="col-span-2 md:col-span-5 border-t border-slate-800/60 pt-3 mt-1 flex flex-col gap-3">
                    <div className="flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-slate-200">Configuração de Movimentação (Trajeto de Patrulha)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Velocidade do Movimento (px/s)</label>
                        <input
                          type="number"
                          value={selectedObstacle.speed || 0}
                          onChange={(e) => updateSelectedObstacle({ speed: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                        />
                      </div>
                      {selectedObstacle.type === 'pedestrian' && (
                        <>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Nome do Pedestre</label>
                            <input
                              type="text"
                              value={selectedObstacle.pedestrianName || ''}
                              onChange={(e) => updateSelectedObstacle({ pedestrianName: e.target.value })}
                              className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100"
                              placeholder="Ex: Carlos, Ana..."
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1 flex items-center gap-1">
                              <Smile className="w-3 h-3 text-emerald-400" /> Humor do NPC
                            </label>
                            <select
                              value={selectedObstacle.mood || 'indifferent'}
                              onChange={(e) => updateSelectedObstacle({ mood: e.target.value as NPCMood })}
                              className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100"
                            >
                              <option value="indifferent">😐 Indiferente</option>
                              <option value="anxious">😰 Ansioso</option>
                              <option value="ironic">😏 Irônico</option>
                              <option value="optimistic">😊 Otimista</option>
                              <option value="dramatic">😭 Dramático</option>
                              <option value="expert">😎 Profissional</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Waypoints Editor UI */}
                    <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/80 flex flex-col gap-2 mt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-300 block">Pontos do Trajeto ({selectedObstacle.waypoints?.length || 0})</span>
                          <span className="text-[10px] text-slate-500">Dica: Você pode arrastar os nós roxos numerados diretamente na tela!</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const current = selectedObstacle.waypoints || [];
                              let newWp = { x: selectedObstacle.x + 50, y: selectedObstacle.y + 50 };
                              if (current.length > 0) {
                                const last = current[current.length - 1];
                                newWp = {
                                  x: Math.max(10, Math.min(790, last.x + 40)),
                                  y: Math.max(10, Math.min(490, last.y + 40))
                                };
                              }
                              updateSelectedObstacle({ waypoints: [...current, newWp] });
                            }}
                            className="px-2.5 py-1 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/80 hover:border-purple-700 text-purple-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Plus className="w-3 h-3 text-purple-400" /> Adicionar Ponto
                          </button>
                          {(selectedObstacle.waypoints?.length || 0) > 0 && (
                            <button
                              onClick={() => updateSelectedObstacle({ waypoints: [] })}
                              className="px-2.5 py-1 bg-rose-950/30 hover:bg-rose-900/30 border border-rose-900/50 hover:border-rose-700 text-rose-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                            >
                              <Trash className="w-3 h-3 text-rose-400" /> Limpar Trajeto
                            </button>
                          )}
                        </div>
                      </div>

                      {/* List of Waypoints */}
                      {!selectedObstacle.waypoints || selectedObstacle.waypoints.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-slate-800 rounded bg-slate-900/20">
                          <span className="text-[11px] text-slate-500">Nenhum ponto configurado. O pedestre ficará parado no local de origem.</span>
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-1.5 mt-1 scrollbar-thin scrollbar-thumb-slate-800">
                          {selectedObstacle.waypoints.map((wp, wpIdx) => (
                            <div key={wpIdx} className="flex items-center justify-between gap-2 bg-slate-900/40 border border-slate-800/50 rounded px-2.5 py-1.5 hover:border-slate-700 transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-900/30 border border-purple-800/50 text-[10px] text-purple-300 flex items-center justify-center font-bold">
                                  {wpIdx + 1}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-mono">X:</span>
                                  <input
                                    type="number"
                                    value={Math.round(wp.x)}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      const next = (selectedObstacle.waypoints || []).map((p, idx) => idx === wpIdx ? { ...p, x: Math.max(5, Math.min(795, val)) } : p);
                                      updateSelectedObstacle({ waypoints: next });
                                    }}
                                    className="w-16 text-xs bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-slate-200 font-mono text-center"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400 font-mono">Y:</span>
                                  <input
                                    type="number"
                                    value={Math.round(wp.y)}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      const next = (selectedObstacle.waypoints || []).map((p, idx) => idx === wpIdx ? { ...p, y: Math.max(5, Math.min(495, val)) } : p);
                                      updateSelectedObstacle({ waypoints: next });
                                    }}
                                    className="w-16 text-xs bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-slate-200 font-mono text-center"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  disabled={wpIdx === 0}
                                  onClick={() => {
                                    const next = [...(selectedObstacle.waypoints || [])];
                                    const temp = next[wpIdx];
                                    next[wpIdx] = next[wpIdx - 1];
                                    next[wpIdx - 1] = temp;
                                    updateSelectedObstacle({ waypoints: next });
                                  }}
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Subir na pilha"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={wpIdx === selectedObstacle.waypoints.length - 1}
                                  onClick={() => {
                                    const next = [...(selectedObstacle.waypoints || [])];
                                    const temp = next[wpIdx];
                                    next[wpIdx] = next[wpIdx + 1];
                                    next[wpIdx + 1] = temp;
                                    updateSelectedObstacle({ waypoints: next });
                                  }}
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Descer na pilha"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    const next = (selectedObstacle.waypoints || []).filter((_, idx) => idx !== wpIdx);
                                    updateSelectedObstacle({ waypoints: next });
                                  }}
                                  className="p-1 hover:bg-rose-950/20 rounded text-slate-500 hover:text-rose-400"
                                  title="Remover ponto"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedId !== null && selectedId !== 'player' && selectedId !== 'spot' && selectedDecoration && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono font-bold text-sky-400 uppercase">
                    {selectedDecoration.type === 'line' ? 'Linha Contínua' : selectedDecoration.type === 'dashed-line' ? 'Linha Tracejada' : 'Área Estética'}
                  </span>
                  <span className="text-xs font-bold uppercase text-slate-200">Propriedades do Elemento Estético</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDuplicateSelected}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Copy className="w-3 h-3 text-sky-400" /> Duplicar
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="px-2 py-1 bg-slate-950 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900 text-slate-300 hover:text-rose-400 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" /> Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição X</label>
                  <input
                    type="number"
                    value={Math.round(selectedDecoration.x)}
                    onChange={(e) => updateSelectedDecoration({ x: Math.max(0, Math.min(800, parseInt(e.target.value) || 0)) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Posição Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedDecoration.y)}
                    onChange={(e) => updateSelectedDecoration({ y: Math.max(0, Math.min(500, parseInt(e.target.value) || 0)) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    {selectedDecoration.type === 'area' ? 'Largura' : 'Comprimento'}
                  </label>
                  <input
                    type="number"
                    value={selectedDecoration.width}
                    onChange={(e) => updateSelectedDecoration({ width: Math.max(5, parseInt(e.target.value) || 5) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    {selectedDecoration.type === 'area' ? 'Altura' : 'Espessura'}
                  </label>
                  <input
                    type="number"
                    value={selectedDecoration.height}
                    onChange={(e) => updateSelectedDecoration({ height: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-slate-400 block mb-1">Rotacionar: {Math.round((selectedDecoration.heading * 180) / Math.PI)}°</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.PI * 2}
                    step="0.05"
                    value={selectedDecoration.heading}
                    onChange={(e) => updateSelectedDecoration({ heading: parseFloat(e.target.value) })}
                    className="w-full accent-sky-500 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>
              </div>

              {/* Color & Opacity tools */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-3 mt-1">
                <div>
                  <label className="text-[10px] text-slate-400 font-medium block mb-1.5 flex items-center gap-1">
                    <Palette className="w-3 h-3 text-sky-400" /> Cor Visual
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative w-8 h-8 rounded overflow-hidden border border-slate-700 bg-slate-950 shrink-0">
                      <input
                        type="color"
                        value={selectedDecoration.color.startsWith('rgba') ? '#ffffff' : selectedDecoration.color}
                        onChange={(e) => updateSelectedDecoration({ color: e.target.value })}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div
                        className="w-full h-full"
                        style={{ backgroundColor: selectedDecoration.color }}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {['#ffffff', '#fef08a', '#3b82f6', '#ef4444', '#10b981', '#f97316', '#7c3aed', '#94a3b8', '#000000'].map((c) => (
                        <button
                          key={c}
                          onClick={() => updateSelectedDecoration({ color: c })}
                          className={`w-6 h-6 rounded-full border transition-all ${
                            selectedDecoration.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Opacidade: {Math.round((selectedDecoration.opacity !== undefined ? selectedDecoration.opacity : 1) * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedDecoration.opacity !== undefined ? selectedDecoration.opacity : 1}
                    onChange={(e) => updateSelectedDecoration({ opacity: parseFloat(e.target.value) })}
                    className="w-full accent-sky-400 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer mt-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* JSON Modal for Exporting/Importing */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-100">Exportar ou Importar via JSON</h4>
              <p className="text-xs text-slate-400 mt-1">
                Copie o JSON abaixo para compartilhar com outros, ou cole um JSON de fase existente e clique em Importar.
              </p>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full h-64 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded p-3 text-slate-300 resize-none focus:outline-none focus:border-slate-700"
            />

            {jsonError && <p className="text-xs text-rose-500 font-mono font-medium">{jsonError}</p>}

            <div className="flex gap-2 justify-end border-t border-slate-800 pt-3 mt-1">
              <button
                onClick={() => setShowJsonModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded"
              >
                Fechar
              </button>
              <button
                onClick={handleImportJson}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded flex items-center gap-1"
              >
                Importar JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
