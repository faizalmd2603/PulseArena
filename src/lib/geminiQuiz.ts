import { GoogleGenAI, Type } from '@google/genai';
import { QuestionData } from '../types';

export interface GenerateQuizParams {
  topic: string;
  category: string; // target domain
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

export async function generateQuizWithGemini(
  params: GenerateQuizParams
): Promise<Omit<QuestionData, 'id' | 'event_id'>[]> {
  const apiKey = process.env.GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please verify your environment secrets.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are the AI Question Engine for PulseArena (an interactive Kahoot-style arena).
Create a high-quality quiz with structured questions on the topic "${params.topic}" within the target domain "${params.category}".
Difficulty: ${params.difficulty}.
Number of questions: ${params.count}.

Requirements:
- Each question must feature an engaging, clear prompt.
- Exactly 4 answer choices per question.
- Exactly one correct choice (indicate with correct_option_index from 0 to 3).
- Provide a clear, engaging 1-2 sentence educational explanation or fun fact for why that answer is correct.
- Set optimal duration_seconds between 10 and 60 seconds (typically 15s to 30s based on reading length and difficulty).
- Set multiplier: 1x for standard questions, 2x for a clutch or finale question.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: 'Question title / prompt' },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of exactly 4 choices',
              },
              correct_option_index: {
                type: Type.INTEGER,
                description: 'Index of correct answer from 0 to 3',
              },
              duration_seconds: {
                type: Type.INTEGER,
                description: 'Timer duration in seconds (10 to 60)',
              },
              multiplier: {
                type: Type.INTEGER,
                description: 'Points multiplier (1 or 2)',
              },
              explanation: {
                type: Type.STRING,
                description: 'Educational explanation or note shown after answer reveal',
              },
            },
            required: ['prompt', 'options', 'correct_option_index', 'duration_seconds', 'explanation'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    return parsed.map((q: any, idx: number) => ({
      question_order: idx + 1,
      question_type: 'quiz',
      prompt: q.prompt,
      options: q.options && q.options.length === 4 ? q.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correct_option_index:
        typeof q.correct_option_index === 'number' && q.correct_option_index >= 0 && q.correct_option_index <= 3
          ? q.correct_option_index
          : 0,
      duration_seconds: Math.max(10, Math.min(60, q.duration_seconds || 20)),
      multiplier: q.multiplier || (idx === parsed.length - 1 && parsed.length > 2 ? 2 : 1),
      explanation: q.explanation || 'Educational breakdown of this question.',
    }));
  } catch (error: any) {
    console.error('Gemini generation error:', error);
    throw new Error(error?.message || 'Failed to generate questions with AI');
  }
}
