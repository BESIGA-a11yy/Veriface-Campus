export type UserRole = 'admin' | 'lecturer' | 'student';

export interface Department {
  _id: string;
  name: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string;
  department?: { _id: string; name: string } | null;
  regNumber?: string;
  staffId?: string;
  courseProgram?: string;
  hasFacePhoto?: boolean;
  faceImageBase64?: string;
  classRepCourseIds?: string[];
}

export interface LecturerUser {
  _id: string;
  name: string;
  email: string;
  staffId: string;
  departmentId?: { _id: string; name: string };
  createdAt: string;
}

export interface EnrolledStudentSummary {
  _id: string;
  name: string;
  email: string;
  regNumber: string;
  courseProgram?: string;
}

export interface CourseUnit {
  _id: string;
  courseCode: string;
  courseName: string;
  departmentId: { _id: string; name: string } | string;
  lecturerId: { _id: string; name: string; email: string; staffId?: string } | string;
  classRepIds: Array<{ _id: string; name: string; email: string; regNumber?: string } | string>;
  enrolledStudentIds: EnrolledStudentSummary[] | string[];
  enrollmentCode: string;
  semester: string;
  createdAt: string;
  isClassRep?: boolean;
  enrolledCount?: number;
}

export interface EnrolledFaceStudent {
  _id: string;
  name: string;
  regNumber: string;
  courseProgram: string;
  faceImageBase64: string;
}

export interface AttendanceRecord {
  studentId: string;
  regNumber: string;
  studentName: string;
  status: 'Present' | 'Absent';
  confidenceScore: number;
  matchedAt?: string;
}

export interface LectureSummarySession {
  _id: string;
  date: string;
  scanMode: 'single_live' | 'classroom_group';
  presentCount: number;
  totalCount: number;
}

export interface Lecture {
  _id: string;
  courseUnitId: string;
  title: string;
  room: string;
  createdByRole: string;
  scheduledAt: string;
  createdAt: string;
  attendanceSession?: LectureSummarySession | null;
}

export interface AttendanceSession {
  _id: string;
  courseUnitId: string;
  lectureId?: { _id: string; title: string; room: string; scheduledAt: string } | string;
  lectureTitle?: string;
  lectureRoom?: string;
  date: string;
  takenByUid: { _id: string; name: string; email: string; regNumber?: string; staffId?: string } | string;
  takenByRole: string;
  scanMode: 'single_live' | 'classroom_group';
  groupPhotoBase64?: string;
  records: AttendanceRecord[];
}

export interface StudentHistoryItem {
  sessionId: string;
  date: string;
  scanMode: 'single_live' | 'classroom_group';
  takenByRole: string;
  takenByName: string;
  courseUnitId: string;
  courseCode: string;
  courseName: string;
  semester: string;
  lectureTitle?: string;
  lectureRoom?: string;
  status: 'Present' | 'Absent';
  confidenceScore: number;
  matchedAt?: string;
}

export interface SingleScanResponse {
  mode: 'single_live';
  matched: boolean;
  studentId: string | null;
  studentName: string | null;
  regNumber: string | null;
  confidence: number;
}

export interface GroupMatchItem {
  studentId: string;
  studentName: string;
  regNumber: string;
  confidence: number;
}

export interface GroupScanResponse {
  mode: 'classroom_group';
  matches: GroupMatchItem[];
}
