export type AppRole = 'doctor' | 'patient';
export type LinkStatus = 'pending' | 'active' | 'revoked';

export interface Profile {
  id: string;
  full_name: string | null;
  doctor_code: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface DoctorPatientLink {
  id: string;
  doctor_user_id: string;
  patient_user_id: string;
  status: LinkStatus;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface ManiaAnswer {
  id: string;
  entry_id: string;
  block_id: number;
  question_id: number;
  score: number;
}

export interface IpsrtAnchor {
  entry_id: string;
  bedtime: string | null;
  wake_time: string | null;
  first_meal_time: string | null;
  last_meal_time: string | null;
  main_social_anchor_time: string | null;
}

export interface IpsrtRating {
  entry_id: string;
  rating_q1: number;
  rating_q2: number;
  rating_q3: number;
  rating_q4: number;
  rhythm_stability_score: number;
}

export interface EntrySummary {
  entry_id: string;
  block1_sum: number;
  block2_sum: number;
  block3_sum: number;
  block4_sum: number;
  block5_sum: number;
  block6_sum: number;
  block7_sum: number;
  total_risk_blocks_count: number;
  sustained_activation: boolean;
  high_risk_sleep: boolean;
}

export interface BlockDef {
  id: number;
  name: string;
  questions: string[];
}
