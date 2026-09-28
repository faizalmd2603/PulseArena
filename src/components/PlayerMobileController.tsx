import React, { useState, useEffect } from 'react';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  Flame,
  Zap,
  Award,
  Send,
  Trophy,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  EventData,
  QuestionData,
  ParticipantData,
  ResponseData,
  KAHOOT_COLORS,
} from '../types';
import { sounds } from '../lib/sounds';
import { getShapeIcon } from './ShapeIcons';

interface PlayerMobileControllerProps {
  eventId: string;
  participantId: string;
  onLeave: () => void;
}

export const PlayerMobileController: React.FC<PlayerMobileControllerProps> = ({
  eventId,
  participantId,
  onLeave,
}) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [currentResponse, setCurrentResponse] = useState<ResponseData | null>(null);

  // Sync Event
  useEffect(() => {
    if (!eventId) return;
    const unsub = onSnapshot(doc(db, 'events', eventId), (snap) => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...snap.data() } as EventData);
      }
    });
    return () => unsub();
  }, [eventId]);

  // Sync Participant
  useEffect(() => {
    if (!participantId) return;
    const unsub = onSnapshot(doc(db, 'participants', participantId), (snap) => {
      if (snap.exists()) {
        setParticipant({ id: snap.id, ...snap.data() } as ParticipantData);
      }
    });
    return () => unsub();
  }, [participantId]);

  // Sync Questions
  useEffect(() => {
    if (!eventId) return;
    const q = query(collection(db, 'questions'), where('event_id', '==', eventId));
    const unsub = onSnapshot(q, (snap) => {
      const qs: QuestionData[] = [];
      snap.forEach((d) => qs.push({ id: d.id, ...d.data() } as QuestionData));
      qs.sort((a, b) => a.question_order - b.question_order);
      setQuestions(qs);
    });
    return () => unsub();
  }, [eventId]);

  const currentQ = questions[event?.current_question_index ?? 0];

  // Reset answer selection on new question / teaser
  useEffect(() => {
    if (event?.phase === 'teaser' || event?.phase === 'active') {
      setSelectedOption(null);
      setHasSubmitted(false);
      setCurrentResponse(null);
    }
  }, [event?.current_question_index, event?.phase]);

  // Submit Answer
  const handleSelectOption = async (optionIndex: number) => {
    if (hasSubmitted || event?.phase !== 'active' || !currentQ || !participant) return;

    sounds.playClick();
    setSelectedOption(optionIndex);
    setHasSubmitted(true);

    const now = Date.now();
    const startTime = event.phase_start_time || now;
    const timeTakenMs = Math.max(100, now - startTime);
    const durationMs = (currentQ.duration_seconds || 20) * 1000;

    // Scoring Formula:
    // Speed + Accuracy: Score = BasePoints * (1 - TimeTaken / (2 * Duration)) * StreakBonus
    const isCorrect = optionIndex === currentQ.correct_option_index;
    let pointsAwarded = 0;

    if (isCorrect) {
      sounds.playCorrect();
      const basePoints = 1000 * (currentQ.multiplier || 1);
      const speedFactor = Math.max(0.5, 1 - timeTakenMs / (2 * durationMs));
      const streakMultiplier = 1 + Math.min(participant.streak, 5) * 0.1; // up to 1.5x streak bonus
      pointsAwarded = Math.round(basePoints * speedFactor * streakMultiplier);
    } else {
      sounds.playWrong();
    }

    const responsePayload: Omit<ResponseData, 'id'> = {
      event_id: eventId,
      question_id: currentQ.id,
      participant_id: participant.id,
      selected_option: optionIndex,
      is_correct: isCorrect,
      time_taken_ms: timeTakenMs,
      points_awarded: pointsAwarded,
      timestamp: now,
    };

    const docRef = await addDoc(collection(db, 'responses'), responsePayload);
    setCurrentResponse({ id: docRef.id, ...responsePayload });

    // Update participant record (score, streak)
    const newStreak = isCorrect ? (participant.streak || 0) + 1 : 0;
    const newScore = (participant.score || 0) + pointsAwarded;

    await updateDoc(doc(db, 'participants', participant.id), {
      score: newScore,
      streak: newStreak,
      last_answer_correct: isCorrect,
      last_points: pointsAwarded,
      last_active: now,
    });
  };

  // Send Floating Emoji Reaction
  const handleSendReaction = async (emoji: string) => {
    if (!eventId) return;
    sounds.playClick();
    await addDoc(collection(db, 'reactions'), {
      event_id: eventId,
      emoji,
      nickname: participant?.nickname || 'Player',
      timestamp: Date.now(),
    });
  };

  if (!event || !participant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-bold text-slate-300">Connecting to Arena Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col justify-between select-none">
      {/* Mobile Top App Bar */}
      <header className="px-4 py-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shadow-md"
            style={{ backgroundColor: participant.avatar_color || '#6366f1' }}
          >
            {participant.nickname.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-black text-white leading-tight">{participant.nickname}</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
              <span className="text-amber-400 font-bold">{participant.score.toLocaleString()} pts</span>
              {participant.streak > 1 && (
                <span className="text-red-400 flex items-center">
                  <Flame className="w-3 h-3 fill-current" /> {participant.streak}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            PIN: {event.pin}
          </span>
          <button
            onClick={onLeave}
            className="text-[11px] text-slate-400 hover:text-white px-2 py-1"
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main Content Controller Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* PHASE 1: LOBBY */}
        {event.phase === 'lobby' && (
          <div className="text-center space-y-6 max-w-sm">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400 shadow-xl">
              <Sparkles className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">You're in the Arena!</h2>
              <p className="text-sm text-slate-400">
                Look at the host screen. The game will begin shortly!
              </p>
            </div>

            {/* Fun reaction testing in lobby */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">
                Send cheer emojis to host screen:
              </span>
              <div className="flex justify-center gap-3 text-2xl pt-1">
                {['👏', '🔥', '❤️', '💡', '🚀'].map((em) => (
                  <button
                    key={em}
                    onClick={() => handleSendReaction(em)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl active:scale-90 transition transform"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: TEASER (Get Ready) */}
        {event.phase === 'teaser' && (
          <div className="text-center space-y-4 max-w-sm animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <Clock className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-2xl font-black text-white">Get Ready!</h3>
            <p className="text-sm text-slate-400">
              Question {event.current_question_index + 1} is about to appear on screen.
            </p>
          </div>
        )}

        {/* PHASE 3: ACTIVE QUESTION CONTROLLER (Vibrant Geometric Buttons) */}
        {event.phase === 'active' && currentQ && (
          <div className="w-full h-full flex-1 flex flex-col justify-between py-2">
            {/* If player already locked in their choice */}
            {hasSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 animate-scaleIn">
                <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-xl">
                  <CheckCircle className="w-10 h-10 animate-bounce" />
                </div>
                <h3 className="text-2xl font-black text-white">Answer Locked In!</h3>
                <p className="text-sm text-slate-400">
                  Waiting for timer to expire or other players to answer...
                </p>
              </div>
            ) : currentQ.question_type === 'quiz' ? (
              /* The 4 Geometric Answer Buttons (Red Triangle, Blue Diamond, Yellow Circle, Green Square) */
              <div className="grid grid-cols-2 gap-3 flex-1 min-h-[360px]">
                {currentQ.options.map((opt, idx) => {
                  const color = KAHOOT_COLORS[idx % 4];
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`relative rounded-3xl flex flex-col items-center justify-center p-4 border-b-8 active:border-b-0 active:translate-y-2 transition-all shadow-xl ${color.bg} ${color.border}`}
                    >
                      <div className="text-white drop-shadow-md">
                        {getShapeIcon(idx, 'w-12 h-12 md:w-16 md:h-16')}
                      </div>
                      <span className="mt-2 text-white font-black text-sm md:text-base text-center line-clamp-2 drop-shadow">
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Presentation slide on mobile */
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <h3 className="text-xl font-bold text-white">Presentation Slide Active</h3>
                <p className="text-sm text-slate-400">
                  Tap floating reaction emojis below to send them live to the host projector!
                </p>
                <div className="flex justify-center gap-3 text-3xl">
                  {['👏', '🔥', '❤️', '💡', '🚀'].map((em) => (
                    <button
                      key={em}
                      onClick={() => handleSendReaction(em)}
                      className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-2xl active:scale-90 transition transform shadow-lg"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PHASE 4: ANSWER REVEAL FEEDBACK SCREEN */}
        {event.phase === 'reveal' && currentQ && (
          <div className="w-full max-w-sm flex flex-col items-center justify-center text-center space-y-5 animate-scaleIn py-4">
            {currentResponse ? (
              currentResponse.is_correct ? (
                /* Correct Screen */
                <div className="w-full bg-emerald-950/70 border-2 border-emerald-500/80 p-6 rounded-3xl space-y-4 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-emerald-300">Correct!</h3>
                    <p className="text-3xl font-black text-white mt-1">
                      +{currentResponse.points_awarded.toLocaleString()} pts
                    </p>
                  </div>

                  <div className="flex justify-around pt-2 border-t border-emerald-800/60 text-xs font-bold text-emerald-200">
                    <div>
                      <span className="block text-emerald-400">Answer Time</span>
                      <span>{(currentResponse.time_taken_ms / 1000).toFixed(1)}s</span>
                    </div>
                    <div>
                      <span className="block text-emerald-400">Streak</span>
                      <span>🔥 {participant.streak}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Wrong Screen */
                <div className="w-full bg-red-950/70 border-2 border-red-500/80 p-6 rounded-3xl space-y-4 shadow-2xl">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border border-red-400 flex items-center justify-center mx-auto">
                    <XCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-red-300">Incorrect!</h3>
                    <p className="text-lg font-bold text-slate-300 mt-1">0 points earned</p>
                  </div>
                  <p className="text-xs text-red-300">
                    Don't worry, catch up on the next question!
                  </p>
                </div>
              )
            ) : (
              /* Didn't answer in time */
              <div className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
                <Clock className="w-10 h-10 text-amber-400 mx-auto" />
                <h3 className="text-xl font-bold text-white">Time's Up!</h3>
                <p className="text-xs text-slate-400">No response was submitted in time.</p>
              </div>
            )}
          </div>
        )}

        {/* PHASE 5: SCOREBOARD */}
        {event.phase === 'scoreboard' && (
          <div className="text-center space-y-5 max-w-sm animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white">Check the Leaderboard!</h3>
              <p className="text-sm text-slate-400">Look at the host screen for current rankings.</p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Your Total Score:</span>
              <span className="text-xl font-black text-amber-400">
                {participant.score.toLocaleString()} pts
              </span>
            </div>
          </div>
        )}

        {/* PHASE 6: PODIUM */}
        {event.phase === 'podium' && (
          <div className="text-center space-y-6 max-w-sm animate-scaleIn">
            <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border border-amber-400/50 text-amber-400 flex items-center justify-center mx-auto shadow-2xl">
              <Trophy className="w-12 h-12 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white">Game Over!</h2>
              <p className="text-sm text-slate-300">
                The grand victory podium is now revealing on the main stage screen!
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs text-slate-400 font-bold block uppercase">
                Final Result
              </span>
              <div className="text-2xl font-black text-amber-400">
                {participant.score.toLocaleString()} Points
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Emoji Bar for participants at bottom */}
      <footer className="px-4 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-center gap-4">
        {['👏', '🔥', '❤️', '💡', '🚀'].map((em) => (
          <button
            key={em}
            onClick={() => handleSendReaction(em)}
            className="text-2xl p-1.5 hover:scale-125 active:scale-95 transition transform"
            title={`React with ${em}`}
          >
            {em}
          </button>
        ))}
      </footer>
    </div>
  );
};
