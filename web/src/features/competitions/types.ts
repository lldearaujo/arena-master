export type FederationPresetSummary = {
  code: string;
  label: string;
  description: string;
  federation: string;
  /** gi | nogi | both */
  modality: string;
};

export type ApplyFederationPresetResponse = {
  preset_code: string;
  reference_year_used: number;
  age_divisions_created: number;
  weight_classes_created: number;
  belt_eligibility_created: number;
  skipped_belt_keys?: string[];
};

export type CompetitionKpiItem = {
  competition_id: number;
  name: string;
  reference_year: number;
  is_published: boolean;
  organizer_dojo_id: number;
  registrations_total: number;
  registrations_registered: number;
  registrations_weighed_in: number;
  registrations_disqualified: number;
  brackets_count: number;
  pending_registration_payment_confirmations?: number;
};

export type Competition = {
  id: number;
  organizer_dojo_id: number;
  name: string;
  reference_year: number;
  event_starts_at: string | null;
  default_match_duration_seconds: number;
  transition_buffer_seconds: number;
  public_display_token: string;
  is_published: boolean;
  visibility?: "internal" | "public";
  created_at: string;
  federation_preset_code?: string | null;
  banner_url?: string | null;
  organizer_dojo_name?: string | null;
  organizer_logo_url?: string | null;
  registration_fee_amount?: number | null;
  registration_fee_amount_1?: number | null;
  registration_fee_amount_2?: number | null;
  registration_fee_amount_3?: number | null;
  registration_fee_amount_4?: number | null;
  registration_payment_instructions?: string | null;
  /** Modalidade "macro" do evento (ex.: "Jiu-Jitsu") */
  event_modality?: string | null;
  /** Texto exibido ao aluno na página do evento */
  description?: string | null;
};

export type AgeDivision = {
  id: number;
  competition_id: number;
  label: string;
  birth_year_min: number;
  birth_year_max: number;
  sort_order: number;
};

export type WeightClass = {
  id: number;
  competition_id: number;
  age_division_id: number;
  gender: string;
  /** kimono vs No-Gi — mesmo evento pode ter ambos */
  modality: string;
  label: string;
  max_weight_kg: number | null;
  sort_order: number;
  /** ex.: "57,5–64 kg", "até 48,5 kg" */
  weight_interval_label?: string | null;
};

export type BeltEligibility = {
  id: number;
  competition_id: number;
  age_division_id: number;
  gender: string;
  faixa_id: number;
};

export type Registration = {
  id: number;
  competition_id: number;
  student_id: number;
  gender: string;
  age_division_id: number;
  weight_class_id: number;
  status: string;
  declared_weight_kg?: number | null;
  actual_weight_kg: number | null;
  registration_public_code: string;
  ranking_points: number;
  weigh_in_at: string | null;
  student_name?: string | null;
  student_dojo_id?: number | null;
  student_dojo_name?: string | null;
  student_external_dojo_name?: string | null;
  student_faixa_id?: number | null;
  student_faixa_label?: string | null;
  student_external_faixa_label?: string | null;
  payment_status?: string;
  payment_receipt_path?: string | null;
  payment_notes?: string | null;
  payment_confirmed_at?: string | null;
  competition_name?: string | null;
  registration_fee_amount?: number | null;
  registration_payment_instructions?: string | null;
  age_division_label?: string | null;
  weight_class_label?: string | null;
};

export type CompetitionMatch = {
  id: number;
  bracket_id: number;
  round_index: number;
  position_in_round: number;
  red_registration_id: number | null;
  blue_registration_id: number | null;
  winner_registration_id: number | null;
  mat_id: number | null;
  queue_order: number | null;
  estimated_start_at: string | null;
  match_status: string;
  red_score: number;
  blue_score: number;
  timer_elapsed_seconds: number;
  timer_running: boolean;
  paused_for: string | null;
  finish_method: string | null;
  feeder_red_match_id: number | null;
  feeder_blue_match_id: number | null;
};

export type CompetitionPrize = {
  id: number;
  competition_id: number;
  kind: "category" | "absolute";
  age_division_id: number | null;
  faixa_id?: number | null;
  gender: "male" | "female";
  modality: "gi" | "nogi";
  place: number;
  reward: string;
};

export type CompetitionBracket = {
  id: number;
  competition_id: number;
  age_division_id: number;
  weight_class_id: number;
  gender: string;
  generated_at: string;
  team_separation_warnings?: string | null;
};

export type CompetitionMat = {
  id: number;
  competition_id: number;
  name: string;
  display_order: number;
};
