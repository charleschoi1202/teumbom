export type Teacher = {
  id: number;
  name: string;
  initial: string;
  region: string;
  area: string;
  radius_km: number;
  context: string;
  distance_km: number | null;
  context_matched: string[];
  qual_type: "certified" | "qualified";
  qual_label: string;
  qual_kind: string;
  qual_detail: string;
  years: number;
  headline: string;
  title: string;
  intro: string;
  experience: string[];
  tags: string[];
  days: string[];
  start_time: string;
  rating: number;
  verified: { docs: boolean; crime: boolean; training: boolean; shadow: boolean };
  score: number | null;
  reasons: string[];
};

export type VisitStatus = "requested" | "declined" | "payment" | "booked" | "live" | "draft" | "sent" | "cancelled";
export type Phase = VisitStatus | "reading" | "approved";

export type Task = {
  id: number;
  title: string;
  kind: "basic" | "school";
  owner: "teacher" | "guardian";
  category: string;
  due: string;
  due_label: string;
  done: boolean;
};

export type Visit = {
  id: number;
  date: string;
  start: string;
  hours: number;
  date_label: string;
  short_date: string;
  time_label: string;
  kind: "single" | "regular";
  kind_label: string;
  price: number;
  note: string;
  tags: string[];
  status: VisitStatus;
  phase: Phase;
  teacher: Teacher;
  simulated_teacher: boolean;
  household: string;
  child_desc: string;
  region: string;
  address: string | null;
  consent: { guardian: boolean; teacher: boolean };
  video_state: "off" | "ready" | "live" | "stopped";
  started_at: string;
  finished_at: string;
  tasks: Task[];
  notice: { id: number; status: "review" | "approved"; title: string; teacher_count: number; guardian_count: number } | null;
  record: { homework: number | null; reading_min: number | null; memo: string } | null;
  report: { sent: boolean; sent_at: string; message: string | null } | null;
};

export type NoticeItem = {
  id: number;
  category: string;
  owner: "teacher" | "guardian";
  title: string;
  detail: string;
  due: string;
  due_label: string;
  source_due: string;
  read_due: string;
  amount: number | null;
  evidence: string;
  checks: { evidence: boolean; consistent: boolean; template: boolean };
  warning: string | null;
  confidence: "high" | "low";
  status: "pending" | "verified" | "edited" | "excluded";
  sendable: boolean;
};

export type Notice = {
  id: number;
  visit_id: number;
  title: string;
  status: "review" | "approved";
  engine: string;
  source_text: string;
  items: NoticeItem[];
  pending: number;
  send_count: number;
};

export type ReportItem = {
  visit_id: number;
  date_label: string;
  short_date: string;
  time_label: string;
  teacher: string;
  sent_at: string;
  message: string;
  read: boolean;
  homework: number | null;
  reading_min: number | null;
  school_done: string[];
  activity: string[];
};

export type Me = {
  id: number;
  role: "guardian" | "teacher";
  name: string;
  room: string | null;
  peers: string[];
  household: { region: string; area: string; lat: number | null; lng: number | null; address: string; address_detail: string; child_desc: string };
  teacher: Teacher | null;
};
