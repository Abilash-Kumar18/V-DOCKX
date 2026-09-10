"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Disc3,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import OrganicSphere from "./OrganicSphere";
import AnimatedGridBackground from "./AnimatedGridBackground";

export default function LoginPage() {
  const { login, register, demoLogin, error, clearError, isLoading } = useAuth();

  // Mode: 'signin' | 'register' | 'forgot'
  const [mode, setMode] = useState("signin");

  // Form Fields
  const [email, setEmail] = useState("operator@vdockx.ai");
  const [password, setPassword] = useState("docking2026#");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    clearError();
    setFormErrors({});
    setSuccessMessage("");
  };

  const validate = () => {
    const errors = {};
    if (!email || !email.includes("@")) {
      errors.email = "Please provide a valid email address.";
    }
    if (!password || password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    if (mode === "register" && (!fullName || fullName.trim().length < 2)) {
      errors.fullName = "Please enter your full name.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setSuccessMessage("");

    if (mode === "forgot") {
      if (!email || !email.includes("@")) {
        setFormErrors({ email: "Please enter your email to receive code." });
        return;
      }
      setSuccessMessage(`A 5-digit verification code has been dispatched to ${email}.`);
      return;
    }

    if (!validate()) return;

    if (mode === "signin") {
      const success = await login(email, password);
      if (success) {
        setSuccessMessage("Authenticated. Redirecting...");
      }
    } else if (mode === "register") {
      const success = await register({ name: fullName, email, password });
      if (success) {
        setSuccessMessage("Account created successfully. Redirecting...");
      }
    }
  };

  const handleSocialClick = async () => {
    clearError();
    setSuccessMessage("Signing in with verified operator credentials...");
    await demoLogin("operator");
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

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#080a0d] text-[#f0f2f5] overflow-hidden">
      {/* 1. Creative Animated Grid & Line Pulses Background */}
      <AnimatedGridBackground />

      {/* 2. Focused, Clean Login Card */}
      <div className="relative z-10 w-full max-w-[390px] rounded-[38px] bg-[#0e1116]/95 border border-[#1e232d] shadow-2xl p-6 sm:p-7 backdrop-blur-md overflow-hidden">
        {/* Subtle top micro-dots overlay */}
        <div className="absolute top-0 inset-x-0 h-36 bg-dot-matrix-green opacity-40 pointer-events-none" />

        {/* Card Top Bar (Back Arrow on Left, Subtle Spinner Indicator on Right) */}
        <div className="relative flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => handleSwitchMode("signin")}
            aria-label="Back to Sign in"
            className="w-8 h-8 rounded-full bg-[#151921] border border-[#242b36] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#1c222c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-8 h-8 rounded-full bg-[#151921] border border-[#242b36] flex items-center justify-center text-zinc-400">
            <Disc3 className="w-4 h-4 text-[#cde655] animate-spin-slow opacity-80" />
          </div>
        </div>

        {/* 3D Organic Moss Sphere */}
        <div className="relative flex justify-center mb-3">
          <OrganicSphere size={92} />
        </div>

        {/* Title & Subtitle */}
        <div className="relative text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1.5">
            {mode === "signin" && "Welcome Back!"}
            {mode === "register" && "Create Your Account"}
            {mode === "forgot" && "Forgot Password?"}
          </h1>
          <p className="text-xs text-zinc-400 px-3 leading-relaxed">
            {mode === "signin" &&
              "Sign in to access your V-DOCKX autonomous docking account."}
            {mode === "register" &&
              "Create an account to monitor and control autonomous missions."}
            {mode === "forgot" &&
              "Enter your email and we'll send a 5-digit verification code instantly."}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#2a1215] border border-[#592228] text-[11px] text-[#fca5a5] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#f87171]" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-[#142013] border border-[#294224] text-[11px] text-[#cde655] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#4ade80]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative space-y-3.5 text-left">
          {/* Full Name (Register only) */}
          {mode === "register" && (
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Full Name*
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Smith"
                className={`input-dark ${formErrors.fullName ? "border-[#f87171]" : ""}`}
              />
              {formErrors.fullName && (
                <p className="text-[10px] text-[#f87171] mt-0.5">{formErrors.fullName}</p>
              )}
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Email address*
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              className={`input-dark ${formErrors.email ? "border-[#f87171]" : ""}`}
              required
            />
            {formErrors.email && (
              <p className="text-[10px] text-[#f87171] mt-0.5">{formErrors.email}</p>
            )}
          </div>

          {/* Password (Sign In & Register) */}
          {mode !== "forgot" && (
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
                  className={`input-dark pr-10 ${formErrors.password ? "border-[#f87171]" : ""}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-[10px] text-[#f87171] mt-0.5">{formErrors.password}</p>
              )}
            </div>
          )}

          {/* Remember Me & Forgot Password Row */}
          {mode === "signin" && (
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-zinc-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-[#16191f] border border-[#2a313d] accent-[#cde655]"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => handleSwitchMode("forgot")}
                className="text-zinc-300 hover:text-[#cde655] font-medium transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3.5 text-[14px] mt-2 gap-2 shadow-sm font-semibold disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0e1208]" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#0e1208]" />
                <span>
                  {mode === "signin" && "Sign in"}
                  {mode === "register" && "Register"}
                  {mode === "forgot" && "Send Code"}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#1f2531]"></div>
          </div>
          <span className="relative px-3 bg-[#0e1116] text-[11px] text-zinc-400">
            Or continue with
          </span>
        </div>

        {/* Google & Apple Social Login */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex items-center justify-center py-2.5 px-3 rounded-full bg-[#151921] border border-[#242b36] text-[12px] font-medium text-zinc-300 hover:bg-[#1b212b] hover:border-[#323b49] transition-colors"
          >
            <GoogleIcon />
            Google
          </button>
          <button
            type="button"
            onClick={handleSocialClick}
            className="flex items-center justify-center py-2.5 px-3 rounded-full bg-[#151921] border border-[#242b36] text-[12px] font-medium text-zinc-300 hover:bg-[#1b212b] hover:border-[#323b49] transition-colors"
          >
            <AppleIcon />
            Apple
          </button>
        </div>

        {/* Bottom Switch Mode Link */}
        <div className="text-center pt-4 text-[11px] text-zinc-400">
          {mode === "signin" ? (
            <span>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("register")}
                className="text-white font-semibold hover:text-[#cde655] transition-colors ml-1"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("signin")}
                className="text-white font-semibold hover:text-[#cde655] transition-colors ml-1"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
