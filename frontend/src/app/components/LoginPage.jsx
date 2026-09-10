"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Compass,
  Cpu,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LoginBackgroundGraphic from "./LoginBackgroundGraphic";

export default function LoginPage() {
  const { login, demoLogin, error, clearError, isLoading } = useAuth();

  // Form Fields - Strictly pre-filled with authorized credentials
  const [email, setEmail] = useState("innovix");
  const [password, setPassword] = useState("innovix@123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [showLearnMore, setShowLearnMore] = useState(false);

  const validate = () => {
    const errors = {};
    const normalizedUser = (email || "").trim().toLowerCase();

    if (normalizedUser !== "innovix") {
      errors.email = "Access restricted. Only username 'innovix' is authorized.";
    }
    if (password !== "innovix@123") {
      errors.password = "Invalid password. Only 'innovix@123' is authorized.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setSuccessMessage("");

    if (!validate()) return;

    const success = await login(email.trim(), password);
    if (success) {
      setSuccessMessage("Credentials authorized. Entering Mission Control...");
    }
  };

  const handleQuickDemoAccess = async () => {
    clearError();
    setEmail("innovix");
    setPassword("innovix@123");
    setSuccessMessage("Authorizing verified 'innovix' operator token...");
    await demoLogin();
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#FAF7F2] text-[#1A1715] overflow-hidden bg-parchment-pattern">
      {/* Rich Background Graphic (Parallax, wavy trajectory, capsules) */}
      <LoginBackgroundGraphic />

      {/* ============================================================
          UNIFIED SPLIT-CARD CONTAINER (Attached Sign-in Panel)
          ============================================================ */}
      <div className="relative z-10 w-full max-w-5xl rounded-[32px] bg-white/95 border border-[#C5A059]/35 shadow-[0_24px_60px_-15px_rgba(26,23,21,0.12),0_0_0_1px_rgba(197,160,89,0.18)] overflow-hidden backdrop-blur-xl transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          
          {/* ============================================================
              LEFT COLUMN: Brand, Hero "Welcome!", Crispy Words & Transparent Robot
              ============================================================ */}
          <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#FAF7F2]/90 via-white/50 to-[#F4EFE6]/70">
            
            {/* Subtle Ambient Glow behind Robot */}
            <div className="absolute right-0 bottom-0 w-72 h-80 rounded-full bg-[#FF3820]/12 blur-2xl pointer-events-none" />

            {/* Red Armored Robot Mascot (100% Transparent PNG, Zero White Background) */}
            <div className="absolute right-[-12px] sm:right-[-4px] bottom-0 w-[46%] max-w-[250px] h-[90%] pointer-events-none flex items-end justify-end select-none z-0">
              <img
                src="/robot-mascot-transparent.png"
                alt="V-DOCKX RAS Robot Mascot"
                className="w-full h-full object-contain object-bottom filter contrast-[1.04] drop-shadow-[-8px_12px_24px_rgba(255,56,32,0.22)]"
              />
            </div>

            {/* Left Content (Crispy Words & Title, Clean Clearance from Robot) */}
            <div className="relative z-10 max-w-[270px] sm:max-w-[310px]">
              {/* Minimal Brand Mark (Two bars like reference) */}
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-end gap-1.5 h-8">
                  <span className="w-3 h-8 rounded-xs bg-[#FF3820]" />
                  <span className="w-3 h-5 rounded-xs bg-[#C5A059]" />
                </div>
                <span className="text-sm font-black tracking-widest text-[#1A1715] uppercase font-sans">
                  V-DOCKX
                </span>
              </div>

              {/* Bold "Welcome!" Title */}
              <h1 className="text-5xl sm:text-6xl font-black text-[#1A1715] tracking-tight leading-none mb-3 font-sans">
                Welcome!
              </h1>
              
              {/* Horizontal Accent Line */}
              <div className="w-14 h-1 bg-[#FF3820] rounded-full mb-4" />

              {/* Few, Crispy Words */}
              <p className="text-xs font-mono font-bold tracking-[0.2em] text-[#8C6D31] uppercase mb-4">
                AUTONOMOUS PRECISION DOCKING
              </p>

              {/* Creative & Stylish Quotation Callout */}
              <div className="pl-3.5 border-l-2 border-[#FF3820] my-3 bg-gradient-to-r from-[#FAF7F2] to-transparent py-2 rounded-r-lg">
                <p
                  className="text-base sm:text-lg text-[#1A1715] leading-snug tracking-tight font-medium"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic" }}
                >
                  “Precision in every millimeter, certainty in every dock.”
                </p>
                <span className="text-[9px] font-mono tracking-widest text-[#8C6D31] font-semibold uppercase mt-1 block">
                  Fleet Directive
                </span>
              </div>
            </div>

            {/* Bottom Learn More Button */}
            <div className="pt-6 relative z-10">
              <button
                type="button"
                onClick={() => setShowLearnMore(true)}
                className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#FF5733] to-[#FF3820] shadow-[0_4px_14px_rgba(255,56,32,0.3)] hover:shadow-[0_6px_20px_rgba(255,56,32,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* ============================================================
              RIGHT COLUMN: Attached Sign-in Panel (Only innovix / innovix@123)
              ============================================================ */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#FCFAF7]/95 via-[#FAF7F2]/90 to-[#F6EFEB]/95 border-t lg:border-t-0 lg:border-l border-[#C5A059]/30 p-8 sm:p-10 lg:p-12 flex flex-col justify-center backdrop-blur-xl">
            <div className="w-full max-w-sm mx-auto">
              
              {/* Heading: "Sign in" with Underline Accent on "in" */}
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1715] tracking-tight font-sans">
                  Sign{" "}
                  <span className="relative inline-block pb-1">
                    in
                    <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#FF3820] rounded-full" />
                  </span>
                </h2>
                <p className="text-[11px] font-mono font-medium text-stone-500 mt-1">
                  Operator Portal Authorization
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#FF3820]" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Success Alert */}
              {successMessage && (
                <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span className="font-medium">{successMessage}</span>
                </div>
              )}

              {/* Auth Form (Strictly innovix / innovix@123) */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* User Name Input */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 ml-2">
                    User Name
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="innovix"
                    className={`w-full px-5 py-3 rounded-full bg-white border ${
                      formErrors.email ? "border-red-400" : "border-[#C5A059]/40"
                    } text-stone-900 text-sm placeholder-stone-400 outline-none focus:border-[#FF3820] focus:ring-2 focus:ring-[#FF3820]/20 transition-all shadow-xs`}
                    required
                  />
                  {formErrors.email && (
                    <p className="text-[10px] text-red-600 mt-1 ml-2 font-semibold">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5 ml-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="innovix@123"
                      className={`w-full px-5 pr-11 py-3 rounded-full bg-white border ${
                        formErrors.password ? "border-red-400" : "border-[#C5A059]/40"
                      } text-stone-900 text-sm placeholder-stone-400 outline-none focus:border-[#FF3820] focus:ring-2 focus:ring-[#FF3820]/20 transition-all shadow-xs`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formErrors.password && (
                    <p className="text-[10px] text-red-600 mt-1 ml-2 font-semibold">
                      {formErrors.password}
                    </p>
                  )}
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between px-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-stone-600 hover:text-stone-900 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-[#C5A059] text-[#FF3820] accent-[#FF3820] cursor-pointer"
                    />
                    <span>Remember credentials</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#8C6D31] font-semibold">
                    INNOVIX_KEY
                  </span>
                </div>

                {/* Primary Submit Pill Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 px-6 rounded-full font-bold text-sm text-white uppercase tracking-wider bg-gradient-to-r from-[#FF5733] via-[#FF3820] to-[#E5352B] shadow-[0_4px_16px_rgba(255,56,32,0.35)] hover:shadow-[0_6px_22px_rgba(255,56,32,0.5)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Session...</span>
                    </>
                  ) : (
                    <span>Submit</span>
                  )}
                </button>
              </form>

              {/* Social / Quick Verification Row */}
              <div className="mt-6 pt-4 border-t border-[#C5A059]/20 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  {/* Demo Operator Quick Pill */}
                  <button
                    type="button"
                    onClick={handleQuickDemoAccess}
                    title="1-Click Login as innovix"
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white border border-[#C5A059]/40 text-xs font-bold text-stone-700 hover:bg-[#FAF7F2] hover:border-[#FF3820] hover:text-[#FF3820] transition-all shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FF3820]" />
                    <span>Quick Login (innovix)</span>
                  </button>

                  {/* Google */}
                  <button
                    type="button"
                    onClick={handleQuickDemoAccess}
                    title="Sign in as innovix"
                    className="w-8 h-8 rounded-full bg-white border border-[#C5A059]/40 flex items-center justify-center hover:bg-[#FAF7F2] hover:border-[#C5A059] transition-all shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                  </button>

                  {/* Apple */}
                  <button
                    type="button"
                    onClick={handleQuickDemoAccess}
                    title="Sign in as innovix"
                    className="w-8 h-8 rounded-full bg-white border border-[#C5A059]/40 flex items-center justify-center hover:bg-[#FAF7F2] hover:border-[#C5A059] transition-all shadow-xs text-stone-800 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.13.64-2.79 1.41-.58.68-1.1 1.74-0.96 2.79 1.07.08 2.12-.58 2.74-1.33z" />
                    </svg>
                  </button>
                </div>

                <p className="text-[10px] font-mono text-stone-400">
                  Authorized Operator: innovix
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Learn More Modal Dialog */}
      {showLearnMore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-[#C5A059]/40 shadow-2xl p-6 sm:p-8 text-[#1A1715]">
            <button
              type="button"
              onClick={() => setShowLearnMore(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-5 rounded-xs bg-[#FF3820]" />
              <h3 className="text-lg font-bold font-sans">About V-DOCKX</h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed mb-5">
              V-DOCKX is an autonomous ground robotics mission control system engineered for millimeter-accurate docking in unstructured arenas.
            </p>

            <div className="space-y-2.5 mb-6 text-left">
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#C5A059]/25 flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-[#FF3820] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900">AprilTag Vision Tracking</h4>
                  <p className="text-[11px] text-stone-500">
                    Real-time pose estimation and homography matrix computation.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#C5A059]/25 flex items-start gap-2.5">
                <Compass className="w-4 h-4 text-[#C5A059] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Dual-Viewport Telemetry</h4>
                  <p className="text-[11px] text-stone-500">
                    Switch seamlessly between camera and 2D arena floor plan.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLearnMore(false)}
              className="w-full py-2.5 rounded-full bg-stone-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
