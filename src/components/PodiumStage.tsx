import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Trophy, Crown, Download, Share2, Award, Sparkles, ArrowRight } from 'lucide-react';
import { ParticipantData, EventData } from '../types';
import { sounds } from '../lib/sounds';

interface PodiumStageProps {
  event: EventData;
  participants: ParticipantData[];
  onRestartOrNew: () => void;
}

export const PodiumStage: React.FC<PodiumStageProps> = ({ event, participants, onRestartOrNew }) => {
  // Sort participants by score descending
  const sorted = [...participants].sort((a, b) => b.score - a.score);
  const top5 = sorted.slice(0, 5);

  // Reveal step index: 0 = hidden, 1 = 5th place, 2 = 4th place, 3 = 3rd place, 4 = 2nd place, 5 = 1st place!
  const [revealStep, setRevealStep] = useState<number>(0);
  const podiumRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Sequential staged animation for cinematic climax
    const timer1 = setTimeout(() => {
      setRevealStep(1); // 5th place
      sounds.playClick();
    }, 1000);

    const timer2 = setTimeout(() => {
      setRevealStep(2); // 4th place
      sounds.playClick();
    }, 2500);

    const timer3 = setTimeout(() => {
      setRevealStep(3); // 3rd (Bronze)
      sounds.playApplause();
    }, 4200);

    const timer4 = setTimeout(() => {
      setRevealStep(4); // 2nd (Silver)
      sounds.playApplause();
    }, 6000);

    const timer5 = setTimeout(() => {
      setRevealStep(5); // 1st (Gold) Champion!
      sounds.playFanfare();
      triggerConfettiExplosion();
    }, 8000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, []);

  const triggerConfettiExplosion = () => {
    const count = 250;
    const defaults = { origin: { y: 0.7 } };

    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    };

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleDownloadBadgePNG = async () => {
    if (!podiumRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(podiumRef.current, {
        scale: 2,
        backgroundColor: '#0a0d14',
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `PulseArena_${event.title.replace(/\s+/g, '_')}_Podium.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export podium PNG', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!podiumRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(podiumRef.current, {
        scale: 2,
        backgroundColor: '#0a0d14',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, pdfHeight);
      pdf.save(`PulseArena_${event.title.replace(/\s+/g, '_')}_Official_Results.pdf`);
    } catch (err) {
      console.error('Failed to export PDF', err);
    } finally {
      setIsExporting(false);
    }
  };

  const champion = top5[0];
  const shareText = encodeURIComponent(
    `🏆 Exciting results from "${event.title}" on PulseArena! Winner: ${champion ? champion.nickname : 'Champion'} with ${champion ? champion.score : 0} pts!`
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#06080e] via-[#0d1322] to-[#04060a] flex flex-col items-center justify-between p-6 md:p-10 text-white overflow-hidden select-none">
      {/* Cinematic Spotlight Beams */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-96 h-[800px] bg-gradient-to-b from-indigo-500/20 via-blue-500/5 to-transparent rotate-12 blur-3xl transform -translate-x-1/2" />
        <div className="absolute -top-32 right-1/4 w-96 h-[800px] bg-gradient-to-b from-amber-500/20 via-yellow-500/5 to-transparent -rotate-12 blur-3xl transform translate-x-1/2" />
      </div>

      {/* Header bar */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Official Victory Podium
            </h1>
            <p className="text-xs text-slate-400 font-medium">{event.title} • PIN: {event.pin}</p>
          </div>
        </div>

        {/* Share & Export controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadBadgePNG}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            Badge PNG
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Official PDF
          </button>
          <a
            href={`https://api.whatsapp.com/send?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 border border-[#0A66C2]/40 text-[#0A66C2] text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            LinkedIn
          </a>
        </div>
      </div>

      {/* Main Podium Stage Capture Container */}
      <div
        ref={podiumRef}
        className="relative z-10 w-full max-w-5xl py-8 px-4 flex flex-col items-center justify-center"
      >
        {/* Top 3 Pedestals */}
        <div className="w-full flex items-end justify-center gap-3 md:gap-8 pt-16 pb-4">
          {/* 2nd Place (Silver) */}
          <div className="flex-1 max-w-[220px] flex flex-col items-center">
            {top5[1] && (
              <div
                className={`flex flex-col items-center w-full transition-all duration-700 transform ${
                  revealStep >= 4 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90'
                }`}
              >
                <div className="relative mb-3">
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-xl border-4 border-slate-300"
                    style={{ backgroundColor: top5[1].avatar_color || '#64748b' }}
                  >
                    {top5[1].nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-2 bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                    2ND
                  </div>
                </div>

                <div className="text-center mb-2">
                  <h3 className="font-extrabold text-base md:text-lg text-white truncate max-w-[180px]">
                    {top5[1].nickname}
                  </h3>
                  <p className="text-slate-300 font-bold text-sm">{top5[1].score.toLocaleString()} pts</p>
                </div>

                {/* Silver Pedestal */}
                <div className="w-full h-44 md:h-56 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-2xl border-t-2 border-slate-300/60 shadow-2xl flex flex-col items-center justify-start pt-4">
                  <div className="w-12 h-12 rounded-full bg-slate-700/80 border border-slate-400 flex items-center justify-center text-slate-200 font-black text-2xl shadow-inner">
                    2
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 1st Place (Gold Winner) */}
          <div className="flex-1 max-w-[260px] flex flex-col items-center">
            {top5[0] && (
              <div
                className={`flex flex-col items-center w-full transition-all duration-1000 transform ${
                  revealStep >= 5 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-16 scale-90'
                }`}
              >
                <div className="relative mb-3">
                  {/* Gold Crown */}
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 text-amber-400 animate-bounce">
                    <Crown className="w-9 h-9 fill-amber-400 stroke-amber-200 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                  </div>
                  <div
                    className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center text-white font-black text-2xl md:text-4xl shadow-2xl border-4 border-amber-400 ring-8 ring-amber-400/20"
                    style={{ backgroundColor: top5[0].avatar_color || '#f59e0b' }}
                  >
                    {top5[0].nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-2 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-amber-950 text-xs font-black px-3.5 py-0.5 rounded-full shadow-lg">
                    1ST GOLD
                  </div>
                </div>

                <div className="text-center mb-2">
                  <h3 className="font-black text-lg md:text-2xl text-amber-300 truncate max-w-[220px]">
                    {top5[0].nickname}
                  </h3>
                  <p className="text-amber-200 font-extrabold text-base md:text-lg">
                    {top5[0].score.toLocaleString()} pts
                  </p>
                </div>

                {/* Gold Pedestal */}
                <div className="w-full h-56 md:h-72 bg-gradient-to-t from-amber-900/80 via-amber-600/90 to-amber-400 rounded-t-2xl border-t-2 border-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.3)] flex flex-col items-center justify-start pt-5">
                  <div className="w-14 h-14 rounded-full bg-amber-300/40 border border-amber-200 flex items-center justify-center text-amber-950 font-black text-3xl shadow-inner">
                    1
                  </div>
                  <Sparkles className="w-6 h-6 text-amber-100 mt-2 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* 3rd Place (Bronze) */}
          <div className="flex-1 max-w-[220px] flex flex-col items-center">
            {top5[2] && (
              <div
                className={`flex flex-col items-center w-full transition-all duration-700 transform ${
                  revealStep >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-90'
                }`}
              >
                <div className="relative mb-3">
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-xl border-4 border-amber-700"
                    style={{ backgroundColor: top5[2].avatar_color || '#b45309' }}
                  >
                    {top5[2].nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-2 bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                    3RD
                  </div>
                </div>

                <div className="text-center mb-2">
                  <h3 className="font-extrabold text-base md:text-lg text-white truncate max-w-[180px]">
                    {top5[2].nickname}
                  </h3>
                  <p className="text-amber-300/80 font-bold text-sm">{top5[2].score.toLocaleString()} pts</p>
                </div>

                {/* Bronze Pedestal */}
                <div className="w-full h-36 md:h-44 bg-gradient-to-t from-stone-900 to-amber-800/80 rounded-t-2xl border-t-2 border-amber-600/60 shadow-2xl flex flex-col items-center justify-start pt-4">
                  <div className="w-12 h-12 rounded-full bg-amber-900/80 border border-amber-600 flex items-center justify-center text-amber-200 font-black text-2xl shadow-inner">
                    3
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4th and 5th Runners Up */}
        <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {/* 4th Place Card */}
          {top5[3] && (
            <div
              className={`p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between transition-all duration-500 transform ${
                revealStep >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-400">
                  4th
                </span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: top5[3].avatar_color || '#3b82f6' }}
                >
                  {top5[3].nickname.slice(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-sm text-slate-200">{top5[3].nickname}</span>
              </div>
              <span className="text-xs font-bold text-slate-400">{top5[3].score.toLocaleString()} pts</span>
            </div>
          )}

          {/* 5th Place Card */}
          {top5[4] && (
            <div
              className={`p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between transition-all duration-500 transform ${
                revealStep >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-400">
                  5th
                </span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: top5[4].avatar_color || '#10b981' }}
                >
                  {top5[4].nickname.slice(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-sm text-slate-200">{top5[4].nickname}</span>
              </div>
              <span className="text-xs font-bold text-slate-400">{top5[4].score.toLocaleString()} pts</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Return / Play Again */}
      <div className="relative z-10 w-full max-w-md pt-4 flex flex-col items-center gap-2">
        <button
          onClick={onRestartOrNew}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-base rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition transform active:scale-95"
        >
          <span>Host New Event or Return Home</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
