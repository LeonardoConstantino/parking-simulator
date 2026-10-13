/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vec2 } from '../types';

/**
 * Basic Vector math utilities
 */
export const Vec = {
  add(v1: Vec2, v2: Vec2): Vec2 {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  },
  sub(v1: Vec2, v2: Vec2): Vec2 {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  },
  mult(v: Vec2, n: number): Vec2 {
    return { x: v.x * n, y: v.y * n };
  },
  dot(v1: Vec2, v2: Vec2): number {
    return v1.x * v2.x + v1.y * v2.y;
  },
  perp(v: Vec2): Vec2 {
    return { x: -v.y, y: v.x };
  },
  len(v: Vec2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  },
  normalize(v: Vec2): Vec2 {
    const l = Vec.len(v);
    if (l === 0) return { x: 0, y: 0 };
    return { x: v.x / l, y: v.y / l };
  },
  dist(v1: Vec2, v2: Vec2): number {
    return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
  },
  rotate(v: Vec2, angle: number): Vec2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos
    };
  }
};

/**
 * Returns the 4 corner points of an Oriented Bounding Box (OBB)
 */
export function getOBBPoints(
  cx: number,
  cy: number,
  width: number,
  height: number,
  heading: number
): Vec2[] {
  const halfW = width / 2;
  const halfH = height / 2;

  // Local coordinates
  const localCorners = [
    { x: -halfW, y: -halfH }, // Top-Left
    { x: halfW, y: -halfH },  // Top-Right
    { x: halfW, y: halfH },   // Bottom-Right
    { x: -halfW, y: halfH }   // Bottom-Left
  ];

  // Rotate and translate
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);

  return localCorners.map((pt) => ({
    x: cx + (pt.x * cos - pt.y * sin),
    y: cy + (pt.x * sin + pt.y * cos)
  }));
}

/**
 * Separating Axis Theorem (SAT) for 2D Polygons (including OBBs)
 */
export function isColliding(poly1: Vec2[], poly2: Vec2[]): boolean {
  const polys = [poly1, poly2];

  for (let p = 0; p < polys.length; p++) {
    const poly = polys[p];
    for (let i = 0; i < poly.length; i++) {
      // Get edge vector
      const nextIndex = (i + 1) % poly.length;
      const edge = Vec.sub(poly[nextIndex], poly[i]);

      // Get perpendicular axis
      const axis = Vec.normalize(Vec.perp(edge));

      // Project both polygons onto axis
      let min1 = Infinity, max1 = -Infinity;
      for (let j = 0; j < poly1.length; j++) {
        const proj = Vec.dot(poly1[j], axis);
        if (proj < min1) min1 = proj;
        if (proj > max1) max1 = proj;
      }

      let min2 = Infinity, max2 = -Infinity;
      for (let j = 0; j < poly2.length; j++) {
        const proj = Vec.dot(poly2[j], axis);
        if (proj < min2) min2 = proj;
        if (proj > max2) max2 = proj;
      }

      // Check for separation gap
      if (max1 < min2 || max2 < min1) {
        return false; // Found separating axis, no collision
      }
    }
  }

  return true; // Overlap on all axes, collision exists
}

/**
 * Calculates the shortest distance from point p to line segment ab
 */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = Vec.sub(b, a);
  const ap = Vec.sub(p, a);
  const abLenSq = ab.x * ab.x + ab.y * ab.y;

  if (abLenSq === 0) return Vec.dist(p, a);

  // Projection factor (clamped to 0..1 to stay on segment)
  let t = Vec.dot(ap, ab) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = Vec.add(a, Vec.mult(ab, t));
  return Vec.dist(p, proj);
}

/**
 * Shortest distance from a point to a polygon's boundary segments
 */
export function distToPolygon(p: Vec2, poly: Vec2[]): number {
  let minDist = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dist = distToSegment(p, a, b);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Check if a point is inside a polygon (ray-casting algorithm)
 */
export function isPointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;

    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Kinematic Bicycle Model equations
 */
export function updateVehicleKinematics(
  car: {
    x: number;
    y: number;
    heading: number;
    velocity: number;
    steerAngle: number;
  },
  inputs: {
    throttle: number; // -1 to 1 (-1 for brake/reverse, 1 for forward, 0 for idle)
    steer: number;    // -1 to 1 (left to right)
  },
  dt: number,
  config: {
    wheelBase: number;
    maxSteerAngle: number;
    maxSpeed: number;
    maxReverseSpeed: number;
    acceleration: number;
    brakeForce: number;
    friction: number;
    gravityEffect?: number; // e.g. from rampa: gravity = 0.3 * Math.sin(slope)
  }
): {
  x: number;
  y: number;
  heading: number;
  velocity: number;
  steerAngle: number;
} {
  // 1. Steering target and interpolation (Steering with smoothing)
  const targetSteer = inputs.steer * config.maxSteerAngle;
  // steerAngle += (targetSteer - steerAngle) * min(dt * 8, 1)
  const newSteerAngle = car.steerAngle + (targetSteer - car.steerAngle) * Math.min(dt * 8, 1);

  // 2. Compute acceleration/deceleration forces
  let currentAcc = 0;
  const isMovingForward = car.velocity > 0.05;
  const isMovingReverse = car.velocity < -0.05;

  if (inputs.throttle > 0) {
    if (isMovingReverse) {
      // Braking while reversing
      currentAcc = config.brakeForce * inputs.throttle;
    } else {
      // Accelerating forward
      currentAcc = config.acceleration * inputs.throttle;
    }
  } else if (inputs.throttle < 0) {
    if (isMovingForward) {
      // Braking while moving forward
      currentAcc = -config.brakeForce * Math.abs(inputs.throttle);
    } else {
      // Accelerating in reverse
      currentAcc = -config.acceleration * Math.abs(inputs.throttle);
    }
  }

  // Apply gravity slope effect if any (e.g. F6 Garage ramp)
  if (config.gravityEffect) {
    // gravityEffect pulls the car down the slope
    // In our top down setup, let's say the ramp pulls toward the bottom-left/left (or back along heading, or absolute direction)
    // Let's pull the car backward or forward based on heading relative to slope direction.
    // For multilevel garage, the rampa is sloped downwards, let's pull car down the slope (direction is heading dependent or static)
    // We'll apply it directly as a constant deceleration/acceleration on velocity
    currentAcc += config.gravityEffect;
  }

  // 3. Integrate Velocity
  let newVelocity = car.velocity + currentAcc * dt;

  // Apply natural rolling friction when not throttling
  if (inputs.throttle === 0) {
    newVelocity *= Math.pow(config.friction, dt * 60);
    // Snapping to zero if very slow
    if (Math.abs(newVelocity) < 2) {
      newVelocity = 0;
    }
  }

  // Cap speed
  if (newVelocity > config.maxSpeed) {
    newVelocity = config.maxSpeed;
  } else if (newVelocity < -config.maxReverseSpeed) {
    newVelocity = -config.maxReverseSpeed;
  }

  // 4. Kinematic Bicycle Model formulas
  // angularVelocity = velocity / (wheelBase / tan(steerAngle))
  // We guard against division by zero (when steerAngle is zero)
  let angularVelocity = 0;
  if (Math.abs(newSteerAngle) > 0.001) {
    angularVelocity = newVelocity / (config.wheelBase / Math.tan(newSteerAngle));
  }

  // heading = heading + angularVelocity * dt
  let newHeading = car.heading + angularVelocity * dt;

  // Keep heading in [-PI, PI] range
  newHeading = Math.atan2(Math.sin(newHeading), Math.cos(newHeading));

  // x = x + velocity * cos(heading) * dt
  // y = y + velocity * sin(heading) * dt
  const newX = car.x + newVelocity * Math.cos(newHeading) * dt;
  const newY = car.y + newVelocity * Math.sin(newHeading) * dt;

  return {
    x: newX,
    y: newY,
    heading: newHeading,
    velocity: newVelocity,
    steerAngle: newSteerAngle
  };
}
