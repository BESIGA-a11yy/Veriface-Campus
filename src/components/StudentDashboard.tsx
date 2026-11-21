import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  ScanFace,
  Shield,
  CheckCircle2,
  XCircle,
  Plus,
  History,
  UserCheck,
  Presentation,
  MapPin,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import type { AuthUser, CourseUnit, Lecture, StudentHistoryItem } from '../types';

interface StudentDashboardProps {
  user: AuthUser;
  onOpenScanner: (courseId: string, lectureId?: string) => void;
  refreshTrigger: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  onOpenScanner,
  refreshTrigger,
}) => {
  const [courses, setCourses] = useState<CourseUnit[]>([]);
  const [history, setHistory] = useState<StudentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Class Rep course lecture workspace
  const [repCourseId, setRepCourseId] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureRoom, setLectureRoom] = useState('');
  const [creatingLecture, setCreatingLecture] = useState(false);

  const loadStudentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, historyRes] = await Promise.all([
        apiFetch<{ courses: CourseUnit[] }>('/api/courses/my-courses'),
        apiFetch<{ history: StudentHistoryItem[] }>('/api/attendance/student/my-history'),
      ]);
      setCourses(coursesRes.courses);
      setHistory(historyRes.history);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load student data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData, refreshTrigger]);

  const loadCourseLectures = useCallback(async (courseId: string) => {
    setLoadingLectures(true);
    try {
      const res = await apiFetch<{ lectures: Lecture[] }>(`/api/courses/${courseId}/lectures`);
      setLectures(res.lectures);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lectures.');
    } finally {
      setLoadingLectures(false);
    }
  }, []);

  useEffect(() => {
    if (repCourseId) {
      loadCourseLectures(repCourseId);
    }
  }, [repCourseId, loadCourseLectures, refreshTrigger]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setEnrolling(true);

    try {
      const res = await apiFetch<{ message: string; course: CourseUnit }>('/api/courses/enroll', {
        method: 'POST',
        body: JSON.stringify({ enrollmentCode: enrollmentCode.trim().toUpperCase() }),
      });
      setEnrollmentCode('');
      setSuccessMsg(res.message);
      await loadStudentData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleCreateLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repCourseId) return;
    setError(null);
    setSuccessMsg(null);
    setCreatingLecture(true);

    try {
      const res = await apiFetch<{ lecture: Lecture }>(`/api/courses/${repCourseId}/lectures`, {
        method: 'POST',
        body: JSON.stringify({
          title: lectureTitle.trim(),
          room: lectureRoom.trim(),
        }),
      });
      setLectures((prev) => [res.lecture, ...prev]);
      setLectureTitle('');
      setLectureRoom('');
      setSuccessMsg(`Lecture "${res.lecture.title}" created for ${res.lecture.room}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lecture.');
    } finally {
      setCreatingLecture(false);
    }
  };

  const repCourse = courses.find((c) => c._id === repCourseId) || null;

  if (repCourse) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setRepCourseId(null)}
              className="mt-0.5 p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-blue-700">
                  {repCourse.courseCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>{repCourse.semester}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-amber-800">Class Rep Access</span>
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                {repCourse.courseName} — Lectures & Attendance
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenScanner(repCourse._id)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <ScanFace className="w-4 h-4" />
            Take Attendance
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateLecture}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
          >
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Create Lecture</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add a lecture title and room before starting facial recognition scanning.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lecture Title
              </label>
              <input
                type="text"
                required
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                placeholder="e.g. Week 4: Graph Theory"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Room Held
              </label>
              <input
                type="text"
                required
                value={lectureRoom}
                onChange={(e) => setLectureRoom(e.target.value)}
                placeholder="e.g. Engineering Hall 2"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={creatingLecture}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              {creatingLecture ? 'Creating...' : 'Create Lecture'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">Course Lectures</h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {lectures.length} lectures
              </span>
            </div>

            {loadingLectures ? (
              <div className="p-6 text-sm text-slate-500">Loading lectures...</div>
            ) : lectures.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No lectures created yet. Create a lecture on the left to record attendance.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {lectures.map((lec) => (
                  <div
                    key={lec._id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">{lec.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {lec.room}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(lec.createdAt).toLocaleDateString()}
                        </span>
                        <span aria-hidden="true">·</span>
                        {lec.attendanceSession ? (
                          <span className="font-medium text-emerald-700 tabular-nums">
                            Recorded ({lec.attendanceSession.presentCount}/
                            {lec.attendanceSession.totalCount} Present)
                          </span>
                        ) : (
                          <span>Attendance not recorded</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenScanner(repCourse._id, lec._id)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <ScanFace className="w-4 h-4" />
                      {lec.attendanceSession ? 'Rescan Attendance' : 'Record Attendance'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalSessions = history.length;
  const attendedCount = history.filter((h) => h.status === 'Present').length;
  const attendanceRate =
    totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Biometric Profile & KPI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-4">
          {user.faceImageBase64 ? (
            <img
              src={user.faceImageBase64}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-900 truncate">
              {user.name}
            </h2>
            <p className="text-xs font-mono text-slate-600 mt-0.5 truncate">
              {user.regNumber || 'Student'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {user.courseProgram || user.email}
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-slate-500">Enrolled Courses</p>
            <p className="mt-1.5 text-2xl font-display font-bold text-slate-900 tabular-nums">
              {courses.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-slate-500">Sessions Attended</p>
            <p className="mt-1.5 text-2xl font-display font-bold text-emerald-700 tabular-nums">
              {attendedCount} / {totalSessions}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-slate-500">Attendance Rate</p>
            <p className="mt-1.5 text-2xl font-display font-bold text-slate-900 tabular-nums">
              {attendanceRate}%
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Enroll in Course Unit Bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <form
          onSubmit={handleEnroll}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-slate-900">
              Enroll in a Course Unit
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              Enter the unique Course Enrollment Code provided by your lecturer.
            </p>
            <input
              type="text"
              required
              value={enrollmentCode}
              onChange={(e) => setEnrollmentCode(e.target.value)}
              placeholder="e.g. CSC310-A4F2"
              className="w-full sm:max-w-sm px-3.5 py-2 text-sm font-mono uppercase bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={enrolling}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {enrolling ? 'Enrolling...' : 'Enroll in Course'}
          </button>
        </form>
      </section>

      {/* Enrolled Course Units */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-slate-600" />
          <h3 className="font-display text-lg font-bold text-slate-900">
            Enrolled Course Units
          </h3>
        </div>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
            Loading enrolled courses...
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-sm text-slate-500">
            You are not enrolled in any course units yet. Use a Course Enrollment Code above to
            join your first class.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {courses.map((course) => {
              const dept = typeof course.departmentId === 'object' ? course.departmentId : null;
              const lec = typeof course.lecturerId === 'object' ? course.lecturerId : null;

              return (
                <div
                  key={course._id}
                  className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-blue-700">
                          {course.courseCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{course.semester}</span>
                        <span aria-hidden="true">·</span>
                        <span>{dept ? dept.name : 'Department'}</span>
                      </div>

                      {course.isClassRep && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shrink-0">
                          <Shield className="w-3.5 h-3.5 text-amber-700" />
                          Class Rep
                        </span>
                      )}
                    </div>

                    <h4 className="font-display text-lg font-bold text-slate-900">
                      {course.courseName}
                    </h4>

                    <p className="text-xs text-slate-600">
                      Lecturer: {lec ? lec.name : 'Assigned Faculty'}
                    </p>
                  </div>

                  {course.isClassRep && (
                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRepCourseId(course._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        <Presentation className="w-3.5 h-3.5" />
                        Lectures
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenScanner(course._id)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        <ScanFace className="w-4 h-4" />
                        Take Attendance
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Personal Attendance History */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h3 className="font-display text-base font-bold text-slate-900">
              My Attendance History
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {history.length} sessions
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No attendance sessions have been recorded for your enrolled courses yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-6">Date & Time</th>
                  <th className="py-3 px-6">Course Unit</th>
                  <th className="py-3 px-6">Lecture & Room</th>
                  <th className="py-3 px-6">Scan Mode</th>
                  <th className="py-3 px-6 text-right">Match</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {history.map((item) => {
                  const isPresent = item.status === 'Present';
                  return (
                    <tr key={item.sessionId} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6 font-mono text-xs text-slate-600 tabular-nums">
                        {new Date(item.date).toLocaleString()}
                      </td>
                      <td className="py-3 px-6">
                        <span className="font-mono font-semibold text-slate-900">
                          {item.courseCode}
                        </span>{' '}
                        <span className="text-slate-700">— {item.courseName}</span>
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-700">
                        {item.lectureTitle ? (
                          <div>
                            <div className="font-medium text-slate-900">{item.lectureTitle}</div>
                            {item.lectureRoom && (
                              <div className="font-mono text-slate-500">{item.lectureRoom}</div>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-6 text-xs text-slate-600">
                        {item.scanMode === 'classroom_group'
                          ? 'Lecture Room Scan'
                          : 'Individual Live Scan'}
                      </td>
                      <td className="py-3 px-6 text-right font-mono text-xs tabular-nums text-slate-600">
                        {item.confidenceScore > 0 ? `${item.confidenceScore}%` : '—'}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            isPresent ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPresent ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
