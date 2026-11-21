import { Router, type Response } from 'express';
import { CourseUnit } from '../models/CourseUnit.ts';
import { AttendanceSession } from '../models/AttendanceSession.ts';
import { Lecture } from '../models/Lecture.ts';
import { User } from '../models/User.ts';
import {
  requireAuth,
  requireDatabase,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  matchClassroomGroupFaces,
  matchSingleLiveFace,
  type EnrolledStudentFace,
} from '../services/geminiVision.ts';

const router = Router();

router.use(requireDatabase);
router.use(requireAuth);

async function verifyCourseScannerAccess(courseId: string, userId: string, role: string) {
  const course = await CourseUnit.findById(courseId)
    .populate('departmentId', 'name')
    .populate('lecturerId', 'name email staffId');

  if (!course) {
    return { errorStatus: 404, error: 'Course unit not found.', course: null, accessRole: null };
  }

  const isCourseLecturer =
    role === 'lecturer' &&
    ((course.lecturerId as { _id?: { toString(): string } })?._id?.toString() === userId ||
      course.lecturerId.toString() === userId);

  const isAssignedClassRep =
    role === 'student' &&
    course.classRepIds.some((repId: { toString(): string }) => repId.toString() === userId);

  if (!isCourseLecturer && !isAssignedClassRep) {
    return {
      errorStatus: 403,
      error: 'Access denied. Only the course Lecturer or an assigned Class Representative can access attendance scanning.',
      course: null,
      accessRole: null,
    };
  }

  return {
    errorStatus: 200,
    error: null,
    course,
    accessRole: isCourseLecturer ? 'lecturer' : 'class_rep',
  };
}

// Fetch enrolled students' reference headshots and metadata for a course unit
router.get(
  '/course/:courseId/enrolled-faces',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseId } = req.params;
      const access = await verifyCourseScannerAccess(courseId, req.user!.id, req.user!.role);
      if (access.error || !access.course) {
        res.status(access.errorStatus).json({ error: access.error });
        return;
      }

      const [students, lectures] = await Promise.all([
        User.find({
          _id: { $in: access.course.enrolledStudentIds },
          role: 'student',
        })
          .select('_id name regNumber courseProgram faceImageBase64')
          .sort({ name: 1 }),
        Lecture.find({ courseUnitId: access.course._id }).sort({ createdAt: -1 }),
      ]);

      res.json({
        course: {
          _id: access.course._id,
          courseCode: access.course.courseCode,
          courseName: access.course.courseName,
          semester: access.course.semester,
          departmentId: access.course.departmentId,
        },
        lectures: lectures.map((l) => ({
          _id: l._id.toString(),
          title: l.title,
          room: l.room,
          scheduledAt: l.scheduledAt,
          createdAt: l.createdAt,
        })),
        students: students.map((s) => ({
          _id: s._id.toString(),
          name: s.name,
          regNumber: s.regNumber || 'N/A',
          courseProgram: s.courseProgram || '',
          faceImageBase64: s.faceImageBase64 || '',
        })),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load enrolled faces.';
      res.status(500).json({ error: message });
    }
  }
);

// Run Gemini 2.5 Flash facial recognition against enrolled students
router.post(
  '/scan-verify',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseUnitId, imageBase64, mode } = req.body as {
        courseUnitId?: string;
        imageBase64?: string;
        mode?: 'single_live' | 'classroom_group';
      };

      if (!courseUnitId || !imageBase64) {
        res.status(400).json({ error: 'courseUnitId and imageBase64 are required.' });
        return;
      }

      const scanMode = mode === 'classroom_group' ? 'classroom_group' : 'single_live';

      const access = await verifyCourseScannerAccess(courseUnitId, req.user!.id, req.user!.role);
      if (access.error || !access.course) {
        res.status(access.errorStatus).json({ error: access.error });
        return;
      }

      const students = await User.find({
        _id: { $in: access.course.enrolledStudentIds },
        role: 'student',
      }).select('_id name regNumber faceImageBase64');

      const enrolledWithFaces: EnrolledStudentFace[] = students
        .filter((s) => Boolean(s.faceImageBase64))
        .map((s) => ({
          studentId: s._id.toString(),
          studentName: s.name,
          regNumber: s.regNumber || 'N/A',
          faceImageBase64: s.faceImageBase64!,
        }));

      if (enrolledWithFaces.length === 0) {
        res.status(400).json({
          error: 'No enrolled students with reference headshots found in this course unit.',
        });
        return;
      }

      if (scanMode === 'classroom_group') {
        const matches = await matchClassroomGroupFaces(imageBase64, enrolledWithFaces);
        res.json({ mode: 'classroom_group', matches });
        return;
      }

      const result = await matchSingleLiveFace(imageBase64, enrolledWithFaces);
      res.json({ mode: 'single_live', ...result });
    } catch (error: unknown) {
      console.error('[Gemini Scan Verify Error]', error);
      const message =
        error instanceof Error ? error.message : 'Facial verification service failed.';
      res.status(500).json({ error: message });
    }
  }
);

// Save finalized attendance session to MongoDB
router.post(
  '/save-session',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseUnitId, lectureId, scanMode, groupPhotoBase64, records } = req.body as {
        courseUnitId?: string;
        lectureId?: string;
        scanMode?: 'single_live' | 'classroom_group';
        groupPhotoBase64?: string;
        records?: Array<{
          studentId: string;
          regNumber: string;
          studentName: string;
          status: 'Present' | 'Absent';
          confidenceScore?: number;
          matchedAt?: string | Date;
        }>;
      };

      if (!courseUnitId || !scanMode || !Array.isArray(records)) {
        res.status(400).json({
          error: 'courseUnitId, scanMode, and records array are required.',
        });
        return;
      }

      const access = await verifyCourseScannerAccess(courseUnitId, req.user!.id, req.user!.role);
      if (access.error || !access.course) {
        res.status(access.errorStatus).json({ error: access.error });
        return;
      }

      let lectureTitle: string | undefined;
      let lectureRoom: string | undefined;
      let validLectureId: string | undefined;

      if (lectureId) {
        const lecture = await Lecture.findOne({
          _id: lectureId,
          courseUnitId: access.course._id,
        });
        if (!lecture) {
          res.status(404).json({ error: 'Selected lecture was not found for this course unit.' });
          return;
        }
        validLectureId = lecture._id.toString();
        lectureTitle = lecture.title;
        lectureRoom = lecture.room;
      }

      const normalizedRecords = records.map((r) => ({
        studentId: r.studentId,
        regNumber: r.regNumber,
        studentName: r.studentName,
        status: r.status === 'Present' ? ('Present' as const) : ('Absent' as const),
        confidenceScore: Number(r.confidenceScore) || 0,
        matchedAt: r.status === 'Present' ? r.matchedAt || new Date() : undefined,
      }));

      const session = await AttendanceSession.create({
        courseUnitId: access.course._id,
        lectureId: validLectureId,
        lectureTitle,
        lectureRoom,
        date: new Date(),
        takenByUid: req.user!.id,
        takenByRole: access.accessRole === 'class_rep' ? 'Class Rep' : 'Lecturer',
        scanMode,
        groupPhotoBase64: scanMode === 'classroom_group' ? groupPhotoBase64 : undefined,
        records: normalizedRecords,
      });

      const populated = await AttendanceSession.findById(session._id)
        .populate('takenByUid', 'name email regNumber staffId')
        .populate('lectureId', 'title room scheduledAt');

      res.status(201).json({ session: populated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save attendance session.';
      res.status(500).json({ error: message });
    }
  }
);

// Course attendance history (Lecturer & assigned Class Rep)
router.get(
  '/course/:courseId/history',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseId } = req.params;
      const access = await verifyCourseScannerAccess(courseId, req.user!.id, req.user!.role);
      if (access.error || !access.course) {
        res.status(access.errorStatus).json({ error: access.error });
        return;
      }

      const sessions = await AttendanceSession.find({ courseUnitId: courseId })
        .populate('takenByUid', 'name email regNumber staffId')
        .populate('lectureId', 'title room scheduledAt')
        .sort({ date: -1 });

      res.json({ sessions });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch attendance history.';
      res.status(500).json({ error: message });
    }
  }
);

// Lecturer edits a saved attendance session's records
router.put(
  '/session/:sessionId',
  requireRole('lecturer'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { records } = req.body as {
        records?: Array<{
          studentId: string;
          status: 'Present' | 'Absent';
        }>;
      };

      if (!Array.isArray(records)) {
        res.status(400).json({ error: 'records array is required.' });
        return;
      }

      const session = await AttendanceSession.findById(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Attendance session not found.' });
        return;
      }

      const course = await CourseUnit.findById(session.courseUnitId);
      if (!course || course.lecturerId.toString() !== req.user!.id) {
        res.status(403).json({
          error: 'Only the course lecturer can edit attendance records.',
        });
        return;
      }

      const statusMap = new Map<string, 'Present' | 'Absent'>(
        records.map((r) => [r.studentId, r.status])
      );
      session.records = session.records.map((rec: {
        studentId: { toString(): string };
        regNumber: string;
        studentName: string;
        status: 'Present' | 'Absent';
        confidenceScore: number;
        matchedAt?: Date;
      }) => {
        const nextStatus = statusMap.get(rec.studentId.toString());
        if (nextStatus === 'Present' || nextStatus === 'Absent') {
          rec.status = nextStatus;
          if (nextStatus === 'Present' && !rec.matchedAt) {
            rec.matchedAt = new Date();
          }
        }
        return rec;
      });

      await session.save();

      const populated = await AttendanceSession.findById(session._id).populate(
        'takenByUid',
        'name email regNumber staffId'
      );

      res.json({ session: populated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update session records.';
      res.status(500).json({ error: message });
    }
  }
);

// Student personal attendance history across enrolled course units
router.get(
  '/student/my-history',
  requireRole('student'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const studentId = req.user!.id;

      const enrolledCourses = await CourseUnit.find({ enrolledStudentIds: studentId })
        .populate('departmentId', 'name')
        .populate('lecturerId', 'name email');

      const courseIds = enrolledCourses.map((c) => c._id);

      const sessions = await AttendanceSession.find({
        courseUnitId: { $in: courseIds },
      })
        .select('-groupPhotoBase64')
        .populate('courseUnitId', 'courseCode courseName semester')
        .populate('lectureId', 'title room scheduledAt')
        .populate('takenByUid', 'name')
        .sort({ date: -1 });

      const history = sessions
        .map((session) => {
          const myRecord = session.records.find(
            (r: { studentId: { toString(): string } }) => r.studentId.toString() === studentId
          );
          if (!myRecord) return null;

          const courseObj = session.courseUnitId as unknown as {
            _id: string;
            courseCode: string;
            courseName: string;
            semester: string;
          };

          const lectureObj = session.lectureId as unknown as {
            title?: string;
            room?: string;
          } | null;

          return {
            sessionId: session._id.toString(),
            date: session.date,
            scanMode: session.scanMode,
            takenByRole: session.takenByRole,
            takenByName:
              (session.takenByUid as unknown as { name?: string })?.name || 'Instructor',
            courseUnitId: courseObj._id.toString(),
            courseCode: courseObj.courseCode,
            courseName: courseObj.courseName,
            semester: courseObj.semester,
            lectureTitle: session.lectureTitle || lectureObj?.title || undefined,
            lectureRoom: session.lectureRoom || lectureObj?.room || undefined,
            status: myRecord.status,
            confidenceScore: myRecord.confidenceScore,
            matchedAt: myRecord.matchedAt,
          };
        })
        .filter(Boolean);

      res.json({ history });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load student attendance history.';
      res.status(500).json({ error: message });
    }
  }
);

export default router;
