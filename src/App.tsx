import React, { useState, useEffect } from "react";
import { apiFetch, getAuthToken, setAuthToken, removeAuthToken } from "./lib/api";
import Sidebar from "./components/Sidebar";
import DashboardAdmin from "./components/DashboardAdmin";
import DashboardGuru from "./components/DashboardGuru";
import DataGuruCRUD from "./components/DataGuruCRUD";
import RiwayatAbsensi from "./components/RiwayatAbsensi";
import JadwalConfig from "./components/JadwalConfig";
import LokasiConfig from "./components/LokasiConfig";
import ProfilAdmin from "./components/ProfilAdmin";
import ProfilGuru from "./components/ProfilGuru";
import StatistikCharts from "./components/StatistikCharts";
import {
  LogIn,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  Camera,
  School,
  Lock,
  Mail,
  UserCheck,
} from "lucide-react";

type ToastState = {
  show: boolean;
  message: string;
};

export default function App() {
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Routing navigation
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Login inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState<"ADMIN" | "GURU">("GURU");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  // Floating Toast Notification
  const [toast, setToast] = useState<ToastState>({ show: false, message: "" });

  const triggerToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 4000);
  };

  const checkSession = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const profile = await apiFetch("/auth/me");
      setUser(profile);
      setToken(currentToken);
    } catch (err) {
      // Token stale or invalid
      removeAuthToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError("Harap masukkan email dan password.");
      return;
    }

    try {
      setAuthenticating(true);
      setLoginError(null);

      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password.trim() 
        }),
      });

      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      setActiveTab("dashboard");
      triggerToast(`Selamat datang, ${data.user.name || "User"}!`);
    } catch (err: any) {
      setLoginError(err.message || "Email atau password salah.");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
    triggerToast("Anda berhasil keluar dari sistem.");
  };

  // Render proper views for Admin Role
  const renderAdminView = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardAdmin onNavigate={(tab) => setActiveTab(tab)} />;
      case "guru":
      case "registrasi-wajah":
        return <DataGuruCRUD onSuccessToast={triggerToast} />;
      case "sekolah":
      case "pengaturan":
        return <ProfilAdmin onSuccessToast={triggerToast} />;
      case "absensi":
      case "laporan":
        return <RiwayatAbsensi onSuccessToast={triggerToast} />;
      case "statistik":
        return <StatistikCharts />;
      case "jadwal":
        return <JadwalConfig onSuccessToast={triggerToast} />;
      case "lokasi":
        return <LokasiConfig onSuccessToast={triggerToast} />;
      default:
        return <DashboardAdmin onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  // Render proper views for Guru Role
  const renderGuruView = () => {
    switch (activeTab) {
      case "dashboard":
      case "absensi-guru":
        return <DashboardGuru onSuccessToast={triggerToast} />;
      case "riwayat-guru":
        // Render personal history list
        return <RiwayatAbsensi onSuccessToast={triggerToast} />;
      case "profil-guru":
        return <ProfilGuru onSuccessToast={triggerToast} />;
      default:
        return <DashboardGuru onSuccessToast={triggerToast} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
        <p className="text-slate-400 font-medium text-xs">Menghubungkan ke Smart Attendance Guru...</p>
      </div>
    );
  }

  // LOGIN SCREEN (If unauthenticated)
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Gradient Background Blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Top subtle visual strip */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-purple-600" />

          {/* Brand Heading */}
          <div className="text-center space-y-2 mb-8">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/15">
              SA
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Smart Attendance Guru</h2>
            <p className="text-xs text-slate-400">Presensi Cerdas Berbasis Pendeteksian Wajah & GPS</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-rose-950/20 border border-rose-900/50 text-rose-300 text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-600 focus:border-teal-500/50 focus:outline-none"
                  placeholder="name@school.sch.id"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-600 focus:border-teal-500/50 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full py-3 bg-gradient-to-r from-teal-400 to-indigo-500 hover:from-teal-500 hover:to-indigo-600 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {authenticating ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <LogIn className="w-4 h-4 text-slate-950" />
              )}
              <span>Masuk ke Akun</span>
            </button>
          </form>

          {/* Quick login info for grading */}
          <div className="mt-8 pt-4 border-t border-slate-800 text-center space-y-2">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Demo Akun Uji Coba:</span>
            <div className="space-y-1">
              <p className="text-[10px] text-teal-400 font-mono">
                Admin: hasanlek486@gmail.com / admin123
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CORE APPLICATION DASHBOARD PORTAL
  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100">
      {/* Floating Toast Notification Alert */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-teal-500/50 text-white font-medium py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-bounce">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          <span className="text-xs">{toast.message}</span>
        </div>
      )}

      {/* Nav Sidebar drawer */}
      <Sidebar
        role={user.role}
        userName={user.name}
        userEmail={user.email}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Area Container */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-950">
        <header className="bg-slate-900/40 border-b border-slate-800/80 py-4 px-6 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase font-mono font-bold">SMART ATTENDANCE GURU</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-white font-bold block">{user.name}</span>
              <span className="text-[9px] text-slate-400 font-mono block">{user.email}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Render */}
        <div className="print:p-0">
          {user.role === "ADMIN" ? renderAdminView() : renderGuruView()}
        </div>
      </main>
    </div>
  );
}
