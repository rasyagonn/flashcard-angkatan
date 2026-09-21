// Client API untuk backend FlashCard (Go + Gin)
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";
const BACKEND_ORIGIN = BASE_URL.replace(/\/api\/v\d+$/, "");

export interface Student {
  id: number;
  nrp: string;
  name: string;
  photo_path: string;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface ListStudentsResponse {
  students: Student[];
  pagination: Pagination;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isForm = options?.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: isForm ? undefined : { "Content-Type": "application/json", ...options?.headers },
  });

  const json = (await res.json().catch(() => null)) as
    | { data?: T; error?: string; success?: boolean }
    | null;

  if (!res.ok) {
    const msg =
      (json && "error" in json && typeof json.error === "string" && json.error) ||
      `Request gagal (${res.status})`;
    throw new Error(msg);
  }
  return (json?.data ?? json) as T;
}

/** Ubah path foto (dari backend) menjadi URL penuh. */
export function photoUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return BACKEND_ORIGIN + path;
}

/** Cek kesehatan backend (untuk tampilan status). */
export async function healthCheck(): Promise<{ status: string }> {
  return request("/health");
}

// ── Mahasiswa ────────────────────────────────────────────

export async function listStudents(
  input?: { search?: string; page?: number; limit?: number }
): Promise<ListStudentsResponse> {
  const params = new URLSearchParams();
  if (input?.page) params.set("page", String(input.page));
  if (input?.limit) params.set("limit", String(input.limit));
  if (input?.search) params.set("search", input.search);
  const qs = params.toString();
  return request(`/students${qs ? `?${qs}` : ""}`);
}

export async function createStudent(payload: {
  nrp: string;
  name: string;
  photo_path?: string;
}): Promise<Student> {
  return request("/students", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStudent(
  id: number,
  payload: { nrp?: string; name?: string; photo_path?: string }
): Promise<Student> {
  return request(`/students/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteStudent(id: number): Promise<void> {
  await request(`/students/${id}`, { method: "DELETE" });
}

export async function uploadPhoto(file: File): Promise<{ photo_path: string }> {
  const form = new FormData();
  form.append("file", file);
  return request("/upload", { method: "POST", body: form });
}

export async function importStudents(file: File): Promise<{
  imported: number;
  failed: number;
  total_rows: number;
  detail?: { line: number; nrp: string; error?: string }[];
}> {
  const form = new FormData();
  form.append("file", file);
  return request("/students/import", { method: "POST", body: form });
}

// ── Permainan (Fase 2) ─────────────────────────────────

export interface PlayOption {
  id: number;
  name: string;
}

export interface PlayRound {
  /** Answer correct = pilih opsi dengan id === card_id */
  card_id: number;
  photo_url: string;
  options: PlayOption[];
  finished?: boolean;
}

export interface PlayAnswerResult {
  correct: boolean;
  points_delta: number;
  current_points: number;
  correct_name: string;
}

export interface PlayEndResult {
  session_id: number;
  points_earned: number;
  accuracy?: number;
}

/** Ambil kartu acak + 4 opsi; exclude = id kartu yang sudah dimainkan di sesi ini. */
export async function getRound(exclude: number[]): Promise<PlayRound> {
  const qs = exclude.length > 0 ? `?exclude=${exclude.join(",")}` : "";
  return request(`/play/round${qs}`);
}

/** Kirim jawaban; benar +2, salah -1 (min 0). */
export async function submitAnswer(
  card_id: number,
  option_id: number
): Promise<PlayAnswerResult> {
  return request("/play/answer", {
    method: "POST",
    body: JSON.stringify({ card_id, option_id }),
  });
}

/** Akhiri sesi dan simpan statistik ke play_sessions. */
export async function endSession(payload: {
  total_cards: number;
  correct_count: number;
  wrong_count: number;
}): Promise<PlayEndResult> {
  return request("/play/end", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Rank & Reward (Fase 3) ──────────────────────────────

export interface Reward {
  id: number;
  name: string;
  description: string;
  target_points: number;
  created_at: string;
  updated_at: string;
}

export interface RewardView extends Reward {
  achievable: boolean;
  percent: number;
}

export interface ClaimedReward {
  id: number;
  reward_id: number;
  points_at_claim: number;
  claimed_at: string;
}

export interface ProgressData {
  current_points: number;
  total_points: number;
  rewards: RewardView[];
  next_reward: Reward | null;
  next_reward_percent: number;
  claimed: ClaimedReward[];
}

export interface PlaySessionItem {
  id: number;
  played_at: string;
  total_cards: number;
  correct_count: number;
  wrong_count: number;
  accuracy: number;
  points_earned: number;
}

export async function listRewards(): Promise<Reward[]> {
  return request("/rewards");
}

export async function createReward(payload: {
  name: string;
  description?: string;
  target_points: number;
}): Promise<Reward> {
  return request("/rewards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReward(
  id: number,
  payload: { name?: string; description?: string; target_points?: number }
): Promise<Reward> {
  return request(`/rewards/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteReward(id: number): Promise<void> {
  await request(`/rewards/${id}`, { method: "DELETE" });
}

export async function getProgress(): Promise<ProgressData> {
  return request("/progress");
}

export async function claimReward(id: number): Promise<{
  claimed_reward: ClaimedReward;
  reward_name: string;
  current_points: number;
}> {
  return request(`/rewards/${id}/claim`, { method: "POST" });
}

export async function listSessions(): Promise<PlaySessionItem[]> {
  return request("/sessions");
}