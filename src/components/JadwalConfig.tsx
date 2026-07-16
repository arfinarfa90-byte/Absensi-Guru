import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { Clock, RefreshCw, Sparkles, Check, Save } from "lucide-react";

interface JadwalConfigProps {
  onSuccessToast: (msg: string) => void;
}

export default function JadwalConfig({ onSuccessToast }: JadwalConfigProps) {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [jamMasuk, setJamMasuk] = useState("");
  const [jamPulang, setJamPulang] = useState("");
  const [jamToleransi, setJamToleransi] = useState(15);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timezone, setTimezone] = useState("WIT");

  const daysList = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/schedule");
      setSchedule(data);
      setJamMasuk(data.jamMasuk);
      setJamPulang(data.jamPulang);
      setJamToleransi(data.jamToleransi);
      setSelectedDays(data.hariKerja.split(","));
      setTimezone(data.timezone || "WIT");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat jadwal.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDays.length === 0) {
      alert("Harap pilih minimal satu hari kerja.");
      return;
    }
    try {
      setSaving(true);
      await apiFetch("/schedule", {
        method: "PUT",
        body: JSON.stringify({
          id: schedule.id,
          jamMasuk,
          jamPulang,
          jamToleransi,
          hariKerja: selectedDays.join(","),
          timezone,
        }),
      });
      onSuccessToast("Konfigurasi Jadwal Kerja Sekolah berhasil diperbarui.");
      loadSchedule();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui jadwal.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded-lg" />
        <div className="h-64 bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Jadwal Kerja Sekolah
          <Clock className="w-5 h-5 text-teal-400" />
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Tetapkan jam masuk, toleransi keterlambatan, jam pulang, dan hari kerja aktif guru.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
            <h3 className="font-semibold text-white">Form Jam Kerja Utama</h3>
            <Sparkles className="w-4 h-4 text-teal-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Jam Masuk (HH:MM)</label>
              <input
                type="text"
                required
                value={jamMasuk}
                onChange={(e) => setJamMasuk(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                placeholder="07:00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Jam Pulang (HH:MM)</label>
              <input
                type="text"
                required
                value={jamPulang}
                onChange={(e) => setJamPulang(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                placeholder="14:30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Zona Waktu (Timezone)</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50 cursor-pointer"
              >
                <option value="WIT">WIT (Waktu Indonesia Timur) - UTC+9</option>
                <option value="WITA">WITA (Waktu Indonesia Tengah) - UTC+8</option>
                <option value="WIB">WIB (Waktu Indonesia Barat) - UTC+7</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Jam Toleransi Keterlambatan (Menit)</label>
            <input
              type="number"
              required
              value={jamToleransi}
              onChange={(e) => setJamToleransi(parseInt(e.target.value, 10))}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              placeholder="15"
              min={0}
            />
            <span className="text-[10px] text-slate-500 block">Guru yang absen melewati batas (Jam Masuk + Toleransi) akan otomatis ditandai sebagai TERLAMBAT.</span>
          </div>

          {/* Day selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase block">Hari Kerja Aktif</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {daysList.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? "bg-teal-500/20 border-teal-400 text-teal-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{day}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold shadow flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
            </button>
          </div>
        </form>

        {/* Right Info Box */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-white mb-2">Informasi Jadwal Kerja</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Jadwal kerja guru di SMKN 1 Jakarta diatur terpusat. Apabila guru melakukan presensi di luar hari kerja yang dipilih, sistem akan memicu notifikasi peringatan.
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-850">
                <span className="text-slate-400">Toleransi Aktif</span>
                <strong className="text-teal-400 font-mono">{jamToleransi} Menit</strong>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-850">
                <span className="text-slate-400">Total Hari Kerja</span>
                <strong className="text-white">{selectedDays.length} Hari</strong>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-850">
                <span className="text-slate-400">Zona Waktu Aktif</span>
                <strong className="text-indigo-400 font-bold">{timezone}</strong>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-850 mt-6 leading-normal">
            Catatan: Toleransi keterlambatan dihitung sejak menit pertama setelah jam masuk. Contoh: Jam Masuk 07:00, Toleransi 15 menit. Maka guru yang absen mulai 07:16 akan dinyatakan terlambat.
          </div>
        </div>
      </div>
    </div>
  );
}
