export type Role = "student" | "instructor" | "admin";
export type QuestionType = "multiple_choice" | "true_false" | "code_output";
export type GameStatus = "lobby" | "question" | "reveal" | "finished";
export type PowerUp = "double" | "fifty" | "time";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  avatar: string;
  total_points: number;
  created_at: string;
}

export interface Question {
  id?: string;
  position?: number;
  type: QuestionType;
  prompt: string;
  code_snippet?: string | null;
  code_language?: string | null;
  choices: string[];
  correct_index: number;
  time_limit: number;
  points: number;
  image_url?: string | null;
}

export interface QuizSet {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  topic: string;
  grade_level: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  questions?: Question[];
  question_count?: number;
}

export interface PlayerSummary {
  id: string;
  user_id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
}

/** Question as sent to players during a game: no correct answer until reveal. */
export interface PublicQuestion {
  id: string;
  index: number;
  total: number;
  type: QuestionType;
  prompt: string;
  code_snippet: string | null;
  code_language: string | null;
  choices: string[];
  time_limit: number;
  points: number;
  image_url: string | null;
  started_at: string | null;
  correct_index?: number;
  choice_counts?: number[];
}

export interface MyPlayerState extends PlayerSummary {
  powerups_used: PowerUp[];
  active_powerup: PowerUp | null;
  hidden_choices: number[];
  answer: { choice_index: number; is_correct?: boolean; points_awarded?: number } | null;
}

export interface GameState {
  id: string;
  pin: string;
  status: GameStatus;
  quiz_title: string;
  is_host: boolean;
  server_now: string;
  question: PublicQuestion | null;
  players: PlayerSummary[];
  answered_count: number;
  me: MyPlayerState | null;
}
