/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bus, User, ArrowRight, CheckCircle } from 'lucide-react';
import { AudioManager } from '../utils/audio';

interface InfratorViewProps {
  onCompleted: () => void;
}

export default function InfratorView({ onCompleted }: InfratorViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [step, setStep] = useState<'walk' | 'bus' | 'watch' | 'done'>('walk');
  const [isMuted, setIsMuted] = useState(false);

  // Player coordinates for 'walk' step
  const playerPos = useRef({ x: 100, y: 350 });
  const keysPressed = useRef<Record<string, boolean>>({});

  // Bus position
  const busPos = useRef({ x: -150, y: 220 });

  // AI Car position for 'watch' step
  const aiCarPos = useRef({ x: 150, y: 160, heading: 0, velocity: 50, steer: 0, state: 'approach' });
  const [aiDialogue, setAiDialogue] = useState<string>('A pé também é transporte! Vamos para o ponto de ônibus.');

  useEffect(() => {
    // Start engine hum
    AudioManager.startEngine();
    return () => {
      AudioManager.stopEngine();
    };
  }, []);

  // Keyboard controls for walking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();
    let stateTime = 0;
    let lastState = aiCarPos.current.state;

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Track sub-state durations for AI Car in 'watch' step
      if (step === 'watch') {
        if (aiCarPos.current.state !== lastState) {
          stateTime = 0;
          lastState = aiCarPos.current.state;
        }
        stateTime += dt;
      }

      // Logic depending on step
      if (step === 'walk') {
        let dx = 0;
        let dy = 0;
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) dy = -1;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dy = 1;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx = -1;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx = 1;

        // Move player
        const speed = 120; // pixels per second
        playerPos.current.x = Math.max(20, Math.min(780, playerPos.current.x + dx * speed * dt));
        playerPos.current.y = Math.max(20, Math.min(480, playerPos.current.y + dy * speed * dt));

        // Bus arrives slowly at coordinates {x: 400, y: 220}
        if (busPos.current.x < 400) {
          busPos.current.x += 80 * dt;
        } else {
          setAiDialogue('O ônibus circular chegou! Entre no ponto de embarque (área amarela) para prosseguir.');
        }

        // Check if player enters bus stop zone (near x: 400, y: 220)
        const distToBus = Math.hypot(playerPos.current.x - 400, playerPos.current.y - 225);
        if (distToBus < 40 && busPos.current.x >= 400) {
          setStep('bus');
          setAiDialogue('Embarcado! Indo para as ruas observar motoristas reais no curso de reciclagem.');
        }
      } else if (step === 'bus') {
        // Bus drives off the screen
        busPos.current.x += 160 * dt;
        if (busPos.current.x > 900) {
          // transition to watching
          setStep('watch');
          // Reset bus for next screen
          busPos.current.x = -150;
          aiCarPos.current = { x: 120, y: 160, heading: 0, velocity: 50, steer: 0, state: 'approach' };
        }
      } else if (step === 'watch') {
        // Bus drives in and parks
        if (busPos.current.x < 250) {
          busPos.current.x += 120 * dt;
        }

        // AI Car tries to park
        const ai = aiCarPos.current;

        if (ai.state === 'approach') {
          ai.x += ai.velocity * dt;
          if (ai.x > 380 || stateTime > 5.0) {
            ai.state = 'align';
            ai.velocity = 20;
            stateTime = 0;
            lastState = 'align';
            setAiDialogue('Olha aquele azul ali... vai tentar fazer uma baliza paralela de primeira.');
          }
        } else if (ai.state === 'align') {
          ai.x += ai.velocity * dt;
          ai.heading += 0.4 * dt;
          if (ai.x > 440 || stateTime > 4.0) {
            ai.state = 'reverse';
            ai.velocity = -35;
            stateTime = 0;
            lastState = 'reverse';
            setAiDialogue('Esterçou todo o volante pra esquerda na ré! Vamos ver se bate na guia.');
          }
        } else if (ai.state === 'reverse') {
          ai.x += ai.velocity * Math.cos(ai.heading) * dt;
          ai.y += ai.velocity * Math.sin(ai.heading) * dt;
          ai.heading -= 0.8 * dt;

          if (ai.y < 120 || stateTime > 4.0) {
            ai.state = 'adjust';
            ai.velocity = 15;
            stateTime = 0;
            lastState = 'adjust';
            AudioManager.playCrash(); // bump sound!
            setAiDialogue('AI! Bateu de leve na calçada! Mas está quase alinhado.');
          }
        } else if (ai.state === 'adjust') {
          ai.x += ai.velocity * dt;
          ai.heading += 0.6 * dt;
          if (ai.heading >= 0 || Math.abs(ai.heading) < 0.1 || stateTime > 3.0) {
            ai.heading = 0;
            ai.velocity = 0;
            ai.state = 'done';
            stateTime = 0;
            lastState = 'done';
            setAiDialogue('Ficou meio torto, mas parou. Parabéns pro esforço dele! Aula concluída.');
            setTimeout(() => {
              setStep('done');
            }, 3000);
          }
        }
      }

      // Draw everything
      drawInfratorCanvas();

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [step]);

  // Draw code
  const drawInfratorCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 800, 500);

    // Draw sidewalks
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 800, 45);
    ctx.fillRect(0, 455, 800, 45);

    // Grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }

    if (step === 'walk') {
      // Draw Bus Stop (Yellow box)
      ctx.fillStyle = 'rgba(234, 179, 8, 0.18)';
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.fillRect(360, 180, 80, 80);
      ctx.strokeRect(360, 180, 80, 80);
      ctx.setLineDash([]);

      // Draw Bus Stop Sign
      ctx.fillStyle = '#eab308';
      ctx.fillRect(397, 130, 6, 50);
      ctx.beginPath();
      ctx.arc(400, 125, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('BUS', 391, 128);

      // Draw Transit Bus
      drawBus(ctx, busPos.current.x, busPos.current.y);

      // Draw Player Pedestrian (little blue character)
      drawPedestrian(ctx, playerPos.current.x, playerPos.current.y, '#3b82f6', 'Você');
    } else if (step === 'bus') {
      // Draw transit screen
      drawBus(ctx, busPos.current.x, busPos.current.y);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('CURSO DE RECICLAGEM EM MOVIMENTO...', 200, 400);
    } else if (step === 'watch' || step === 'done') {
      // We are looking out of the bus window at an AI driver
      // Draw the static parked cars
      ctx.fillStyle = '#ef4444'; // Red static car
      ctx.fillRect(320, 95, 80, 35);
      ctx.fillStyle = '#10b981'; // Green static car
      ctx.fillRect(580, 95, 80, 35);

      // Draw parking target spot
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(440, 95, 100, 35);
      ctx.setLineDash([]);

      // Draw AI Car
      const ai = aiCarPos.current;
      ctx.save();
      ctx.translate(ai.x, ai.y);
      ctx.rotate(ai.heading);
      ctx.fillStyle = '#2563eb'; // blue car body
      ctx.fillRect(-40, -18, 80, 36);
      // windows
      ctx.fillStyle = '#000000';
      ctx.fillRect(10, -14, 12, 28);
      ctx.fillRect(-20, -14, 8, 28);
      ctx.restore();

      // Label AI Car
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText('AI Aprendiz', ai.x - 25, ai.y - 25);

      // Draw the Bus parked watching
      drawBus(ctx, busPos.current.x, busPos.current.y);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('Seu Ônibus', busPos.current.x - 30, busPos.current.y - 30);
    }

    // Draw feedback / instructions box at bottom
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(40, 410, 720, 40);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(40, 410, 720, 40);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText(aiDialogue, 60, 434);
  };

  const drawBus = (ctx: CanvasRenderingContext2D, bx: number, by: number) => {
    ctx.save();
    ctx.translate(bx, by);

    // Bus body (long yellow rectangle)
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-90, -30, 180, 60);

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeRect(-90, -30, 180, 60);

    // Windows
    ctx.fillStyle = '#1e293b';
    for (let i = -70; i <= 50; i += 30) {
      ctx.fillRect(i, -24, 20, 14);
      ctx.fillRect(i, 10, 20, 14);
    }

    // Windshield (front looking right)
    ctx.fillRect(72, -24, 12, 48);

    // Wheels
    ctx.fillStyle = '#000000';
    ctx.fillRect(-60, -33, 24, 5);
    ctx.fillRect(-60, 28, 24, 5);
    ctx.fillRect(40, -33, 24, 5);
    ctx.fillRect(40, 28, 24, 5);

    ctx.restore();
  };

  const drawPedestrian = (ctx: CanvasRenderingContext2D, px: number, py: number, color: string, name: string) => {
    ctx.save();
    ctx.translate(px, py);

    // Body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(2, 2, 8, 0, Math.PI * 2);
    ctx.fill();

    // Shirt
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Name tag
    ctx.restore();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(name, px - 12, py - 12);
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl p-6 max-w-3xl w-full mx-auto text-slate-100" id="infrator-view-panel">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Bus className="w-6 h-6 text-yellow-400 animate-pulse" />
          <h2 className="text-lg font-bold">Modo Infrator: Curso de Reciclagem</h2>
        </div>
        <div className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold">
          CNH ZERADA (0 PTS)
        </div>
      </div>

      {step !== 'done' ? (
        <div className="relative bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className="w-full max-w-[800px] h-auto object-contain bg-slate-900"
          />

          {step === 'walk' && (
            <div className="absolute top-4 left-4 bg-slate-950/80 border border-slate-800 p-3 rounded-md text-[10px] font-mono text-slate-300">
              <span className="font-bold text-white uppercase">REGRAS DO CURSO:</span>
              <div className="mt-1">Use <span className="text-yellow-400">WASD</span> ou <span className="text-yellow-400">Setas</span> para andar até o ônibus.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center bg-slate-950/60 rounded-lg p-10 border border-emerald-500/30 text-center py-16 animate-in zoom-in duration-300">
          <CheckCircle className="w-16 h-16 text-emerald-400 animate-bounce mb-4" />
          <h3 className="text-2xl font-bold text-emerald-400">Habilitação Restaurada!</h3>
          <p className="text-sm text-slate-300 mt-2 max-w-md leading-relaxed">
            Você assistiu atentamente aos erros comuns de estacionamento, completou as horas teóricas do curso de reciclagem comunitário e recuperou o direito de dirigir.
          </p>

          <div className="my-6 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-amber-400 font-mono text-sm font-bold">
            PONTUAÇÃO ATUAL DA CNH: +5 PONTOS
          </div>

          <button
            onClick={onCompleted}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95"
            id="finish-reciclagem-btn"
          >
            Retomar Volante
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
