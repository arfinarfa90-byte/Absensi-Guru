export type UserRole = "ADMIN" | "GURU";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Guru {
  id: string;
  userId?: string;
  nama: string;
  NIP: string;
  NIK: string;
  jenisKelamin: "L" | "P";
  tempatLahir: string;
  tanggalLahir: string;
  alamat: string;
  noHP: string;
  email: string;
  jabatan: string;
  mataPelajaran: string;
  status: "AKTIF" | "NON_AKTIF";
  foto?: string;
  faceID?: string;
  qrCode?: string;
}

export interface FaceEmbedding {
  id: string;
  guruId: string;
  expression: string;
  embedding: number[];
}

export interface Attendance {
  id: string;
  guruId: string;
  guru?: Guru;
  date: string;
  jamMasuk?: string;
  jamPulang?: string;
  latitude?: number;
  longitude?: number;
  alamat?: string;
  ip?: string;
  device?: string;
  browser?: string;
  selfie?: string;
  status: "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "ALPHA" | "PULANG";
  createdAt: string;
}

export interface School {
  id: string;
  name: string;
  address: string;
  logo?: string;
}

export interface Schedule {
  id: string;
  name: string;
  jamMasuk: string;
  jamPulang: string;
  hariKerja: string;
  jamToleransi: number;
}

export interface LocationConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  action: string;
  details: string;
  ip?: string;
  createdAt: string;
}

export interface AdminDashboardStats {
  totalGuru: number;
  guruHadirHariIni: number;
  guruTerlambatHariIni: number;
  guruIzinHariIni: number;
  guruSakitHariIni: number;
  belumAbsenHariIni: number;
  totalAbsensiBulanIni: number;
  weeklyAttendance: { date: string; hadir: number; terlambat: number }[];
  monthlyAttendance: { month: string; rate: number }[];
  terlambatTerbanyak: { nama: string; NIP: string; count: number }[];
  palingRajin: { nama: string; NIP: string; rate: number }[];
  aktivitasTerbaru: ActivityLog[];
}

export interface GuruDashboardStats {
  jamMasuk: string;
  jamPulang: string;
  statusHariIni: string;
  persentaseHadir: number;
  jumlahTerlambat: number;
  jumlahIzin: number;
  jumlahSakit: number;
  history7Days: Attendance[];
  attendanceTrend: { date: string; status: string }[];
}
