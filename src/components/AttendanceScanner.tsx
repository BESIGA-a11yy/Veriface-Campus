import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Users,
  ScanFace,
  Save,
  AlertTriangle,
  Plus,
  MapPin,
  Presentation,
  Upload,
  Camera,
  ImagePlus,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { compressImageFile, getBase64SizeKb } from '../utils/imageCompression';
import { CameraCapture } from './CameraCapture';
import type {
  AttendanceRecord,
  EnrolledFaceStudent,
  GroupScanResponse,
  Lecture,
  SingleScanResponse,
} from '../types';

interface AttendanceScannerProps {
  courseId: string;
  initialLectureId?: string;
  onClose: () => void;
  onSessionSaved: () => void;
}

interface CourseMeta {
  _id: string;
  courseCode: string;
  courseName: string;
  semester: string;
  departmentId?: { name: string };
}

type InputSourceOption = 'camera' | 'upload';
type ScanTargetMode = 'single_live' | 'classroom_group';

interface ScanFeedback {
  type: 'verified' | 'duplicate' | 'unrecognized' | 'group_summary';
  title: string;
  detail: string;
  confidence?: number;
  regNumber?: string;
  faceImageBase64?: string;
}

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  courseId,
  initialLectureId,
  onClose,
  onSessionSaved,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseMeta | null>(null);
  const [students, setStudents] = useState<EnrolledFaceStudent[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedLectureId, setSelectedLectureId] = useState<string>(initialLectureId || '');

  // Inline Create Lecture form
  const [showNewLectureForm, setShowNewLectureForm] = useState(false);
  const [newLectureTitle, setNewLectureTitle] = useState('');
  const [newLectureRoom, setNewLectureRoom] = useState('');
  const [creatingLecture, setCreatingLecture] = useState(false);

  // Option 1: Scan Students (Live Camera) | Option 2: Upload Students' Image
  const [inputOption, setInputOption] = useState<InputSourceOption>('camera');
  // Sub-mode for both options: One-by-One or Lecture Room
  const [scanMode, setScanMode] = useState<ScanTargetMode>('single_live');

  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  // Active attendance records keyed by studentId (accumulates across unlimited scans & uploads)
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [lastGroupPhotoBase64, setLastGroupPhotoBase64] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);

  // Upload queue preview state (Option 2)
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    lastPreview: string | null;
  }>({ current: 0, total: 0, lastPreview: null });

  const loadEnrolledFaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        course: CourseMeta;
        lectures: Lecture[];
        students: EnrolledFaceStudent[];
      }>(`/api/attendance/course/${courseId}/enrolled-faces`);

      setCourse(data.course);
      setLectures(data.lectures || []);
      setStudents(data.students);

      if (initialLectureId) {
        setSelectedLectureId(initialLectureId);
      } else if (data.lectures && data.lectures.length > 0) {
        setSelectedLectureId((prev) => prev || data.lectures[0]._id);
      } else {
        setShowNewLectureForm(true);
      }

      const initialRecords: Record<string, AttendanceRecord> = {};
      for (const s of data.students) {
        initialRecords[s._id] = {
          studentId: s._id,
          regNumber: s.regNumber,
          studentName: s.name,
          status: 'Absent',
          confidenceScore: 0,
        };
      }
      setRecordsMap(initialRecords);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load enrolled student faces.');
    } finally {
      setLoading(false);
    }
  }, [courseId, initialLectureId]);

  useEffect(() => {
    loadEnrolledFaces();
  }, [loadEnrolledFaces]);

  const handleCreateLectureInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatingLecture(true);
    try {
      const res = await apiFetch<{ lecture: Lecture }>(`/api/courses/${courseId}/lectures`, {
        method: 'POST',
        body: JSON.stringify({
          title: newLectureTitle.trim(),
          room: newLectureRoom.trim(),
        }),
      });
      setLectures((prev) => [res.lecture, ...prev]);
      setSelectedLectureId(res.lecture._id);
      setNewLectureTitle('');
      setNewLectureRoom('');
      setShowNewLectureForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create lecture.');
    } finally {
      setCreatingLecture(false);
    }
  };

  // Core verification handler used by BOTH Live Camera (Option 1) and Image Upload (Option 2)
  // Accumulates Present marks across unlimited scans/uploads without resetting previous matches.
  const processImageForAttendance = async (imageBase64: string, modeUsed: ScanTargetMode) => {
    if (modeUsed === 'single_live') {
      const result = await apiFetch<SingleScanResponse>('/api/attendance/scan-verify', {
        method: 'POST',
        body: JSON.stringify({
          courseUnitId: courseId,
          imageBase64,
          mode: 'single_live',
        }),
      });

      setScanCount((c) => c + 1);

      if (!result.matched || !result.studentId) {
        setFeedback({
          type: 'unrecognized',
          title: 'Unrecognized Face',
          detail: 'No matching enrolled student was detected in this image.',
        });
        return;
      }

      const matchedStudent = students.find((s) => s._id === result.studentId);
      let wasAlreadyPresent = false;

      setRecordsMap((prev) => {
        const existing = prev[result.studentId!];
        wasAlreadyPresent = Boolean(existing && existing.status === 'Present');
        if (wasAlreadyPresent) {
          return prev;
        }
        return {
          ...prev,
          [result.studentId!]: {
            studentId: result.studentId!,
            regNumber: result.regNumber || matchedStudent?.regNumber || 'N/A',
            studentName: result.studentName || matchedStudent?.name || 'Student',
            status: 'Present',
            confidenceScore: result.confidence,
            matchedAt: new Date().toISOString(),
          },
        };
      });

      if (wasAlreadyPresent) {
        setFeedback({
          type: 'duplicate',
          title: result.studentName || matchedStudent?.name || 'Student',
          regNumber: result.regNumber || matchedStudent?.regNumber,
          confidence: result.confidence,
          faceImageBase64: matchedStudent?.faceImageBase64,
          detail: 'Already marked Present in this session (duplicate check-in prevented).',
        });
      } else {
        setFeedback({
          type: 'verified',
          title: result.studentName || matchedStudent?.name || 'Verified Student',
          regNumber: result.regNumber || matchedStudent?.regNumber,
          confidence: result.confidence,
          faceImageBase64: matchedStudent?.faceImageBase64,
          detail: 'Verified and marked Present. Ready for next scan.',
        });
      }
      return;
    }

    // Lecture Room Group Scan (accumulates newly matched students into recordsMap)
    setLastGroupPhotoBase64(imageBase64);
    const result = await apiFetch<GroupScanResponse>('/api/attendance/scan-verify', {
      method: 'POST',
      body: JSON.stringify({
        courseUnitId: courseId,
        imageBase64,
        mode: 'classroom_group',
      }),
    });

    setScanCount((c) => c + 1);

    let newlyMarkedCount = 0;
    const totalDetectedInFrame = result.matches.length;

    setRecordsMap((prev) => {
      const next = { ...prev };
      for (const match of result.matches) {
        const existing = next[match.studentId];
        if (!existing || existing.status !== 'Present') {
          newlyMarkedCount += 1;
        }
        next[match.studentId] = {
          studentId: match.studentId,
          regNumber: match.regNumber,
          studentName: match.studentName,
          status: 'Present',
          confidenceScore: Math.max(existing?.confidenceScore || 0, match.confidence),
          matchedAt: existing?.matchedAt || new Date().toISOString(),
        };
      }
      return next;
    });

    setFeedback({
      type: 'group_summary',
      title: `Detected ${totalDetectedInFrame} enrolled student(s) in frame`,
      detail:
        totalDetectedInFrame > 0
          ? `${newlyMarkedCount} newly marked Present. Scan or upload another angle anytime to add more students.`
          : 'No enrolled student faces matched in this frame. Try closer framing or another angle.',
    });
  };

  const handleCameraCapture = async (imageBase64: string) => {
    setError(null);
    setVerifying(true);
    try {
      await processImageForAttendance(imageBase64, scanMode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Facial verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    e.target.value = '';

    setError(null);
    setVerifying(true);
    setUploadProgress({ current: 0, total: files.length, lastPreview: null });

    try {
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFile(files[i], 800, 0.7);
        setUploadProgress({ current: i + 1, total: files.length, lastPreview: compressed });
        await processImageForAttendance(compressed, scanMode);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Image upload verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const toggleStudentStatus = (studentId: string) => {
    setRecordsMap((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      const nextStatus = current.status === 'Present' ? 'Absent' : 'Present';
      return {
        ...prev,
        [studentId]: {
          ...current,
          status: nextStatus,
          matchedAt:
            nextStatus === 'Present' ? current.matchedAt || new Date().toISOString() : undefined,
        },
      };
    });
  };

  const handleFinalizeSession = async () => {
    if (!selectedLectureId) {
      setShowNewLectureForm(true);
      setError('Please select or create a lecture (title and room) above before saving attendance.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const records = Object.values(recordsMap);
      const effectiveMode: ScanTargetMode = lastGroupPhotoBase64 ? 'classroom_group' : scanMode;
      await apiFetch('/api/attendance/save-session', {
        method: 'POST',
        body: JSON.stringify({
          courseUnitId: courseId,
          lectureId: selectedLectureId,
          scanMode: effectiveMode,
          groupPhotoBase64: lastGroupPhotoBase64 || undefined,
          records,
        }),
      });
      onSessionSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance session.');
    } finally {
      setSaving(false);
    }
  };

  const activeLecture = lectures.find((l) => l._id === selectedLectureId) || null;
  const recordsList = Object.values(recordsMap);
  const presentCount = recordsList.filter((r) => r.status === 'Present').length;
  const absentCount = recordsList.length - presentCount;

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
        Loading enrolled student biometric profiles...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scanner Header Bar + Primary Option Selector (1. Scan Students | 2. Upload Students' Image) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-blue-700">{course?.courseCode}</span>
              <span aria-hidden="true">·</span>
              <span>{course?.semester}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{students.length} enrolled</span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
              {course?.courseName} — Record Attendance
            </h2>
          </div>
        </div>

        {/* Two Primary Options: 1. Scan Students (Active Camera) | 2. Upload Students' Image */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit shrink-0">
          <button
            type="button"
            onClick={() => {
              setInputOption('camera');
              setError(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              inputOption === 'camera'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            1. Scan Students
          </button>
          <button
            type="button"
            onClick={() => {
              setInputOption('upload');
              setError(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              inputOption === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            2. Upload Students' Image
          </button>
        </div>
      </div>

      {/* Target Lecture Context Bar (compact, never blocks camera from activating) */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-slate-100 text-slate-700 shrink-0">
              <Presentation className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Active Lecture</p>
              {activeLecture ? (
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-900">{activeLecture.title}</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {activeLecture.room}
                  </span>
                </div>
              ) : (
                <p className="text-xs font-medium text-amber-700 mt-0.5">
                  You can start scanning now — create or select a lecture before saving.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {lectures.length > 0 && (
              <select
                value={selectedLectureId}
                onChange={(e) => setSelectedLectureId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-xs"
              >
                {lectures.map((lec) => (
                  <option key={lec._id} value={lec._id}>
                    {lec.title} ({lec.room})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowNewLectureForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {showNewLectureForm ? 'Close' : 'New Lecture'}
            </button>
          </div>
        </div>

        {showNewLectureForm && (
          <form
            onSubmit={handleCreateLectureInline}
            className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lecture Title
              </label>
              <input
                type="text"
                required
                value={newLectureTitle}
                onChange={(e) => setNewLectureTitle(e.target.value)}
                placeholder="e.g. Week 5: Neural Networks"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Held
              </label>
              <input
                type="text"
                required
                value={newLectureRoom}
                onChange={(e) => setNewLectureRoom(e.target.value)}
                placeholder="e.g. Block B · Room 204"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={creatingLecture}
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors"
              >
                {creatingLecture ? 'Creating...' : 'Create & Select'}
              </button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {students.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-2">
          <p className="text-base font-semibold text-slate-900">No students enrolled yet</p>
          <p className="text-sm text-slate-500">
            Share your course enrollment code with students so they can enroll before recording
            attendance.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT WORKSPACE: Option 1 (Live Camera) or Option 2 (Upload Images) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            {/* Sub-Mode Toggle: One-by-One vs Lecture Room */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {inputOption === 'camera'
                    ? 'Scan Students (Live Camera)'
                    : "Upload Students' Image"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {inputOption === 'camera'
                    ? 'Scan individual faces or the lecture room as many times as needed — matches accumulate automatically.'
                    : 'Upload single student photos or lecture room photos as many times as needed — matches accumulate automatically.'}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setScanMode('single_live')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    scanMode === 'single_live'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  One-by-One
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('classroom_group')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    scanMode === 'classroom_group'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Lecture Room
                </button>
              </div>
            </div>

            {inputOption === 'camera' ? (
              /* OPTION 1: ACTIVE LIVE CAMERA (unlimited scans, one-by-one or lecture room) */
              <CameraCapture
                onCapture={handleCameraCapture}
                captureLabel={
                  scanMode === 'classroom_group'
                    ? 'Scan Lecture Room'
                    : 'Scan Student Face'
                }
                initialFacingMode="user"
                isBusy={verifying}
                showUploadButton={false}
                aspectClass={scanMode === 'classroom_group' ? 'aspect-video' : 'aspect-[4/3]'}
              />
            ) : (
              /* OPTION 2: UPLOAD STUDENTS' IMAGE FOR SCANNING (unlimited uploads, multi-file supported) */
              <div className="space-y-4">
                <div
                  onClick={() => !verifying && uploadInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    verifying
                      ? 'border-slate-200 bg-slate-50 cursor-wait'
                      : 'border-slate-300 hover:border-blue-600 hover:bg-blue-50/30 cursor-pointer'
                  }`}
                >
                  <div className="mx-auto w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-3">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {verifying
                      ? `Scanning uploaded image ${uploadProgress.current} of ${uploadProgress.total}...`
                      : scanMode === 'classroom_group'
                      ? 'Click to upload lecture room photo(s)'
                      : 'Click to upload student photo(s)'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Select one or multiple images per batch. You can continue uploading additional
                    photos as many times as needed.
                  </p>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={(e) => {
                      e.stopPropagation();
                      uploadInputRef.current?.click();
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-md transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {verifying ? 'Scanning...' : 'Select Image(s) to Scan'}
                  </button>
                </div>

                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesUpload}
                />

                {uploadProgress.lastPreview && (
                  <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <img
                      src={uploadProgress.lastPreview}
                      alt="Last uploaded scan frame"
                      referrerPolicy="no-referrer"
                      className="w-20 h-14 object-cover rounded border border-slate-200 shrink-0"
                    />
                    <div className="text-xs text-slate-600">
                      <p className="font-semibold text-slate-900">Last Uploaded Image Processed</p>
                      <p className="font-mono mt-0.5 tabular-nums">
                        Compressed {getBase64SizeKb(uploadProgress.lastPreview)} KB · Ready for
                        more uploads
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instant Feedback Card */}
            {feedback && (
              <div
                className={`p-4 rounded-lg border flex items-start gap-4 ${
                  feedback.type === 'verified' || feedback.type === 'group_summary'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : feedback.type === 'duplicate'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-red-50 border-red-200 text-red-950'
                }`}
              >
                {feedback.faceImageBase64 ? (
                  <img
                    src={feedback.faceImageBase64}
                    alt={feedback.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-lg object-cover border border-black/10 shrink-0"
                  />
                ) : (
                  <div className="p-2.5 rounded-lg bg-white/70 shrink-0">
                    {feedback.type === 'unrecognized' ? (
                      <XCircle className="w-6 h-6 text-red-600" />
                    ) : feedback.type === 'duplicate' ? (
                      <AlertTriangle className="w-6 h-6 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold">{feedback.title}</span>
                    {typeof feedback.confidence === 'number' && (
                      <span className="font-mono text-xs font-semibold tabular-nums">
                        {feedback.confidence}% match
                      </span>
                    )}
                  </div>
                  {feedback.regNumber && (
                    <p className="font-mono text-xs mt-0.5 opacity-80">
                      Reg No: {feedback.regNumber}
                    </p>
                  )}
                  <p className="text-xs mt-1">{feedback.detail}</p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT WORKSPACE: Active Session Roster & Review / Save */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Attendance Roster
                </h3>
                <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                  Present: <span className="font-semibold text-emerald-700">{presentCount}</span> ·
                  Absent: <span className="font-semibold text-slate-700">{absentCount}</span> ·
                  Scans: <span className="font-mono">{scanCount}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleFinalizeSession}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save & Finalize'}
              </button>
            </div>

            <div className="divide-y divide-slate-200 max-h-[560px] overflow-y-auto">
              {students.map((student) => {
                const rec = recordsMap[student._id];
                const isPresent = rec?.status === 'Present';
                return (
                  <div
                    key={student._id}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {student.faceImageBase64 ? (
                        <img
                          src={student.faceImageBase64}
                          alt={student.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {student.name}
                        </p>
                        <p className="text-xs font-mono text-slate-500 truncate">
                          {student.regNumber}
                          {isPresent && rec.confidenceScore > 0
                            ? ` · ${rec.confidenceScore}%`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPresent}
                      onClick={() => toggleStudentStatus(student._id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                        isPresent
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {isPresent ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Present
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          Absent
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
