/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CNHState } from '../types';
import { Shield, ShieldAlert, ShieldX, Award, HelpCircle, History, Clock } from 'lucide-react';

interface CNHProfileProps {
  cnh: CNHState;
  onClose: () => void;
  onReset: () => void;
}

export default function CNHProfile({ cnh, onClose, onReset }: CNHProfileProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Determine color status
  const getStatusConfig = () => {
    switch (cnh.status) {
      case 'maximum':
        return {
          bg: 'bg-emerald-950/40',
          border: 'border-emerald-500/50',
          text: 'text-emerald-400',
          desc: 'Excelente motorista! Vagas VIP liberadas e NPCs elogiosos.',
          icon: <Shield className="w-12 h-12 text-emerald-400" />
        };
      case 'normal':
        return {
          bg: 'bg-sky-950/40',
          border: 'border-sky-500/50',
          text: 'text-sky-400',
          desc: 'Direção correta. Sem consequências especiais.',
          icon: <Shield className="w-12 h-12 text-sky-400" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/40',
          border: 'border-amber-500/50',
          text: 'text-amber-400',
          desc: 'Atenção redobrada! Fiscais de trânsito 2× mais frequentes nas ruas.',
          icon: <ShieldAlert className="w-12 h-12 text-amber-400 animate-pulse" />
        };
      case 'critical':
        return {
          bg: 'bg-rose-950/40',
          border: 'border-rose-500/50',
          text: 'text-rose-400',
          desc: 'Risco iminente de suspensão! Timer de fases −20% e NPCs hostis.',
          icon: <ShieldAlert className="w-12 h-12 text-rose-400 animate-bounce" />
        };
      case 'suspended':
      default:
        return {
          bg: 'bg-red-950/50',
          border: 'border-red-600/60',
          text: 'text-red-500',
          desc: 'CNH suspensa! Você não pode dirigir. Ative o modo de reciclagem a pé / ônibus para recuperar sua licença.',
          icon: <ShieldX className="w-12 h-12 text-red-500 animate-ping" />
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl p-6 max-w-2xl w-full mx-auto text-slate-100 animate-in fade-in zoom-in duration-150" id="cnh-profile-panel">
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Carteira de Habilitação Viva</h2>
          <p className="text-xs text-slate-400 mt-1">Sua identidade e histórico nas ruas</p>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          id="close-cnh-btn"
        >
          Voltar ao Menu
        </button>
      </div>

      {/* Main card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: License Visual Card */}
        <div className={`flex flex-col rounded-xl p-5 border ${config.border} ${config.bg} shadow-md justify-between h-64`}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase leading-none">REPÚBLICA DO PARKING</span>
              <span className="text-lg font-bold mt-1 text-slate-200">Carteira de Habilitação</span>
            </div>
            {config.icon}
          </div>

          <div className="my-3">
            <div className="text-xs text-slate-400">Classificação por Estilo:</div>
            <div className="text-2xl font-black text-amber-400 tracking-tight flex items-center gap-1.5 mt-0.5">
              <Award className="w-5 h-5 text-amber-400" />
              {cnh.styleNickname}
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-slate-800/60 pt-3">
            <div>
              <div className="text-[9px] uppercase text-slate-400 font-mono">Pontuação atual</div>
              <div className={`text-3xl font-extrabold ${config.text}`}>{cnh.points} / 20</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase text-slate-400 font-mono">Status da licença</div>
              <div className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
                {cnh.status === 'maximum' ? 'MÁXIMO VIP' : cnh.status === 'normal' ? 'NORMAL' : cnh.status === 'warning' ? 'ATENÇÃO' : cnh.status === 'critical' ? 'CRÍTICO' : 'SUSPENSA'}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Stats and Info */}
        <div className="flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-1.5">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              Status de Direção
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800">
              {config.desc}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-center">
                <div className="text-[10px] uppercase text-slate-400">Colisões Totais</div>
                <div className="text-xl font-bold text-rose-400 mt-1 font-mono">{cnh.totalCollisions}</div>
              </div>
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 text-center">
                <div className="text-[10px] uppercase text-slate-400">Vagas Perfeitas</div>
                <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{cnh.totalPerfectParks}</div>
              </div>
            </div>
          </div>

          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full mt-4 py-2 rounded bg-slate-950/60 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/60 text-slate-400 hover:text-rose-300 text-xs font-semibold transition-all duration-150"
              id="reset-cnh-btn"
            >
              Zerar e Reiniciar Histórico
            </button>
          ) : (
            <div className="mt-4 p-3 rounded bg-rose-950/25 border border-rose-900/40 text-center">
              <span className="text-[11px] text-rose-300 font-bold block mb-2 leading-relaxed">
                Tem certeza? Todo o progresso e CNH serão reiniciados do zero!
              </span>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    onReset();
                    setShowResetConfirm(false);
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-colors shadow-md"
                >
                  Sim, Resetar
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded text-xs font-bold border border-slate-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Log */}
      <div className="mt-8">
        <h3 className="font-semibold text-sm text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-1.5 mb-3">
          <History className="w-4 h-4 text-slate-400" />
          Histórico Recente de Multas e Conquistas
        </h3>

        <div className="bg-slate-950/40 border border-slate-800 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-800/60" id="cnh-history-list">
          {cnh.history.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">Nenhum evento registrado ainda nas ruas.</div>
          ) : (
            cnh.history.map((h, idx) => (
              <div key={idx} className="flex justify-between items-center px-4 py-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300 font-medium">{h.event}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className={`font-bold ${h.pointsDelta > 0 ? 'text-emerald-400' : h.pointsDelta < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {h.pointsDelta > 0 ? `+${h.pointsDelta}` : h.pointsDelta === 0 ? '0' : h.pointsDelta} pts
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
