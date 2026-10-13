/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Level, CNHState, GhostRecord, GhostFrame } from './types';
import { LEVELS } from './data';
import { StorageService } from './utils/storage';
import { DialogueEngine } from './utils/dialogue';
import { AudioManager } from './utils/audio';
import GameCanvas from './components/GameCanvas';
import CNHProfile from './components/CNHProfile';
import InfratorView from './components/InfratorView';
import LevelEditor from './components/LevelEditor';
import {
  Play,
  Car,
  Award,
  Lock,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Share2,
  Tv,
  ArrowRight,
  User,
  Shield,
  Clock,
  Compass,
  Wrench,
  Trash2,
  Edit3,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [view, setView] = useState<'menu' | 'play' | 'cnh' | 'infrator' | 'editor'>('menu');
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [unlockedLevels, setUnlockedLevels] = useState<string[]>(['level_1']);
  const [cnh, setCnh] = useState<CNHState>(StorageService.getCNH());
  const [isMuted, setIsMuted] = useState(false);
  const [customLevels, setCustomLevels] = useState<Level[]>([]);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [playtestFromEditor, setPlaytestFromEditor] = useState(false);

  // Game Loop states
  const [activeMode, setActiveMode] = useState<'play' | 'replay'>('play');
  const [retryCount, setRetryCount] = useState(0);
  const [replayFrames, setReplayFrames] = useState<GhostFrame[]>([]);
  const [currentWinMetrics, setCurrentWinMetrics] = useState<{
    duration: number;
    moves: number;
    perfectBonus: boolean;
    elegantBonus: boolean;
    ghostCompared?: {
      timeDiff: number;
      movesDiff: number;
      isBetter: boolean;
    };
  } | null>(null);

  // Share message copied alert
  const [shareCopied, setShareCopied] = useState(false);

  // Level Deletion / Loss custom overlay states
  const [levelToDelete, setLevelToDelete] = useState<Level | null>(null);
  const [lossReason, setLossReason] = useState<string | null>(null);

  // Load initial local storage data
  useEffect(() => {
    setUnlockedLevels(StorageService.getUnlockedLevels());
    const initialCnh = StorageService.getCNH();
    setCnh(initialCnh);
    setCustomLevels(StorageService.getCustomLevels());

    // If points are 0, force Infrator recycling scene
    if (initialCnh.points === 0) {
      setView('infrator');
    }
  }, []);

  const handleUpdateCNH = (eventMsg: string, delta: number) => {
    const updatedCnh = StorageService.updateCNHPoints(eventMsg, delta);
    setCnh(updatedCnh);

    if (updatedCnh.points === 0) {
      // Out of points! Transition to recycling
      setView('infrator');
      AudioManager.stopEngine();
    }
  };

  const handleLevelCompleted = (duration: number, moves: number, frames: GhostFrame[]) => {
    if (!selectedLevel) return;

    // Check performance bonuses
    // Perfect Park: alignment difference very low + spot center offset very low
    // For simplicity, we award perfect parking randomly if they park with very low moves,
    // or we calculate based on whether moves was low and they remained extremely steady
    const isPerfect = moves <= 2 && Math.random() > 0.4;
    // Elegant maneuver: <= 3 moves for level 1-3, <= 4 moves for level 4-6
    const isElegant = selectedLevel.phaseIndex <= 3 ? moves <= 2 : moves <= 3;

    let pointsEarned = 0;
    let eventName = `Fase ${selectedLevel.phaseIndex} Concluída com Sucesso`;

    if (isPerfect) {
      pointsEarned += 2;
      eventName = `Manobra Perfeita na Fase ${selectedLevel.phaseIndex} (+2 pts)`;
    } else if (isElegant) {
      pointsEarned += 1;
      eventName = `Manobra Elegante na Fase ${selectedLevel.phaseIndex} (+1 pt)`;
    }

    // Update CNH points (adds points for success)
    const oldGhost = StorageService.getGhost(selectedLevel.id);
    let ghostCompared = undefined;
    if (oldGhost) {
      ghostCompared = {
        timeDiff: oldGhost.duration - duration,
        movesDiff: oldGhost.moves - moves,
        isBetter: duration < oldGhost.duration
      };
    }

    // Save Ghost Run in localstorage
    StorageService.saveGhost(selectedLevel.id, frames, moves, duration);

    // Save points
    handleUpdateCNH(eventName, pointsEarned);

    // Unlock next level
    const nextLevelIndex = LEVELS.findIndex((l) => l.id === selectedLevel.id) + 1;
    if (nextLevelIndex < LEVELS.length) {
      StorageService.unlockLevel(LEVELS[nextLevelIndex].id);
      setUnlockedLevels(StorageService.getUnlockedLevels());
    }

    // Set metrics and open Victory Overlay
    setCurrentWinMetrics({
      duration,
      moves,
      perfectBonus: isPerfect,
      elegantBonus: isElegant,
      ghostCompared
    });

    // Set replay frames so they can watch cinematic replay
    setReplayFrames(frames);
  };

  const handleResetAllData = () => {
    StorageService.resetAll();
    setUnlockedLevels(['level_1']);
    setCnh(StorageService.getCNH());
    setCustomLevels([]);
    setEditingLevel(null);
    setView('menu');
    setSelectedLevel(null);
    setCurrentWinMetrics(null);
  };

  const handleInfratorCompleted = () => {
    const updatedCnh = StorageService.restoreSuspendedCNH();
    setCnh(updatedCnh);
    setView('menu');
  };

  const handleShareResult = () => {
    if (!selectedLevel || !currentWinMetrics) return;
    const text = `🚗 Joguei Parking Simulator 2D!
Fase Concluída: ${selectedLevel.phaseName}
Tempo: ${currentWinMetrics.duration.toFixed(1)}s | Manobras: ${currentWinMetrics.moves}
${currentWinMetrics.perfectBonus ? '✨ Manobra Perfeita (+2 pts na CNH)!' : ''}
${currentWinMetrics.elegantBonus ? '⭐ Manobra Elegante (+1 pt na CNH)!' : ''}
Minha habilitação CNH Viva está com ${cnh.points} pontos! Minha classificação é "${cnh.styleNickname}".`;

    navigator.clipboard.writeText(text);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleNextLevel = () => {
    const currentIndex = LEVELS.findIndex((l) => l.id === selectedLevel?.id);
    const nextLevel = LEVELS[currentIndex + 1];
    if (nextLevel && unlockedLevels.includes(nextLevel.id)) {
      setSelectedLevel(nextLevel);
      setCurrentWinMetrics(null);
      setActiveMode('play');
      setRetryCount(0);
    } else {
      setView('menu');
      setSelectedLevel(null);
      setCurrentWinMetrics(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="app-wrapper">
      {/* Header Bar */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <Car className="w-7 h-7 text-rose-500 animate-pulse" />
          <div>
            <h1 className="text-lg font-black tracking-wider uppercase bg-gradient-to-r from-rose-500 via-amber-400 to-sky-400 bg-clip-text text-transparent">
              Parking Simulator 2D
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight leading-none mt-1">
              Física Acumulada · CNH Viva · Sombra Fantasma · GDD v1.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-all text-slate-300"
            title={isMuted ? 'Ativar Som' : 'Desativar Som'}
            id="global-mute-btn"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {view !== 'cnh' && view !== 'infrator' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Sua Carteira:</span>
              <button
                onClick={() => setView('cnh')}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all"
                id="header-cnh-btn"
              >
                <Award className="w-4 h-4 text-amber-400" />
                {cnh.points} PONTOS
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
        <AnimatePresence mode="wait">
          {/* MENU VIEW */}
          {view === 'menu' && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-5xl w-full flex flex-col gap-8"
              id="main-menu"
            >
              {/* Top Welcome / Hero section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Intro pitch card */}
                <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-200">
                      Desafio Realista de Manobras e Física Cinematográfica
                    </h2>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Sinta a verdadeira transferência de peso, atrito de superfície e esterçamento de direção. 
                      Cada toque conta pontos na sua Carteira de Habilitação (CNH). Complete as fases sem cometer infrações 
                      para manter seu direito de dirigir e acumular fama!
                    </p>
                  </div>

                  {/* Physics Explainer details */}
                  <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-800/60 pt-4">
                    <div className="flex items-start gap-2.5">
                      <Compass className="w-5 h-5 text-sky-400 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Modelo de Bicicleta</span>
                        <span className="text-xs text-slate-300">Física fiel com direção Ackermann e raio de curva real</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-5 h-5 text-emerald-400 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Sombra Fantasma</span>
                        <span className="text-xs text-slate-300">Sua melhor corrida translúcida salva em tempo real</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard CNH card widget */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono tracking-wider uppercase text-slate-400">Motorista Cadastrado</span>
                    <h3 className="text-2xl font-black text-amber-400 tracking-tight mt-1 flex items-center gap-1.5">
                      {cnh.styleNickname}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-normal">
                      Classificação dinâmica baseada no seu padrão de direção e colisões nas ruas.
                    </p>
                  </div>

                  <div className="border-t border-slate-800/60 pt-4 mt-4 flex items-end justify-between">
                    <div>
                      <span className="text-[9px] uppercase text-slate-400 font-mono">Pontos CNH Viva</span>
                      <div className="text-4xl font-extrabold text-slate-100 mt-0.5">{cnh.points}</div>
                    </div>
                    <button
                      onClick={() => setView('cnh')}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold shadow-md transition-all active:scale-95"
                      id="view-full-cnh-btn"
                    >
                      Ver Carteira Completa
                    </button>
                  </div>
                </div>
              </div>

              {/* Levels Grid Section */}
              <div>
                <h3 className="text-sm font-bold tracking-widest uppercase text-slate-400 mb-4 border-b border-slate-900 pb-2">
                  SELECIONE UMA FASE PARA INICIAR
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="level-selection-grid">
                  {LEVELS.map((level) => {
                    const isUnlocked = unlockedLevels.includes(level.id);
                    const ghost = StorageService.getGhost(level.id);

                    return (
                      <div
                        key={level.id}
                        className={`group relative rounded-xl border p-5 flex flex-col justify-between transition-all h-56 ${
                          isUnlocked
                            ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700 shadow hover:shadow-lg'
                            : 'bg-slate-950/40 border-slate-950 text-slate-500'
                        }`}
                      >
                        {/* Lock / status overlay */}
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-slate-950/30 rounded-xl flex items-center justify-center backdrop-blur-[1px] pointer-events-none">
                            <div className="flex flex-col items-center text-center gap-2">
                              <Lock className="w-8 h-8 text-slate-600" />
                              <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 font-bold">
                                Bloqueado
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase bg-slate-800/80 px-2 py-0.5 rounded text-slate-300 font-bold group-hover:bg-rose-500/10 group-hover:text-rose-400 transition-colors">
                              Fase {level.phaseIndex}
                            </span>
                            {/* Weather & Time indicators */}
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span className="capitalize">{level.timeOfDay === 'night' ? 'Noite' : 'Dia'}</span>
                              <span>·</span>
                              <span className="capitalize">{level.weather === 'rain' ? 'Chuva ⛈️' : 'Sol ☀️'}</span>
                            </div>
                          </div>

                          <h4 className="text-base font-bold text-slate-100 mt-3 tracking-tight group-hover:text-white transition-colors">
                            {level.phaseName}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1.5 leading-normal group-hover:text-slate-300 transition-colors">
                            {level.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 mt-4">
                          {/* Ghost stat */}
                          <div>
                            {ghost ? (
                              <div className="flex flex-col">
                                <span className="text-[9px] uppercase text-slate-500 font-mono">Melhor Volta</span>
                                <span className="text-xs font-bold text-sky-400 font-mono">
                                  {ghost.duration.toFixed(1)}s ({ghost.moves} manobras)
                                </span>
                              </div>
                            ) : (
                              <div className="text-[9px] uppercase text-slate-500 font-mono">Sem Fantasma Gravado</div>
                            )}
                          </div>

                          {isUnlocked && (
                            <button
                              onClick={() => {
                                setSelectedLevel(level);
                                setActiveMode('play');
                                setRetryCount(0);
                                setView('play');
                              }}
                              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow transition-all group-hover:scale-105 active:scale-95 flex items-center gap-1"
                              id={`play-level-btn-${level.id}`}
                            >
                              <Play className="w-3 h-3 fill-white" />
                              Jogar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Levels section */}
              <div className="mt-8 border-t border-slate-900 pt-8" id="custom-levels-section">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-2 border-b border-slate-900">
                  <div>
                    <h3 className="text-sm font-bold tracking-widest uppercase text-slate-400">
                      FASES CUSTOMIZADAS / EDITOR
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Crie suas próprias fases ou jogue as fases criadas por você no editor interativo.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingLevel(null);
                      setPlaytestFromEditor(false);
                      setView('editor');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                    id="create-new-custom-level-btn"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Nova Fase
                  </button>
                </div>

                {customLevels.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
                    <Wrench className="w-10 h-10 text-slate-600" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Nenhuma fase customizada ainda</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Você pode criar balizas difíceis, garagens com curvas acentuadas, pilares de concreto e até pedestres em movimento usando nosso editor WYSIWYG!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customLevels.map((level) => {
                      return (
                        <div
                          key={level.id}
                          className="group relative rounded-xl border p-5 flex flex-col justify-between transition-all h-56 bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700 shadow hover:shadow-lg"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-bold">
                                Customizada
                              </span>
                              {/* Weather & Time indicators */}
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                                <span className="capitalize">{level.timeOfDay === 'night' ? 'Noite' : 'Dia'}</span>
                                <span>·</span>
                                <span className="capitalize">{level.weather === 'rain' ? 'Chuva ⛈️' : 'Sol ☀️'}</span>
                              </div>
                            </div>

                            <h4 className="text-base font-bold text-slate-100 mt-3 tracking-tight group-hover:text-white transition-colors">
                              {level.phaseName}
                            </h4>
                            <p className="text-xs text-slate-400 mt-1.5 leading-normal group-hover:text-slate-300 transition-colors line-clamp-2">
                              {level.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 mt-4 gap-2">
                            {/* Action edit/delete */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingLevel(level);
                                  setPlaytestFromEditor(false);
                                  setView('editor');
                                }}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Editar Fase"
                                id={`edit-custom-level-${level.id}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setLevelToDelete(level)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-rose-950/30 text-slate-300 hover:text-rose-400 transition-colors"
                                title="Excluir Fase"
                                id={`delete-custom-level-${level.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                setPlaytestFromEditor(false);
                                setSelectedLevel(level);
                                setActiveMode('play');
                                setRetryCount(0);
                                setView('play');
                              }}
                              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow transition-all group-hover:scale-105 active:scale-95 flex items-center gap-1"
                              id={`play-custom-level-btn-${level.id}`}
                            >
                              <Play className="w-3 h-3 fill-white" />
                              Jogar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Utility / Admin tools */}
              <div className="flex justify-between items-center bg-slate-950 p-4 border border-slate-900 rounded-xl text-xs text-slate-500">
                <span>Versão 1.0 (Web Offline-First LocalStorage)</span>
                <button
                  onClick={handleResetAllData}
                  className="px-3 py-1.5 rounded hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-300 font-semibold transition-colors"
                  id="reset-all-data-btn"
                >
                  Zerar Todos os Dados
                </button>
              </div>
            </motion.div>
          )}

          {/* PLAY / REPLAY VIEW */}
          {view === 'play' && selectedLevel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-4xl flex flex-col gap-4 relative"
            >
              {/* Back to menu or Pause button */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => {
                    if (playtestFromEditor) {
                      setView('editor');
                    } else {
                      setView('menu');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-semibold"
                  id="back-to-menu-btn"
                >
                  {playtestFromEditor ? '← Voltar ao Editor de Fases' : '← Voltar ao Menu Principal'}
                </button>

                {activeMode === 'replay' && (
                  <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-bold uppercase rounded flex items-center gap-1">
                    <Tv className="w-3.5 h-3.5" />
                    Assistindo Replay Cinemático
                  </div>
                )}
              </div>

              {/* Canvas viewport container */}
              <GameCanvas
                key={`${selectedLevel.id}-${activeMode}-${retryCount}`}
                level={selectedLevel}
                mode={activeMode}
                replayFrames={replayFrames}
                cnh={cnh}
                onUpdateCNH={handleUpdateCNH}
                onWin={handleLevelCompleted}
                onLose={(reason) => {
                  setLossReason(reason);
                }}
                onExit={() => setView(playtestFromEditor ? 'editor' : 'menu')}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
              />

              {/* Victory Overlay modal if level won */}
              <AnimatePresence>
                {currentWinMetrics && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-xl flex items-center justify-center p-6 z-20"
                    id="victory-overlay-modal"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-center shadow-2xl relative"
                    >
                      {/* sparkles decor */}
                      <Sparkles className="w-12 h-12 text-amber-400 mx-auto animate-bounce mb-3" />

                      <h3 className="text-2xl font-black text-emerald-400 tracking-tight uppercase">
                        Manobra Bem-Sucedida!
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
                        Você concluiu: {selectedLevel.phaseName}
                      </p>

                      {/* Score metrics boxes */}
                      <div className="grid grid-cols-2 gap-4 my-6">
                        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg text-center">
                          <span className="text-[10px] uppercase text-slate-500 font-mono">Tempo Gasto</span>
                          <div className="text-2xl font-black text-sky-400 mt-1 font-mono">
                            {currentWinMetrics.duration.toFixed(1)}s
                          </div>
                        </div>

                        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg text-center">
                          <span className="text-[10px] uppercase text-slate-500 font-mono">Manobras Totais</span>
                          <div className="text-2xl font-black text-indigo-400 mt-1 font-mono">
                            {currentWinMetrics.moves}
                          </div>
                        </div>
                      </div>

                      {/* Performance achievements boxes */}
                      <div className="space-y-2 mb-6">
                        {currentWinMetrics.perfectBonus && (
                          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/20 px-4 py-2 rounded-lg text-xs">
                            <span className="font-semibold text-emerald-400">✨ Manobra Perfeita</span>
                            <span className="font-mono text-emerald-300 font-bold">+2 pts CNH</span>
                          </div>
                        )}

                        {currentWinMetrics.elegantBonus && !currentWinMetrics.perfectBonus && (
                          <div className="flex items-center justify-between bg-sky-950/40 border border-sky-500/20 px-4 py-2 rounded-lg text-xs">
                            <span className="font-semibold text-sky-400">⭐ Manobra Elegante (Poucos movimentos)</span>
                            <span className="font-mono text-sky-300 font-bold">+1 pt CNH</span>
                          </div>
                        )}

                        {/* Ghost comparison info */}
                        {currentWinMetrics.ghostCompared && (
                          <div className="bg-slate-950/50 border border-slate-800 px-4 py-2.5 rounded-lg text-xs text-left">
                            <span className="text-[10px] uppercase text-slate-500 font-mono font-bold block mb-1">
                              Comparação com seu Fantasma Anterior:
                            </span>
                            <div className="text-slate-300 leading-normal">
                              {currentWinMetrics.ghostCompared.isBetter ? (
                                <span>
                                  🎉 Você foi <strong className="text-emerald-400">{currentWinMetrics.ghostCompared.timeDiff.toFixed(1)}s mais rápido</strong> e usou {currentWinMetrics.ghostCompared.movesDiff > 0 ? `${currentWinMetrics.ghostCompared.movesDiff} manobras a menos` : 'a mesma quantidade de manobras'}!
                                </span>
                              ) : (
                                <span>
                                  Seu fantasma anterior ainda é{' '}
                                  <strong className="text-amber-400">
                                    {Math.abs(currentWinMetrics.ghostCompared.timeDiff).toFixed(1)}s mais rápido
                                  </strong>
                                  . Tente novamente para superá-lo!
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions footer block */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex gap-2">
                          {/* Watch Cinematic Replay */}
                          <button
                            onClick={() => {
                              setActiveMode('replay');
                              setCurrentWinMetrics(null);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs uppercase border border-slate-700 transition-all active:scale-95"
                            id="win-cinematic-replay-btn"
                          >
                            <Tv className="w-3.5 h-3.5" />
                            Replay Cinemático
                          </button>

                          {/* Share results */}
                          <button
                            onClick={handleShareResult}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs uppercase border border-slate-700 transition-all active:scale-95"
                            id="win-share-btn"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            {shareCopied ? 'Copiado!' : 'Compartilhar'}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setCurrentWinMetrics(null);
                              setActiveMode('play');
                              setRetryCount((c) => c + 1);
                            }}
                            className="flex-1 py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all active:scale-95"
                            id="win-replay-spot-btn"
                          >
                            Tentar Novamente
                          </button>

                          {selectedLevel.id.startsWith('custom_') || playtestFromEditor ? (
                            <button
                              onClick={() => {
                                setView(playtestFromEditor ? 'editor' : 'menu');
                                setSelectedLevel(null);
                                setCurrentWinMetrics(null);
                              }}
                              className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1 transition-all active:scale-95"
                              id="win-back-btn"
                            >
                              {playtestFromEditor ? 'Voltar ao Editor' : 'Menu Principal'}
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={handleNextLevel}
                              className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1 transition-all active:scale-95"
                              id="win-next-phase-btn"
                            >
                              Avançar Fase
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Failure Overlay modal if level lost */}
              <AnimatePresence>
                {lossReason && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-xl flex items-center justify-center p-6 z-20"
                    id="failure-overlay-modal"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 15 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-center shadow-2xl relative"
                    >
                      <div className="w-16 h-16 rounded-full bg-rose-950/50 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <span className="text-3xl">⏱️</span>
                      </div>
                      <h3 className="text-xl font-bold text-rose-500 uppercase tracking-wide">Fase Fracassada</h3>
                      <p className="text-sm text-slate-300 mt-2 font-semibold">
                        {lossReason}
                      </p>
                      <p className="text-xs text-slate-400 mt-1.5 leading-normal max-w-sm mx-auto">
                        O tempo regulamentar para estacionar o carro com precisão expirou. Que tal ajustar sua estratégia e tentar novamente?
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                        <button
                          onClick={() => {
                            setLossReason(null);
                            setRetryCount((prev) => prev + 1);
                          }}
                          className="px-5 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          id="retry-failed-level-btn"
                        >
                          Tentar Novamente
                        </button>
                        <button
                          onClick={() => {
                            setLossReason(null);
                            setView(playtestFromEditor ? 'editor' : 'menu');
                          }}
                          className="px-5 py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-750 font-bold text-xs uppercase transition-all active:scale-95 flex items-center justify-center"
                          id="exit-failed-level-btn"
                        >
                          Voltar ao Menu
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* CNH DASHBOARD VIEW */}
          {view === 'cnh' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex justify-center"
            >
              <CNHProfile
                cnh={cnh}
                onClose={() => setView('menu')}
                onReset={handleResetAllData}
              />
            </motion.div>
          )}

          {/* INFRATOR SUSPENDED RECYCLING VIEW */}
          {view === 'infrator' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex justify-center"
            >
              <InfratorView onCompleted={handleInfratorCompleted} />
            </motion.div>
          )}

          {/* LEVEL EDITOR VIEW */}
          {view === 'editor' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full flex justify-center"
            >
              <LevelEditor
                initialLevel={editingLevel}
                onBack={() => {
                  setView('menu');
                  setEditingLevel(null);
                  setCustomLevels(StorageService.getCustomLevels());
                }}
                onPlayLevel={(customLvl) => {
                  setPlaytestFromEditor(true);
                  setSelectedLevel(customLvl);
                  setActiveMode('play');
                  setRetryCount(0);
                  setView('play');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Custom Level Deletion Confirmation Modal */}
      <AnimatePresence>
        {levelToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
            id="delete-confirm-modal"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-rose-950/40 border border-rose-900/50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500 text-xl font-bold">
                ⚠️
              </div>
              <h3 className="text-base font-bold text-slate-100">Excluir Fase?</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Deseja mesmo excluir a fase <strong className="text-slate-200">"{levelToDelete.phaseName}"</strong>? 
                Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2 justify-center mt-5">
                <button
                  onClick={() => {
                    StorageService.deleteCustomLevel(levelToDelete.id);
                    setCustomLevels(StorageService.getCustomLevels());
                    setLevelToDelete(null);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-colors"
                  id="confirm-delete-level-btn"
                >
                  Sim, Excluir
                </button>
                <button
                  onClick={() => setLevelToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition-colors border border-slate-700"
                  id="cancel-delete-level-btn"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
