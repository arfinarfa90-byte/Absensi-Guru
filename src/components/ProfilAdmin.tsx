import React, { useEffect, useState } from "react";
import { apiFetch, getBaseUrl, setCustomApiUrl, getActiveDatabaseMode } from "../lib/api";
import { 
  School, 
  Database, 
  Save, 
  Sparkles, 
  Download, 
  Upload, 
  AlertCircle, 
  RefreshCw, 
  Settings,
  Share2,
  Copy,
  Link,
  Server,
  Check
} from "lucide-react";

interface ProfilAdminProps {
  onSuccessToast: (msg: string) => void;
}

export default function ProfilAdmin({ onSuccessToast }: ProfilAdminProps) {
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom API configuration state
  const [customApiUrl, setCustomApiUrlInput] = useState(() => {
    return localStorage.getItem("attendance_api_url") || "";
  });
  const [copied, setCopied] = useState(false);

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

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedUrl = customApiUrl.trim();
    if (formattedUrl) {
      setCustomApiUrl(formattedUrl);
      onSuccessToast("URL Backend Server berhasil disimpan! Halaman akan dimuat ulang.");
    } else {
      setCustomApiUrl(null);
      onSuccessToast("URL Backend diatur ulang ke server default! Halaman akan dimuat ulang.");
    }
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleCopySharingLink = () => {
    const activeApi = getBaseUrl();
    const sharingUrl = `${window.location.origin}/?api=${activeApi}`;
    
    try {
      navigator.clipboard.writeText(sharingUrl);
      setCopied(true);
      onSuccessToast("Link berbagi berhasil disalin! Silakan kirimkan link ini ke WhatsApp guru-guru.");
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      // Fallback if clipboard API fails
      const input = document.createElement("input");
      input.value = sharingUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      onSuccessToast("Link berbagi berhasil disalin (fallback)! Silakan bagikan ke guru-guru.");
      setTimeout(() => setCopied(false), 3000);
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

      {/* Cloud Sync and Multi-Device Connectivity Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm sm:text-base">
            <Server className="w-5 h-5 text-indigo-400" />
            Hubungkan Aplikasi ke Perangkat Guru & Smartphone (Sinkronisasi Cloud)
          </h3>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            getActiveDatabaseMode() === "Local Mock DB" 
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse"
          }`}>
            Mode: {getActiveDatabaseMode()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Copy Sharing Link */}
          <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-xl flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Share2 className="w-4 h-4 text-teal-400" />
                Langkah 1: Bagikan Link Khusus ke Guru-Guru
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Salin link khusus di bawah ini dan bagikan kepada seluruh guru (misal lewat WhatsApp Group sekolah). Ketika guru membuka link ini di HP atau laptop mereka, aplikasi mereka akan <strong>otomatis langsung terhubung ke database server yang sama</strong> dengan yang Anda kelola saat ini. Semua data guru yang telah Anda daftarkan akan langsung sinkron secara <em>real-time</em>!
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleCopySharingLink}
                className="w-full py-3 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Link Berhasil Disalin!" : "Salin Link Berbagi untuk Guru"}</span>
              </button>
              <div className="mt-2 text-[10px] font-mono text-slate-500 text-center break-all bg-slate-900 p-2 rounded border border-slate-800">
                {window.location.origin}/?api={getBaseUrl()}
              </div>
            </div>
          </div>

          {/* Column 2: Configure API Endpoint */}
          <form onSubmit={handleSaveApiUrl} className="bg-slate-950 border border-slate-800/80 p-5 rounded-xl flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Link className="w-4 h-4 text-indigo-400" />
                Langkah 2: Kelola URL API Backend Server
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Secara default, aplikasi mendeteksi server Cloud Run secara otomatis. Jika Anda ingin memindahkan database ke server lain atau memaksa menggunakan URL tertentu, isi di bawah ini dan klik Simpan. Kosongkan lalu Simpan untuk mengembalikan ke deteksi otomatis.
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">URL Endpoint API Aktif</label>
              <input
                type="text"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrlInput(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                placeholder={`Contoh: https://my-server.run.app/api (Saat ini: ${getBaseUrl()})`}
              />
            </div>

            <div className="flex gap-2.5 justify-end">
              {localStorage.getItem("attendance_api_url") && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomApiUrlInput("");
                    setCustomApiUrl(null);
                    onSuccessToast("URL Backend disetel ulang ke default. Halaman akan dimuat ulang.");
                    setTimeout(() => window.location.reload(), 1000);
                  }}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Gunakan Default
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan URL</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
