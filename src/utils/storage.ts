/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CNHState, GhostRecord, GhostFrame, Level } from '../types';

const CNH_KEY = 'parking2d_cnh_state';
const GHOST_PREFIX = 'parking2d_ghost_';
const UNLOCKED_KEY = 'parking2d_unlocked_levels';

const INITIAL_CNH: CNHState = {
  points: 20,
  status: 'maximum',
  history: [
    {
      event: 'CNH Emitida com sucesso',
      pointsDelta: 0,
      timestamp: Date.now()
    }
  ],
  styleNickname: 'O Moderado',
  totalCollisions: 0,
  totalPerfectParks: 0,
  totalManeuvers: 0
};

const CUSTOM_LEVELS_KEY = 'parking2d_custom_levels';

export const StorageService = {
  getCNH(): CNHState {
    const data = localStorage.getItem(CNH_KEY);
    if (!data) return INITIAL_CNH;
    try {
      const parsed = JSON.parse(data);
      // Ensure history structure is preserved
      if (!parsed.history) parsed.history = [];
      return parsed;
    } catch (e) {
      return INITIAL_CNH;
    }
  },

  saveCNH(state: CNHState): void {
    localStorage.setItem(CNH_KEY, JSON.stringify(state));
  },

  updateCNHPoints(eventDescription: string, delta: number): CNHState {
    const cnh = this.getCNH();

    // Apply delta and clamp
    const oldPoints = cnh.points;
    let newPoints = cnh.points + delta;
    newPoints = Math.max(0, Math.min(20, newPoints));

    // Update statistics
    if (delta < 0) {
      cnh.totalCollisions += 1;
    }
    if (eventDescription.toLowerCase().includes('perfeita')) {
      cnh.totalPerfectParks += 1;
    }
    cnh.totalManeuvers += 1;

    // Add history item
    cnh.points = newPoints;
    cnh.history.unshift({
      event: eventDescription,
      pointsDelta: newPoints - oldPoints,
      timestamp: Date.now()
    });

    // Limit history length to 50
    if (cnh.history.length > 50) {
      cnh.history = cnh.history.slice(0, 50);
    }

    // Recalculate status
    if (cnh.points === 20) {
      cnh.status = 'maximum';
    } else if (cnh.points >= 10) {
      cnh.status = 'normal';
    } else if (cnh.points >= 5) {
      cnh.status = 'warning';
    } else if (cnh.points >= 1) {
      cnh.status = 'critical';
    } else {
      cnh.status = 'suspended';
    }

    // Recalculate Driver Nickname based on style
    if (cnh.totalCollisions > 15) {
      cnh.styleNickname = 'O Temerário';
    } else if (cnh.totalPerfectParks >= 4) {
      cnh.styleNickname = 'O Cirúrgico';
    } else if (cnh.totalManeuvers > 40 && cnh.totalCollisions < 5) {
      cnh.styleNickname = 'O Paciente';
    } else if (cnh.points >= 15 && cnh.totalManeuvers > 20) {
      cnh.styleNickname = 'O Especialista';
    } else {
      cnh.styleNickname = 'O Moderado';
    }

    this.saveCNH(cnh);
    return cnh;
  },

  restoreSuspendedCNH(): CNHState {
    const cnh = this.getCNH();
    if (cnh.points === 0) {
      cnh.points = 5; // Restores to 5 points so they can drive again!
      cnh.status = 'warning';
      cnh.history.unshift({
        event: 'Curso de reciclagem a pé concluído (+5 pts)',
        pointsDelta: 5,
        timestamp: Date.now()
      });
      this.saveCNH(cnh);
    }
    return cnh;
  },

  getGhost(levelId: string): GhostRecord | null {
    const data = localStorage.getItem(GHOST_PREFIX + levelId);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  saveGhost(levelId: string, frames: GhostFrame[], moves: number, duration: number): void {
    const existing = this.getGhost(levelId);

    // Save only if it is the first ghost OR it completed in less time
    if (!existing || duration < existing.duration) {
      const now = new Date();
      // Format like "Terça, 23:14"
      const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const timestamp = `${weekdays[now.getDay()]}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const record: GhostRecord = {
        levelId,
        timestamp,
        frames,
        moves,
        duration
      };
      localStorage.setItem(GHOST_PREFIX + levelId, JSON.stringify(record));
    }
  },

  getUnlockedLevels(): string[] {
    const data = localStorage.getItem(UNLOCKED_KEY);
    if (!data) return ['level_1']; // Only Level 1 unlocked by default
    try {
      return JSON.parse(data);
    } catch (e) {
      return ['level_1'];
    }
  },

  unlockLevel(levelId: string): void {
    const unlocked = this.getUnlockedLevels();
    if (!unlocked.includes(levelId)) {
      unlocked.push(levelId);
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
    }
  },

  resetAll(): void {
    localStorage.removeItem(CNH_KEY);
    localStorage.removeItem(UNLOCKED_KEY);
    localStorage.removeItem(CUSTOM_LEVELS_KEY);
    // clear ghost keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(GHOST_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  },

  getCustomLevels(): Level[] {
    const data = localStorage.getItem(CUSTOM_LEVELS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  saveCustomLevel(level: Level): void {
    const list = this.getCustomLevels();
    const idx = list.findIndex((l) => l.id === level.id);
    if (idx >= 0) {
      list[idx] = level;
    } else {
      list.push(level);
    }
    localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(list));
  },

  deleteCustomLevel(levelId: string): void {
    const list = this.getCustomLevels();
    const filtered = list.filter((l) => l.id !== levelId);
    localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(filtered));
  }
};
