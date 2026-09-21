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