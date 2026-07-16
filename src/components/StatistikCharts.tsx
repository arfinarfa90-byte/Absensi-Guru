import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { TrendingUp, Award, Clock, Star, RefreshCw, BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";

export default function StatistikCharts() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/stats/admin");
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat statistik harian.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-800 rounded-2xl" />
          <div className="h-80 bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">{error || "Koneksi gagal"}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Statistik Kehadiran Lengkap
          <TrendingUp className="w-5 h-5 text-teal-400" />
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Analisis grafik data mingguan, bulanan, tingkat ketepatan waktu, dan pemeringkatan guru.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Bar Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-1.5">
            <BarChart2 className="w-4.5 h-4.5 text-teal-400" /> Kehadiran Mingguan (Jumlah)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weeklyAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "11px", fontWeight: "bold" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Bar dataKey="hadir" fill="#2dd4bf" name="Hadir Tepat" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terlambat" fill="#f59e0b" name="Terlambat" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Line Rate Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4.5 h-4.5 text-indigo-400" /> Tren Kehadiran Bulanan (%)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} domain={[80, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                  labelStyle={{ color: "#94a3b8", fontSize: "11px", fontWeight: "bold" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" activeDot={{ r: 6 }} name="Tingkat Kehadiran (%)" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guru Terlambat Terbanyak */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-1.5">
            <Clock className="w-4.5 h-4.5 text-amber-500" /> Guru Terlambat Terbanyak
          </h3>
          <div className="divide-y divide-slate-800/60 space-y-3 pt-1">
            {stats.terlambatTerbanyak.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Tidak ada catatan keterlambatan bulan ini.</p>
            ) : (
              stats.terlambatTerbanyak.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="font-semibold text-white">{item.nama}</h4>
                      <p className="text-[10px] text-slate-400">NIP: {item.NIP}</p>
                    </div>
                  </div>
                  <strong className="text-rose-400 font-mono bg-rose-950/20 border border-rose-900/20 px-2 py-0.5 rounded">
                    {item.count} Kali Terlambat
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Guru Paling Rajin / Disiplin */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-semibold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-1.5">
            <Award className="w-4.5 h-4.5 text-yellow-400 animate-pulse" /> Guru Paling Rajin (Apresiasi)
          </h3>
          <div className="divide-y divide-slate-800/60 space-y-3 pt-1">
            {stats.palingRajin.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Belum ada data kehadiran terekam.</p>
            ) : (
              stats.palingRajin.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold flex items-center justify-center">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    </span>
                    <div>
                      <h4 className="font-semibold text-white">{item.nama}</h4>
                      <p className="text-[10px] text-slate-400">NIP: {item.NIP}</p>
                    </div>
                  </div>
                  <strong className="text-teal-400 font-mono bg-teal-950/20 border border-teal-900/20 px-2 py-0.5 rounded">
                    {item.rate}% Kehadiran
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
