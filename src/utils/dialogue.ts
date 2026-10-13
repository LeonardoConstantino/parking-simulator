/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DIALOGUES } from '../data';
import { DialogTrigger, DialogueLine, TimeSlot, NPCMood } from '../types';

// Track used dialogue IDs and how many ticks/triggers ago they were used
const usedHistory: Record<string, number> = {};
let totalTriggers = 0;

export const DialogueEngine = {
  /**
   * Selects an appropriate dialogue line based on context and trigger event
   */
  selectLine(
    trigger: DialogTrigger,
    timeOfDay: TimeSlot,
    cnhPoints: number,
    preferredMood?: NPCMood
  ): { text: string[]; id: string; mood: NPCMood } | null {
    totalTriggers++;

    // Filter available lines
    const candidates = DIALOGUES.filter((d) => {
      // Must match trigger
      if (d.trigger !== trigger) return false;

      // Must match time context if specified
      if (d.contexts && d.contexts.length > 0 && !d.contexts.includes(timeOfDay)) {
        return false;
      }

      // If license is low and dialogue requires low license, check points
      if (d.requiresMemory === 'low_license' && cnhPoints > 9) {
        return false;
      }

      // Check cooldowns
      const lastUsedAt = usedHistory[d.id] || 0;
      if (lastUsedAt > 0 && totalTriggers - lastUsedAt < d.cooldown) {
        return false; // Still in cooldown
      }

      return true;
    });

    if (candidates.length === 0) {
      // Fallback if all are on cooldown: relax cooldown check
      const emergencyCandidates = DIALOGUES.filter((d) => d.trigger === trigger);
      if (emergencyCandidates.length > 0) {
        const random = emergencyCandidates[Math.floor(Math.random() * emergencyCandidates.length)];
        return { text: random.text, id: random.id, mood: random.mood };
      }
      return null;
    }

    // Apply weights and selection bias
    // GDD: "Peso 10x menor para frases recentes na seleção ponderada"
    const weightedCandidates = candidates.map((d) => {
      let weight = d.weight;

      // If preferred mood matches
      if (preferredMood && d.mood === preferredMood) {
        weight *= 3;
      }

      // If used somewhat recently (e.g., within last 15 triggers), divide weight by 10
      const lastUsedAt = usedHistory[d.id] || 0;
      if (lastUsedAt > 0 && totalTriggers - lastUsedAt < 15) {
        weight /= 10;
      }

      return { d, weight };
    });

    // Weighted random selection
    const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    let selectedLine: DialogueLine | null = null;

    for (const item of weightedCandidates) {
      r -= item.weight;
      if (r <= 0) {
        selectedLine = item.d;
        break;
      }
    }

    if (!selectedLine && candidates.length > 0) {
      selectedLine = candidates[0];
    }

    if (selectedLine) {
      // Save usage history
      usedHistory[selectedLine.id] = totalTriggers;

      // Escalation handling (under low license CNH < 5, dialogues can escalate or change text)
      let textToUse = [...selectedLine.text];
      if (cnhPoints < 5 && Math.random() > 0.5) {
        // GDD Section 6.2: NPCs are hostile/impatient under critical license
        if (selectedLine.mood === 'ironic') {
          textToUse = ['Olha... com essa CNH quase suspensa, eu nem ficaria na calçada!', 'Dá ré com mais cuidado!'];
        } else if (selectedLine.mood === 'anxious') {
          textToUse = ['Socorro! O motorista infrator está à solta!', 'Vai bater em mim de novo?!'];
        }
      }

      return {
        id: selectedLine.id,
        text: textToUse,
        mood: selectedLine.mood
      };
    }

    return null;
  }
};
