"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import RoboticMissionControl from "./components/RoboticMissionControl";
import OrganicSphere from "./components/OrganicSphere";
import { Radio, ArrowRight, ShieldCheck } from "lucide-react";

function MainContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [directAccess, setDirectAccess] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4 text-slate-500">
        <OrganicSphere size={80} />
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span>CHECKING_SESSION...</span>
        </div>
      </div>
    );
  }

  // If user is authenticated or clicked direct access
  if (isAuthenticated || directAccess) {
    return (
      <RoboticMissionControl
        user={user || { name: "Live Operator", role: "Field Robotics Lead", avatar: "OP" }}
        onLogout={() => {
          setDirectAccess(false);
          logout();
        }}
      />
    );
  }

  // Otherwise show Login Page with top quick-access launcher to the Robotic View & 2D Map
  return (
    <div className="relative min-h-screen">
      {/* Top Floating Direct Access Bar */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setDirectAccess(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 text-xs font-bold shadow-md hover:shadow-lg transition-all backdrop-blur-sm"
        >
          <Radio className="w-3.5 h-3.5 text-blue-600" />
          <span>View Robotic Screen & 2D Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <LoginPage />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
