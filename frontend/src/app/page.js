"use client";

import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import TelemetryHUD from "./components/TelemetryHUD";
import OrganicSphere from "./components/OrganicSphere";

function MainContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090b0e] flex flex-col items-center justify-center gap-4 text-zinc-400">
        <OrganicSphere size={80} />
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-[#cde655] animate-pulse" />
          <span>CHECKING_OPERATOR_SESSION...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <TelemetryHUD user={user} onLogout={logout} />;
}

export default function Home() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
