import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Box,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  QrCode,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { loginWithPassword, REMEMBERED_USER_KEY, setStoredToken } from '../api/client.ts';
import type { AuthUser, UserRole } from '../types/store.ts';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
  onOpenCustomerCatalog: () => void;
}

const BACKDROP_IMG = '/src/assets/images/grocery_aisle_cart_bg_1795335430034.jpg';

const SmartStockLogoMark: React.FC<{ className?: string }> = ({
  className = 'w-14 h-14',
}) => (
  <svg
    viewBox="0 0 72 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Rising Bar Chart Bars inside Cart */}
    <rect x="20" y="30" width="6.5" height="10" rx="1.5" fill="#FACC15" />
    <rect x="29.5" y="25" width="6.5" height="15" rx="1.5" fill="#84CC16" />
    <rect x="39" y="21" width="6.5" height="19" rx="1.5" fill="#22C55E" />
    <rect x="48.5" y="15" width="6.5" height="25" rx="1.5" fill="#34D399" />

    {/* Glowing Cyan Upward Trend Arrow */}
    <path
      d="M19 25.5C29 22 38 17 51 7.5"
      stroke="#22E5D6"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <path
      d="M44.5 6.5L53 6L51.5 14.5"
      stroke="#22E5D6"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* White Shopping Cart Frame */}
    <path
      d="M6 12H13.5L19.5 41.5C20 44 22.1 45.8 24.7 45.8H54.5"
      stroke="#FFFFFF"
      strokeWidth="4.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 12H10.5"
      stroke="#FACC15"
      strokeWidth="4.2"
      strokeLinecap="round"
    />
    <circle cx="25.5" cy="54.5" r="4.5" fill="#FFFFFF" />
    <circle cx="48.5" cy="54.5" r="4.5" fill="#FFFFFF" />
  </svg>
);

const FEATURE_CARDS = [
  {
    title: 'Track',
    subtitle: 'Stock',
    icon: Box,
  },
  {
    title: 'Analyze',
    subtitle: 'Sales',
    icon: TrendingUp,
  },
  {
    title: 'AI',
    subtitle: 'Assistant',
    icon: Bot,
  },
  {
    title: 'Low Stock',
    subtitle: 'Alerts',
    icon: Bell,
  },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthenticated,
  onOpenCustomerCatalog,
}) => {
  const [activeRole, setActiveRole] = useState<UserRole>('Admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotNotice, setForgotNotice] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_USER_KEY);
      if (saved && saved.trim() && saved !== 'null' && saved !== 'undefined') {
        setIdentifier(saved.trim());
        setRememberMe(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotNotice(false);

    if (!identifier.trim() || !password) {
      setError('Enter your username or email and password to sign in.');
      return;
    }

    setSubmitting(true);
    try {
      const { token, user } = await loginWithPassword(
        identifier.trim(),
        password,
        activeRole
      );
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_USER_KEY, identifier.trim());
        } else {
          localStorage.removeItem(REMEMBERED_USER_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      setStoredToken(token);
      onAuthenticated(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid username/email or password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-gradient-to-br from-[#EAF3FF] via-[#F4F8FF] to-[#DFECFF] overflow-x-hidden">
      {/* Compact Mobile Header (< 768px) — collapses left panel so login card fits immediately */}
      <header className="md:hidden bg-gradient-to-r from-[#04183D] via-[#072B6B] to-[#0052FF] text-white px-5 py-3.5 flex items-center justify-center gap-3 shrink-0 shadow-sm">
        <SmartStockLogoMark className="w-10 h-9 shrink-0" />
        <div className="min-w-0">
          <div className="font-display text-lg font-bold tracking-tight leading-none">
            <span>SmartStock </span>
            <span className="text-[#2EE877]">AI</span>
          </div>
          <p className="text-[11px] text-blue-100/90 mt-0.5 truncate">
            Smart Inventory. Smarter Business.
          </p>
        </div>
      </header>

      {/* Desktop Split-Screen Left Panel (>= 768px) */}
      <section className="hidden md:flex md:w-[51%] lg:w-[54%] relative overflow-hidden bg-[#051942] text-white flex-col justify-between">
        {/* Background Grocery Aisle + Foreground Cart Photo */}
        {!imgFailed && (
          <img
            src={BACKDROP_IMG}
            alt="Modern grocery aisle with stocked shopping cart"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-left-bottom scale-[1.01]"
          />
        )}

        {/* Deep Navy-Blue Gradient Overlay (clear cart visibility at bottom-left) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(4, 22, 62, 0.94) 0%, rgba(6, 33, 88, 0.78) 44%, rgba(6, 26, 68, 0.34) 76%, rgba(4, 16, 44, 0.78) 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 25% 18%, rgba(0, 122, 255, 0.32) 0%, transparent 58%)',
          }}
        />

        {/* Foreground Left Panel Content */}
        <div className="relative z-10 flex flex-col justify-between h-full px-8 lg:px-12 xl:px-14 pt-10 pb-8 pr-20 lg:pr-28">
          {/* Top Brand Lockup + 4 Glowing Cyan Glassmorphism Feature Cards */}
          <div className="space-y-8 max-w-[540px]">
            {/* Logo & Tagline */}
            <div className="flex items-center gap-4">
              <SmartStockLogoMark className="w-16 h-14 lg:w-[74px] lg:h-[66px] shrink-0 drop-shadow-[0_4px_18px_rgba(34,229,214,0.35)]" />
              <div>
                <h1 className="font-display text-3xl lg:text-[42px] font-bold tracking-tight leading-none">
                  <span className="text-white">SmartStock </span>
                  <span className="text-[#2EE877]">AI</span>
                </h1>
                <p className="mt-1.5 text-sm lg:text-base font-medium text-blue-100/95 tracking-wide">
                  Smart Inventory. Smarter Business.
                </p>
              </div>
            </div>

            {/* Four Glowing Cyan Glassmorphism Feature Cards */}
            <div className="grid grid-cols-4 gap-2.5 lg:gap-3.5">
              {FEATURE_CARDS.map(({ title, subtitle, icon: Icon }) => (
                <div
                  key={`${title}-${subtitle}`}
                  className="rounded-2xl bg-[#09245B]/55 backdrop-blur-md border border-cyan-300/65 shadow-[0_0_22px_rgba(34,211,238,0.26),inset_0_1px_1px_rgba(255,255,255,0.25)] px-2 py-3.5 lg:py-4 flex flex-col items-center justify-center text-center"
                >
                  <Icon
                    className="w-7 h-7 lg:w-8 lg:h-8 text-[#38F2E6] drop-shadow-[0_0_8px_rgba(56,242,230,0.6)]"
                    strokeWidth={1.85}
                  />
                  <span className="mt-2.5 text-xs lg:text-[13px] font-semibold text-white leading-tight">
                    {title}
                    <br />
                    {subtitle}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom-Left Quote over Shopping Cart */}
          <div className="relative mt-auto pt-36 lg:pt-44 max-w-md">
            <p className="font-display italic text-lg lg:text-[22px] font-semibold text-white leading-snug drop-shadow-[0_2px_10px_rgba(2,10,30,0.85)]">
              &ldquo;Manage your store smarter
              <br />
              with the power of AI&rdquo;
            </p>
            <svg
              viewBox="0 0 180 14"
              fill="none"
              className="w-36 lg:w-44 h-3.5 mt-1.5 ml-12"
              aria-hidden="true"
            >
              <path
                d="M4 10.5C48 3.5 118 2.5 176 7.5"
                stroke="#FACC15"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Smooth Multi-Layer Curved Wave Divider on Right Edge */}
        <svg
          viewBox="0 0 150 900"
          preserveAspectRatio="none"
          className="absolute top-0 right-[-1px] h-full w-24 lg:w-36 pointer-events-none z-20"
          aria-hidden="true"
        >
          {/* Outer subtle glowing accent line */}
          <path
            d="M42,0 C-18,230 98,540 14,900"
            fill="none"
            stroke="rgba(147, 197, 253, 0.35)"
            strokeWidth="1.5"
          />
          {/* Mid royal blue ribbon wave */}
          <path
            d="M84,0 C20,240 122,520 26,900 L150,900 L150,0 Z"
            fill="rgba(0, 82, 255, 0.42)"
          />
          {/* Inner bright cobalt wave sweep */}
          <path
            d="M108,0 C48,235 138,530 48,900 L150,900 L150,0 Z"
            fill="#0052FF"
            fillOpacity="0.22"
          />
          {/* Right panel icy-blue foreground curve */}
          <path
            d="M126,0 C68,260 152,550 56,900 L150,900 L150,0 Z"
            fill="#EDF4FF"
          />
        </svg>
      </section>

      {/* Right Panel: Soft Icy-Blue/White Backdrop Centering Login Card */}
      <main className="flex-1 relative flex flex-col items-center justify-center px-4 py-6 sm:px-8 md:py-10">
        {/* Decorative top royal-blue arc bleed on desktop */}
        <div
          className="hidden md:block absolute top-0 left-0 w-72 h-44 pointer-events-none opacity-80"
          style={{
            background:
              'radial-gradient(ellipse at 0% 0%, rgba(0, 82, 255, 0.24) 0%, transparent 72%)',
          }}
          aria-hidden="true"
        />

        {/* Crisp White Rounded Login Card */}
        <div className="relative z-10 w-full max-w-[450px] bg-white rounded-3xl shadow-[0_24px_60px_rgba(12,42,107,0.13)] border border-white/80 px-6 py-7 sm:px-9 sm:py-8">
          {/* Segmented Pill Role Switcher */}
          <div
            role="tablist"
            aria-label="Login Role"
            className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-[#EEF1F6]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'Admin'}
              onClick={() => {
                setActiveRole('Admin');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeRole === 'Admin'
                  ? 'bg-[#0052FF] text-white shadow-[0_6px_16px_rgba(0,82,255,0.34)]'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Admin Login</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'Employee'}
              onClick={() => {
                setActiveRole('Employee');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeRole === 'Employee'
                  ? 'bg-[#0052FF] text-white shadow-[0_6px_16px_rgba(0,82,255,0.34)]'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Employee Login</span>
            </button>
          </div>

          {/* Card Heading */}
          <div className="mt-6 text-center">
            <h2 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#0D1B3E]">
              Welcome Back!
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              Sign in to access your SmartStock AI dashboard
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          {forgotNotice && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
              Please contact your Store Admin to reset your SmartStock AI account password.
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
            {/* Username or Email Input */}
            <div className="relative">
              <label htmlFor="login-identifier" className="sr-only">
                Username or Email
              </label>
              <Mail className="w-[18px] h-[18px] text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Username or Email"
                autoComplete="username"
                className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0052FF] focus:ring-3 focus:ring-[#0052FF]/15 transition-colors"
              />
            </div>

            {/* Password Input with Show/Hide Toggle */}
            <div className="relative">
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <Lock className="w-[18px] h-[18px] text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full pl-11 pr-11 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0052FF] focus:ring-3 focus:ring-[#0052FF]/15 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {showPassword ? (
                  <Eye className="w-[18px] h-[18px]" />
                ) : (
                  <EyeOff className="w-[18px] h-[18px]" />
                )}
              </button>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label className="inline-flex items-center gap-2 text-xs sm:text-[13px] font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0052FF] accent-[#0052FF] focus:ring-[#0052FF] cursor-pointer"
                />
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotNotice((prev) => !prev);
                  setError(null);
                }}
                className="text-xs sm:text-[13px] font-semibold text-[#0052FF] hover:text-[#003EC2] hover:underline cursor-pointer whitespace-nowrap"
              >
                Forgot Password?
              </button>
            </div>

            {/* Full-Width Royal Blue Login Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-[#0052FF] hover:bg-[#0044D6] active:bg-[#0039B5] text-white text-sm sm:text-base font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(0,82,255,0.3)] transition-all disabled:opacity-60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0052FF]"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>{submitting ? 'Signing In...' : 'Login'}</span>
            </button>
          </form>

          {/* OR Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">OR</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Soft Blue-Tinted Powered by AI Badge */}
          <div className="rounded-2xl bg-[#EDF3FF] border border-[#DCE8FF] px-4 py-3.5 flex items-center justify-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#D4E3FF] flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 text-[#0052FF]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[#0D1B3E] leading-tight">
                Powered by AI
              </p>
              <p className="text-xs font-medium text-[#1D4ED8] mt-0.5">
                Automate • Predict • Grow
              </p>
            </div>
          </div>
        </div>

        {/* Subtle Walk-In Customer Product Availability Link Below Card */}
        <button
          type="button"
          onClick={onOpenCustomerCatalog}
          className="relative z-10 mt-5 inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-slate-600 hover:text-[#0052FF] transition-colors cursor-pointer"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Customer View: Check Product Availability</span>
        </button>
      </main>
    </div>
  );
};
