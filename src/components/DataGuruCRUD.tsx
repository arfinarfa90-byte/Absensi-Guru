import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Lock,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  Sparkles,
  Camera,
  Download,
  Upload,
  UserX,
  UserCheck,
  AlertCircle,
  QrCode,
} from "lucide-react";
import CameraRecognition from "./CameraRecognition";

interface DataGuruCRUDProps {
  onSuccessToast: (msg: string) => void;
}

export default function DataGuruCRUD({ onSuccessToast }: DataGuruCRUDProps) {
  const [gurus, setGurus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals / Form State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedGuru, setSelectedGuru] = useState<any>(null);

  // Active Facial Scanner
  const [showFaceRegScanner, setShowFaceRegScanner] = useState(false);
  const [scanGuruId, setScanGuruId] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    nama: "",
    NIP: "",
    NIK: "",
    jenisKelamin: "L",
    tempatLahir: "",
    tanggalLahir: "",
    alamat: "",
    noHP: "",
    email: "",
    jabatan: "",
    mataPelajaran: "",
    password: "",
  });

  const loadGurus = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/guru?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      setGurus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal mengambil data guru.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGurus();
  }, [search, statusFilter]);

  const handleOpenAdd = () => {
    setModalMode("add");
    setSelectedGuru(null);
    setFormData({
      nama: "",
      NIP: "",
      NIK: "",
      jenisKelamin: "L",
      tempatLahir: "",
      tanggalLahir: "",
      alamat: "",
      noHP: "",
      email: "",
      jabatan: "",
      mataPelajaran: "",
      password: "password123", // Default enroll password
    });
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (guru: any) => {
    setModalMode("edit");
    setSelectedGuru(guru);
    setFormData({
      nama: guru.nama,
      NIP: guru.NIP,
      NIK: guru.NIK,
      jenisKelamin: guru.jenisKelamin,
      tempatLahir: guru.tempatLahir,
      tanggalLahir: guru.tanggalLahir,
      alamat: guru.alamat,
      noHP: guru.noHP,
      email: guru.email,
      jabatan: guru.jabatan,
      mataPelajaran: guru.mataPelajaran,
      password: "", // Leave blank if no change
    });
    setShowAddEditModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalMode === "add") {
        await apiFetch("/guru", {
          method: "POST",
          body: JSON.stringify(formData),
        });
        onSuccessToast(`Berhasil mendaftarkan guru baru: ${formData.nama}`);
      } else {
        await apiFetch(`/guru/${selectedGuru.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        });
        onSuccessToast(`Berhasil memperbarui data guru: ${formData.nama}`);
      }
      setShowAddEditModal(false);
      loadGurus();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat memproses formulir.");
    }
  };

  const handleDelete = async (guru: any) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data guru ${guru.nama}? Tindakan ini bersifat permanen.`)) return;
    try {
      await apiFetch(`/guru/${guru.id}`, { method: "DELETE" });
      onSuccessToast(`Berhasil menghapus guru: ${guru.nama}`);
      loadGurus();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus data.");
    }
  };

  const toggleStatus = async (guru: any) => {
    const nextStatus = guru.status === "AKTIF" ? "NON_AKTIF" : "AKTIF";
    try {
      await apiFetch(`/guru/${guru.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus }),
      });
      onSuccessToast(`Berhasil mengubah status ${guru.nama} menjadi ${nextStatus}.`);
      loadGurus();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status.");
    }
  };

  const resetPassword = async (guru: any) => {
    if (!window.confirm(`Reset password ${guru.nama} menjadi default: 'guru123'?`)) return;
    try {
      const response = await apiFetch(`/guru/${guru.id}/reset-password`, { method: "POST" });
      onSuccessToast(response.message);
    } catch (err: any) {
      alert(err.message || "Gagal mereset password.");
    }
  };

  const resetFace = async (guru: any) => {
    if (!window.confirm(`Hapus seluruh data embedding wajah ${guru.nama}? Mereka harus mendaftarkan wajah kembali.`)) return;
    try {
      const response = await apiFetch(`/guru/${guru.id}/reset-face`, { method: "POST" });
      onSuccessToast(response.message);
      loadGurus();
    } catch (err: any) {
      alert(err.message || "Gagal mereset wajah.");
    }
  };

  const handleFaceRegSuccess = async (data: { embeddings?: any[] }) => {
    if (!data.embeddings || data.embeddings.length === 0) return;
    try {
      setShowFaceRegScanner(false);
      setLoading(true);
      await apiFetch(`/guru/${scanGuruId}/register-face`, {
        method: "POST",
        body: JSON.stringify({ embeddings: data.embeddings }),
      });
      onSuccessToast("Registrasi pemindaian wajah guru berhasil disimpan ke database!");
      loadGurus();
    } catch (err: any) {
      alert(err.message || "Gagal mengunggah data wajah.");
    } finally {
      setLoading(false);
    }
  };

  // Bulk CSV parser for teacher imports
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert("File CSV kosong atau tidak memiliki tajuk.");
        return;
      }

      // Read header columns
      const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
      const expected = ["nama", "NIP", "NIK", "jenisKelamin", "tempatLahir", "tanggalLahir", "alamat", "noHP", "email", "jabatan", "mataPelajaran"];

      let errorCount = 0;
      let successCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
        if (cols.length < expected.length) continue;

        const record: any = {};
        expected.forEach((key, index) => {
          record[key] = cols[index] || "";
        });
        record.password = "guru123"; // Default import password

        try {
          await apiFetch("/guru", {
            method: "POST",
            body: JSON.stringify(record),
          });
          successCount++;
        } catch (err) {
          console.error("Failed to import line", cols, err);
          errorCount++;
        }
      }

      onSuccessToast(`Import CSV selesai. Berhasil: ${successCount}, Gagal: ${errorCount}`);
      loadGurus();
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Active face scanner modal */}
      {showFaceRegScanner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <CameraRecognition
            mode="register"
            guruId={scanGuruId || undefined}
            onSuccess={handleFaceRegSuccess}
            onCancel={() => setShowFaceRegScanner(false)}
          />
        </div>
      )}

      {/* Main Header title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Administrasi Data Guru
            <Users className="w-5 h-5 text-teal-400" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manajemen lengkap biodata, reset password, hapus koordinat wajah, dan status keaktifan Guru.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1.5 transition">
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Import CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </label>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" /> Tambah Guru
          </button>
        </div>
      </div>

      {/* Query Filter and Search Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Cari NIP, NIK, nama guru..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
          >
            <option value="">Semua Status Keaktifan</option>
            <option value="AKTIF">Hanya Aktif</option>
            <option value="NON_AKTIF">Hanya Non-Aktif</option>
          </select>
        </div>
      </div>

      {/* Main Teachers Grid Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/20">
                <th className="py-3 px-4">Nama & NIP</th>
                <th className="py-3 px-4">Kontak / Email</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4">Face Scan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Opsi Operasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-400 mb-2" />
                    Memuat daftar guru...
                  </td>
                </tr>
              ) : gurus.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Tidak ada guru terdaftar yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              ) : (
                gurus.map((guru) => (
                  <tr key={guru.id} className="hover:bg-slate-850/20 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-teal-400 uppercase">
                          {guru.nama.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{guru.nama}</h4>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">NIP: {guru.NIP}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-white">{guru.email}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{guru.noHP}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-white font-medium">{guru.mataPelajaran}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{guru.jabatan}</p>
                    </td>
                    <td className="py-4 px-4">
                      {guru.faceID ? (
                        <div className="flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] w-fit">
                          <Check className="w-3 h-3" /> REGISTERED
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setScanGuruId(guru.id);
                            setShowFaceRegScanner(true);
                          }}
                          className="flex items-center gap-1 bg-amber-950/40 border border-amber-900/40 text-amber-400 hover:bg-amber-950 hover:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px] transition cursor-pointer"
                        >
                          <Camera className="w-3 h-3 animate-pulse" /> DAFTAR WAJAH
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => toggleStatus(guru)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          guru.status === "AKTIF"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/30"
                            : "bg-rose-950 text-rose-400 border border-rose-900/30"
                        }`}
                      >
                        {guru.status}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setScanGuruId(guru.id);
                            setShowFaceRegScanner(true);
                          }}
                          title="Pindai Ulang Wajah"
                          className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded transition"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => resetPassword(guru)}
                          title="Reset Password Guru"
                          className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded transition"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => resetFace(guru)}
                          title="Reset Face ID"
                          className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(guru)}
                          title="Edit Biodata"
                          className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(guru)}
                          title="Hapus Guru"
                          className="p-1.5 bg-rose-950/20 hover:bg-rose-950 text-red-400 hover:text-red-300 rounded transition"
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

      {/* Modals Form enrollment */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <h3 className="font-semibold text-white text-base">
                {modalMode === "add" ? "Tambah Data Guru Baru" : `Edit Data Guru: ${selectedGuru?.nama}`}
              </h3>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                    placeholder="Nama Lengkap & Gelar"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Email Resmi</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                    placeholder="email@sekolah.sch.id"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Nomor Induk Pegawai (NIP)</label>
                  <input
                    type="text"
                    required
                    value={formData.NIP}
                    onChange={(e) => setFormData({ ...formData, NIP: e.target.value })}
                    disabled={modalMode === "edit"}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none disabled:bg-slate-900 disabled:text-slate-500"
                    placeholder="NIP Guru"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Nomor Induk Kependudukan (NIK)</label>
                  <input
                    type="text"
                    required
                    value={formData.NIK}
                    onChange={(e) => setFormData({ ...formData, NIK: e.target.value })}
                    disabled={modalMode === "edit"}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none disabled:bg-slate-900 disabled:text-slate-500"
                    placeholder="NIK KTP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Jenis Kelamin</label>
                  <select
                    value={formData.jenisKelamin}
                    onChange={(e) => setFormData({ ...formData, jenisKelamin: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                  >
                    <option value="L">Laki-Laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Mata Pelajaran Diampu</label>
                  <input
                    type="text"
                    required
                    value={formData.mataPelajaran}
                    onChange={(e) => setFormData({ ...formData, mataPelajaran: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                    placeholder="Mata Pelajaran Utama"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Tempat Lahir</label>
                  <input
                    type="text"
                    value={formData.tempatLahir}
                    onChange={(e) => setFormData({ ...formData, tempatLahir: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                    placeholder="Kota Lahir"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formData.tanggalLahir}
                    onChange={(e) => setFormData({ ...formData, tanggalLahir: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Nomor Telepon / WA</label>
                <input
                  type="text"
                  required
                  value={formData.noHP}
                  onChange={(e) => setFormData({ ...formData, noHP: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                  placeholder="08xxxxxxxxxx"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Jabatan Sekolah</label>
                <input
                  type="text"
                  required
                  value={formData.jabatan}
                  onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                  placeholder="Guru Madya, Kepala Lab, Wali Kelas, dll"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Alamat Rumah Lengkap</label>
                <textarea
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                  rows={2}
                  placeholder="Alamat lengkap sesuai KTP"
                />
              </div>

              {modalMode === "add" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Password Pendaftaran Awal</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end pt-4 gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 rounded-xl text-xs font-bold shadow"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
