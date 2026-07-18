import React from "react";
import {
  LayoutDashboard,
  Users,
  School,
  Camera,
  CalendarCheck,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  MapPin,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bell,
  Database
} from "lucide-react";
import { isFrontendPlatform, getActiveDatabaseMode } from "../lib/api";

interface SidebarProps {
  role: "ADMIN" | "GURU";
  userName: string;
  userEmail: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({
  role,
  userName,
  userEmail,
  activeTab,
  setActiveTab,
  onLogout,
  collapsed,
  setCollapsed,
}: SidebarProps) {
  // Navigation links for Admin role
  const adminMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "guru", label: "Data Guru", icon: Users },
    { id: "sekolah", label: "Data Sekolah", icon: School },
    { id: "registrasi-wajah", label: "Registrasi Wajah", icon: Camera },
    { id: "absensi", label: "Data Absensi", icon: CalendarCheck },
    { id: "laporan", label: "Laporan Presensi", icon: FileSpreadsheet },
    { id: "statistik", label: "Statistik", icon: TrendingUp },
    { id: "jadwal", label: "Jadwal Kerja", icon: Clock },
    { id: "lokasi", label: "Lokasi Absensi", icon: MapPin },
    { id: "pengaturan", label: "Pengaturan & Backup", icon: Settings },
  ];

  // Navigation links for Guru role
  const guruMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "absensi-guru", label: "Presensi Harian", icon: Camera },
    { id: "riwayat-guru", label: "Riwayat Presensi", icon: CalendarCheck },
    { id: "profil-guru", label: "Profil Saya", icon: User },
  ];

  const menuItems = role === "ADMIN" ? adminMenuItems : guruMenuItems;

  return (
    <aside
      className={`h-screen sticky top-0 bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 flex flex-col justify-between z-30 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Top Brand Logo */}
      <div>
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
                SA
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight leading-none">Smart Attendance</h2>
                <span className="text-[10px] text-teal-400 font-mono mt-1 block">GURU V1.0</span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
              SA
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition hidden md:block"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User Identity Banner */}
        <div className={`p-4 border-b border-slate-800/60 ${collapsed ? "text-center" : "flex items-center gap-3"}`}>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-teal-500 flex items-center justify-center text-teal-400 font-bold uppercase overflow-hidden">
              {userName ? userName.charAt(0) : "U"}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h4 className="text-xs font-semibold text-white truncate leading-tight">{userName}</h4>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{role}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${getActiveDatabaseMode() === "Local Mock DB" ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                  {getActiveDatabaseMode() === "Cloud Sync" ? "Cloud Sync (Vercel)" : getActiveDatabaseMode() === "Local Mock DB" ? "Local Offline" : "Cloud Server"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menus List */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)]">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-200 group relative ${
                  isActive
                    ? "bg-gradient-to-r from-teal-500/20 to-indigo-500/10 border-l-4 border-teal-400 text-white shadow-inner"
                    : "hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <IconComponent
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    isActive ? "text-teal-400" : "text-slate-400 group-hover:text-teal-300"
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Collapsed Tooltip */}
                {collapsed && (
                  <div className="absolute left-16 scale-0 group-hover:scale-100 bg-slate-950 text-white text-xs px-2 py-1 rounded shadow-md font-medium border border-slate-800 transition pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Action Footer */}
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition duration-150 group relative"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-red-400 group-hover:text-red-300" />
          {!collapsed && <span>Keluar</span>}

          {collapsed && (
            <div className="absolute left-16 scale-0 group-hover:scale-100 bg-slate-950 text-red-400 text-xs px-2 py-1 rounded shadow-md font-medium border border-slate-800 transition pointer-events-none whitespace-nowrap z-50">
              Keluar
            </div>
          )}
        </button>

        {!collapsed && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-900/50 text-[10px] text-slate-400 leading-normal text-center">
            <span className="block text-slate-500">Pengembang Sistem:</span>
            <span className="font-semibold text-teal-400">Arfin Arfa, ST</span>
          </div>
        )}
      </div>
    </aside>
  );
}
