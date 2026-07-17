import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { MapPin, Sparkles, Navigation, Save, AlertCircle } from "lucide-react";

interface LokasiConfigProps {
  onSuccessToast: (msg: string) => void;
}

export default function LokasiConfig({ onSuccessToast }: LokasiConfigProps) {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("");

  const [detecting, setDetecting] = useState(false);

  const loadLocation = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/location");
      setLocation(data);
      setName(data.name);
      setLatitude(String(data.latitude));
      setLongitude(String(data.longitude));
      setRadius(String(data.radius));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat lokasi sekolah.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocation();
  }, []);

  // Capture current administrator coordinates
  const handleDetectCoordinates = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setDetecting(false);
        onSuccessToast("Berhasil mengambil titik koordinat GPS perangkat Anda!");
      },
      (err) => {
        alert("Gagal mendeteksi lokasi GPS. Pastikan izin akses lokasi aktif di browser.");
        setDetecting(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !latitude || !longitude || !radius) {
      alert("Semua kolom wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      await apiFetch("/location", {
        method: "PUT",
        body: JSON.stringify({
          id: location.id,
          name,
          latitude,
          longitude,
          radius,
        }),
      });
      onSuccessToast("Konfigurasi Lokasi Sekolah berhasil diperbarui.");
      loadLocation();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui lokasi.");
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
          Lokasi Absensi Sekolah
          <MapPin className="w-5 h-5 text-teal-400" />
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Atur titik koordinat pusat sekolah dan batasan radius GPS maksimum bagi guru melakukan presensi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coordinates adjustment form */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
            <h3 className="font-semibold text-white">Form Pemetaan Geofencing</h3>
            <Sparkles className="w-4 h-4 text-teal-400" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Nama Lokasi / Titik Absensi</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
              placeholder="Kampus Utama SMK Negeri 1 Jakarta"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Garis Lintang (Latitude)</label>
              <input
                type="text"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-teal-500/50"
                placeholder="-6.168582"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Garis Bujur (Longitude)</label>
              <input
                type="text"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-teal-500/50"
                placeholder="106.834044"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase">Radius Maksimal (Meter)</label>
              <input
                type="number"
                required
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/50"
                placeholder="100"
                min={1}
              />
            </div>

            {/* Auto Detect Button container */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleDetectCoordinates}
                disabled={detecting}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Navigation className={`w-4 h-4 ${detecting ? "animate-bounce" : ""}`} />
                <span>{detecting ? "Mendeteksi GPS..." : "Gunakan GPS Perangkat Admin"}</span>
              </button>
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

        {/* Info Area */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-white mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-teal-400" /> Aturan GPS Geofence
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Sistem absensi menggunakan validasi Geofencing. Jarak lurus dihitung menggunakan Rumus Haversine antara koordinat perangkat guru saat menekan tombol absen dengan titik sekolah di samping.
            </p>
            <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-850 text-xs text-slate-300">
              <p>📍 <strong>Lokalitas Sekolah:</strong> {location?.name}</p>
              <p>📏 <strong>Radius Batas:</strong> {location?.radius} meter</p>
              <p>🌐 <strong>Titik Lat, Lng:</strong> {location?.latitude != null ? Number(location.latitude).toFixed(6) : "0.000000"}, {location?.longitude != null ? Number(location.longitude).toFixed(6) : "0.000000"}</p>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 bg-slate-950/40 p-3 rounded-xl border border-slate-850 mt-6 leading-normal">
            Saran: Untuk keakuratan terbaik di dalam gedung sekolah, disarankan menetapkan radius minimum 100-150 meter guna mengantisipasi deviasi GPS satelit akibat halangan atap beton.
          </div>
        </div>
      </div>
    </div>
  );
}
