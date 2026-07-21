// Client-side API request wrapper for Smart Attendance Guru
import * as XLSX from "xlsx";

export const isFrontendPlatform = typeof window !== "undefined" && (
  window.location.hostname.includes("github.io") || 
  window.location.hostname.includes("vercel.app") ||
  window.location.hostname.includes("github.dev") ||
  (!window.location.hostname.includes("run.app") && 
   !window.location.hostname.includes("localhost") && 
   !window.location.hostname.includes("127.0.0.1"))
);

export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const apiParam = params.get("api");
    if (apiParam) {
      localStorage.setItem("attendance_api_url", apiParam);
      try {
        // Clean query parameter from address bar to keep it tidy
        const url = new URL(window.location.href);
        url.searchParams.delete("api");
        window.history.replaceState({}, document.title, url.toString());
      } catch (e) {
        console.error("Failed to clean search param", e);
      }
    }
    
    const savedUrl = localStorage.getItem("attendance_api_url");
    if (savedUrl) {
      return savedUrl;
    }
  }

  const metaEnv = (import.meta as any).env;
  if (metaEnv && metaEnv.VITE_API_URL) {
    return metaEnv.VITE_API_URL;
  }
  
  // Dynamic production URL of the deployed Cloud Run container
  const CLOUD_RUN_URL = "https://ais-pre-desns7ivcyf2oafn6gd4tv-432802410429.asia-southeast1.run.app";
  const CLOUD_DEV_URL = "https://ais-dev-desns7ivcyf2oafn6gd4tv-432802410429.asia-southeast1.run.app";
  
  // If we are on a static platform (Vercel, GitHub Pages) and there is no custom API URL,
  // we default to the live Cloud Run backend instead of offline Mock DB, so data is persistent across devices!
  if (isFrontendPlatform) {
    // If the active URL of the current builder contains ais-dev, use CLOUD_DEV_URL
    if (typeof window !== "undefined" && window.location.hostname.includes("ais-dev")) {
      return `${CLOUD_DEV_URL}/api`;
    }
    return `${CLOUD_RUN_URL}/api`;
  }
  return "/api";
};

export const setCustomApiUrl = (url: string | null) => {
  if (url) {
    localStorage.setItem("attendance_api_url", url);
  } else {
    localStorage.removeItem("attendance_api_url");
  }
};

export const getActiveDatabaseMode = () => {
  if (typeof window !== "undefined" && localStorage.getItem("attendance_fallback_active") === "true") {
    return "Local Mock DB";
  }
  const activeUrl = getBaseUrl();
  if (activeUrl.startsWith("http")) {
    return "Cloud Sync";
  }
  if (isFrontendPlatform) {
    return "Local Mock DB";
  }
  return "Cloud Server";
};

export function getAuthToken(): string | null {
  return localStorage.getItem("attendance_guru_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("attendance_guru_token", token);
}

export function removeAuthToken() {
  localStorage.removeItem("attendance_guru_token");
}

// Helper to seed initial mock data for offline fallback (GitHub Pages, Vercel, etc.)
function initMockData() {
  if (!localStorage.getItem("_mock_school")) {
    localStorage.setItem("_mock_school", JSON.stringify({
      id: "school-1",
      name: "SMK Negeri 1 Jayapura",
      address: "Jl. Pendidikan No. 45, Jayapura, Papua",
      email: "info@smkn1jayapura.sch.id",
      phone: "081122334455",
      website: "smkn1jayapura.sch.id"
    }));
  }
  if (!localStorage.getItem("_mock_schedule")) {
    localStorage.setItem("_mock_schedule", JSON.stringify({
      id: "schedule-1",
      name: "Jadwal Kerja Standard Guru",
      jamMasuk: "07:00",
      jamPulang: "14:30",
      hariKerja: "Senin,Selasa,Rabu,Kamis,Jumat",
      jamToleransi: 15,
      timezone: "WIT"
    }));
  }
  if (!localStorage.getItem("_mock_location")) {
    localStorage.setItem("_mock_location", JSON.stringify({
      id: "loc-1",
      name: "SMK Negeri 1 Jayapura",
      latitude: -2.5488,
      longitude: 140.7012,
      radius: 100
    }));
  }
  if (!localStorage.getItem("_mock_gurus")) {
    localStorage.setItem("_mock_gurus", JSON.stringify([]));
  }
  if (!localStorage.getItem("_mock_users")) {
    localStorage.setItem("_mock_users", JSON.stringify([
      {
        id: "admin-1",
        email: "hasanlek486@gmail.com",
        name: "Administrator Utama",
        role: "ADMIN"
      }
    ]));
  }
  if (!localStorage.getItem("_mock_attendances")) {
    localStorage.setItem("_mock_attendances", JSON.stringify([]));
  }
}

// Full client-side offline mock server
export async function mockFetch(endpoint: string, options: RequestInit = {}) {
  initMockData();

  // Helper to parse query params
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(cleanEndpoint, "http://localhost");
  const path = url.pathname;
  const searchParams = url.searchParams;

  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : null;

  // Retrieve mock DB tables
  const getTable = (key: string) => JSON.parse(localStorage.getItem(key) || "[]");
  const saveTable = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  const getSingleObj = (key: string) => JSON.parse(localStorage.getItem(key) || "{}");
  const saveSingleObj = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

  // Simulate minimal server-side network lag (150ms)
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Helper: check auth token and return current mock user
  const getCurrentUser = () => {
    const token = getAuthToken();
    if (!token) return null;
    if (token === "mock-token-admin-1") {
      return { id: "admin-1", email: "hasanlek486@gmail.com", name: "Administrator Utama", role: "ADMIN" };
    }
    if (token.startsWith("mock-token-")) {
      const userId = token.replace("mock-token-", "");
      const users = getTable("_mock_users");
      const user = users.find((u: any) => u.id === userId);
      if (user && user.role === "GURU") {
        const gurus = getTable("_mock_gurus");
        const guru = gurus.find((g: any) => g.userId === userId || g.email === user.email);
        if (guru) {
          return {
            id: guru.id,
            email: guru.email,
            role: "GURU",
            name: guru.nama,
            NIP: guru.NIP,
            NIK: guru.NIK,
            jenisKelamin: guru.jenisKelamin,
            alamat: guru.alamat,
            noHP: guru.noHP || guru.telepon,
            jabatan: guru.jabatan,
            mataPelajaran: guru.mataPelajaran,
            status: guru.status,
            foto: guru.foto,
            faceID: guru.faceID,
            embeddings: guru.embeddings || [],
          };
        }
      }
      return user || null;
    }
    return null;
  };

  // --- 1. LOGIN ---
  if (path === "/auth/login" && method === "POST") {
    const emailLower = (body.email || "").trim().toLowerCase();
    const passwordTrimmed = (body.password || "").trim();

    if (emailLower === "hasanlek486@gmail.com" && passwordTrimmed === "admin123") {
      const user = { id: "admin-1", email: "hasanlek486@gmail.com", name: "Administrator Utama", role: "ADMIN" };
      return { token: "mock-token-admin-1", user };
    }
    
    const users = getTable("_mock_users");
    const user = users.find((u: any) => u.email.trim().toLowerCase() === emailLower);
    if (user) {
      // In mock mode, we accept either "guru123" or any password for convenience
      return { token: "mock-token-" + user.id, user };
    }

    throw new Error("Email atau password tidak terdaftar di sistem.");
  }

  // --- 2. AUTH ME ---
  if (path === "/auth/me" && method === "GET") {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("Access token is missing or expired (Mock)");
    }
    return user;
  }

  // --- 3. SCHOOL INFO ---
  if (path === "/school") {
    if (method === "GET") {
      return getSingleObj("_mock_school");
    }
    if (method === "PUT") {
      const school = { ...getSingleObj("_mock_school"), ...body };
      saveSingleObj("_mock_school", school);
      return school;
    }
  }

  // --- 4. SCHEDULE ---
  if (path === "/schedule") {
    if (method === "GET") {
      return getSingleObj("_mock_schedule");
    }
    if (method === "PUT") {
      const schedule = {
        ...getSingleObj("_mock_schedule"),
        ...body,
        jamToleransi: body.jamToleransi ? parseInt(String(body.jamToleransi), 10) : 15
      };
      saveSingleObj("_mock_schedule", schedule);
      return schedule;
    }
  }

  // --- 5. LOCATION ---
  if (path === "/location") {
    if (method === "GET") {
      return getSingleObj("_mock_location");
    }
    if (method === "PUT") {
      const location = {
        ...getSingleObj("_mock_location"),
        ...body,
        latitude: body.latitude ? parseFloat(String(body.latitude)) : 0,
        longitude: body.longitude ? parseFloat(String(body.longitude)) : 0,
        radius: body.radius ? parseFloat(String(body.radius)) : 100
      };
      saveSingleObj("_mock_location", location);
      return location;
    }
  }

  // --- 6. GURU ---
  if (path === "/guru") {
    if (method === "GET") {
      const search = searchParams.get("search")?.toLowerCase() || "";
      const statusFilter = searchParams.get("status") || "semua";
      let gurus = getTable("_mock_gurus");

      if (search) {
        gurus = gurus.filter((g: any) => 
          g.nama.toLowerCase().includes(search) || 
          g.NIP.toLowerCase().includes(search) ||
          (g.mataPelajaran && g.mataPelajaran.toLowerCase().includes(search))
        );
      }

      if (statusFilter && statusFilter !== "semua" && statusFilter !== "") {
        gurus = gurus.filter((g: any) => g.status === statusFilter);
      }

      return gurus;
    }

    if (method === "POST") {
      const { NIP, nama, email, mataPelajaran, telepon, NIK, jenisKelamin, tempatLahir, tanggalLahir, alamat, noHP, jabatan } = body;
      const gurus = getTable("_mock_gurus");
      const users = getTable("_mock_users");

      if (gurus.some((g: any) => g.NIP === NIP)) {
        throw new Error("NIP guru sudah terdaftar.");
      }
      if (gurus.some((g: any) => g.email === email)) {
        throw new Error("Email guru sudah terdaftar.");
      }

      const id = "guru-" + Date.now();
      const userId = "user-" + id;

      const newGuru = {
        id,
        NIP,
        nama,
        email,
        mataPelajaran,
        telepon: noHP || telepon || "",
        noHP: noHP || telepon || "",
        NIK: NIK || "",
        jenisKelamin: jenisKelamin || "L",
        tempatLahir: tempatLahir || "",
        tanggalLahir: tanggalLahir || "",
        alamat: alamat || "",
        jabatan: jabatan || "",
        status: "AKTIF",
        userId,
        faceID: null,
        embeddings: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const newUser = {
        id: userId,
        email,
        name: nama,
        role: "GURU"
      };

      gurus.push(newGuru);
      users.push(newUser);

      saveTable("_mock_gurus", gurus);
      saveTable("_mock_users", users);

      return newGuru;
    }
  }

  // Handle specific guru actions like status, reset, delete
  if (path.startsWith("/guru/")) {
    const parts = path.split("/");
    const id = parts[2];
    const subAction = parts[3];

    const gurus = getTable("_mock_gurus");
    const users = getTable("_mock_users");

    const guruIdx = gurus.findIndex((g: any) => g.id === id);

    if (method === "DELETE") {
      if (guruIdx > -1) {
        const deleted = gurus.splice(guruIdx, 1)[0];
        const userIdx = users.findIndex((u: any) => u.id === deleted.userId);
        if (userIdx > -1) {
          users.splice(userIdx, 1);
        }
        saveTable("_mock_gurus", gurus);
        saveTable("_mock_users", users);
        return { success: true };
      }
      throw new Error("Guru tidak ditemukan.");
    }

    if ((method === "POST" || method === "PUT") && subAction === "status") {
      const { status } = body;
      if (guruIdx > -1) {
        gurus[guruIdx].status = status;
        saveTable("_mock_gurus", gurus);
        return gurus[guruIdx];
      }
      throw new Error("Guru tidak ditemukan.");
    }

    if (method === "PUT" && !subAction) { // update guru
      const { NIP, nama, email, mataPelajaran, telepon, NIK, jenisKelamin, tempatLahir, tanggalLahir, alamat, noHP, jabatan } = body;
      if (guruIdx > -1) {
        gurus[guruIdx] = { 
          ...gurus[guruIdx], 
          NIP: NIP || gurus[guruIdx].NIP, 
          nama: nama || gurus[guruIdx].nama, 
          email: email || gurus[guruIdx].email, 
          mataPelajaran: mataPelajaran || gurus[guruIdx].mataPelajaran, 
          telepon: noHP || telepon || gurus[guruIdx].telepon,
          noHP: noHP || gurus[guruIdx].noHP,
          NIK: NIK || gurus[guruIdx].NIK,
          jenisKelamin: jenisKelamin || gurus[guruIdx].jenisKelamin,
          tempatLahir: tempatLahir || gurus[guruIdx].tempatLahir,
          tanggalLahir: tanggalLahir || gurus[guruIdx].tanggalLahir,
          alamat: alamat || gurus[guruIdx].alamat,
          jabatan: jabatan || gurus[guruIdx].jabatan,
          updatedAt: new Date().toISOString()
        };
        
        // update corresponding user name / email
        const userIdx = users.findIndex((u: any) => u.id === gurus[guruIdx].userId);
        if (userIdx > -1) {
          users[userIdx].name = nama || users[userIdx].name;
          users[userIdx].email = email || users[userIdx].email;
        }

        saveTable("_mock_gurus", gurus);
        saveTable("_mock_users", users);
        return gurus[guruIdx];
      }
      throw new Error("Guru tidak ditemukan.");
    }

    if (method === "POST" && subAction === "reset-password") {
      return { success: true, message: "Password berhasil di-reset ke standar." };
    }

    if (method === "POST" && subAction === "reset-face") {
      if (guruIdx > -1) {
        gurus[guruIdx].faceID = null;
        gurus[guruIdx].embeddings = [];
        saveTable("_mock_gurus", gurus);
        return { success: true, message: "Pendaftaran wajah berhasil di-reset." };
      }
      throw new Error("Guru tidak ditemukan.");
    }

    if (method === "POST" && subAction === "register-face") {
      if (guruIdx > -1) {
        gurus[guruIdx].faceID = `FACE-${gurus[guruIdx].NIP}-${Date.now()}`;
        gurus[guruIdx].embeddings = body.embeddings || [];
        saveTable("_mock_gurus", gurus);
        return { success: true, message: "Pendaftaran wajah berhasil didaftarkan." };
      }
      throw new Error("Guru tidak ditemukan.");
    }
  }

  // --- 7. ATTENDANCE ---
  if (path === "/attendance") {
    if (method === "GET") {
      const search = searchParams.get("search")?.toLowerCase() || "";
      const statusFilter = searchParams.get("status") || "";
      const filterDate = searchParams.get("date") || "";
      const filterMonth = searchParams.get("month") || "";
      const filterYear = searchParams.get("year") || "";

      let list = getTable("_mock_attendances");
      const gurus = getTable("_mock_gurus");

      // Join guru details
      list = list.map((log: any) => {
        const g = gurus.find((guru: any) => guru.id === log.guruId);
        return { ...log, guru: g };
      });

      // Filters
      if (search) {
        list = list.filter((log: any) => 
          log.guru?.nama?.toLowerCase().includes(search) || 
          log.guru?.NIP?.toLowerCase().includes(search)
        );
      }
      if (statusFilter) {
        list = list.filter((log: any) => log.status === statusFilter);
      }
      if (filterDate) {
        list = list.filter((log: any) => log.date === filterDate);
      }
      if (filterMonth) {
        list = list.filter((log: any) => {
          const parts = log.date.split("-"); // YYYY-MM-DD
          return parseInt(parts[1], 10) === parseInt(filterMonth, 10);
        });
      }
      if (filterYear) {
        list = list.filter((log: any) => {
          const parts = log.date.split("-");
          return parseInt(parts[0], 10) === parseInt(filterYear, 10);
        });
      }

      // Sort newest date and newest time
      list.sort((a: any, b: any) => {
        const dDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dDiff !== 0) return dDiff;
        return (b.jamMasuk || "").localeCompare(a.jamMasuk || "");
      });

      return list;
    }
  }

  // Handle specific attendance actions (Delete/Edit)
  if (path.startsWith("/attendance/")) {
    const parts = path.split("/");
    const id = parts[2];

    if (id && id !== "manual" && id !== "submit") {
      const list = getTable("_mock_attendances");
      const idx = list.findIndex((x: any) => x.id === id);

      if (method === "DELETE") {
        if (idx > -1) {
          list.splice(idx, 1);
          saveTable("_mock_attendances", list);
          return { success: true, message: "Data absensi berhasil dihapus." };
        }
        throw new Error("Data absensi tidak ditemukan.");
      }

      if (method === "PUT") {
        if (idx > -1) {
          const { date, status, notes, jamMasuk, jamPulang } = body;
          list[idx] = {
            ...list[idx],
            date: date || list[idx].date,
            status: status || list[idx].status,
            alamat: notes !== undefined ? notes : list[idx].alamat,
            jamMasuk: jamMasuk !== undefined ? jamMasuk : list[idx].jamMasuk,
            jamPulang: jamPulang !== undefined ? jamPulang : list[idx].jamPulang,
            updatedAt: new Date().toISOString()
          };
          saveTable("_mock_attendances", list);
          return { success: true, message: "Data absensi berhasil diperbarui.", data: list[idx] };
        }
        throw new Error("Data absensi tidak ditemukan.");
      }
    }
  }

  // Manual Attendance Create
  if (path === "/attendance/manual" && method === "POST") {
    const { guruId, date, status, jamMasuk, jamPulang, keterangan, notes } = body;
    const list = getTable("_mock_attendances");
    
    // Check if entry already exists for that date and guru
    const existingIdx = list.findIndex((x: any) => x.guruId === guruId && x.date === date);
    
    const finalJamMasuk = jamMasuk || (status === "HADIR" ? "07:00" : null);
    const finalJamPulang = jamPulang || null;
    const finalAlamat = notes || keterangan || "Dibuat secara Manual oleh Admin";

    if (existingIdx !== -1) {
      list[existingIdx] = {
        ...list[existingIdx],
        status,
        jamMasuk: finalJamMasuk,
        jamPulang: finalJamPulang,
        alamat: finalAlamat,
        updatedAt: new Date().toISOString()
      };
      saveTable("_mock_attendances", list);
      return list[existingIdx];
    } else {
      const id = "att-manual-" + Date.now();
      const newLog = {
        id,
        date,
        status,
        jamMasuk: finalJamMasuk,
        jamPulang: finalJamPulang,
        alamat: finalAlamat,
        guruId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      list.push(newLog);
      saveTable("_mock_attendances", list);
      return newLog;
    }
  }

  // Submit Real-time Attendance via Camera/GPS
  if (path === "/attendance/submit" && method === "POST") {
    const { type, foto } = body;
    const curUser = getCurrentUser();
    if (!curUser) throw new Error("Anda tidak terautentikasi.");

    const gurus = getTable("_mock_gurus");
    const guru = gurus.find((g: any) => g.id === curUser.id || g.userId === curUser.id || g.email === curUser.email);
    if (!guru) throw new Error("Profil guru tidak ditemukan untuk akun ini.");

    const schedule = getSingleObj("_mock_schedule");
    const tz = schedule.timezone || "WIT";
    let ianaTz = "Asia/Jayapura";
    if (tz === "WIB") ianaTz = "Asia/Jakarta";
    else if (tz === "WITA") ianaTz = "Asia/Makassar";

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: ianaTz });
    const timeStr = now.toLocaleTimeString("en-GB", { timeZone: ianaTz, hour12: false });

    const list = getTable("_mock_attendances");

    if (type === "masuk") {
      const alreadyCheckedIn = list.some((l: any) => l.guruId === guru.id && l.date === dateStr);
      if (alreadyCheckedIn) {
        throw new Error("Anda sudah melakukan absensi Masuk hari ini.");
      }

      // Check attendance status based on entry schedule and toleransi
      let finalStatus = "HADIR";
      const [nowH, nowM] = timeStr.split(":").map(Number);
      const [schH, schM] = (schedule.jamMasuk || "07:00").split(":").map(Number);
      const nowMinutes = nowH * 60 + nowM;
      const schMinutes = schH * 60 + schM;
      const lateThreshold = schMinutes + (schedule.jamToleransi || 15);

      if (nowMinutes > lateThreshold) {
        finalStatus = "TERLAMBAT";
      }

      const newLog = {
        id: "att-submit-" + Date.now(),
        date: dateStr,
        jamMasuk: timeStr,
        jamPulang: null,
        status: finalStatus,
        alamat: "Dalam Area Sekolah (Satelit GPS)",
        fotoMasuk: foto || null,
        guruId: guru.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      list.push(newLog);
      saveTable("_mock_attendances", list);
      return newLog;
    } else if (type === "pulang") {
      const existingLogIdx = list.findIndex((l: any) => l.guruId === guru.id && l.date === dateStr);
      if (existingLogIdx === -1) {
        throw new Error("Anda belum melakukan absensi Masuk hari ini.");
      }

      const log = list[existingLogIdx];
      if (log.jamPulang) {
        throw new Error("Anda sudah melakukan absensi Pulang hari ini.");
      }

      log.jamPulang = timeStr;
      log.fotoPulang = foto || null;
      log.updatedAt = new Date().toISOString();

      list[existingLogIdx] = log;
      saveTable("_mock_attendances", list);
      return log;
    }

    throw new Error("Tipe absensi tidak valid.");
  }

  // --- 8. STATS ADMIN ---
  if (path === "/stats/admin" && method === "GET") {
    const gurus = getTable("_mock_gurus").filter((g: any) => g.status !== "NON_AKTIF");
    const list = getTable("_mock_attendances");

    const schedule = getSingleObj("_mock_schedule");
    const tz = schedule.timezone || "WIT";
    let ianaTz = "Asia/Jayapura";
    if (tz === "WIB") ianaTz = "Asia/Jakarta";
    else if (tz === "WITA") ianaTz = "Asia/Makassar";

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: ianaTz });
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM

    const todayLogs = list.filter((l: any) => l.date === todayStr);

    let guruHadirHariIni = 0;
    let guruTerlambatHariIni = 0;
    let guruIzinHariIni = 0;
    let guruSakitHariIni = 0;

    todayLogs.forEach((log: any) => {
      if (log.status === "HADIR") guruHadirHariIni++;
      else if (log.status === "TERLAMBAT") guruTerlambatHariIni++;
      else if (log.status === "IZIN") guruIzinHariIni++;
      else if (log.status === "SAKIT") guruSakitHariIni++;
    });

    const activeGurus = gurus.length;
    const totalAbsenHariIni = todayLogs.length;
    const belumAbsenHariIni = Math.max(0, activeGurus - totalAbsenHariIni);

    const totalAbsensiBulanIni = list.filter((l: any) => l.date.startsWith(currentMonthStr)).length;

    // Weekly trend
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split("T")[0]);
    }

    const weeklyAttendance = last7Days.map((dayStr) => {
      const dayLogs = list.filter((l: any) => l.date === dayStr);
      let hadir = 0;
      let terlambat = 0;
      dayLogs.forEach((c: any) => {
        if (c.status === "HADIR") hadir++;
        if (c.status === "TERLAMBAT") terlambat++;
      });
      return { date: dayStr, hadir, terlambat };
    });

    const monthlyAttendance = [
      { month: "Feb 2026", rate: 88 },
      { month: "Mar 2026", rate: 92 },
      { month: "Apr 2026", rate: 91 },
      { month: "May 2026", rate: 95 },
      { month: "Jun 2026", rate: 94 },
      { month: "Jul 2026", rate: 96 },
    ];

    // Top late & diligent
    const lateMap: Record<string, any> = {};
    const allLate = list.filter((l: any) => l.status === "TERLAMBAT");
    allLate.forEach((l: any) => {
      const g = gurus.find((g: any) => g.id === l.guruId);
      if (g) {
        if (!lateMap[l.guruId]) {
          lateMap[l.guruId] = { nama: g.nama, NIP: g.NIP, count: 0 };
        }
        lateMap[l.guruId].count++;
      }
    });
    const terlambatTerbanyak = Object.values(lateMap).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

    const presenceMap: Record<string, any> = {};
    list.forEach((l: any) => {
      const g = gurus.find((g: any) => g.id === l.guruId);
      if (g) {
        if (!presenceMap[l.guruId]) {
          presenceMap[l.guruId] = { nama: g.nama, NIP: g.NIP, present: 0, total: 0 };
        }
        presenceMap[l.guruId].total++;
        if (l.status === "HADIR" || l.status === "TERLAMBAT") {
          presenceMap[l.guruId].present++;
        }
      }
    });
    const palingRajin = Object.values(presenceMap).map((item: any) => ({
      nama: item.nama,
      NIP: item.NIP,
      rate: item.total > 0 ? Math.round((item.present / item.total) * 100) : 0
    })).sort((a: any, b: any) => b.rate - a.rate).slice(0, 5);

    const aktivitasTerbaru = [
      { id: "act-1", email: "hasanlek486@gmail.com", action: "LOGIN", details: "Admin masuk ke sistem panel pengawas (Mock Mode).", createdAt: new Date().toISOString() }
    ];

    return {
      totalGuru: activeGurus,
      guruHadirHariIni,
      guruTerlambatHariIni,
      guruIzinHariIni,
      guruSakitHariIni,
      belumAbsenHariIni,
      totalAbsensiBulanIni,
      weeklyAttendance,
      monthlyAttendance,
      terlambatTerbanyak,
      palingRajin,
      aktivitasTerbaru
    };
  }

  // --- 9. STATS GURU ---
  if (path === "/stats/guru" && method === "GET") {
    const curUser = getCurrentUser();
    if (!curUser) throw new Error("Anda tidak terautentikasi.");

    const gurus = getTable("_mock_gurus");
    const guru = gurus.find((g: any) => g.id === curUser.id || g.userId === curUser.id || g.email === curUser.email);
    if (!guru) throw new Error("Profil guru tidak ditemukan.");

    const list = getTable("_mock_attendances");
    const schedule = getSingleObj("_mock_schedule");
    const tz = schedule.timezone || "WIT";
    let ianaTz = "Asia/Jayapura";
    if (tz === "WIB") ianaTz = "Asia/Jakarta";
    else if (tz === "WITA") ianaTz = "Asia/Makassar";

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: ianaTz });
    const todayLog = list.find((l: any) => l.guruId === guru.id && l.date === todayStr);

    const personalLogs = list.filter((l: any) => l.guruId === guru.id);

    const totalLogs = personalLogs.length;
    const totalPresent = personalLogs.filter((l: any) => l.status === "HADIR" || l.status === "TERLAMBAT").length;
    const persentaseHadir = totalLogs > 0 ? Math.round((totalPresent / totalLogs) * 100) : 100;

    const jumlahTerlambat = personalLogs.filter((l: any) => l.status === "TERLAMBAT").length;
    const jumlahSakit = personalLogs.filter((l: any) => l.status === "SAKIT").length;
    const jumlahIzin = personalLogs.filter((l: any) => l.status === "IZIN").length;

    const history7Days = personalLogs.slice(0, 7).map((log: any) => ({
      date: log.date,
      status: log.status,
      jamMasuk: log.jamMasuk || "--:--:--",
      jamPulang: log.jamPulang || "--:--:--"
    }));

    return {
      jamMasuk: schedule.jamMasuk || "07:00",
      jamPulang: schedule.jamPulang || "14:30",
      statusHariIni: todayLog ? todayLog.status : "BELUM ABSEN",
      absensiMasukCatat: todayLog?.jamMasuk || "--:--:--",
      absensiPulangCatat: todayLog?.jamPulang || "--:--:--",
      persentaseHadir,
      jumlahTerlambat,
      jumlahSakit,
      jumlahIzin,
      history7Days
    };
  }

  // --- 10. BACKUP & RESTORE DATABASE (OFFLINE fallback) ---
  if (path === "/backup/export" && method === "POST") {
    const users = getTable("_mock_users");
    const gurus = getTable("_mock_gurus");
    const attendances = getTable("_mock_attendances");
    const schedule = getSingleObj("_mock_schedule");
    const location = getSingleObj("_mock_location");
    const school = getSingleObj("_mock_school");

    return {
      users,
      gurus,
      embeddings: [], // embedded directly inside the gurus table in mock localStorage
      attendances,
      schedules: schedule ? [schedule] : [],
      locations: location ? [location] : [],
      schools: school ? [school] : [],
      settings: [],
      notifications: [],
      logs: []
    };
  }

  if (path === "/backup/restore" && method === "POST") {
    if (!body || !body.data) {
      throw new Error("Data cadangan tidak valid (Mock).");
    }
    const data = body.data;
    if (!data.users || !data.gurus || !data.attendances) {
      throw new Error("Format file cadangan tidak didukung (Mock).");
    }

    if (Array.isArray(data.users)) saveTable("_mock_users", data.users);
    if (Array.isArray(data.gurus)) saveTable("_mock_gurus", data.gurus);
    if (Array.isArray(data.attendances)) saveTable("_mock_attendances", data.attendances);

    if (data.schedules && data.schedules.length > 0) {
      saveSingleObj("_mock_schedule", data.schedules[0]);
    } else if (data.schedule) {
      saveSingleObj("_mock_schedule", data.schedule);
    }

    if (data.locations && data.locations.length > 0) {
      saveSingleObj("_mock_location", data.locations[0]);
    } else if (data.location) {
      saveSingleObj("_mock_location", data.location);
    }

    if (data.schools && data.schools.length > 0) {
      saveSingleObj("_mock_school", data.schools[0]);
    } else if (data.school) {
      saveSingleObj("_mock_school", data.school);
    }

    return { success: true, message: "Database Mock berhasil dipulihkan dari data cadangan." };
  }

  throw new Error(`Endpoint mock ${method} ${path} belum diimplementasikan.`);
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${getBaseUrl()}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // If it returned 404 (endpoint not found) and we can fallback to mock
      if (response.status === 404) {
        console.warn(`[Switch API] Endpoint ${endpoint} tidak ditemukan (404). Mencoba beralih ke Mock.`);
        localStorage.setItem("attendance_fallback_active", "true");
        return mockFetch(endpoint, options);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      } else {
        console.warn(`[Switch API] Status ${response.status} dengan respon non-JSON. Mencoba beralih ke Mock.`);
        localStorage.setItem("attendance_fallback_active", "true");
        return mockFetch(endpoint, options);
      }
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn(`[Switch API] Response tidak dalam format JSON. Mencoba beralih ke Mock.`);
      localStorage.setItem("attendance_fallback_active", "true");
      return mockFetch(endpoint, options);
    }

    const jsonResult = await response.json();
    localStorage.removeItem("attendance_fallback_active");
    return jsonResult;
  } catch (err: any) {
    // If it's a connection / network error, or JSON parsing error (e.g. from html response),
    // transparently fall back to client-side localStorage mock DB
    console.warn(`[Switch API] Gagal memproses request backend (${err.message}). Menjalankan fallback database lokal (Mock).`);
    localStorage.setItem("attendance_fallback_active", "true");
    return mockFetch(endpoint, options);
  }
}

// Compact payload representation for sharing via URL parameters securely and compactly.
export function encodeSyncPayload(payload: any): string {
  try {
    const compactGurus = (payload.gurus || []).map((g: any) => ({
      id: g.id,
      nip: g.NIP,
      nik: g.NIK,
      nm: g.nama,
      em: g.email,
      jk: g.jenisKelamin,
      tl: g.tempatLahir,
      tg: g.tanggalLahir,
      al: g.alamat,
      hp: g.noHP || g.telepon || "",
      jb: g.jabatan || "",
      mp: g.mataPelajaran || "",
      fId: g.faceID || "",
      eb: g.embeddings ? g.embeddings.map((item: any) => ({
        ex: item.expression,
        em: item.embedding ? item.embedding.map((val: number) => Math.round(val * 10000) / 10000) : []
      })) : [],
    }));

    const compact = {
      sc: payload.school ? { n: payload.school.name, a: payload.school.address } : null,
      sh: payload.schedule ? { t: payload.schedule.timezone, i: payload.schedule.jamMasuk, o: payload.schedule.jamPulang, l: payload.schedule.jamToleransi } : null,
      lo: payload.location ? { n: payload.location.name, la: payload.location.latitude, lo: payload.location.longitude, r: payload.location.radius } : null,
      gu: compactGurus
    };

    const jsonStr = JSON.stringify(compact);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binStr = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binStr += String.fromCharCode(utf8Bytes[i]);
    }
    return window.btoa(binStr)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (err) {
    console.error("Error encoding sync payload:", err);
    return "";
  }
}

export function decodeSyncPayload(str: string): any {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binStr = window.atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const compact = JSON.parse(jsonStr);

    const fullGurus = (compact.gu || []).map((g: any) => ({
      id: g.id,
      NIP: g.nip,
      NIK: g.nik,
      nama: g.nm,
      email: g.em,
      jenisKelamin: g.jk,
      tempatLahir: g.tl,
      tanggalLahir: g.tg,
      alamat: g.al,
      noHP: g.hp,
      jabatan: g.jb,
      mataPelajaran: g.mp,
      statusVerifikasi: false,
      faceID: g.fId || null,
      embeddings: g.eb ? g.eb.map((item: any) => ({
        expression: item.ex,
        embedding: item.em
      })) : []
    }));

    return {
      school: compact.sc ? { name: compact.sc.n, address: compact.sc.a } : null,
      schedule: compact.sh ? { timezone: compact.sh.t, jamMasuk: compact.sh.i, jamPulang: compact.sh.o, jamToleransi: compact.sh.l } : null,
      location: compact.lo ? { name: compact.lo.n, latitude: compact.lo.la, longitude: compact.lo.lo, radius: compact.lo.r } : null,
      gurus: fullGurus
    };
  } catch (err) {
    console.error("Error decoding sync payload:", err);
    return null;
  }
}
