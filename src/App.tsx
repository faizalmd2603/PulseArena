import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from 'firebase/firestore';
import {
  Sparkles,
  Zap,
  Play,
  Users,
  Trophy,
  ArrowRight,
  Plus,
  Gamepad2,
  Tv,
  Smartphone,
  ShieldAlert,
} from 'lucide-react';
import { db } from './lib/firebase';
import { HostStage } from './components/HostStage';
import { PlayerMobileController } from './components/PlayerMobileController';
import { sounds } from './lib/sounds';
import { AVATAR_COLORS, EventData, QuestionData } from './types';

export default function App() {
  // Navigation / Mode state: 'home' | 'host' | 'player'
  const [currentMode, setCurrentMode] = useState<'home' | 'host' | 'player'>('home');
  const [activeEventId, setActiveEventId] = useState<string>('');
  const [participantId, setParticipantId] = useState<string>('');

  // Player Join form states
  const [inputPin, setInputPin] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>(AVATAR_COLORS[0]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  // Host Create form states
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventCategory, setEventCategory] = useState<string>('Technology & General');
  const [isCreatingHost, setIsCreatingHost] = useState<boolean>(false);

  // Auto-fill PIN if present in URL hash (#pin=123456)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('pin=')) {
      const match = hash.match(/pin=([0-9]{6})/);
      if (match && match[1]) {
        setInputPin(match[1]);
      }
    }
  }, []);

  // Handle Player Join
  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin.trim() || !nickname.trim()) {
      setJoinError('Please enter both Game PIN and Nickname');
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    sounds.playClick();

    try {
      const pinClean = inputPin.trim();
      const q = query(collection(db, 'events'), where('pin', '==', pinClean));
      const snap = await getDocs(q);

      if (snap.empty) {
        setJoinError('Invalid Game PIN. No active session found with this PIN.');
        setIsJoining(false);
        return;
      }

      const eventDoc = snap.docs[0];
      const eventData = eventDoc.data() as EventData;

      if (eventData.status === 'ended') {
        setJoinError('This event has already ended.');
        setIsJoining(false);
        return;
      }

      // Create Participant Doc
      const pDoc = await addDoc(collection(db, 'participants'), {
        event_id: eventDoc.id,
        nickname: nickname.trim(),
        avatar_color: selectedColor,
        score: 0,
        streak: 0,
        last_active: Date.now(),
      });

      setActiveEventId(eventDoc.id);
      setParticipantId(pDoc.id);
      setCurrentMode('player');
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Host Create New Arena Event
  const handleCreateHostEvent = async () => {
    setIsCreatingHost(true);
    sounds.playClick();

    try {
      // Generate random 6-digit PIN
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      const hostId = `host_${Date.now()}`;
      const title = eventTitle.trim() || 'PulseArena Live Quiz Battle';

      const eventPayload: Omit<EventData, 'id'> = {
        pin: randomPin,
        title,
        category: eventCategory,
        host_id: hostId,
        status: 'lobby',
        current_question_index: 0,
        phase: 'lobby',
        phase_start_time: Date.now(),
        created_at: new Date().toISOString(),
      };

      const eventDocRef = await addDoc(collection(db, 'events'), eventPayload);

      // Seed 4 sample high-energy default questions so the host can test instantly without manual input
      const sampleQuestions: Omit<QuestionData, 'id' | 'event_id'>[] = [
        {
          question_order: 1,
          question_type: 'quiz',
          prompt: 'Which programming language powers modern React, Vue, and web app frontends?',
          options: ['JavaScript & TypeScript', 'Python', 'C++', 'Ruby'],
          correct_option_index: 0,
          duration_seconds: 20,
          multiplier: 1,
          explanation: 'JavaScript and TypeScript are the ubiquitous runtime standards of the modern web platform.',
        },
        {
          question_order: 2,
          question_type: 'quiz',
          prompt: 'What shape is typically used in Kahoot-style buttons for the Red answer choice?',
          options: ['Triangle', 'Diamond', 'Circle', 'Square'],
          correct_option_index: 0,
          duration_seconds: 15,
          multiplier: 1,
          explanation: 'Red is Triangle, Blue is Diamond, Yellow is Circle, and Green is Square!',
        },
        {
          question_order: 3,
          question_type: 'presentation',
          prompt: 'Audience Check-in: Tap floating reactions to celebrate the live session!',
          options: ['Tap reactions on your mobile controller! ❤️ 🔥 👏 💡 🚀'],
          correct_option_index: -1,
          duration_seconds: 40,
          multiplier: 0,
          explanation: 'Reaction mode lets all connected players rain floating animated emojis onto the stage screen!',
        },
        {
          question_order: 4,
          question_type: 'quiz',
          prompt: 'Final Clash: What is the highest award pedestal on the victory podium?',
          options: ['Bronze Pedestal', 'Silver Pedestal', 'Gold Champion Pedestal', 'Titanium'],
          correct_option_index: 2,
          duration_seconds: 20,
          multiplier: 2,
          explanation: 'The 1st place gold winner rises highest with crown and victory confetti explosions!',
        },
      ];

      for (let i = 0; i < sampleQuestions.length; i++) {
        const qData = sampleQuestions[i];
        await addDoc(collection(db, 'questions'), {
          ...qData,
          event_id: eventDocRef.id,
        });
      }

      setActiveEventId(eventDocRef.id);
      setCurrentMode('host');
    } catch (err: any) {
      alert('Failed to initialize host event: ' + err.message);
    } finally {
      setIsCreatingHost(false);
    }
  };

  // Render Host Stage Screen
  if (currentMode === 'host' && activeEventId) {
    return <HostStage eventId={activeEventId} onExit={() => setCurrentMode('home')} />;
  }

  // Render Player Mobile Controller Screen
  if (currentMode === 'player' && activeEventId && participantId) {
    return (
      <PlayerMobileController
        eventId={activeEventId}
        participantId={participantId}
        onLeave={() => setCurrentMode('home')}
      />
    );
  }

  // HOME / LANDING SCREEN (Dual options: Join Game PIN on mobile, or Host Game on Projector)
  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <header className="px-6 py-5 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-500/25">
            P
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              PulseArena
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                100% FREE &amp; OPEN
              </span>
            </h1>
            <p className="text-xs text-slate-400">Zero-paywall Kahoot alternative for live events &amp; quizzes</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const pinInput = document.getElementById('player-pin-input');
              pinInput?.focus();
            }}
            className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 transition"
          >
            Enter Game PIN
          </button>
        </div>
      </header>

      {/* Main Dual Hero & Join/Host Cards */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:py-16 flex flex-col items-center justify-center space-y-12">
        {/* Hero Title */}
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Powered by Gemini AI &amp; Realtime Firestore
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
            High-Octane Quizzes &amp; Live Presentations
          </h2>
          <p className="text-slate-400 text-sm md:text-base">
            No participant caps, no subscription locks. Host on your projector screen, let everyone join with their mobile phones in seconds.
          </p>
        </div>

        {/* Dual Actions Grid: Join as Player vs Host New Game */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* CARD 1: JOIN AS PLAYER (Mobile Controller) */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col justify-between space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Smartphone className="w-32 h-32 text-indigo-400" />
            </div>

            <div className="space-y-3 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-white">Join as Player</h3>
              <p className="text-xs text-slate-400">
                Enter the 6-digit Game PIN from the host's screen to play along on your device.
              </p>
            </div>

            {joinError && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinGame} className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  6-Digit Game PIN
                </label>
                <input
                  id="player-pin-input"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 849201"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-2xl font-black tracking-widest text-center text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Your Nickname
                </label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. Maverick, Neo, Quantum..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Pick Avatar Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      className={`w-7 h-7 rounded-full border-2 transition transform ${
                        selectedColor === col ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-70'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-base rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition transform active:scale-98 disabled:opacity-50"
              >
                {isJoining ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Arena</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* CARD 2: HOST AN EVENT (Stage / Projector View) */}
          <div className="bg-slate-900/90 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col justify-between space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Tv className="w-32 h-32 text-emerald-400" />
            </div>

            <div className="space-y-3 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Tv className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-white">Host on Big Screen</h3>
              <p className="text-xs text-slate-400">
                Launch a live stage screen for projector or television with AI questions, sound effects, and victory podium.
              </p>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Friday Trivia Championship"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-semibold placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Category
                </label>
                <select
                  value={eventCategory}
                  onChange={(e) => setEventCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="Technology & Coding">Technology &amp; Coding</option>
                  <option value="General Aptitude & Trivia">General Aptitude &amp; Trivia</option>
                  <option value="Business, Finance & Startups">Business, Finance &amp; Startups</option>
                  <option value="Science & Mathematics">Science &amp; Mathematics</option>
                  <option value="Pop Culture & Cinema">Pop Culture &amp; Cinema</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Includes AI Generator + Soundboard
                </div>
                <p>
                  Comes pre-loaded with sample slides. You can generate custom quizzes with Gemini AI or build custom slides in the lobby!
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateHostEvent}
                disabled={isCreatingHost}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition transform active:scale-98 disabled:opacity-50"
              >
                {isCreatingHost ? (
                  <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Host Stage</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800/60 text-center text-xs text-slate-500">
        PulseArena — Open, real-time interactive game and event stage. Built with React, Tailwind CSS, and Firestore Realtime.
      </footer>
    </div>
  );
}
