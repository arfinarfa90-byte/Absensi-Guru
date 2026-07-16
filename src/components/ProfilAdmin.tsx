import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { School, Database, Save, Sparkles, Download, Upload, AlertCircle, RefreshCw, Settings } from "lucide-react";

interface ProfilAdminProps {
  onSuccessToast: (msg: string) => void;
}

export default function ProfilAdmin({ onSuccessToast }: ProfilAdminProps) {
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  // Backup states
  const [restoring, setRestoring] = useState(false);

  const loadSchool = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/school");
      setSchool(data);
      setName(data.name);
      setAddress(data.address);
      setLogo(data.logo);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat profil sekolah.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchool();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiFetch("/school", {
        method: "PUT",
        body: JSON.stringify({
          id: school.id,
          name,
          address,
          logo,
        }),
      });
      onSuccessToast("Profil & Identitas Sekolah berhasil diperbarui.");
      loadSchool();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui profil sekolah.");
    } finally {
      setSaving(false);
    }
  };

  // Export full database JSON dump
  const handleExportBackup = async () => {
    try {
      const dump = await apiFetch("/backup/export", { method: "POST" });
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dump, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `BACKUP_SMART_ATTENDANCE_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      onSuccessToast("Database cadangan berhasil diekspor!");
    } catch (err) {
      alert("Gagal mengunduh file cadangan database.");
    }
  };

  // Restore database JSON dump
  const handleImportRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("PERINGATAN KRITIKAL: Memulihkan database akan menghapus seluruh data guru, log kehadiran, dan akun saat ini untuk digantikan dengan isi file cadangan. Apakah Anda yakin?")) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setRestoring(true);
        const parsed = JSON.parse(event.target?.result as string);
        const response = await apiFetch("/backup/restore", {
          method: "POST",
          body: JSON.stringify({ data: parsed }),
        });
        onSuccessToast(response.message);
        loadSchool();
        window.location.reload(); // Refresh to reload the whole system state safely
      } catch (err: any) {
        alert(err.message || "Gagal memproses file cadangan. Pastikan struktur file JSON valid.");
      } finally {
        setRestoring(false);
      }
    };
    reader.readAsText(file);
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
      {/* Header title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Pengaturan & Pemeliharaan Sistem
          <Settings className="w-5 h-5 text-teal-400" />
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Kelola profil logo sekolah, identitas resmi, dan cadangan ekspor-impor database Smart Attendance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Institutional form */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <School className="w-5 h-5 text-teal-400" /> Profil Sekolah
            </h3>
            <Sparkles className="w-4 h-4 text-teal-400" />
          </div>

          {/* Logo display and select */}
          <div className="flex items-center gap-4 py-2">
            <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
              {logo ? (
                <img src={logo} alt="School Logo" className="w-full h-full object-cover" />
              ) : (
                <School className="w-8 h-8 text-slate-600" />
              )}
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block mb-1">LOGO RESMI SEKOLAH</span>
              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition">
                <span>Pilih Foto</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Nama Resmi Sekolah</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              placeholder="SMK Negeri 1 Jakarta"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Alamat Resmi Lengkap</label>
            <textarea
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              rows={3}
              placeholder="Jl. Budi Utomo No.7, Sawah Besar, Jakarta Pusat, DKI Jakarta"
            />
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

        {/* Database backup / restore panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <Database className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white">Cadangan Database</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Lakukan ekspor cadangan seluruh tabel, koordinat wajah, log, dan presensi secara berkala demi menjamin keamanan data guru SMKN 1 Jakarta.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-teal-400" />
                <span>Unduh Cadangan (.json)</span>
              </button>

              <label className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>{restoring ? "Memulihkan..." : "Pulihkan Cadangan (.json)"}</span>
                <input type="file" accept=".json" onChange={handleImportRestore} disabled={restoring} className="hidden" />
              </label>
            </div>
          </div>

          <div className="bg-amber-950/20 border border-amber-900/40 p-3.5 rounded-xl flex items-start gap-2.5 text-[10px] text-amber-300 mt-6 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Peringatan:</strong> Memulihkan cadangan akan menimpa seluruh rekaman database saat ini. Harap lakukan ekspor terlebih dahulu sebelum melakukan pemulihan.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
