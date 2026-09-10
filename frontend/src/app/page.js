"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import RoboticMissionControl from "./components/RoboticMissionControl";
import OrganicSphere from "./components/OrganicSphere";
import { Radio, ArrowRight, ShieldCheck } from "lucide-react";

function MainContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center gap-4 text-[#1A1715]">
        <OrganicSphere size={80} />
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-600">
          <span className="w-2 h-2 rounded-full bg-[#FF3820] shadow-[0_0_8px_rgba(255,56,32,0.8)] animate-pulse" />
          <span>AUTHENTICATING_SESSION...</span>
        </div>
      </div>
    );
  }

  // Only after logging in does it show the main mission control page
  if (isAuthenticated) {
    return (
      <RoboticMissionControl
        user={user || { name: "Live Operator", role: "Field Robotics Lead", avatar: "OP" }}
        onLogout={logout}
      />
    );
  }

  // Otherwise strictly show the Login Page
  return <LoginPage />;
}

export default function Home() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
