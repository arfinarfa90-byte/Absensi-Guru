import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { User, Save, Lock, Camera, Check, RefreshCw } from "lucide-react";

interface ProfilGuruProps {
  onSuccessToast: (msg: string) => void;
}

export default function ProfilGuru({ onSuccessToast }: ProfilGuruProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [noHP, setNoHP] = useState("");
  const [alamat, setAlamat] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/auth/me");
      setProfile(data);
      setNoHP(data.noHP || "");
      setAlamat(data.alamat || "");
      setEmail(data.email || "");
      setFoto(data.foto || null);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat profil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiFetch(`/guru/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({
          noHP,
          alamat,
          email,
          foto,
        }),
      });
      onSuccessToast("Biodata & profil berhasil diperbarui.");
      loadProfile();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui profil.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      alert("Harap masukkan password baru.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Konfirmasi password tidak cocok.");
      return;
    }
    try {
      setSaving(true);
      await apiFetch(`/guru/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      onSuccessToast("Password login Anda berhasil diperbarui.");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui password.");
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
      {/* Header title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Profil Saya
          <User className="w-5 h-5 text-teal-400" />
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Ubah informasi kontak, alamat rumah, foto profil utama, dan perbarui kata sandi akun Guru Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info Form */}
        <form onSubmit={handleSaveInfo} className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
            <h3 className="font-semibold text-white">Form Biodata Guru</h3>
            <span className="text-xs bg-slate-800 text-teal-300 font-mono px-2 py-0.5 rounded border border-slate-700">
              {profile?.jabatan || "Guru"}
            </span>
          </div>

          {/* Picture Selector */}
          <div className="flex items-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-slate-950 border-2 border-teal-500/50 flex items-center justify-center overflow-hidden">
              {foto ? (
                <img src={foto} alt="Foto Profil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-slate-600" />
              )}
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block mb-1">FOTO PROFIL</span>
              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition">
                <span>Unggah Foto</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Nama Lengkap</label>
              <input
                type="text"
                disabled
                value={profile?.name || ""}
                className="w-full p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-slate-500 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Nomor Induk Pegawai (NIP)</label>
              <input
                type="text"
                disabled
                value={profile?.NIP || ""}
                className="w-full p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-xs text-slate-500 font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">No. Handphone / WhatsApp</label>
              <input
                type="text"
                required
                value={noHP}
                onChange={(e) => setNoHP(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Alamat Rumah Tinggal</label>
            <textarea
              required
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              rows={3}
              placeholder="Alamat rumah tinggal saat ini"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold shadow flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Menyimpan..." : "Simpan Biodata"}</span>
            </button>
          </div>
        </form>

        {/* Change Password Form */}
        <form onSubmit={handleUpdatePassword} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-2">
              <Lock className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white">Ubah Password</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Password Baru</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                placeholder="Kata sandi baru"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Konfirmasi Password Baru</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                placeholder="Ulangi kata sandi baru"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 mt-6 cursor-pointer"
          >
            <Lock className="w-4 h-4 text-teal-400" />
            <span>{saving ? "Memperbarui..." : "Ubah Sandi"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
