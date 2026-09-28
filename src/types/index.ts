export type EventStatus = 'lobby' | 'active' | 'paused' | 'ended';
export type QuestionType = 'quiz' | 'true_false' | 'presentation' | 'poll';
export type GamePhase = 'lobby' | 'teaser' | 'active' | 'reveal' | 'scoreboard' | 'podium';

export interface EventData {
  id: string;
  pin: string;
  title: string;
  category: string;
  host_id: string;
  status: EventStatus;
  current_question_index: number;
  phase: GamePhase;
  phase_start_time: number; // unix timestamp ms
  created_at: string;
}

export interface QuestionData {
  id: string;
  event_id: string;
  question_order: number;
  question_type: QuestionType;
  prompt: string;
  options: string[];
  correct_option_index: number; // 0-3, or null for presentation
  duration_seconds: number;
  multiplier: number; // 1 or 2
  explanation?: string;
}

export interface ParticipantData {
  id: string;
  event_id: string;
  nickname: string;
  avatar_color: string;
  score: number;
  streak: number;
  last_answer_correct?: boolean;
  last_points?: number;
  last_active?: number;
}

export interface ResponseData {
  id: string;
  event_id: string;
  question_id: string;
  participant_id: string;
  selected_option: number;
  is_correct: boolean;
  time_taken_ms: number;
  points_awarded: number;
  timestamp: number;
}

export interface ReactionData {
  id: string;
  event_id: string;
  emoji: string;
  nickname?: string;
  timestamp: number;
}

export const KAHOOT_COLORS = [
  { bg: 'bg-[#E21B3C]', border: 'border-[#b8122d]', name: 'Red', shape: 'triangle', text: 'text-white' },
  { bg: 'bg-[#1368CE]', border: 'border-[#0e4e9c]', name: 'Blue', shape: 'diamond', text: 'text-white' },
  { bg: 'bg-[#D89E00]', border: 'border-[#a87a00]', name: 'Yellow', shape: 'circle', text: 'text-white' },
  { bg: 'bg-[#26890C]', border: 'border-[#1b6408]', name: 'Green', shape: 'square', text: 'text-white' },
];

export const AVATAR_COLORS = [
  '#E21B3C', '#1368CE', '#D89E00', '#26890C', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#10B981', '#6366F1'
];
