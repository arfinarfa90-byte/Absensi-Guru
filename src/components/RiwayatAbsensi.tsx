import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "../lib/api";
import {
  Calendar,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  MapPin,
  RefreshCw,
  Plus,
  X,
  Edit2,
  Trash2,
} from "lucide-react";

interface RiwayatAbsensiProps {
  onSuccessToast: (msg: string) => void;
}

export default function RiwayatAbsensi({ onSuccessToast }: RiwayatAbsensiProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [gurus, setGurus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const [school, setSchool] = useState<any>(null);

  // Manual Attendance Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const [manualData, setManualData] = useState({
    guruId: "",
    date: new Date().toISOString().split("T")[0],
    status: "HADIR",
    notes: "",
    jamMasuk: "",
    jamPulang: "",
  });

  const openManualModal = () => {
    setManualData({
      guruId: "",
      date: new Date().toISOString().split("T")[0],
      status: "HADIR",
      notes: "",
      jamMasuk: "",
      jamPulang: "",
    });
    setEditId(null);
    setShowManualModal(true);
  };

  const handleEditClick = (log: any) => {
    setManualData({
      guruId: log.guruId,
      date: log.date,
      status: log.status,
      notes: log.alamat || "",
      jamMasuk: log.jamMasuk ? log.jamMasuk.substring(0, 5) : "",
      jamPulang: log.jamPulang ? log.jamPulang.substring(0, 5) : "",
    });
    setEditId(log.id);
    setShowManualModal(true);
  };

  const handleDeleteClick = (log: any) => {
    setDeleteTarget(log);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/attendance/${deleteTarget.id}`, {
        method: "DELETE",
      });
      onSuccessToast("Presensi berhasil dihapus.");
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      loadLogsAndGurus();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus presensi.");
    }
  };

  const loadLogsAndGurus = async () => {
    try {
      setLoading(true);
      // Compile endpoint query string
      let query = "?";
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (status) query += `status=${status}&`;
      if (date) query += `date=${date}&`;
      if (month) query += `month=${month}&`;
      if (year) query += `year=${year}&`;

      const [logsData, gurusData, schoolData] = await Promise.all([
        apiFetch(`/attendance${query}`),
        apiFetch("/guru"),
        apiFetch("/school").catch(() => null),
      ]);

      setLogs(logsData);
      setGurus(gurusData);
      if (schoolData) {
        setSchool(schoolData);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat riwayat kehadiran.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogsAndGurus();
  }, [search, status, date, month, year]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.guruId || !manualData.date) {
      alert("Silakan lengkapi pilihan Guru dan Tanggal.");
      return;
    }
    try {
      if (editId) {
        // Edit Mode
        await apiFetch(`/attendance/${editId}`, {
          method: "PUT",
          body: JSON.stringify({
            date: manualData.date,
            status: manualData.status,
            notes: manualData.notes,
            jamMasuk: manualData.jamMasuk,
            jamPulang: manualData.jamPulang,
          }),
        });
        onSuccessToast("Presensi berhasil diperbarui.");
      } else {
        // Create Mode
        await apiFetch("/attendance/manual", {
          method: "POST",
          body: JSON.stringify(manualData),
        });
        onSuccessToast("Presensi manual berhasil dicatat.");
      }
      setShowManualModal(false);
      setEditId(null);
      loadLogsAndGurus();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan presensi.");
    }
  };

  // Export to standard formatted Excel CSV
  const handleExportExcel = () => {
    if (logs.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const schoolName = school?.name || "SMK Negeri 1 Jakarta";
    const schoolAddress = school?.address || "Jl. Raya Jakarta No. 1, Indonesia";
    
    // Create new workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Generate descriptive headers
    const filterInfo = [];
    if (search) filterInfo.push(`Pencarian: "${search}"`);
    if (status) filterInfo.push(`Status: ${status}`);
    if (date) filterInfo.push(`Tanggal: ${date}`);
    if (month) {
      const monthLabel = new Date(2020, parseInt(month, 10) - 1, 1).toLocaleDateString("id-ID", { month: "long" });
      filterInfo.push(`Bulan: ${monthLabel}`);
    }
    if (year) filterInfo.push(`Tahun: ${year}`);
    const filterText = filterInfo.length > 0 ? filterInfo.join(" | ") : "Semua Data";

    const aoaData: any[][] = [
      ["LAPORAN ABSENSI & PRESENSI KEHADIRAN GURU"],
      [schoolName],
      [schoolAddress],
      [`Periode / Filter: ${filterText}`],
      [`Unduh Pada: ${new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}`],
      [], // Empty row separator
      ["No", "Tanggal", "Hari", "NIP", "Nama Guru", "Mata Pelajaran", "Jam Masuk", "Jam Pulang", "Status", "Keterangan / Lokasi Presensi"]
    ];

    // Map logs to excel rows
    logs.forEach((log, index) => {
      const logDate = new Date(log.date);
      const dayName = logDate.toLocaleDateString("id-ID", { weekday: "long" });
      const dateStr = logDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      
      aoaData.push([
        index + 1,
        dateStr,
        dayName,
        log.guru?.NIP || "-",
        log.guru?.nama || "-",
        log.guru?.mataPelajaran || "-",
        log.jamMasuk || "-",
        log.jamPulang || "-",
        log.status || "-",
        log.alamat || "Presensi Otomatis"
      ]);
    });

    // Add some statistic summary at the bottom
    const totalLogs = logs.length;
    const totalHadir = logs.filter(l => l.status === "HADIR").length;
    const totalTerlambat = logs.filter(l => l.status === "TERLAMBAT").length;
    const totalIzin = logs.filter(l => l.status === "IZIN").length;
    const totalSakit = logs.filter(l => l.status === "SAKIT").length;
    const totalAlpha = logs.filter(l => l.status === "ALPHA").length;
    const totalPulang = logs.filter(l => l.status === "PULANG").length;

    aoaData.push([]);
    aoaData.push([]);
    aoaData.push(["RINGKASAN STATISTIK KEHADIRAN"]);
    aoaData.push(["Parameter Kehadiran", "Jumlah Guru", "Persentase (%)"]);
    
    aoaData.push(["Total Log Absensi", totalLogs, "100%"]);
    aoaData.push(["Hadir Tepat Waktu (HADIR)", totalHadir, totalLogs > 0 ? `${Math.round((totalHadir / totalLogs) * 100)}%` : "0%"]);
    aoaData.push(["Terlambat (TERLAMBAT)", totalTerlambat, totalLogs > 0 ? `${Math.round((totalTerlambat / totalLogs) * 100)}%` : "0%"]);
    aoaData.push(["Izin (IZIN)", totalIzin, totalLogs > 0 ? `${Math.round((totalIzin / totalLogs) * 100)}%` : "0%"]);
    aoaData.push(["Sakit (SAKIT)", totalSakit, totalLogs > 0 ? `${Math.round((totalSakit / totalLogs) * 100)}%` : "0%"]);
    aoaData.push(["Tanpa Keterangan (ALPHA)", totalAlpha, totalLogs > 0 ? `${Math.round((totalAlpha / totalLogs) * 100)}%` : "0%"]);
    aoaData.push(["Sudah Pulang (PULANG)", totalPulang, totalLogs > 0 ? `${Math.round((totalPulang / totalLogs) * 100)}%` : "0%"]);

    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    // Apply auto column-width calculation to make the document extremely neat ("rapikan")
    const colWidths = [
      { wch: 6 },   // No
      { wch: 16 },  // Tanggal
      { wch: 12 },  // Hari
      { wch: 18 },  // NIP
      { wch: 25 },  // Nama Guru
      { wch: 25 },  // Mata Pelajaran
      { wch: 12 },  // Jam Masuk
      { wch: 12 },  // Jam Pulang
      { wch: 15 },  // Status
      { wch: 55 },  // Keterangan / Lokasi Presensi
    ];
    ws["!cols"] = colWidths;

    // Merge titles cleanly
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // LAPORAN ABSENSI
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // School Name
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }, // School Address
      { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }, // Periode / Filter
      { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } }, // Unduh Pada
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Laporan Kehadiran");

    // Download file
    const fileDate = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Laporan_Presensi_Guru_${fileDate}.xlsx`);
    onSuccessToast("Laporan Excel (.xlsx) berhasil diekspor dengan format rapi dan statistik lengkap.");
  };

  // Instant print layout trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 print:bg-white print:p-0">
      {/* Header title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Riwayat & Laporan Absensi
            <Calendar className="w-5 h-5 text-teal-400" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Lihat, ubah status kehadiran guru secara manual, dan ekspor laporan periodik.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openManualModal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4 text-teal-400" /> Presensi Manual
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Ekspor Excel
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Printer className="w-4 h-4" /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* Query Filter and Search Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari guru atau NIP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
            >
              <option value="">Semua Status Kehadiran</option>
              <option value="HADIR">HADIR</option>
              <option value="TERLAMBAT">TERLAMBAT</option>
              <option value="IZIN">IZIN</option>
              <option value="SAKIT">SAKIT</option>
              <option value="ALPHA">ALPHA</option>
              <option value="PULANG">PULANG</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
            >
              <option value="">Pilih Bulan</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {new Date(2020, i, 1).toLocaleDateString("id-ID", { month: "long" })}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
            >
              <option value="">Pilih Tahun</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl print:border-none print:bg-white print:text-slate-950">
        {/* Printable Header */}
        <div className="hidden print:block text-center p-6 border-b border-slate-300 mb-6">
          <h2 className="text-xl font-bold text-slate-900">LAPORAN KEHADIRAN GURU</h2>
          <p className="text-xs text-slate-600 mt-1">SMK Negeri 1 Jakarta</p>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Dicetak pada: {new Date().toLocaleString("id-ID")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/20 print:border-slate-300 print:text-slate-700">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Nama Guru</th>
                <th className="py-3 px-4">Jam Masuk</th>
                <th className="py-3 px-4">Jam Pulang</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 print:hidden">Alamat/Lokasi</th>
                <th className="py-3 px-4 print:hidden text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300 print:divide-slate-200 print:text-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-400 mb-2" />
                    Memuat riwayat presensi...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Tidak ada log kehadiran guru yang terekam untuk kriteria pencarian ini.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/20 transition-colors print:hover:bg-transparent">
                    <td className="py-3.5 px-4 font-medium text-white print:text-slate-900">
                      {new Date(log.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3.5 px-4 font-mono">{log.guru?.NIP || "--"}</td>
                    <td className="py-3.5 px-4 font-semibold text-white print:text-slate-900">{log.guru?.nama || "--"}</td>
                    <td className="py-3.5 px-4 font-mono">{log.jamMasuk || "--"}</td>
                    <td className="py-3.5 px-4 font-mono">{log.jamPulang || "--"}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === "HADIR"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30 print:text-emerald-700 print:bg-emerald-100"
                          : log.status === "TERLAMBAT"
                          ? "bg-amber-950 text-amber-400 border border-amber-900/30 print:text-amber-700 print:bg-amber-100"
                          : "bg-rose-950 text-rose-400 border border-rose-900/30 print:text-rose-700 print:bg-rose-100"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 print:hidden max-w-[200px] truncate" title={log.alamat}>
                      {log.alamat || "Presensi Otomatis"}
                    </td>
                    <td className="py-3.5 px-4 print:hidden text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditClick(log)}
                          className="p-1.5 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-lg transition"
                          title="Ubah Presensi"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(log)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                          title="Hapus Presensi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Input Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-semibold text-white text-base">
                {editId ? "Ubah Presensi Guru" : "Presensi Manual Guru"}
              </h3>
              <button
                onClick={() => {
                  setShowManualModal(false);
                  setEditId(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Pilih Guru</label>
                <select
                  required
                  disabled={!!editId}
                  value={manualData.guruId}
                  onChange={(e) => setManualData({ ...manualData, guruId: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none disabled:opacity-50"
                >
                  <option value="">-- Pilih Guru --</option>
                  {gurus.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} (NIP: {g.NIP})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Tanggal Presensi</label>
                <input
                  type="date"
                  required
                  disabled={!!editId}
                  value={manualData.date}
                  onChange={(e) => setManualData({ ...manualData, date: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Status Presensi</label>
                <select
                  required
                  value={manualData.status}
                  onChange={(e) => setManualData({ ...manualData, status: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="HADIR">HADIR (Sesuai Jam Masuk)</option>
                  <option value="TERLAMBAT">TERLAMBAT</option>
                  <option value="IZIN">IZIN</option>
                  <option value="SAKIT">SAKIT</option>
                  <option value="ALPHA">ALPHA</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <span>Jam Masuk</span>
                    <span className="text-[9px] font-normal text-slate-500">(Opsional)</span>
                  </label>
                  <input
                    type="time"
                    value={manualData.jamMasuk}
                    onChange={(e) => setManualData({ ...manualData, jamMasuk: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <span>Jam Pulang</span>
                    <span className="text-[9px] font-normal text-slate-500">(Opsional)</span>
                  </label>
                  <input
                    type="time"
                    value={manualData.jamPulang}
                    onChange={(e) => setManualData({ ...manualData, jamPulang: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Catatan / Keterangan</label>
                <input
                  type="text"
                  value={manualData.notes}
                  onChange={(e) => setManualData({ ...manualData, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                  placeholder="Contoh: Sakit Surat Dokter, Dinas Luar, dll"
                />
              </div>

              <div className="flex justify-end pt-4 gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualModal(false);
                    setEditId(null);
                  }}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold shadow"
                >
                  {editId ? "Simpan Perubahan" : "Catat Kehadiran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-semibold text-white text-base">Hapus Presensi</h3>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus data presensi untuk <span className="font-semibold text-white">{deleteTarget?.guru?.nama || "guru ini"}</span> pada tanggal <span className="font-semibold text-white">{deleteTarget?.date ? new Date(deleteTarget.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>?
              </p>
              <p className="text-[11px] text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="p-5 bg-slate-950/20 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
