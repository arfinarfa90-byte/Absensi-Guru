// Client-side API request wrapper for Smart Attendance Guru

const BASE_URL = "/api";

export function getAuthToken(): string | null {
  return localStorage.getItem("attendance_guru_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("attendance_guru_token", token);
}

export function removeAuthToken() {
  localStorage.removeItem("attendance_guru_token");
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}
