/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Polygon {
  points: Vec2[];
}

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export type NPCMood = 'anxious' | 'ironic' | 'optimistic' | 'indifferent' | 'dramatic' | 'expert';

export type DialogTrigger =
  | 'near_miss'
  | 'light_hit'
  | 'hard_hit'
  | 'perfect_park'
  | 'too_slow'
  | 'blocked_sidewalk'
  | 'elegant_move'
  | 'near_pedestrian';

export interface DialogueLine {
  id: string;
  mood: NPCMood;
  trigger: DialogTrigger;
  text: string[]; // Sequential speech bubbles
  weight: number;
  cooldown: number; // in number of triggers/events
  escalation?: number;
  requiresMemory?: string;
  contexts?: TimeSlot[];
}

export interface GhostFrame {
  x: number;
  y: number;
  heading: number;
  t: number;
}

export interface GhostRecord {
  levelId: string;
  timestamp: string; // e.g., "Terça, 23:14"
  frames: GhostFrame[];
  moves: number;
  duration: number;
}

export interface CNHState {
  points: number; // 0 to 20
  status: 'maximum' | 'normal' | 'warning' | 'critical' | 'suspended';
  history: {
    event: string;
    pointsDelta: number;
    timestamp: number;
  }[];
  styleNickname: string; // "O Cirúrgico", "O Temerário", etc.
  totalCollisions: number;
  totalPerfectParks: number;
  totalManeuvers: number;
}

export interface Obstacle {
  id: string;
  type: 'wall' | 'car' | 'pilar' | 'construction' | 'pedestrian' | 'sweeper';
  x: number;
  y: number;
  width: number;
  height: number;
  heading: number;
  color?: string;
  // Dynamic behavior for pedestrians/moving cars
  speed?: number;
  waypoints?: Vec2[];
  currentWaypointIdx?: number;
  pedestrianName?: string;
  mood?: NPCMood;
}

export interface ParkingSpot {
  x: number;
  y: number;
  width: number;
  height: number;
  heading: number; // angle
  toleranceHeading: number; // in radians
  toleranceOffset: number; // in pixels (e.g. 15px)
}

export interface Decoration {
  id: string;
  type: 'line' | 'dashed-line' | 'area';
  x: number;
  y: number;
  width: number;
  height: number;
  heading: number;
  color: string;
  opacity?: number;
}

export interface Level {
  id: string;
  phaseName: string; // "Street parking", "Night drive", etc.
  description: string;
  phaseIndex: number; // 1 to 6
  timeOfDay: TimeSlot;
  timeLimit?: number; // in seconds
  weather: 'clear' | 'rain';
  // Vehicle starting pos
  startX: number;
  startY: number;
  startHeading: number;
  // Spot
  spot: ParkingSpot;
  // Obstacles
  obstacles: Obstacle[];
  // Decorations (aesthetic elements rendered below others)
  decorations?: Decoration[];
  // Slope for multilevel garage (influences gravity)
  slope?: number; // in degrees
  // Tight squeeze zones (smaller target box)
  tightSqueezeMultiplier?: number; // e.g. 0.7 for 30% smaller
  patienceTime?: number; // for cars behind in F5
}

export interface GameConfig {
  wheelBase: number; // e.g., 54 px (2.7m * 20px/m)
  maxSteerAngle: number; // 0.6 rad
  maxSpeed: number; // 160 px/s (8m/s)
  maxReverseSpeed: number; // 80 px/s (4m/s)
  acceleration: number; // 80 px/s^2 (4m/s^2)
  brakeForce: number; // 160 px/s^2 (8m/s^2)
  friction: number; // 0.92 friction per frame (dt-based)
}
