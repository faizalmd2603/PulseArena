import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import {
  Play,
  Volume2,
  VolumeX,
  Users,
  Settings,
  ChevronRight,
  Trophy,
  HelpCircle,
  BarChart2,
  Clock,
  Sparkles,
  QrCode as QrIcon,
  Flame,
  CheckCircle,
  Sliders,
  Music,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { EventData, QuestionData, ParticipantData, ResponseData, KAHOOT_COLORS } from '../types';
import { sounds } from '../lib/sounds';
import { ReactionRain } from './ReactionRain';
import { QuizEditorModal } from './QuizEditorModal';
import { PodiumStage } from './PodiumStage';
import { getShapeIcon } from './ShapeIcons';

interface HostStageProps {
  eventId: string;
  onExit: () => void;
}

export const HostStage: React.FC<HostStageProps> = ({ eventId, onExit }) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [responses, setResponses] = useState<ResponseData[]>([]);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editorTab, setEditorTab] = useState<'ai' | 'manual'>('ai');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Countdown timer in Active question phase
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // 3-2-1 teaser countdown
  const [teaserCountdown, setTeaserCountdown] = useState<number>(3);

  // Load Event and Listen to Firestore Realtime Updates
  useEffect(() => {
    if (!eventId) return;

    // Listen to Event doc
    const unsubEvent = onSnapshot(doc(db, 'events', eventId), (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as EventData;
        setEvent(data);
      }
    });

    // Listen to Questions
    const qQuestions = query(collection(db, 'questions'), where('event_id', '==', eventId));
    const unsubQuestions = onSnapshot(qQuestions, (snapshot) => {
      const qs: QuestionData[] = [];
      snapshot.forEach((d) => {
        qs.push({ id: d.id, ...d.data() } as QuestionData);
      });
      qs.sort((a, b) => a.question_order - b.question_order);
      setQuestions(qs);
    });

    // Listen to Participants
    const qParticipants = query(collection(db, 'participants'), where('event_id', '==', eventId));
    const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
      const parts: ParticipantData[] = [];
      snapshot.forEach((d) => {
        parts.push({ id: d.id, ...d.data() } as ParticipantData);
      });
      setParticipants(parts);
    });

    return () => {
      unsubEvent();
      unsubQuestions();
      unsubParticipants();
      sounds.stopLobbyBgm();
    };
  }, [eventId]);

  // Generate QR Code for Mobile joining
  useEffect(() => {
    if (event?.pin) {
      const joinUrl = `${window.location.origin}/#pin=${event.pin}`;
      QRCode.toDataURL(joinUrl, {
        width: 280,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      }).then((url) => {
        setQrDataUrl(url);
      });
    }
  }, [event?.pin]);

  // Handle Lobby BGM with Howler.js
  useEffect(() => {
    if (event?.phase === 'lobby') {
      sounds.startLobbyBgm();
    } else {
      sounds.stopLobbyBgm();
    }
  }, [event?.phase]);

  // Listen to Responses for the current question
  const currentQ = questions[event?.current_question_index ?? 0];
  useEffect(() => {
    if (!eventId || !currentQ) return;

    const qResponses = query(
      collection(db, 'responses'),
      where('event_id', '==', eventId),
      where('question_id', '==', currentQ.id)
    );

    const unsubResponses = onSnapshot(qResponses, (snapshot) => {
      const res: ResponseData[] = [];
      snapshot.forEach((d) => {
        res.push({ id: d.id, ...d.data() } as ResponseData);
      });
      setResponses(res);
    });

    return () => unsubResponses();
  }, [eventId, currentQ?.id]);

  // Teaser Countdown Loop (3 -> 2 -> 1 -> Active)
  useEffect(() => {
    if (event?.phase === 'teaser') {
      setTeaserCountdown(3);
      sounds.playCountdownBeep(false);

      const interval = setInterval(() => {
        setTeaserCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            sounds.playCountdownBeep(true);
            advanceToActiveQuestion();
            return 0;
          }
          sounds.playCountdownBeep(false);
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [event?.phase, event?.current_question_index]);

  // Active Timer Loop
  useEffect(() => {
    let interval: any = null;
    if (event?.phase === 'active' && currentQ) {
      const duration = currentQ.duration_seconds || 20;
      setTimeLeft(duration);
      setTimerRunning(true);
      setShowExplanation(false);

      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimerRunning(false);
            revealCurrentAnswer();
            return 0;
          }
          if (prev <= 6) {
            sounds.playTick(true); // Urgent fast ticking countdown
          } else {
            sounds.playTick(false); // Normal ticking countdown
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [event?.phase, currentQ?.id]);

  // Auto-reveal if all joined participants answered
  useEffect(() => {
    if (
      event?.phase === 'active' &&
      participants.length > 0 &&
      responses.length >= participants.length
    ) {
      revealCurrentAnswer();
    }
  }, [responses.length, participants.length, event?.phase]);

  // Audio Controls & State Transitions
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    sounds.setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      sounds.setMuted(false);
    }
  };

  const startQuiz = async () => {
    if (!event) return;
    sounds.stopLobbyBgm();
    sounds.playClick();
    await updateDoc(doc(db, 'events', event.id), {
      status: 'active',
      phase: 'teaser',
      current_question_index: 0,
      phase_start_time: Date.now(),
    });
  };

  const advanceToActiveQuestion = async () => {
    if (!event) return;
    await updateDoc(doc(db, 'events', event.id), {
      phase: 'active',
      phase_start_time: Date.now(),
    });
  };

  const revealCurrentAnswer = async () => {
    if (!event) return;
    sounds.playFanfare();
    await updateDoc(doc(db, 'events', event.id), {
      phase: 'reveal',
      phase_start_time: Date.now(),
    });
  };

  const showScoreboard = async () => {
    if (!event) return;
    sounds.playClick();
    await updateDoc(doc(db, 'events', event.id), {
      phase: 'scoreboard',
      phase_start_time: Date.now(),
    });
  };

  const nextQuestionOrPodium = async () => {
    if (!event) return;
    sounds.playClick();
    const nextIdx = event.current_question_index + 1;
    if (nextIdx >= questions.length) {
      // Reached end -> Trigger Podium Stage!
      await updateDoc(doc(db, 'events', event.id), {
        status: 'ended',
        phase: 'podium',
        phase_start_time: Date.now(),
      });
    } else {
      // Advance to next question teaser
      await updateDoc(doc(db, 'events', event.id), {
        phase: 'teaser',
        current_question_index: nextIdx,
        phase_start_time: Date.now(),
      });
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-slate-300">Loading PulseArena Event...</span>
        </div>
      </div>
    );
  }

  // --- PODIUM STAGE ---
  if (event.phase === 'podium') {
    return <PodiumStage event={event} participants={participants} onRestartOrNew={onExit} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white flex flex-col justify-between overflow-x-hidden relative select-none">
      {/* Realtime Emoji Reaction Rain Layer */}
      <ReactionRain eventId={event.id} />

      {/* Top Navbar */}
      <header className="px-6 py-4 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-black shadow-lg shadow-indigo-500/30">
              P
            </div>
            <div>
              <h1 className="font-black tracking-tight text-white text-base md:text-lg flex items-center gap-2">
                PulseArena
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  HOST STAGE
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium truncate max-w-xs">{event.title}</p>
            </div>
          </div>
        </div>

        {/* Center PIN & Join Link Info */}
        <div className="hidden md:flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-5 py-2 rounded-2xl shadow-inner">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Join at <strong className="text-white">PulseArena</strong> with PIN:
          </span>
          <span className="text-2xl font-black tracking-widest text-amber-400 bg-amber-400/10 px-3 py-0.5 rounded-xl border border-amber-400/30">
            {event.pin}
          </span>
        </div>

        {/* Right Tools: Audio volume controls, AI Quiz Generator Button, Participant Count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>{participants.length}</span>
          </div>

          {/* Audio Controls with Howler.js */}
          <div className="relative flex items-center">
            <button
              onClick={toggleMute}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowVolumeSlider(!showVolumeSlider);
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition flex items-center gap-1.5"
              title={isMuted ? 'Audio Muted (Click to Unmute)' : `Audio Active (${Math.round(volume * 100)}%)`}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {/* Quick volume popover trigger */}
            <button
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="p-1 text-slate-400 hover:text-white"
              title="Adjust Volume"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Volume slider popover */}
            {showVolumeSlider && (
              <div className="absolute right-0 top-12 bg-slate-900 border border-slate-700 p-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 z-30 w-36">
                <div className="flex justify-between w-full text-[10px] font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Music className="w-3 h-3 text-indigo-400" /> Audio
                  </span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* AI Generator & Slide Deck Editor button */}
          {event.phase === 'lobby' && (
            <button
              onClick={() => {
                sounds.playClick();
                setEditorTab('ai');
                setIsEditorOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-purple-600/25 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI Quiz Generator</span>
            </button>
          )}

          <button
            onClick={onExit}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 transition"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Screen Body by Phase */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 z-10">
        {/* PHASE 1: LOBBY */}
        {event.phase === 'lobby' && (
          <div className="w-full max-w-5xl flex flex-col items-center space-y-8 animate-fadeIn">
            {/* PIN & QR Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full items-center bg-slate-900/60 border border-slate-800/80 p-8 rounded-3xl shadow-2xl backdrop-blur-md">
              <div className="flex flex-col items-center md:items-start space-y-4">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Live Multiplayer Lobby
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
                  Join the Arena!
                </h2>
                <p className="text-slate-400 text-sm md:text-base">
                  Scan the QR code or enter the Game PIN on your mobile device or controller.
                </p>

                <div className="w-full bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-bold block">
                      Game PIN
                    </span>
                    <span className="text-4xl md:text-5xl font-black tracking-widest text-amber-400">
                      {event.pin}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-400/10 rounded-xl text-amber-400">
                    <QrIcon className="w-8 h-8" />
                  </div>
                </div>

                <div className="pt-2 w-full flex flex-col gap-2">
                  <button
                    onClick={startQuiz}
                    disabled={questions.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 transition transform active:scale-98 disabled:opacity-50"
                  >
                    <Play className="w-6 h-6 fill-current" />
                    <span>Start Game ({questions.length} Slides)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setEditorTab('ai');
                      setIsEditorOpen(true);
                    }}
                    className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-purple-500/40 text-purple-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Customize Questions or Generate with AI ({questions.length})</span>
                  </button>

                  {questions.length === 0 && (
                    <p className="text-xs text-red-400 mt-1 text-center font-bold">
                      Please generate questions with Gemini AI or create manually!
                    </p>
                  )}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-xl">
                {qrDataUrl ? (
                  <div className="bg-white p-3 rounded-2xl shadow-2xl">
                    <img src={qrDataUrl} alt="Join QR Code" className="w-56 h-56 rounded-xl" />
                  </div>
                ) : (
                  <div className="w-56 h-56 bg-slate-800 rounded-xl animate-pulse" />
                )}
                <span className="text-xs text-slate-400 font-bold mt-4">
                  Point mobile camera to join instantly
                </span>
              </div>
            </div>

            {/* Joined Players Avatars Grid */}
            <div className="w-full bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Players in Arena ({participants.length})
                </h3>
                <span className="text-xs text-slate-500">
                  {participants.length === 0 ? 'Waiting for players to connect...' : 'Ready for battle'}
                </span>
              </div>

              {participants.length === 0 ? (
                <div className="py-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                  <p className="text-sm">No players joined yet. Use another tab or mobile device to join!</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md animate-scaleIn"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-sm"
                        style={{ backgroundColor: p.avatar_color || '#6366f1' }}
                      >
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-slate-100">{p.nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 2: QUESTION TEASER (3-2-1 countdown) */}
        {event.phase === 'teaser' && currentQ && (
          <div className="w-full max-w-3xl flex flex-col items-center justify-center text-center space-y-8 animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-sm font-black tracking-widest uppercase">
                Question {event.current_question_index + 1} of {questions.length}
              </span>
              {currentQ.multiplier > 1 && (
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  {currentQ.multiplier}x Points!
                </span>
              )}
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
              {currentQ.prompt}
            </h2>

            {/* Huge countdown circle */}
            <div className="w-32 h-32 rounded-full border-4 border-indigo-500 bg-indigo-600/10 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <span className="text-6xl font-black text-indigo-400 animate-ping">
                {teaserCountdown}
              </span>
            </div>
          </div>
        )}

        {/* PHASE 3 & 4: ACTIVE QUESTION & ANSWER REVEAL */}
        {(event.phase === 'active' || event.phase === 'reveal') && currentQ && (
          <div className="w-full max-w-5xl flex flex-col space-y-6">
            {/* Top Prompt Banner & Countdown Bar */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                  Slide {event.current_question_index + 1} / {questions.length} •{' '}
                  {currentQ.question_type === 'presentation' ? 'Presentation Slide' : 'Quiz'}
                </span>

                {/* Live Answered Count */}
                {currentQ.question_type === 'quiz' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span>Answers Submitted:</span>
                    <span className="text-emerald-400 text-sm font-black">
                      {responses.length} / {participants.length}
                    </span>
                  </div>
                )}
              </div>

              <h2 className="text-2xl md:text-4xl font-black text-white leading-snug">
                {currentQ.prompt}
              </h2>

              {/* Timer Progress Bar (Active phase) */}
              {event.phase === 'active' && (
                <div className="w-full space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> Time Remaining
                    </span>
                    <span
                      className={`text-base font-black ${
                        timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`}
                    >
                      {timeLeft}s
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                        timeLeft <= 5
                          ? 'bg-gradient-to-r from-amber-500 to-red-500'
                          : 'bg-gradient-to-r from-indigo-500 to-cyan-500'
                      }`}
                      style={{
                        width: `${(timeLeft / (currentQ.duration_seconds || 20)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Answer Options Grid (Quiz mode) */}
            {currentQ.question_type === 'quiz' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options.map((opt, idx) => {
                  const color = KAHOOT_COLORS[idx % 4];
                  const isCorrect = currentQ.correct_option_index === idx;
                  const isRevealed = event.phase === 'reveal';

                  // Count votes for this option
                  const votes = responses.filter((r) => r.selected_option === idx).length;
                  const pct = responses.length > 0 ? Math.round((votes / responses.length) * 100) : 0;

                  return (
                    <div
                      key={idx}
                      className={`relative overflow-hidden p-6 rounded-2xl border-2 transition-all duration-500 flex flex-col justify-between min-h-[110px] ${
                        color.bg
                      } ${
                        isRevealed
                          ? isCorrect
                            ? 'border-emerald-300 ring-4 ring-emerald-400/40 shadow-2xl scale-[1.02]'
                            : 'opacity-40 grayscale-[40%] border-transparent'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center text-white">
                            {getShapeIcon(idx, 'w-5 h-5')}
                          </div>
                          <span className="text-xl md:text-2xl font-black text-white drop-shadow-md">
                            {opt}
                          </span>
                        </div>

                        {/* If revealed, show checkmark or vote count */}
                        {isRevealed && isCorrect && (
                          <div className="bg-white text-emerald-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-md">
                            <CheckCircle className="w-4 h-4 fill-current text-emerald-600" />
                            Correct
                          </div>
                        )}
                      </div>

                      {/* Vote breakdown bar when revealed */}
                      {isRevealed && (
                        <div className="mt-4 pt-2 border-t border-black/20 flex items-center justify-between text-white font-black text-sm z-10">
                          <span>
                            {votes} Vote{votes !== 1 ? 's' : ''}
                          </span>
                          <span>{pct}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Presentation Slide Content Screen */
              <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <Sparkles className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white">Interactive Reaction Mode Active</h3>
                <p className="text-slate-300 max-w-lg text-sm">
                  Audience members can tap floating emojis on their mobile controller to cheer, clap, and interact live on the projector screen!
                </p>
                <div className="flex gap-4 text-3xl pt-2">
                  <span>❤️</span>
                  <span>🔥</span>
                  <span>👏</span>
                  <span>💡</span>
                  <span>🚀</span>
                </div>
              </div>
            )}

            {/* Explanation card (when revealed) */}
            {event.phase === 'reveal' && currentQ.explanation && (
              <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-700/60 text-indigo-200 text-sm flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-white font-bold mb-0.5">Educational Note / Explanation:</strong>
                  {currentQ.explanation}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PHASE 5: SCOREBOARD */}
        {event.phase === 'scoreboard' && (
          <div className="w-full max-w-3xl flex flex-col space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" /> Live Leaderboard
                </span>
                <h2 className="text-3xl font-black text-white">Current Standings</h2>
              </div>
              <span className="text-xs text-slate-400">Top 5 Players</span>
            </div>

            <div className="space-y-3">
              {[...participants]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition transform shadow-lg ${
                      idx === 0
                        ? 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-amber-500/40 ring-1 ring-amber-500/20'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                        style={{ backgroundColor: p.avatar_color || '#6366f1' }}
                      >
                        {p.nickname.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-white">{p.nickname}</h4>
                        {p.streak > 1 && (
                          <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                            <Flame className="w-3 h-3 fill-current" /> {p.streak} streak
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xl font-black text-white">{p.score.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 block">points</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Host Bottom Control Bar */}
      <footer className="px-6 py-4 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Phase: <strong className="text-slate-200 uppercase">{event.phase}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {event.phase === 'active' && (
            <button
              onClick={revealCurrentAnswer}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
            >
              <BarChart2 className="w-4 h-4" />
              <span>Reveal Answers Early</span>
            </button>
          )}

          {event.phase === 'reveal' && (
            <button
              onClick={showScoreboard}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              <Trophy className="w-4 h-4" />
              <span>Show Leaderboard</span>
            </button>
          )}

          {event.phase === 'scoreboard' && (
            <button
              onClick={nextQuestionOrPodium}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
            >
              <span>
                {event.current_question_index + 1 >= questions.length
                  ? 'Reveal Victory Podium 🏆'
                  : 'Next Question'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* Quiz & Slide Deck Editor Modal with AI Generator Form */}
      <QuizEditorModal
        isOpen={isEditorOpen}
        initialTab={editorTab}
        onClose={() => setIsEditorOpen(false)}
        questions={questions}
        onSaveQuestions={async (updated) => {
          // Sync questions to Firestore
          for (let i = 0; i < updated.length; i++) {
            const q = updated[i];
            const qRef = doc(db, 'questions', q.id || `q_${Date.now()}_${i}`);
            await updateDoc(qRef, {
              event_id: event.id,
              question_order: i + 1,
              question_type: q.question_type,
              prompt: q.prompt,
              options: q.options,
              correct_option_index: q.correct_option_index,
              duration_seconds: q.duration_seconds,
              multiplier: q.multiplier,
              explanation: q.explanation || '',
            }).catch(async () => {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(qRef, {
                event_id: event.id,
                question_order: i + 1,
                question_type: q.question_type,
                prompt: q.prompt,
                options: q.options,
                correct_option_index: q.correct_option_index,
                duration_seconds: q.duration_seconds,
                multiplier: q.multiplier,
                explanation: q.explanation || '',
              });
            });
          }
        }}
      />
    </div>
  );
};
