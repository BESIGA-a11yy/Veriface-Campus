import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  ScanFace,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { apiFetch, clearStoredToken, getStoredToken } from './utils/api';
import { AuthPortal } from './components/AuthPortal';
import { AdminDashboard } from './components/AdminDashboard';
import { LecturerDashboard } from './components/LecturerDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AttendanceScanner } from './components/AttendanceScanner';
import type { AuthUser } from './types';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [scannerTarget, setScannerTarget] = useState<{
    courseId: string;
    lectureId?: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bootstrapSession = useCallback(async () => {
    try {
      const health = await apiFetch<{ ok: boolean; dbConnected: boolean }>('/api/health');
      setDbConnected(health.dbConnected);
    } catch {
      setDbConnected(false);
    }

    const token = getStoredToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }

    try {
      const me = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      setUser(me.user);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    setScannerTarget(null);
    setMobileMenuOpen(false);
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    const isAdminRoute =
      window.location.pathname === '/admin' || window.location.hash === '#admin';

    return (
      <AuthPortal
        onAuthenticated={(loggedInUser) => {
          setUser(loggedInUser);
          // Re-fetch /api/auth/me to hydrate faceImageBase64 and populated department
          apiFetch<{ user: AuthUser }>('/api/auth/me')
            .then((res) => setUser(res.user))
            .catch(() => {});
        }}
        dbConnected={dbConnected}
        isAdminRoute={isAdminRoute}
      />
    );
  }

  const roleLabel =
    user.role === 'admin'
      ? 'System Admin'
      : user.role === 'lecturer'
      ? 'Lecturer'
      : user.classRepCourseIds && user.classRepCourseIds.length > 0
      ? 'Student · Class Rep'
      : 'Student';

  const RoleIcon =
    user.role === 'admin'
      ? ShieldCheck
      : user.role === 'lecturer'
      ? BookOpen
      : GraduationCap;

  const pageTitle = scannerTarget
    ? 'Live Attendance Scanner'
    : user.role === 'admin'
    ? 'Administration Console'
    : user.role === 'lecturer'
    ? 'Lecturer Workspace'
    : 'Student Portal';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200 justify-between">
        <div>
          <div className="px-6 py-5 border-b border-slate-200">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              VeriFace Campus
            </span>
          </div>

          <nav className="p-4 space-y-1">
            <button
              type="button"
              onClick={() => setScannerTarget(null)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors ${
                !scannerTarget
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="truncate">Dashboard</span>
            </button>

            {scannerTarget && (
              <button
                type="button"
                onClick={() => {}}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium bg-blue-700 text-white"
              >
                <ScanFace className="w-4 h-4 shrink-0" />
                <span className="truncate">Attendance Scanner</span>
              </button>
            )}
          </nav>
        </div>

        {/* User Account Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-slate-100 text-slate-700 shrink-0">
              <RoleIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
              <p className="text-xs font-mono text-slate-500 truncate mt-0.5">
                {user.regNumber || user.staffId || user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-72 bg-white h-full border-r border-slate-200 flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <span className="font-display text-lg font-bold text-slate-900">
                  VeriFace Campus
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setScannerTarget(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium ${
                    !scannerTarget
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                {roleLabel}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-bold text-slate-900 truncate">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {scannerTarget ? (
              <button
                type="button"
                onClick={() => setScannerTarget(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Exit Scanner
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="lg:hidden px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {scannerTarget ? (
            <AttendanceScanner
              courseId={scannerTarget.courseId}
              initialLectureId={scannerTarget.lectureId}
              onClose={() => setScannerTarget(null)}
              onSessionSaved={() => {
                setScannerTarget(null);
                setRefreshTrigger((t) => t + 1);
              }}
            />
          ) : user.role === 'admin' ? (
            <AdminDashboard />
          ) : user.role === 'lecturer' ? (
            <LecturerDashboard
              onOpenScanner={(courseId, lectureId) =>
                setScannerTarget({ courseId, lectureId })
              }
              refreshTrigger={refreshTrigger}
            />
          ) : (
            <StudentDashboard
              user={user}
              onOpenScanner={(courseId, lectureId) =>
                setScannerTarget({ courseId, lectureId })
              }
              refreshTrigger={refreshTrigger}
            />
          )}
        </main>
      </div>
    </div>
  );
}
