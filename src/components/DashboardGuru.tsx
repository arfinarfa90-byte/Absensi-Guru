import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Camera,
  History,
  Calendar,
  Compass,
  AlertCircle,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import CameraRecognition from "./CameraRecognition";

interface DashboardGuruProps {
  onSuccessToast: (msg: string) => void;
}

export default function DashboardGuru({ onSuccessToast }: DashboardGuruProps) {
  const [stats, setStats] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Clock State
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  // Live Geolocation State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [checkingGps, setCheckingGps] = useState(false);

  // Camera Recognition Activation
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState<"masuk" | "pulang">("masuk");
  const [teacherProfile, setTeacherProfile] = useState<any>(null);

  // Update Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("id-ID", { hour12: false }));
      setDateStr(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load stats and configs
  const loadStatsAndConfigs = async () => {
    try {
      setLoading(true);
      const [statsData, locData, profileData] = await Promise.all([
        apiFetch("/stats/guru"),
        apiFetch("/location"),
        apiFetch("/auth/me"),
      ]);

      setStats(statsData);
      setLocation(locData);
      setTeacherProfile(profileData);
      setError(null);

      // Trigger GPS track
      trackGPS(locData);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data dashboard guru.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsAndConfigs();
  }, []);

  // Track GPS Coordinates and Calculate distance to school
  const trackGPS = (locConfig?: any) => {
    const targetLoc = locConfig || location;
    if (!targetLoc) return;

    setCheckingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Browser Anda tidak mendukung layanan Geolocation GPS.");
      setCheckingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        setUserCoords({ lat: uLat, lng: uLng });

        // Haversine formula distance calculation
        const R = 6371e3; // meters
        const lat1 = (uLat * Math.PI) / 180;
        const lat2 = (targetLoc.latitude * Math.PI) / 180;
        const deltaLat = ((targetLoc.latitude - uLat) * Math.PI) / 180;
        const deltaLng = ((targetLoc.longitude - uLng) * Math.PI) / 180;

        const a =
          Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distMeters = R * c;

        setDistance(distMeters);
        setCheckingGps(false);
      },
      (err) => {
        setGpsError("Gagal mendeteksi lokasi GPS. Harap berikan izin akses lokasi di browser Anda.");
        setCheckingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleScanSuccess = async (data: { selfie: string }) => {
    try {
      setShowScanner(false);
      setLoading(true);

      // Get Client Details
      const ua = navigator.userAgent;
      let browserName = "Chrome";
      if (ua.indexOf("Firefox") > -1) browserName = "Firefox";
      else if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) browserName = "Safari";
      else if (ua.indexOf("Edge") > -1) browserName = "Edge";

      const deviceName = /Mobi|Android|iPhone/i.test(ua) ? "Mobile Smartphone" : "Desktop PC";

      // Submit attendance request
      const response = await apiFetch("/attendance/submit", {
        method: "POST",
        body: JSON.stringify({
          type: scanType,
          latitude: userCoords?.lat || null,
          longitude: userCoords?.lng || null,
          selfie: data.selfie,
          device: deviceName,
          browser: browserName,
          address: distance ? `Jarak ${Math.round(distance)}m dari sekolah` : "GPS Terverifikasi",
        }),
      });

      onSuccessToast(response.message || "Presensi Anda berhasil disimpan!");
      await loadStatsAndConfigs();
    } catch (err: any) {
      alert(err.message || "Gagal melakukan presensi.");
      await loadStatsAndConfigs();
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 lg:col-span-2 bg-slate-800 rounded-2xl" />
          <div className="h-64 bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="bg-red-950/20 border border-red-800/50 p-6 rounded-2xl text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3 animate-bounce" />
          <h3 className="text-lg font-semibold text-white">Oops! Koneksi Bermasalah</h3>
          <p className="text-xs text-red-300 mt-1">{error || "Koneksi ke backend server gagal."}</p>
          <button
            onClick={loadStatsAndConfigs}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl border border-slate-700 text-xs hover:bg-slate-700"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // Determine button parameters
  const isWithinRadius = location && distance !== null && distance <= location.radius;
  const showWarningZone = location && distance !== null && distance > location.radius;

  return (
    <div className="p-6 space-y-6">
      {/* Active Scan Overlay modal */}
      {showScanner && teacherProfile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <CameraRecognition
            mode="verify"
            guruId={teacherProfile.id}
            registeredEmbeddings={teacherProfile.embeddings || []}
            onSuccess={handleScanSuccess}
            onCancel={() => setShowScanner(false)}
          />
        </div>
      )}

      {/* Header Welcome Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider font-mono">PORTAL PRESENSI GURU</span>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              Selamat Datang, {teacherProfile?.name || "Bapak/Ibu Guru"}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              Silakan lakukan presensi masuk atau pulang menggunakan validasi pemindaian wajah dan koordinat satelit GPS Anda.
            </p>
          </div>

          {/* Digital Clock card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[200px] text-center shadow-inner relative group">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent" />
            <Clock className="w-5 h-5 text-teal-400 animate-pulse mb-1" />
            <span className="text-3xl font-extrabold font-mono tracking-widest text-white leading-none">
              {timeStr || "--:--:--"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium uppercase mt-2">
              {dateStr || "Memuat Hari..."}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Actions and GPS Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Presensi CTA panel */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
              <div>
                <h3 className="font-semibold text-white">Presensi Mandiri Hari Ini</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Catatan aktivitas kehadiran jam kerja Anda.</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                stats.statusHariIni === "HADIR"
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                  : stats.statusHariIni === "TERLAMBAT"
                  ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                  : "bg-slate-950 text-slate-400 border border-slate-800"
              }`}>
                Status Hari ini: {stats.statusHariIni}
              </span>
            </div>

            {/* Time constraints */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-center">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Jam Masuk Sekolah</span>
                <strong className="text-xl font-bold text-white mt-1 block">{stats.jamMasuk}</strong>
                <span className="text-[9px] text-teal-400 block mt-1 font-mono">Tercatat: {stats.absensiMasukCatat}</span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-center">
                <span className="text-[10px] text-slate-400 font-medium uppercase block">Jam Pulang Sekolah</span>
                <strong className="text-xl font-bold text-white mt-1 block">{stats.jamPulang}</strong>
                <span className="text-[9px] text-teal-400 block mt-1 font-mono">Tercatat: {stats.absensiPulangCatat}</span>
              </div>
            </div>

            {/* Radius Validation Notification */}
            {showWarningZone && (
              <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs p-4 rounded-xl flex items-start gap-3 mb-6">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h5 className="font-semibold text-white">Tidak Berada di Area Sekolah</h5>
                  <p className="text-[11px] text-rose-200 mt-1 leading-relaxed">
                    Jarak Anda saat ini: <strong>{Math.round(distance || 0)} meter</strong> dari titik koordinat sekolah.
                    Radius presensi maksimal yang diizinkan adalah <strong>{location?.radius} meter</strong>.
                    Tombol presensi akan dinonaktifkan sementara.
                  </p>
                </div>
              </div>
            )}

            {isWithinRadius && (
              <div className="bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs p-4 rounded-xl flex items-start gap-3 mb-6">
                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-white">Verifikasi Lokasi Sukses</h5>
                  <p className="text-[11px] text-emerald-200 mt-1 leading-relaxed">
                    Anda terdeteksi berada di dalam wilayah sekolah (jarak: <strong>{Math.round(distance || 0)}m</strong>).
                    Pindai wajah diaktifkan. Silakan tekan tombol absensi.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Large Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setScanType("masuk");
                setShowScanner(true);
              }}
              disabled={stats.absensiMasukCatat !== "--:--:--" || showWarningZone || !isWithinRadius}
              className={`py-4 rounded-xl font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 ${
                stats.absensiMasukCatat !== "--:--:--"
                  ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed shadow-none"
                  : showWarningZone
                  ? "bg-rose-900/40 text-rose-300/40 border border-rose-900/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-slate-950"
              }`}
            >
              <Camera className="w-5 h-5" />
              <span>Absen Masuk</span>
            </button>

            <button
              onClick={() => {
                setScanType("pulang");
                setShowScanner(true);
              }}
              disabled={stats.absensiMasukCatat === "--:--:--" || stats.absensiPulangCatat !== "--:--:--" || showWarningZone || !isWithinRadius}
              className={`py-4 rounded-xl font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 ${
                stats.absensiMasukCatat === "--:--:--" || stats.absensiPulangCatat !== "--:--:--"
                  ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed shadow-none"
                  : showWarningZone
                  ? "bg-rose-900/40 text-rose-300/40 border border-rose-900/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
              }`}
            >
              <Camera className="w-5 h-5" />
              <span>Absen Pulang</span>
            </button>
          </div>
        </div>

        {/* GPS Satellite details card */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-semibold text-white">Satelit GPS Geolocation</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Pemeriksaan koordinat presisi jarak.</p>
              </div>
              <Compass className={`w-4 h-4 ${checkingGps ? "animate-spin text-teal-400" : "text-slate-400"}`} />
            </div>

            <div className="space-y-4">
              {/* Lat Lng display */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">KOORDINAT GURU</span>
                  <strong className="text-xs font-mono text-white block mt-1">
                    {userCoords ? `${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)}` : "Mencari satelit..."}
                  </strong>
                </div>
                <MapPin className="w-5 h-5 text-teal-400" />
              </div>

              {/* Dist and Radius */}
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-850">
                <span className="text-slate-400 font-medium">Jarak ke Sekolah</span>
                <strong className="text-white">
                  {distance !== null ? `${Math.round(distance)} meter` : "--"}
                </strong>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-850">
                <span className="text-slate-400 font-medium">Radius Maksimal</span>
                <strong className="text-teal-400 font-mono">
                  {location ? `${location.radius} meter` : "--"}
                </strong>
              </div>

              {gpsError && (
                <div className="bg-rose-950/20 border border-rose-900/50 text-rose-300 text-[10px] p-2.5 rounded-lg flex gap-1.5 leading-normal">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{gpsError}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button
              onClick={() => trackGPS()}
              disabled={checkingGps}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              {checkingGps ? "Melacak GPS..." : "Perbarui Akurasi GPS"}
            </button>
          </div>
        </div>
      </div>

      {/* Grid Lower Stats & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guru stats cards */}
        <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <h3 className="font-semibold text-white border-b border-slate-800 pb-3 mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-teal-400" /> Statistik Kehadiran Saya
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Persentase Hadir</span>
              <strong className="text-2xl font-bold text-teal-400 mt-1 block">{stats.persentaseHadir}%</strong>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Total Terlambat</span>
              <strong className="text-2xl font-bold text-amber-400 mt-1 block">{stats.jumlahTerlambat} kali</strong>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Sakit</span>
              <strong className="text-2xl font-bold text-purple-400 mt-1 block">{stats.jumlahSakit} hari</strong>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Izin</span>
              <strong className="text-2xl font-bold text-indigo-400 mt-1 block">{stats.jumlahIzin} hari</strong>
            </div>
          </div>
        </div>

        {/* 7 Days History Panel */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <h3 className="font-semibold text-white border-b border-slate-800 pb-3 mb-4 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-400" /> Riwayat Presensi Terakhir (7 Hari)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5">Tanggal</th>
                  <th className="py-2.5">Jam Masuk</th>
                  <th className="py-2.5">Jam Pulang</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {stats.history7Days.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Belum ada data presensi terekam dalam 7 hari kerja terakhir.
                    </td>
                  </tr>
                ) : (
                  stats.history7Days.map((log: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-850/20">
                      <td className="py-3 font-medium text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </td>
                      <td className="py-3 font-mono">{log.jamMasuk || "--:--:--"}</td>
                      <td className="py-3 font-mono">{log.jamPulang || "--:--:--"}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === "HADIR"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30"
                            : log.status === "TERLAMBAT"
                            ? "bg-amber-950 text-amber-400 border border-amber-900/30"
                            : "bg-rose-950 text-rose-400 border border-rose-900/30"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
