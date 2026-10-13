/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Level, DialogueLine } from './types';

export const DIALOGUES: DialogueLine[] = [
  {
    id: 'ironic_near_miss_1',
    mood: 'ironic',
    trigger: 'near_miss',
    text: ['Olha...', '...pelo menos você é consistente nos erros.'],
    weight: 10,
    cooldown: 3
  },
  {
    id: 'ironic_near_miss_2',
    mood: 'ironic',
    trigger: 'near_miss',
    text: ['Bela tentativa!', 'Quase levei minha terapia de graça hoje.'],
    weight: 8,
    cooldown: 4
  },
  {
    id: 'anxious_near_miss',
    mood: 'anxious',
    trigger: 'near_miss',
    text: ['AI MEU DEUS!', 'Você quase me transformou em adesivo de para-choque!'],
    weight: 10,
    cooldown: 2
  },
  {
    id: 'expert_near_miss',
    mood: 'expert',
    trigger: 'near_miss',
    text: ['Esterça mais cedo na paralela.', 'Você tá calculando mal o raio de giro.'],
    weight: 9,
    cooldown: 5
  },
  {
    id: 'optimistic_near_miss',
    mood: 'optimistic',
    trigger: 'near_miss',
    text: ['Ufa! Passou raspando.', 'Sei que na próxima você acerta o ângulo!'],
    weight: 7,
    cooldown: 4
  },
  {
    id: 'dramatic_near_miss',
    mood: 'dramatic',
    trigger: 'near_miss',
    text: ['Minha vida passou diante dos meus olhos...', 'E tinha gosto de pneu queimado!'],
    weight: 10,
    cooldown: 5
  },
  {
    id: 'ironic_hit_fixed',
    mood: 'ironic',
    trigger: 'light_hit',
    text: ['A parede não vai sair do lugar, viu?', 'Ela tem preferência por lei física.'],
    weight: 10,
    cooldown: 2
  },
  {
    id: 'anxious_hit_fixed',
    mood: 'anxious',
    trigger: 'light_hit',
    text: ['Esse barulho... dói na alma!', 'Será que amassou muito?'],
    weight: 9,
    cooldown: 3
  },
  {
    id: 'dramatic_hit_fixed',
    mood: 'dramatic',
    trigger: 'hard_hit',
    text: ['MINHA NOSSA!', 'Isso foi um terremoto ou a sua habilidade desabando?'],
    weight: 10,
    cooldown: 4
  },
  {
    id: 'expert_hit_fixed',
    mood: 'expert',
    trigger: 'light_hit',
    text: ['Esqueceu de acionar a marcha ré?', 'Use o freio com mais suavidade.'],
    weight: 8,
    cooldown: 3
  },
  {
    id: 'ironic_hit_car',
    mood: 'ironic',
    trigger: 'light_hit',
    text: ['Ah, o clássico estacionamento por audição.', 'Bateu, parou, né?'],
    weight: 10,
    cooldown: 3
  },
  {
    id: 'anxious_hit_car',
    mood: 'anxious',
    trigger: 'hard_hit',
    text: ['O dono daquele carro vai te matar!', 'E eu vou ser testemunha!'],
    weight: 10,
    cooldown: 2
  },
  {
    id: 'indifferent_hit_car',
    mood: 'indifferent',
    trigger: 'light_hit',
    text: ['Mais um risco pra coleção do shopping.', 'Ninguém vai notar.'],
    weight: 8,
    cooldown: 4
  },
  {
    id: 'perfect_park_ironic',
    mood: 'ironic',
    trigger: 'perfect_park',
    text: ['Espetacular.', 'Agora faz isso de novo com metade do tempo.'],
    weight: 8,
    cooldown: 2
  },
  {
    id: 'perfect_park_optimistic',
    mood: 'optimistic',
    trigger: 'perfect_park',
    text: ['Que precisão maravilhosa!', 'Você nasceu pra estacionar em SP!'],
    weight: 10,
    cooldown: 1
  },
  {
    id: 'perfect_park_expert',
    mood: 'expert',
    trigger: 'perfect_park',
    text: ['Esterçamento perfeito.', 'Alinhamento em paralelo impecável.'],
    weight: 10,
    cooldown: 1
  },
  {
    id: 'too_slow_ironic',
    mood: 'ironic',
    trigger: 'too_slow',
    text: ['Estamos esperando o eclipse solar acabar', 'ou você vai terminar a ré hoje?'],
    weight: 10,
    cooldown: 3
  },
  {
    id: 'too_slow_anxious',
    mood: 'anxious',
    trigger: 'too_slow',
    text: ['Rápido, o fiscal tá vindo!', 'Minha pressão tá subindo!'],
    weight: 10,
    cooldown: 3
  },
  {
    id: 'elegant_move_expert',
    mood: 'expert',
    trigger: 'elegant_move',
    text: ['Manobra limpa.', 'Menos de 3 movimentos, ótima leitura de espaço.'],
    weight: 10,
    cooldown: 2
  },
  {
    id: 'near_pedestrian_dramatic',
    mood: 'dramatic',
    trigger: 'near_pedestrian',
    text: ['Assassino em potencial!', 'Eu só queria atravessar a rua!'],
    weight: 10,
    cooldown: 3
  }
];

export const LEVELS: Level[] = [
  {
    id: 'level_1',
    phaseName: 'Street Parking',
    description: 'Controles básicos na rua de bairro. Encontre o ângulo e alinhe o carro sem pressão.',
    phaseIndex: 1,
    timeOfDay: 'morning',
    weather: 'clear',
    startX: 120,
    startY: 280,
    startHeading: 0,
    spot: {
      x: 550,
      y: 110,
      width: 110,
      height: 44,
      heading: 0,
      toleranceHeading: 0.1, // ~5.7 degrees
      toleranceOffset: 15
    },
    obstacles: [
      // Parked cars creating a parallel spot
      {
        id: 'obs_1_car1',
        type: 'car',
        x: 400,
        y: 110,
        width: 100,
        height: 40,
        heading: 0,
        color: '#3b82f6' // Blue
      },
      {
        id: 'obs_1_car2',
        type: 'car',
        x: 700,
        y: 110,
        width: 100,
        height: 40,
        heading: 0,
        color: '#ef4444' // Red
      },
      // Street borders
      {
        id: 'obs_1_sidewalk_top',
        type: 'wall',
        x: 400,
        y: 40,
        width: 800,
        height: 10,
        heading: 0,
        color: '#6b7280'
      },
      {
        id: 'obs_1_sidewalk_bottom',
        type: 'wall',
        x: 400,
        y: 460,
        width: 800,
        height: 10,
        heading: 0,
        color: '#6b7280'
      }
    ]
  },
  {
    id: 'level_2',
    phaseName: 'Estacionamento 45°',
    description: 'Aprenda o ângulo diagonal em shopping aberto. NPCs observadores reagem às suas ações.',
    phaseIndex: 2,
    timeOfDay: 'afternoon',
    weather: 'clear',
    startX: 120,
    startY: 380,
    startHeading: -Math.PI / 6,
    spot: {
      x: 420,
      y: 120,
      width: 100,
      height: 50,
      heading: Math.PI / 4, // 45 degrees
      toleranceHeading: 0.15,
      toleranceOffset: 12
    },
    obstacles: [
      // Border walls
      {
        id: 'obs_2_top_wall',
        type: 'wall',
        x: 400,
        y: 40,
        width: 800,
        height: 10,
        heading: 0
      },
      {
        id: 'obs_2_bottom_wall',
        type: 'wall',
        x: 400,
        y: 460,
        width: 800,
        height: 10,
        heading: 0
      },
      // Adjacent 45 degree parked cars
      {
        id: 'obs_2_car_left',
        type: 'car',
        x: 350,
        y: 90,
        width: 90,
        height: 44,
        heading: Math.PI / 4,
        color: '#10b981' // Green
      },
      {
        id: 'obs_2_car_right',
        type: 'car',
        x: 490,
        y: 150,
        width: 90,
        height: 44,
        heading: Math.PI / 4,
        color: '#f59e0b' // Orange
      },
      // NPC spectator near the spot
      {
        id: 'obs_2_spectator_1',
        type: 'pedestrian',
        x: 550,
        y: 200,
        width: 16,
        height: 16,
        heading: Math.PI,
        color: '#ec4899', // Pink
        pedestrianName: 'Marcio',
        mood: 'ironic'
      }
    ]
  },
  {
    id: 'level_3',
    phaseName: 'Estacionamento 90°',
    description: 'Manobra perpendicular de 90°. Cuidado com o fiscal de trânsito rondando com timer severo!',
    phaseIndex: 3,
    timeOfDay: 'afternoon',
    timeLimit: 45, // 45 seconds
    weather: 'clear',
    startX: 120,
    startY: 350,
    startHeading: 0,
    spot: {
      x: 450,
      y: 110,
      width: 90,
      height: 46,
      heading: Math.PI / 2, // 90 deg
      toleranceHeading: 0.08, // Strict 90 deg aligment
      toleranceOffset: 10
    },
    obstacles: [
      {
        id: 'obs_3_top_wall',
        type: 'wall',
        x: 400,
        y: 30,
        width: 800,
        height: 10,
        heading: 0
      },
      {
        id: 'obs_3_bottom_wall',
        type: 'wall',
        x: 400,
        y: 470,
        width: 800,
        height: 10,
        heading: 0
      },
      // Parked cars
      {
        id: 'obs_3_car_l',
        type: 'car',
        x: 390,
        y: 110,
        width: 90,
        height: 44,
        heading: Math.PI / 2,
        color: '#8b5cf6'
      },
      {
        id: 'obs_3_car_r',
        type: 'car',
        x: 510,
        y: 110,
        width: 90,
        height: 44,
        heading: Math.PI / 2,
        color: '#6366f1'
      },
      // Walking Traffic Officer (Fiscal) patrolling
      {
        id: 'obs_3_traffic_officer',
        type: 'pedestrian',
        x: 200,
        y: 230,
        width: 18,
        height: 18,
        heading: 0,
        color: '#eab308', // Yellow shirt
        speed: 35, // pixels per second
        waypoints: [
          { x: 200, y: 230 },
          { x: 650, y: 230 },
          { x: 650, y: 320 },
          { x: 200, y: 320 }
        ],
        currentWaypointIdx: 0,
        pedestrianName: 'Guarda Nunes',
        mood: 'anxious'
      }
    ]
  },
  {
    id: 'level_4',
    phaseName: 'Night Drive',
    description: 'Visibilidade muito reduzida à noite. Desbloqueia Perspectiva do Motorista (tecla V). Use faróis!',
    phaseIndex: 4,
    timeOfDay: 'night',
    weather: 'clear',
    startX: 100,
    startY: 320,
    startHeading: 0,
    spot: {
      x: 600,
      y: 350,
      width: 100,
      height: 44,
      heading: 0,
      toleranceHeading: 0.12,
      toleranceOffset: 14
    },
    obstacles: [
      // Street lamps and trees
      {
        id: 'obs_4_top_wall',
        type: 'wall',
        x: 400,
        y: 40,
        width: 800,
        height: 10,
        heading: 0
      },
      {
        id: 'obs_4_bottom_wall',
        type: 'wall',
        x: 400,
        y: 460,
        width: 800,
        height: 10,
        heading: 0
      },
      // Parked car behind
      {
        id: 'obs_4_car1',
        type: 'car',
        x: 450,
        y: 350,
        width: 100,
        height: 40,
        heading: 0,
        color: '#475569'
      },
      {
        id: 'obs_4_car2',
        type: 'car',
        x: 750,
        y: 350,
        width: 100,
        height: 40,
        heading: 0,
        color: '#1e293b'
      },
      // Pillar near center
      {
        id: 'obs_4_pilar1',
        type: 'pilar',
        x: 350,
        y: 180,
        width: 30,
        height: 30,
        heading: 0,
        color: '#94a3b8'
      },
      // Walking pedestrian
      {
        id: 'obs_4_ghost_pedestrian',
        type: 'pedestrian',
        x: 300,
        y: 100,
        width: 16,
        height: 16,
        heading: Math.PI / 2,
        color: '#f43f5e',
        speed: 25,
        waypoints: [
          { x: 300, y: 100 },
          { x: 300, y: 400 }
        ],
        currentWaypointIdx: 0,
        pedestrianName: 'Aline de Casaco Escuro',
        mood: 'dramatic'
      }
    ]
  },
  {
    id: 'level_5',
    phaseName: 'Tight Squeeze',
    description: 'Vaga apertadíssima! Motorista impaciente atrás observando com barra de paciência.',
    phaseIndex: 5,
    timeOfDay: 'evening',
    weather: 'rain', // introduces rain!
    tightSqueezeMultiplier: 0.7, // reduces target size by 30%
    patienceTime: 40, // 40s patience bar for honking cars
    startX: 120,
    startY: 280,
    startHeading: 0,
    spot: {
      x: 480,
      y: 110,
      width: 85, // Normal was 110! Now much tighter!
      height: 42,
      heading: 0,
      toleranceHeading: 0.06, // extremely strict
      toleranceOffset: 8
    },
    obstacles: [
      {
        id: 'obs_5_top_wall',
        type: 'wall',
        x: 400,
        y: 40,
        width: 800,
        height: 10,
        heading: 0
      },
      {
        id: 'obs_5_bottom_wall',
        type: 'wall',
        x: 400,
        y: 460,
        width: 800,
        height: 10,
        heading: 0
      },
      // Tight parking buddies
      {
        id: 'obs_5_car_front',
        type: 'car',
        x: 380,
        y: 110,
        width: 100,
        height: 40,
        heading: 0,
        color: '#dc2626'
      },
      {
        id: 'obs_5_car_back',
        type: 'car',
        x: 585,
        y: 110,
        width: 100,
        height: 40,
        heading: 0,
        color: '#16a34a'
      },
      // The impatient car behind (in the street)
      {
        id: 'obs_5_car_impatient',
        type: 'car',
        x: 220,
        y: 280,
        width: 100,
        height: 40,
        heading: 0,
        color: '#e11d48',
        pedestrianName: 'Apressadinho da Fita'
      },
      // NPC looking at you and complaining
      {
        id: 'obs_5_impatient_driver',
        type: 'pedestrian',
        x: 200,
        y: 240,
        width: 16,
        height: 16,
        heading: Math.PI / 2,
        color: '#9333ea',
        pedestrianName: 'Seu Roberto Impaciente',
        mood: 'dramatic'
      }
    ]
  },
  {
    id: 'level_6',
    phaseName: 'Multilevel Garage',
    description: 'Estacionamento de shopping fechado. Rampa íngreme (gravidade puxa!), pilares pesados e piso liso.',
    phaseIndex: 6,
    timeOfDay: 'afternoon',
    slope: 12, // 12 degree slope!
    weather: 'clear',
    startX: 150,
    startY: 420,
    startHeading: -Math.PI / 4,
    spot: {
      x: 650,
      y: 140,
      width: 90,
      height: 48,
      heading: Math.PI / 2,
      toleranceHeading: 0.1,
      toleranceOffset: 12
    },
    obstacles: [
      // Concrete walls outlining the garage & ramp
      {
        id: 'obs_6_outer_top',
        type: 'wall',
        x: 400,
        y: 30,
        width: 800,
        height: 10,
        heading: 0
      },
      {
        id: 'obs_6_outer_bottom',
        type: 'wall',
        x: 400,
        y: 470,
        width: 800,
        height: 10,
        heading: 0
      },
      // Center ramp dividers
      {
        id: 'obs_6_ramp_wall_1',
        type: 'wall',
        x: 350,
        y: 350,
        width: 300,
        height: 20,
        heading: -Math.PI / 6, // slanted ramp wall
        color: '#4b5563'
      },
      {
        id: 'obs_6_ramp_wall_2',
        type: 'wall',
        x: 350,
        y: 220,
        width: 300,
        height: 20,
        heading: -Math.PI / 6,
        color: '#4b5563'
      },
      // Pillars
      {
        id: 'obs_6_pilar1',
        type: 'pilar',
        x: 550,
        y: 120,
        width: 25,
        height: 25,
        heading: 0,
        color: '#d1d5db'
      },
      {
        id: 'obs_6_pilar2',
        type: 'pilar',
        x: 550,
        y: 280,
        width: 25,
        height: 25,
        heading: 0,
        color: '#d1d5db'
      },
      {
        id: 'obs_6_pilar3',
        type: 'pilar',
        x: 750,
        y: 280,
        width: 25,
        height: 25,
        heading: 0,
        color: '#d1d5db'
      },
      // Parked cars
      {
        id: 'obs_6_car1',
        type: 'car',
        x: 590,
        y: 140,
        width: 90,
        height: 44,
        heading: Math.PI / 2,
        color: '#0284c7'
      },
      {
        id: 'obs_6_car2',
        type: 'car',
        x: 710,
        y: 140,
        width: 90,
        height: 44,
        heading: Math.PI / 2,
        color: '#0d9488'
      },
      // Ground supervisor
      {
        id: 'obs_6_supervisor',
        type: 'pedestrian',
        x: 500,
        y: 80,
        width: 16,
        height: 16,
        heading: Math.PI / 2,
        color: '#312e81',
        pedestrianName: 'Carlos Supervisor',
        mood: 'expert'
      }
    ]
  }
];
