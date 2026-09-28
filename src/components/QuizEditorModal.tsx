import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Zap,
  BookOpen,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Flame,
} from 'lucide-react';
import { QuestionData, KAHOOT_COLORS } from '../types';
import { generateQuizWithGemini } from '../lib/geminiQuiz';
import { RedTriangle, BlueDiamond, YellowCircle, GreenSquare } from '../components/ShapeIcons';
import { sounds } from '../lib/sounds';

interface QuizEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuestionData[];
  onSaveQuestions: (updated: QuestionData[]) => void;
  initialTab?: 'ai' | 'manual';
}

export const QuizEditorModal: React.FC<QuizEditorModalProps> = ({
  isOpen,
  onClose,
  questions: initialQuestions,
  onSaveQuestions,
  initialTab = 'ai',
}) => {
  const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>(initialTab);

  // AI Quiz Generator Form State
  const [topic, setTopic] = useState('');
  const [targetDomain, setTargetDomain] = useState('Technology & Coding');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      setAiError('Please enter a quiz topic or theme to generate questions.');
      return;
    }

    setIsGenerating(true);
    setAiError(null);
    setGenerationSuccess(null);
    sounds.playClick();

    try {
      const generated = await generateQuizWithGemini({
        topic: topic.trim(),
        category: targetDomain,
        difficulty,
        count: questionCount,
      });

      const formatted: QuestionData[] = generated.map((q, idx) => ({
        id: `q_${Date.now()}_${idx}`,
        event_id: '',
        question_order: questions.length + idx + 1,
        question_type: 'quiz',
        prompt: q.prompt,
        options: q.options,
        correct_option_index: q.correct_option_index,
        duration_seconds: q.duration_seconds,
        multiplier: q.multiplier,
        explanation: q.explanation,
      }));

      setQuestions((prev) => [...prev, ...formatted]);
      sounds.playCorrect();
      setGenerationSuccess(`Generated ${formatted.length} questions successfully! Review and edit below.`);
      setTimeout(() => {
        setActiveTab('manual');
        setGenerationSuccess(null);
      }, 1200);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate quiz. Please check your prompt or network connection.');
      sounds.playWrong();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManualQuestion = () => {
    sounds.playClick();
    const newQ: QuestionData = {
      id: `q_${Date.now()}`,
      event_id: '',
      question_order: questions.length + 1,
      question_type: 'quiz',
      prompt: 'What is the answer to this question?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_option_index: 0,
      duration_seconds: 20,
      multiplier: 1,
      explanation: 'Explanation of why this answer is correct.',
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleAddSlide = () => {
    sounds.playClick();
    const newSlide: QuestionData = {
      id: `q_${Date.now()}`,
      event_id: '',
      question_order: questions.length + 1,
      question_type: 'presentation',
      prompt: 'Interactive Presentation Slide',
      options: ['Tap reaction emojis on your controller to interact live! ❤️ 🔥 👏 💡 🚀'],
      correct_option_index: -1,
      duration_seconds: 60,
      multiplier: 0,
      explanation: 'Presentation Slide - Live Reaction Rain is active!',
    };
    setQuestions((prev) => [...prev, newSlide]);
  };

  const handleDeleteQuestion = (index: number) => {
    sounds.playClick();
    setQuestions((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((q, i) => ({ ...q, question_order: i + 1 }));
    });
  };

  const handleUpdateField = (index: number, field: keyof QuestionData, value: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = text;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const handleSaveAndClose = () => {
    sounds.playClick();
    onSaveQuestions(questions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-wide text-white flex items-center gap-2">
                Quiz &amp; Slide Deck Studio
              </h2>
              <p className="text-xs text-slate-400">
                Generate questions with Gemini AI or build custom slides manually with instant fallbacks.
              </p>
            </div>
          </div>

          {/* Tab switchers */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('ai');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              AI Generator
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('manual');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Manual Deck ({questions.length})
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: AI GENERATOR FORM */}
          {activeTab === 'ai' && (
            <div className="max-w-xl mx-auto space-y-6 py-2">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-white">AI Quiz Generator</h3>
                <p className="text-xs md:text-sm text-slate-400">
                  Provide your desired topic, domain, difficulty, and question count. Gemini will generate complete questions with 4 choices, correct answers, educational explanations, and optimal timers.
                </p>
              </div>

              {aiError && (
                <div className="p-3.5 bg-red-500/20 border border-red-500/40 text-red-300 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{aiError}</span>
                </div>
              )}

              {generationSuccess && (
                <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-2xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{generationSuccess}</span>
                </div>
              )}

              <form onSubmit={handleGenerateAI} className="space-y-4 bg-slate-800/60 p-6 rounded-3xl border border-slate-700/60 shadow-xl">
                {/* Topic Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Topic / Concept
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Modern Web Architecture, Global Finance, World History, Marvel Cinematic Universe..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm font-semibold"
                  />
                </div>

                {/* Target Domain / Category & Difficulty */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Target Domain
                    </label>
                    <select
                      value={targetDomain}
                      onChange={(e) => setTargetDomain(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 text-sm font-semibold"
                    >
                      <option value="Technology & Coding">Technology &amp; Coding</option>
                      <option value="Finance & Business">Finance &amp; Business</option>
                      <option value="General Aptitude & Trivia">General Aptitude &amp; Trivia</option>
                      <option value="Science & Mathematics">Science &amp; Mathematics</option>
                      <option value="History & Geography">History &amp; Geography</option>
                      <option value="Pop Culture & Cinema">Pop Culture &amp; Cinema</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['easy', 'medium', 'hard'] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setDifficulty(diff);
                          }}
                          className={`py-2 text-xs font-bold rounded-xl capitalize border transition ${
                            difficulty === diff
                              ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Question Count Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
                    <span className="uppercase tracking-wider">Question Count</span>
                    <span className="text-purple-400 font-black">{questionCount} Questions</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    step="1"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-semibold px-1 mt-1">
                    <span>3 Quick</span>
                    <span>5 Standard</span>
                    <span>10 Full Match</span>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black text-sm md:text-base rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition transform active:scale-98 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating Structured Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300" />
                      Generate {questionCount} Questions with AI
                    </>
                  )}
                </button>

                {/* Manual Fallback affordance */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab('manual');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
                  >
                    Or switch to Manual Question Builder &rarr;
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: MANUAL QUESTION & SLIDE DECK BUILDER */}
          {activeTab === 'manual' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  {questions.length} Slide{questions.length !== 1 ? 's' : ''} in Sequence
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAddManualQuestion}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Question
                  </button>
                  <button
                    onClick={handleAddSlide}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Add Presentation Slide
                  </button>
                  <button
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab('ai');
                    }}
                    className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> AI Generator
                  </button>
                </div>
              </div>

              {questions.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 space-y-3">
                  <Zap className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold">No slides configured yet.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('ai')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-lg"
                    >
                      Use AI Generator
                    </button>
                    <button
                      onClick={handleAddManualQuestion}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Create First Question
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {questions.map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 space-y-4 shadow-xl"
                    >
                      {/* Slide Top Bar */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                            {qIdx + 1}
                          </span>
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                            {q.question_type === 'presentation' ? 'Presentation Slide' : 'Multiple Choice Quiz'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {/* Duration Selector */}
                          <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <select
                              value={q.duration_seconds}
                              onChange={(e) => handleUpdateField(qIdx, 'duration_seconds', parseInt(e.target.value))}
                              className="bg-transparent text-white font-bold focus:outline-none"
                            >
                              <option value="10">10s</option>
                              <option value="15">15s</option>
                              <option value="20">20s</option>
                              <option value="30">30s</option>
                              <option value="60">60s</option>
                            </select>
                          </div>

                          {/* Multiplier toggle for quiz questions */}
                          {q.question_type === 'quiz' && (
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playClick();
                                handleUpdateField(qIdx, 'multiplier', q.multiplier === 2 ? 1 : 2);
                              }}
                              className={`px-2.5 py-1 rounded-xl text-xs font-black border transition flex items-center gap-1 ${
                                q.multiplier === 2
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                  : 'bg-slate-950 text-slate-400 border-slate-800'
                              }`}
                            >
                              <Flame className="w-3 h-3 fill-current" />
                              {q.multiplier}x Points
                            </button>
                          )}

                          {/* Delete Slide */}
                          <button
                            onClick={() => handleDeleteQuestion(qIdx)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                            title="Delete this question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Question Prompt Title */}
                      <div>
                        <input
                          type="text"
                          value={q.prompt}
                          onChange={(e) => handleUpdateField(qIdx, 'prompt', e.target.value)}
                          placeholder="Type question prompt..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-indigo-500 text-sm"
                        />
                      </div>

                      {/* 4 Choices (if quiz) */}
                      {q.question_type === 'quiz' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {q.options.map((opt, optIdx) => {
                            const color = KAHOOT_COLORS[optIdx % 4];
                            const isCorrect = q.correct_option_index === optIdx;

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center gap-2 p-2.5 rounded-2xl border transition ${
                                  isCorrect ? 'border-emerald-500 bg-emerald-500/15' : 'border-slate-700/80 bg-slate-950/70'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleUpdateField(qIdx, 'correct_option_index', optIdx)}
                                  title="Mark as correct answer"
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color.bg} text-white font-bold text-xs shadow-md`}
                                >
                                  {optIdx === 0 && <RedTriangle className="w-4 h-4" />}
                                  {optIdx === 1 && <BlueDiamond className="w-4 h-4" />}
                                  {optIdx === 2 && <YellowCircle className="w-4 h-4" />}
                                  {optIdx === 3 && <GreenSquare className="w-4 h-4" />}
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleUpdateOption(qIdx, optIdx, e.target.value)}
                                  className="w-full bg-transparent text-xs md:text-sm text-white font-semibold focus:outline-none"
                                  placeholder={`Choice ${optIdx + 1}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateField(qIdx, 'correct_option_index', optIdx)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition ${
                                    isCorrect
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                >
                                  {isCorrect ? 'Correct' : 'Mark'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-slate-300 text-xs">
                          <p className="font-bold text-emerald-400 mb-1">Presentation Slide Settings:</p>
                          <p className="text-slate-400">
                            This slide displays the title above. Connected audience members will see a live reaction emoji pad (❤️, 🔥, 👏, 💡, 🚀) to rain floating emojis live across your stage screen!
                          </p>
                        </div>
                      )}

                      {/* Educational explanation note */}
                      <div>
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) => handleUpdateField(qIdx, 'explanation', e.target.value)}
                          placeholder="Host Explanation / Educational Fact (revealed after countdown)..."
                          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-semibold">
            Total {questions.length} slide{questions.length !== 1 ? 's' : ''} configured
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition"
            >
              Save &amp; Apply to Arena
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
