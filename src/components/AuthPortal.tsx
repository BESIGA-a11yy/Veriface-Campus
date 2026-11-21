import React, { useState } from 'react';
import {
  ScanFace,
  GraduationCap,
  Users,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../utils/api';
import { getBase64SizeKb } from '../utils/imageCompression';
import { CameraCapture } from './CameraCapture';
import type { AuthUser } from '../types';

interface AuthPortalProps {
  onAuthenticated: (user: AuthUser) => void;
  dbConnected: boolean | null;
  isAdminRoute?: boolean;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({
  onAuthenticated,
  dbConnected,
  isAdminRoute = false,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Student registration state
  const [name, setName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [courseProgram, setCourseProgram] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [faceImageBase64, setFaceImageBase64] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      if (isAdminRoute && data.user.role !== 'admin') {
        setError('This console is restricted to System Administrator accounts.');
        setSubmitting(false);
        return;
      }

      setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!faceImageBase64) {
      setError(
        'Please capture or upload a clear, front-facing reference headshot before registering.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/register-student',
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            regNumber: regNumber.trim(),
            courseProgram: courseProgram.trim(),
            email: regEmail.trim(),
            password: regPassword,
            faceImageBase64,
          }),
        }
      );
      setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Student registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hidden System Admin Console Sign-In (only shown on direct /admin route)
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-900 text-white shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                Administration Console
              </h1>
              <p className="text-xs text-slate-500">VeriFace Campus System Access</p>
            </div>
          </div>

          {dbConnected === false && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              Database connection pending. Verify <code className="font-mono">MONGODB_URI</code>.
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@university.edu"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: 3 clean zones (no admin sign-in option exposed) */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          VeriFace Campus
        </span>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              mode === 'login' ? 'text-slate-900 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Portal Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              mode === 'register' ? 'text-slate-900 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Student Enrollment
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {mode === 'login' ? 'Register Student' : 'Sign In'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Institutional Context Column */}
        <section className="lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-mono font-medium text-blue-700 tracking-wide">
              Biometric Academic Attendance
            </p>
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-tight text-balance">
              Automated lecture attendance via multimodal facial recognition.
            </h1>
            <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
              Manage course units, enroll with your biometric headshot, and record verified
              classroom attendance in seconds.
            </p>
          </div>

          {dbConnected === false && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
              <p className="font-semibold mb-1">MongoDB Atlas connection pending</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Set <code className="font-mono">MONGODB_URI</code> in your environment secrets to
                enable database persistence, account login, and attendance recording.
              </p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Course Unit Management
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Lecturers create course units, share enrollment codes, and export verified
                  attendance logs as CSV.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                <ScanFace className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Dual-Mode Gemini AI Scanning
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Verify students one-by-one at the podium or capture a single wide-angle lecture
                  hall photo for batch attendance review.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Class Rep Delegation
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Lecturers can empower enrolled students as course Class Representatives with
                  scoped scanning rights.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Student Self-Service
                </h2>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Register with your reference headshot, join courses via enrollment code, and track
                  verified attendance records.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Interactive Auth Card */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6 w-fit">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Student Self-Registration
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Sign in to your account
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Lecturers, Class Reps, and Students sign in with their institutional email.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Institutional Email
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                Sign in with your Lecturer or Student credentials. New students can self-register
                using the tab above.
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterStudent} className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Student Biometric Registration
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Provide your academic credentials and capture a clear, front-facing headshot.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Amina Nakato"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    required
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="2026/BCS/0142"
                    className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Course / Program
                  </label>
                  <input
                    type="text"
                    required
                    value={courseProgram}
                    onChange={(e) => setCourseProgram(e.target.value)}
                    placeholder="BSc Computer Science"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    University Email
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="amina.nakato@student.edu"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Reference Headshot Photo (Front-Facing)
                  </label>
                  {faceImageBase64 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Compressed {getBase64SizeKb(faceImageBase64)} KB
                    </span>
                  )}
                </div>

                {!faceImageBase64 ? (
                  <CameraCapture
                    onCapture={(img) => setFaceImageBase64(img)}
                    captureLabel="Capture Headshot"
                    initialFacingMode="user"
                    aspectClass="aspect-[16/10]"
                  />
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <img
                      src={faceImageBase64}
                      alt="Captured reference headshot"
                      referrerPolicy="no-referrer"
                      className="w-28 h-28 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <p className="text-sm font-semibold text-slate-900">
                        Reference headshot ready
                      </p>
                      <p className="text-xs text-slate-600">
                        Ensure your face is clearly lit, centered, and unobstructed before
                        submitting.
                      </p>
                      <button
                        type="button"
                        onClick={() => setFaceImageBase64(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retake Headshot
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors"
              >
                {submitting ? 'Creating Student Profile...' : 'Complete Student Registration'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};
