import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  FileText,
  UserX,
  History,
  Calendar,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

interface DashboardAdminProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardAdmin({ onNavigate }: DashboardAdminProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await apiFetch("/stats/admin");
        setStats(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Gagal memuat data statistik dashboard.");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 lg:col-span-2 bg-slate-800 rounded-2xl" />
          <div className="h-80 bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <div className="bg-red-950/20 border border-red-800/50 p-6 rounded-2xl text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3 animate-bounce" />
          <h3 className="text-lg font-semibold text-white">Oops! Terjadi Kesalahan</h3>
          <p className="text-xs text-red-300 mt-1">{error || "Koneksi backend gagal."}</p>
        </div>
      </div>
    );
  }

  // Dashboard Stats Highlights
  const cards = [
    {
      label: "Total Guru",
      value: stats.totalGuru,
      icon: Users,
      color: "from-blue-500/20 to-indigo-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
    },
    {
      label: "Hadir Tepat Waktu",
      value: stats.guruHadirHariIni,
      icon: CheckCircle,
      color: "from-emerald-500/20 to-teal-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
    },
    {
      label: "Guru Terlambat",
      value: stats.guruTerlambatHariIni,
      icon: Clock,
      color: "from-amber-500/20 to-orange-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
    },
    {
      label: "Izin / Sakit",
      value: stats.guruIzinHariIni + stats.guruSakitHariIni,
      icon: FileText,
      color: "from-purple-500/20 to-pink-500/10",
      border: "border-purple-500/30",
      text: "text-purple-400",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header Welcome Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Ringkasan Kehadiran Sekolah
            <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data rekapitulasi kehadiran Guru hari ini secara real-time.
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300 font-mono">
          <Calendar className="w-4 h-4 text-teal-400" />
          <span>Hari ini: {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
      </div>

      {/* Stats Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className={`bg-gradient-to-br ${card.color} border ${card.border} rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:-translate-y-1 transition duration-300`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400 font-medium">{card.label}</span>
                  <h3 className="text-3xl font-extrabold text-white mt-1.5 font-sans tracking-tight">
                    {card.value}
                  </h3>
                </div>
                <div className={`p-3 rounded-xl bg-slate-900 border border-slate-800 ${card.text}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Area Trend Chart */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-white">Tren Kehadiran Mingguan</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Statistik kedisiplinan guru selama 7 hari kerja terakhir.</p>
            </div>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "11px", fontWeight: "bold" }}
                />
                <Area type="monotone" dataKey="hadir" stroke="#2dd4bf" strokeWidth={2} fillOpacity={1} fill="url(#colorHadir)" name="Hadir Tepat" />
                <Area type="monotone" dataKey="terlambat" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#colorLate)" name="Terlambat" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance metrics */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-semibold text-white">Metrik Bulan Ini</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Persentase data perbandingan kehadiran.</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="space-y-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Presensi Bulan Ini</span>
                  <strong className="text-2xl font-bold text-white mt-1 block">
                    {stats.totalAbsensiBulanIni}
                  </strong>
                </div>
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 text-sm">
                  {stats.totalAbsensiBulanIni > 0 ? "OK" : "NEW"}
                </div>
              </div>

              {/* Attendance compliance */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Tingkat Kehadiran Guru</span>
                  <span className="text-teal-400 font-bold">96%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full" style={{ width: "96%" }} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Rata-Rata Keterlambatan</span>
                  <span className="text-amber-400 font-bold">4%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full" style={{ width: "4%" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={() => onNavigate("laporan")}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 shadow"
            >
              Ekspor Laporan Presensi <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Lower section: Recent Activities & Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top late or top active staff */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-white">Guru Paling Disiplin (Bulan Ini)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Rangking kehadiran tertinggi dan tepat waktu.</p>
            </div>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>

          <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
            {stats.palingRajin.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Belum ada data kehadiran.</p>
            ) : (
              stats.palingRajin.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-white">{item.nama}</h4>
                      <p className="text-[10px] text-slate-400">NIP: {item.NIP}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-400">{item.rate}% Hadir</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit Action Logs */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-semibold text-white">Aktivitas Sistem Terbaru</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Log audit transaksi pendaftaran, login, dan presensi.</p>
            </div>
            <History className="w-4 h-4 text-slate-400" />
          </div>

          <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto space-y-2.5 pt-1">
            {stats.aktivitasTerbaru.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Belum ada aktivitas tercatat.</p>
            ) : (
              stats.aktivitasTerbaru.map((log: any, i: number) => (
                <div key={i} className="flex items-start justify-between py-2 text-xs">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{log.details}</p>
                      <span className="text-[10px] text-slate-400">{log.userId || "Sistem"} | IP: {log.ip}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
