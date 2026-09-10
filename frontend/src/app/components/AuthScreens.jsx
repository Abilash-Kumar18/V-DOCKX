"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  Disc3,
  Wifi,
  Battery,
  Signal,
  Radio,
  ExternalLink,
} from "lucide-react";
import OrganicSphere from "./OrganicSphere";

export default function AuthScreens({ onEnterDashboard }) {
  const [activeTab, setActiveTab] = useState("signin"); // 'signin' | 'register' | 'forgot'
  const [viewMode, setViewMode] = useState("gallery"); // 'gallery' | 'single'
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form states
  const [email, setEmail] = useState("operator@vdockx.ai");
  const [password, setPassword] = useState("docking2026#");
  const [fullName, setFullName] = useState("Alex Chen (Perception Lead)");
  const [notification, setNotification] = useState("");

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setNotification("Authenticating credentials & initiating telemetry session...");
    setTimeout(() => {
      onEnterDashboard();
    }, 450);
  };

  const handleSendCode = (e) => {
    if (e) e.preventDefault();
    setNotification("Verification code sent to " + email);
    setTimeout(() => setNotification(""), 3000);
  };

  // Google SVG
  const GoogleIcon = () => (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-1.9.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
      />
    </svg>
  );

  // Apple SVG
  const AppleIcon = () => (
    <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.13.64-2.79 1.41-.58.68-1.1 1.74-0.96 2.79 1.07.08 2.12-.58 2.74-1.33z" />
    </svg>
  );

  // Reusable Phone Frame Header
  const PhoneHeader = ({ onBack }) => (
    <div className="w-full">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-medium text-zinc-400 select-none">
        <span>9:30 PM</span>
        <div className="w-24 h-4 bg-black/40 rounded-full mx-auto" />
        <div className="flex items-center gap-1.5">
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <Battery className="w-4 h-4" />
        </div>
      </div>

      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <button
          type="button"
          onClick={onBack || (() => setActiveTab("signin"))}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-[#181c22] border border-[#262c35] flex items-center justify-center text-zinc-300 hover:text-white hover:bg-[#20252d] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-9 h-9 rounded-full bg-[#181c22] border border-[#262c35] flex items-center justify-center text-zinc-400">
          <Disc3 className="w-4 h-4 animate-spin-slow text-[#bcd84b]" />
        </div>
      </div>
    </div>
  );

  // Phone Screen 1: Welcome Back (Sign In)
  const renderSignInScreen = () => (
    <div className="w-full h-full flex flex-col justify-between p-5 pb-6">
      <div>
        <div className="flex justify-center -mt-1 mb-3">
          <OrganicSphere size={95} />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
            Welcome Back!
          </h2>
          <p className="text-xs text-zinc-400 px-4 leading-relaxed">
            Sign in to access V-DOCKX autonomous docking telemetry, controls & telemetry analytics.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Email address*
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className="input-dark"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Password*
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="@Sn123hsn#"
                className="input-dark pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-[#171a1f] border border-[#2a313a] accent-[#cde655]"
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => setActiveTab("forgot")}
              className="text-zinc-300 hover:text-[#cde655] font-medium transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3.5 text-[14px] mt-2 gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#0e1208]" />
            Sign in
          </button>
        </form>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#222731]"></div>
          </div>
          <span className="relative px-3 bg-[#0f1217] text-[11px] text-zinc-500">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center justify-center py-2.5 px-3 rounded-full bg-[#16191f] border border-[#262c36] text-[12px] font-medium text-zinc-300 hover:bg-[#1d222a] hover:border-[#343c49] transition-colors"
          >
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center justify-center py-2.5 px-3 rounded-full bg-[#16191f] border border-[#262c36] text-[12px] font-medium text-zinc-300 hover:bg-[#1d222a] hover:border-[#343c49] transition-colors"
          >
            <AppleIcon />
            Apple
          </button>
        </div>
      </div>

      <div className="text-center pt-3 text-[11px] text-zinc-400">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={() => setActiveTab("register")}
          className="text-white font-semibold hover:text-[#cde655] transition-colors"
        >
          Sign up
        </button>
      </div>
    </div>
  );

  // Phone Screen 2: Create Account (Register)
  const renderRegisterScreen = () => (
    <div className="w-full h-full flex flex-col justify-between p-5 pb-6">
      <div>
        <div className="flex justify-center -mt-1 mb-3">
          <OrganicSphere size={95} />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
            Create Your Account?
          </h2>
          <p className="text-xs text-zinc-400 px-4 leading-relaxed">
            Create your account to explore autonomous docking mission control and telemetry.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Full Name*
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Smith"
              className="input-dark"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Email address*
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className="input-dark"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Password*
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="@Sn123hsn#"
                className="input-dark pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3.5 text-[14px] mt-4 gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#0e1208]" />
            Register
          </button>
        </form>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#222731]"></div>
          </div>
          <span className="relative px-3 bg-[#0f1217] text-[11px] text-zinc-500">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center justify-center py-2.5 px-3 rounded-full bg-[#16191f] border border-[#262c36] text-[12px] font-medium text-zinc-300 hover:bg-[#1d222a] hover:border-[#343c49] transition-colors"
          >
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center justify-center py-2.5 px-3 rounded-full bg-[#16191f] border border-[#262c36] text-[12px] font-medium text-zinc-300 hover:bg-[#1d222a] hover:border-[#343c49] transition-colors"
          >
            <AppleIcon />
            Apple
          </button>
        </div>
      </div>

      <div className="text-center pt-3 text-[11px] text-zinc-400">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => setActiveTab("signin")}
          className="text-white font-semibold hover:text-[#cde655] transition-colors"
        >
          Sign In
        </button>
      </div>
    </div>
  );

  // Phone Screen 3: Forgot Password
  const renderForgotPasswordScreen = () => (
    <div className="w-full h-full flex flex-col justify-between p-5 pb-6">
      <div>
        <div className="flex justify-center -mt-1 mb-3">
          <OrganicSphere size={95} />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-1.5">
            Forgot Password?
          </h2>
          <p className="text-xs text-zinc-400 px-4 leading-relaxed">
            Enter your email and we&apos;ll send a 5-digit verification code instantly.
          </p>
        </div>

        <form onSubmit={handleSendCode} className="space-y-4 text-left">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Email address*
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className="input-dark"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3.5 text-[14px] mt-2 gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#0e1208]" />
            Send Code
          </button>
        </form>

        {notification && (
          <div className="mt-4 p-3 rounded-xl bg-[#1c2215] border border-[#3b4d24] text-[11px] text-[#cde655] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{notification}</span>
          </div>
        )}
      </div>

      <div className="text-center pt-3 text-[11px] text-zinc-400">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => setActiveTab("signin")}
          className="text-white font-semibold hover:text-[#cde655] transition-colors"
        >
          Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 overflow-hidden bg-[#0a0c0e]">
      {/* Background radial ambient texture */}
      <div className="absolute inset-0 bg-dot-matrix opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#223314] opacity-20 blur-[130px] rounded-full pointer-events-none" />

      {/* Top Controls Bar: Switch between 3-Phone Gallery & Single Interactive View */}
      <header className="relative z-20 w-full max-w-6xl flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#1c212a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#191d24] border border-[#2d3442] flex items-center justify-center text-[#cde655]">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              V-DOCKX
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-[#182012] border border-[#303f21] text-[#bcd84b] font-mono">
                Autonomous Docking Suite
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">
              Vision-Guided Closed-Loop Ground Vehicle Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-[#13161c] border border-[#222833]">
            <button
              onClick={() => setViewMode("gallery")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "gallery"
                  ? "bg-[#212732] text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Gallery View (3 Phones)
            </button>
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "single"
                  ? "bg-[#212732] text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Interactive Focus
            </button>
          </div>

          {/* Quick Cockpit Entry Button */}
          <button
            onClick={onEnterDashboard}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a2113] border border-[#3e4f24] text-[#d4ea6b] text-xs font-semibold hover:bg-[#232d19] transition-all"
          >
            <span>Launch Mission Control HUD</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Showcase Body */}
      <main className="relative z-10 w-full max-w-6xl my-auto py-8 flex items-center justify-center">
        {viewMode === "gallery" ? (
          /* TRIPLE PHONE GALLERY LAYOUT MATCHING USER IMAGE */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 w-full max-w-5xl items-center justify-center">
            {/* Phone 1: Welcome Back */}
            <div className="relative mx-auto w-full max-w-[340px] aspect-[9/19] rounded-[44px] bg-[#0f1217] border-[6px] border-[#1f252f] shadow-2xl overflow-hidden flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <div className="absolute top-0 inset-x-0 h-44 bg-dot-matrix-green opacity-40 pointer-events-none" />
              <PhoneHeader onBack={() => setActiveTab("signin")} />
              <div className="flex-1 overflow-y-auto">{renderSignInScreen()}</div>
              {/* Home bar */}
              <div className="w-28 h-1 bg-zinc-600/70 rounded-full mx-auto mb-2" />
            </div>

            {/* Phone 2: Create Account */}
            <div className="relative mx-auto w-full max-w-[340px] aspect-[9/19] rounded-[44px] bg-[#0f1217] border-[6px] border-[#1f252f] shadow-2xl overflow-hidden flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <div className="absolute top-0 inset-x-0 h-44 bg-dot-matrix-green opacity-40 pointer-events-none" />
              <PhoneHeader onBack={() => setActiveTab("signin")} />
              <div className="flex-1 overflow-y-auto">{renderRegisterScreen()}</div>
              {/* Home bar */}
              <div className="w-28 h-1 bg-zinc-600/70 rounded-full mx-auto mb-2" />
            </div>

            {/* Phone 3: Forgot Password */}
            <div className="relative mx-auto w-full max-w-[340px] aspect-[9/19] rounded-[44px] bg-[#0f1217] border-[6px] border-[#1f252f] shadow-2xl overflow-hidden flex flex-col justify-between transition-transform hover:scale-[1.01]">
              <div className="absolute top-0 inset-x-0 h-44 bg-dot-matrix-green opacity-40 pointer-events-none" />
              <PhoneHeader onBack={() => setActiveTab("signin")} />
              <div className="flex-1 overflow-y-auto">{renderForgotPasswordScreen()}</div>
              {/* Home bar */}
              <div className="w-28 h-1 bg-zinc-600/70 rounded-full mx-auto mb-2" />
            </div>
          </div>
        ) : (
          /* SINGLE INTERACTIVE PHONE FOCUS VIEW */
          <div className="flex flex-col items-center">
            {/* Screen Tab Selector */}
            <div className="flex items-center gap-2 mb-6 p-1 rounded-full bg-[#13161c] border border-[#232935]">
              <button
                onClick={() => setActiveTab("signin")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === "signin"
                    ? "bg-[#cde655] text-[#0e1208] font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === "register"
                    ? "bg-[#cde655] text-[#0e1208] font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Create Account
              </button>
              <button
                onClick={() => setActiveTab("forgot")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === "forgot"
                    ? "bg-[#cde655] text-[#0e1208] font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Forgot Password
              </button>
            </div>

            {/* Single Interactive Phone */}
            <div className="relative w-[360px] aspect-[9/19] rounded-[46px] bg-[#0f1217] border-[7px] border-[#222835] shadow-2xl overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 inset-x-0 h-44 bg-dot-matrix-green opacity-40 pointer-events-none" />
              <PhoneHeader
                onBack={() => {
                  if (activeTab !== "signin") setActiveTab("signin");
                }}
              />

              <div className="flex-1 overflow-y-auto">
                {activeTab === "signin" && renderSignInScreen()}
                {activeTab === "register" && renderRegisterScreen()}
                {activeTab === "forgot" && renderForgotPasswordScreen()}
              </div>

              {/* Home bar */}
              <div className="w-32 h-1 bg-zinc-600/70 rounded-full mx-auto mb-2.5" />
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-5xl py-4 border-t border-[#181d24] text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>V-DOCKX Autonomous Mobile Robot Docking Suite • Challenge 14 MVP</p>
        <p className="text-zinc-400">
          Refined Dark Matte Architecture • React 19 & Next.js 16
        </p>
      </footer>
    </div>
  );
}
