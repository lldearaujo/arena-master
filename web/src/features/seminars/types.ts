export type Seminar = {
  id: number;
  organizer_dojo_id: number;
  title: string;
  description: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location_city: string | null;
  location_state: string | null;
  location_text: string | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  speaker_photo_url: string | null;
  speaker_achievements: string | null;
  capacity: number | null;
  is_published: boolean;
  visibility?: "internal" | "public";
  created_at: string;
  updated_at: string;
};

export type SeminarLot = {
  id: number;
  seminar_id: number;
  name: string;
  price_amount: number;
  starts_at: string | null;
  ends_at: string | null;
  order: number;
};

export type SeminarScheduleItem = {
  id: number;
  seminar_id: number;
  kind: string;
  starts_at: string | null;
  ends_at: string | null;
  title: string;
  notes: string | null;
};

export type SeminarRegistration = {
  id: number;
  seminar_id: number;
  buyer_user_id: number | null;
  student_id: number | null;
  student_name?: string | null;
  guest_full_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  payment_status: string;
  payment_receipt_path: string | null;
  payment_notes: string | null;
  payment_confirmed_at: string | null;
  paid_amount: number | null;
  public_code: string;
  created_at: string;
};

export type SeminarAttendance = {
  id: number;
  seminar_id: number;
  registration_id: number;
  checked_in_at: string;
  checked_in_by_user_id: number | null;
};

