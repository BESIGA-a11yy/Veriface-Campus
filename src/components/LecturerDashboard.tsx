import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  ScanFace,
  Users,
  Download,
  Copy,
  Check,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Shield,
  Save,
  Presentation,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import type {
  AttendanceRecord,
  AttendanceSession,
  CourseUnit,
  Department,
  EnrolledStudentSummary,
  Lecture,
} from '../types';

interface LecturerDashboardProps {
  onOpenScanner: (courseId: string, lectureId?: string) => void;
  refreshTrigger: number;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({
  onOpenScanner,
  refreshTrigger,
}) => {
  const [courses, setCourses] = useState<CourseUnit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Course form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState('Fall 2026');
  const [creating, setCreating] = useState(false);

  // Selected course detail view (Lectures, Roster & Logs)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'lectures' | 'roster' | 'logs'>('lectures');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Create Lecture form
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureRoom, setLectureRoom] = useState('');
  const [creatingLecture, setCreatingLecture] = useState(false);

  // Session editing state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedRecords, setEditedRecords] = useState<Record<string, 'Present' | 'Absent'>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const loadLecturerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, deptsRes] = await Promise.all([
        apiFetch<{ courses: CourseUnit[] }>('/api/courses/my-courses'),
        apiFetch<{ departments: Department[] }>('/api/admin/departments'),
      ]);
      setCourses(coursesRes.courses);
      setDepartments(deptsRes.departments);
      if (deptsRes.departments.length > 0 && !departmentId) {
        setDepartmentId(deptsRes.departments[0]._id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lecturer courses.');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    loadLecturerData();
  }, [loadLecturerData, refreshTrigger]);

  const loadCourseDetails = useCallback(async (courseId: string) => {
    setLoadingLectures(true);
    setLoadingSessions(true);
    try {
      const [lecturesRes, historyRes] = await Promise.all([
        apiFetch<{ lectures: Lecture[] }>(`/api/courses/${courseId}/lectures`),
        apiFetch<{ sessions: AttendanceSession[] }>(
          `/api/attendance/course/${courseId}/history`
        ),
      ]);
      setLectures(lecturesRes.lectures);
      setSessions(historyRes.sessions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load course lectures and logs.');
    } finally {
      setLoadingLectures(false);
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseDetails(selectedCourseId);
    }
  }, [selectedCourseId, loadCourseDetails, refreshTrigger]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setCreating(true);
    try {
      const res = await apiFetch<{ course: CourseUnit }>('/api/courses/create', {
        method: 'POST',
        body: JSON.stringify({
          courseCode: courseCode.trim().toUpperCase(),
          courseName: courseName.trim(),
          departmentId,
          semester: semester.trim(),
        }),
      });
      setCourses((prev) => [res.course, ...prev]);
      setCourseCode('');
      setCourseName('');
      setShowCreateForm(false);
      setSuccessMsg(
        `Course "${res.course.courseCode}" created with enrollment code ${res.course.enrollmentCode}.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create course unit.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setError(null);
    setSuccessMsg(null);
    setCreatingLecture(true);

    try {
      const res = await apiFetch<{ lecture: Lecture }>(
        `/api/courses/${selectedCourseId}/lectures`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: lectureTitle.trim(),
            room: lectureRoom.trim(),
          }),
        }
      );
      setLectures((prev) => [res.lecture, ...prev]);
      setLectureTitle('');
      setLectureRoom('');
      setSuccessMsg(
        `Lecture "${res.lecture.title}" (${res.lecture.room}) created. Ready to record attendance.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lecture.');
    } finally {
      setCreatingLecture(false);
    }
  };

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleToggleClassRep = async (
    courseId: string,
    studentId: string,
    currentlyRep: boolean
  ) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch<{ course: CourseUnit }>(`/api/courses/${courseId}/assign-rep`, {
        method: 'PUT',
        body: JSON.stringify({
          studentId,
          assign: !currentlyRep,
        }),
      });
      setCourses((prev) => prev.map((c) => (c._id === courseId ? res.course : c)));
      setSuccessMsg(
        !currentlyRep
          ? 'Student assigned as Class Representative for this course.'
          : 'Class Representative privileges removed.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update Class Rep assignment.');
    }
  };

  const startEditingSession = (session: AttendanceSession) => {
    setEditingSessionId(session._id);
    const map: Record<string, 'Present' | 'Absent'> = {};
    session.records.forEach((r) => {
      map[r.studentId] = r.status;
    });
    setEditedRecords(map);
  };

  const handleSaveSessionEdits = async (sessionId: string) => {
    setSavingEdit(true);
    setError(null);
    try {
      const records = Object.entries(editedRecords).map(([studentId, status]) => ({
        studentId,
        status,
      }));
      const res = await apiFetch<{ session: AttendanceSession }>(
        `/api/attendance/session/${sessionId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ records }),
        }
      );
      setSessions((prev) => prev.map((s) => (s._id === sessionId ? res.session : s)));
      setEditingSessionId(null);
      setSuccessMsg('Attendance log updated successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance edits.');
    } finally {
      setSavingEdit(false);
    }
  };

  const exportCourseCsv = (course: CourseUnit, targetSessions: AttendanceSession[]) => {
    const headers = [
      'Course Code',
      'Course Name',
      'Lecture Title',
      'Room Held',
      'Session Date',
      'Scan Mode',
      'Taken By',
      'Taken By Role',
      'Registration Number',
      'Student Name',
      'Status',
      'Confidence (%)',
      'Matched At',
    ];

    const rows: string[][] = [];
    for (const session of targetSessions) {
      const takenByName =
        typeof session.takenByUid === 'object' ? session.takenByUid.name : 'Instructor';
      const lectureObj =
        session.lectureId && typeof session.lectureId === 'object' ? session.lectureId : null;
      const lecTitle = session.lectureTitle || lectureObj?.title || 'General Session';
      const lecRoom = session.lectureRoom || lectureObj?.room || '—';
      const sessionDateStr = new Date(session.date).toISOString();
      const modeLabel =
        session.scanMode === 'classroom_group' ? 'Classroom Group Scan' : 'One-by-One Live Scan';

      for (const rec of session.records) {
        rows.push([
          course.courseCode,
          course.courseName,
          lecTitle,
          lecRoom,
          sessionDateStr,
          modeLabel,
          takenByName,
          session.takenByRole,
          rec.regNumber,
          rec.studentName,
          rec.status,
          String(rec.confidenceScore ?? 0),
          rec.matchedAt ? new Date(rec.matchedAt).toISOString() : '',
        ]);
      }
    }

    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r) => r.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${course.courseCode}_attendance_logs.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedCourse = courses.find((c) => c._id === selectedCourseId) || null;

  if (selectedCourse) {
    const enrolledStudents = (selectedCourse.enrolledStudentIds || []) as EnrolledStudentSummary[];
    const repIdSet = new Set(
      (selectedCourse.classRepIds || []).map((r) => (typeof r === 'string' ? r : r._id))
    );

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCourseId(null);
                setEditingSessionId(null);
              }}
              className="mt-0.5 p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-blue-700">
                  {selectedCourse.courseCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedCourse.semester}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">Enroll Code: {selectedCourse.enrollmentCode}</span>
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                {selectedCourse.courseName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenScanner(selectedCourse._id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <ScanFace className="w-4 h-4" />
              Take Attendance
            </button>
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

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setDetailTab('lectures')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                detailTab === 'lectures'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              Lectures ({lectures.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('roster')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                detailTab === 'roster'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Roster & Class Reps ({enrolledStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('logs')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                detailTab === 'logs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Attendance Logs ({sessions.length})
            </button>
          </div>

          {detailTab === 'logs' && sessions.length > 0 && (
            <button
              type="button"
              onClick={() => exportCourseCsv(selectedCourse, sessions)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export All Logs (CSV)
            </button>
          )}
        </div>

        {detailTab === 'lectures' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleCreateLecture}
              className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
            >
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Create Lecture
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define the lecture title and room where it is held, then scan student attendance.
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
                  placeholder="e.g. Week 4: Search Algorithms"
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
                  placeholder="e.g. Science Block · Room 105"
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
                <h3 className="font-display text-base font-bold text-slate-900">
                  Course Lectures
                </h3>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {lectures.length} lectures
                </span>
              </div>

              {loadingLectures ? (
                <div className="p-6 text-sm text-slate-500">Loading lectures...</div>
              ) : lectures.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No lectures created for this course unit yet. Create your first lecture on the
                  left to start scanning attendance.
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
                            <span className="text-slate-500">Attendance not recorded</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenScanner(selectedCourse._id, lec._id)}
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
        ) : detailTab === 'roster' ? (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                Student Roster & Class Representative Assignment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign one or more enrolled students as Class Rep to grant them lecture &
                attendance scanning access for this course unit.
              </p>
            </div>

            {enrolledStudents.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No students enrolled yet. Share enrollment code{' '}
                <code className="font-mono font-semibold text-slate-800">
                  {selectedCourse.enrollmentCode}
                </code>{' '}
                with your class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-6">Reg Number</th>
                      <th className="py-3 px-6">Student Name</th>
                      <th className="py-3 px-6">Program</th>
                      <th className="py-3 px-6 text-right">Class Rep Privilege</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {enrolledStudents.map((student) => {
                      const isRep = repIdSet.has(student._id);
                      return (
                        <tr key={student._id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-6 font-mono text-xs font-semibold text-slate-900">
                            {student.regNumber}
                          </td>
                          <td className="py-3 px-6">
                            <div className="font-medium text-slate-900">{student.name}</div>
                            <div className="text-xs text-slate-500">{student.email}</div>
                          </td>
                          <td className="py-3 px-6 text-xs text-slate-600">
                            {student.courseProgram || '—'}
                          </td>
                          <td className="py-3 px-6 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleClassRep(selectedCourse._id, student._id, isRep)
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                                isRep
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5" />
                              {isRep ? 'Class Rep Assigned' : 'Assign Class Rep'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {loadingSessions ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-500">
                Loading attendance sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  No attendance sessions recorded for this course unit yet.
                </p>
                <button
                  type="button"
                  onClick={() => setDetailTab('lectures')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
                >
                  <Presentation className="w-4 h-4" />
                  Create a Lecture to Scan
                </button>
              </div>
            ) : (
              sessions.map((session) => {
                const presentCount = session.records.filter((r) => r.status === 'Present').length;
                const isEditing = editingSessionId === session._id;
                const takenByName =
                  typeof session.takenByUid === 'object' ? session.takenByUid.name : 'Instructor';
                const lectureObj =
                  session.lectureId && typeof session.lectureId === 'object'
                    ? session.lectureId
                    : null;
                const displayLectureTitle = session.lectureTitle || lectureObj?.title;
                const displayLectureRoom = session.lectureRoom || lectureObj?.room;

                return (
                  <div
                    key={session._id}
                    className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        {displayLectureTitle && (
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900 mb-1">
                            <span>{displayLectureTitle}</span>
                            {displayLectureRoom && (
                              <>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono text-xs font-medium text-slate-600">
                                  {displayLectureRoom}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-slate-800 tabular-nums">
                            {new Date(session.date).toLocaleString()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {session.scanMode === 'classroom_group'
                              ? 'Lecture Room Group Scan'
                              : 'One-by-One Live Scan'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Taken by {takenByName} ({session.takenByRole})
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1 tabular-nums">
                          {presentCount} / {session.records.length} Present
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => exportCourseCsv(selectedCourse, [session])}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          CSV
                        </button>

                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => handleSaveSessionEdits(session._id)}
                            disabled={savingEdit}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap shrink-0"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingEdit ? 'Saving...' : 'Save Changes'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingSession(session)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0"
                          >
                            Edit Attendance
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            <th className="py-2.5 px-6">Reg Number</th>
                            <th className="py-2.5 px-6">Student Name</th>
                            <th className="py-2.5 px-6 text-right">Confidence</th>
                            <th className="py-2.5 px-6 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-sm">
                          {session.records.map((rec: AttendanceRecord) => {
                            const status = isEditing
                              ? editedRecords[rec.studentId] || rec.status
                              : rec.status;
                            const isPresent = status === 'Present';

                            return (
                              <tr key={rec.studentId} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-6 font-mono text-xs text-slate-700">
                                  {rec.regNumber}
                                </td>
                                <td className="py-2.5 px-6 font-medium text-slate-900">
                                  {rec.studentName}
                                </td>
                                <td className="py-2.5 px-6 text-right font-mono text-xs tabular-nums text-slate-600">
                                  {rec.confidenceScore > 0 ? `${rec.confidenceScore}%` : '—'}
                                </td>
                                <td className="py-2.5 px-6 text-right">
                                  {isEditing ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditedRecords((prev) => ({
                                          ...prev,
                                          [rec.studentId]: isPresent ? 'Absent' : 'Present',
                                        }))
                                      }
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                        isPresent
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-red-50 text-red-700 border-red-200'
                                      }`}
                                    >
                                      {isPresent ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Present
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3.5 h-3.5" />
                                          Absent
                                        </>
                                      )}
                                    </button>
                                  ) : (
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
                                      {status}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">My Course Units</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create courses, schedule lectures with room details, assign Class Reps, and run AI
            attendance scans.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showCreateForm ? 'Close Form' : 'New Course Unit'}
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

      {showCreateForm && (
        <form
          onSubmit={handleCreateCourse}
          className="bg-white border border-slate-200 rounded-lg p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Course Code
            </label>
            <input
              type="text"
              required
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="CSC 3102"
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Course Name
            </label>
            <input
              type="text"
              required
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Artificial Intelligence"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Department
            </label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {departments.length === 0 && <option value="">No departments found</option>}
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Semester
            </label>
            <input
              type="text"
              required
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="Fall 2026"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={creating || departments.length === 0}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors"
            >
              {creating ? 'Creating...' : 'Create Course & Generate Code'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
          Loading course units...
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">No course units created yet</p>
          <p className="text-sm text-slate-500">
            Create your first course unit to generate an enrollment code and start biometric
            attendance sessions.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md"
          >
            <Plus className="w-4 h-4" />
            Create Course Unit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courses.map((course) => {
            const dept = typeof course.departmentId === 'object' ? course.departmentId : null;
            const repCount = course.classRepIds?.length || 0;
            const studentCount = course.enrolledStudentIds?.length || 0;

            return (
              <div
                key={course._id}
                className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-blue-700">
                      {course.courseCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{dept ? dept.name : 'Department'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{course.semester}</span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-slate-900">
                    {course.courseName}
                  </h3>

                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
                    <span>{studentCount} enrolled</span>
                    <span aria-hidden="true">·</span>
                    <span>{repCount} Class Rep(s)</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                    <span className="text-slate-500">Enrollment Code</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(course._id, course.enrollmentCode)}
                      className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {course.enrollmentCode}
                      {copiedCodeId === course._id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course._id);
                        setDetailTab('lectures');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <Presentation className="w-4 h-4" />
                      Lectures & Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourseId(course._id);
                        setDetailTab('roster');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <Users className="w-4 h-4" />
                      Roster & Logs
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
