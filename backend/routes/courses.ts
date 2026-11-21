import { Router, type Response } from 'express';
import crypto from 'crypto';
import { CourseUnit } from '../models/CourseUnit.ts';
import { Department } from '../models/Department.ts';
import { Lecture } from '../models/Lecture.ts';
import { AttendanceSession } from '../models/AttendanceSession.ts';
import {
  requireAuth,
  requireDatabase,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

router.use(requireDatabase);
router.use(requireAuth);

async function generateUniqueEnrollmentCode(courseCode: string): Promise<string> {
  const prefix = courseCode.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'CRS';
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `${prefix}-${suffix}`;
    const existing = await CourseUnit.findOne({ enrollmentCode: candidate });
    if (!existing) {
      return candidate;
    }
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

// Create Course Unit (Lecturer only)
router.post(
  '/create',
  requireRole('lecturer'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseCode, courseName, departmentId, semester } = req.body;
      if (!courseCode || !courseName || !departmentId || !semester) {
        res.status(400).json({
          error: 'Course code, course name, department, and semester are all required.',
        });
        return;
      }

      const department = await Department.findById(departmentId);
      if (!department) {
        res.status(404).json({ error: 'Selected department does not exist.' });
        return;
      }

      const normalizedCode = String(courseCode).trim().toUpperCase();
      const enrollmentCode = await generateUniqueEnrollmentCode(normalizedCode);

      const course = await CourseUnit.create({
        courseCode: normalizedCode,
        courseName: String(courseName).trim(),
        departmentId: department._id,
        lecturerId: req.user!.id,
        classRepIds: [],
        enrolledStudentIds: [],
        enrollmentCode,
        semester: String(semester).trim(),
      });

      const populated = await CourseUnit.findById(course._id)
        .populate('departmentId', 'name')
        .populate('lecturerId', 'name email staffId')
        .populate('enrolledStudentIds', 'name email regNumber courseProgram')
        .populate('classRepIds', 'name email regNumber');

      res.status(201).json({ course: populated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create course unit.';
      res.status(500).json({ error: message });
    }
  }
);

// Student Enroll via Enrollment Code
router.post(
  '/enroll',
  requireRole('student'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { enrollmentCode } = req.body;
      if (!enrollmentCode) {
        res.status(400).json({ error: 'Enrollment code is required.' });
        return;
      }

      const normalizedCode = String(enrollmentCode).trim().toUpperCase();
      const course = await CourseUnit.findOne({ enrollmentCode: normalizedCode });
      if (!course) {
        res.status(404).json({ error: 'No course unit found with that enrollment code.' });
        return;
      }

      const studentId = req.user!.id;
      const alreadyEnrolled = course.enrolledStudentIds.some(
        (id: { toString(): string }) => id.toString() === studentId
      );

      if (alreadyEnrolled) {
        res.status(409).json({ error: 'You are already enrolled in this course unit.' });
        return;
      }

      course.enrolledStudentIds.push(studentId as unknown as typeof course.enrolledStudentIds[0]);
      await course.save();

      const populated = await CourseUnit.findById(course._id)
        .populate('departmentId', 'name')
        .populate('lecturerId', 'name email staffId');

      res.json({
        message: `Successfully enrolled in ${course.courseCode} — ${course.courseName}.`,
        course: populated,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Enrollment failed.';
      res.status(500).json({ error: message });
    }
  }
);

// Assign or Remove Class Rep (Lecturer who owns the course only)
router.put(
  '/:id/assign-rep',
  requireRole('lecturer'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { studentId, assign } = req.body;

      if (!studentId || typeof assign !== 'boolean') {
        res.status(400).json({ error: 'studentId and assign (boolean) are required.' });
        return;
      }

      const course = await CourseUnit.findById(id);
      if (!course) {
        res.status(404).json({ error: 'Course unit not found.' });
        return;
      }

      if (course.lecturerId.toString() !== req.user!.id) {
        res.status(403).json({ error: 'Only the course lecturer can assign Class Representatives.' });
        return;
      }

      const isEnrolled = course.enrolledStudentIds.some(
        (enrolledId: { toString(): string }) => enrolledId.toString() === studentId
      );
      if (!isEnrolled) {
        res.status(400).json({
          error: 'Only students currently enrolled in this course unit can be assigned as Class Rep.',
        });
        return;
      }

      if (assign) {
        const alreadyRep = course.classRepIds.some(
          (repId: { toString(): string }) => repId.toString() === studentId
        );
        if (!alreadyRep) {
          course.classRepIds.push(studentId);
        }
      } else {
        course.classRepIds = course.classRepIds.filter(
          (repId: { toString(): string }) => repId.toString() !== studentId
        );
      }

      await course.save();

      const updated = await CourseUnit.findById(course._id)
        .populate('departmentId', 'name')
        .populate('lecturerId', 'name email staffId')
        .populate('enrolledStudentIds', 'name email regNumber courseProgram')
        .populate('classRepIds', 'name email regNumber');

      res.json({ course: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update Class Rep.';
      res.status(500).json({ error: message });
    }
  }
);

// Get My Courses (role-aware)
router.get('/my-courses', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    if (user.role === 'lecturer') {
      const courses = await CourseUnit.find({ lecturerId: user.id })
        .populate('departmentId', 'name')
        .populate('lecturerId', 'name email staffId')
        .populate('enrolledStudentIds', 'name email regNumber courseProgram')
        .populate('classRepIds', 'name email regNumber')
        .sort({ createdAt: -1 });

      res.json({ courses });
      return;
    }

    if (user.role === 'student') {
      const courses = await CourseUnit.find({ enrolledStudentIds: user.id })
        .populate('departmentId', 'name')
        .populate('lecturerId', 'name email staffId')
        .sort({ createdAt: -1 });

      const enriched = courses.map((course) => {
        const obj = course.toObject();
        const isClassRep = course.classRepIds.some(
          (repId: { toString(): string }) => repId.toString() === user.id
        );
        return {
          ...obj,
          isClassRep,
          enrolledCount: course.enrolledStudentIds.length,
        };
      });

      res.json({ courses: enriched });
      return;
    }

    // Admin overview
    const courses = await CourseUnit.find()
      .populate('departmentId', 'name')
      .populate('lecturerId', 'name email staffId')
      .sort({ createdAt: -1 });

    res.json({ courses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch courses.';
    res.status(500).json({ error: message });
  }
});

// Create a Lecture within a Course Unit (Lecturer or assigned Class Rep)
router.post(
  '/:courseId/lectures',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseId } = req.params;
      const { title, room, scheduledAt } = req.body as {
        title?: string;
        room?: string;
        scheduledAt?: string;
      };

      if (!title || !String(title).trim() || !room || !String(room).trim()) {
        res.status(400).json({ error: 'Lecture title and room are required.' });
        return;
      }

      const course = await CourseUnit.findById(courseId);
      if (!course) {
        res.status(404).json({ error: 'Course unit not found.' });
        return;
      }

      const userId = req.user!.id;
      const isLecturer =
        req.user!.role === 'lecturer' && course.lecturerId.toString() === userId;
      const isClassRep =
        req.user!.role === 'student' &&
        course.classRepIds.some((repId: { toString(): string }) => repId.toString() === userId);

      if (!isLecturer && !isClassRep) {
        res.status(403).json({
          error: 'Only the course Lecturer or an assigned Class Representative can create lectures.',
        });
        return;
      }

      const lecture = await Lecture.create({
        courseUnitId: course._id,
        title: String(title).trim(),
        room: String(room).trim(),
        createdByUid: userId,
        createdByRole: isLecturer ? 'Lecturer' : 'Class Rep',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      });

      res.status(201).json({
        lecture: {
          ...lecture.toObject(),
          attendanceSession: null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create lecture.';
      res.status(500).json({ error: message });
    }
  }
);

// List Lectures within a Course Unit (Lecturer, Class Rep, or enrolled Student)
router.get(
  '/:courseId/lectures',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { courseId } = req.params;
      const course = await CourseUnit.findById(courseId);
      if (!course) {
        res.status(404).json({ error: 'Course unit not found.' });
        return;
      }

      const userId = req.user!.id;
      const isLecturer =
        req.user!.role === 'lecturer' && course.lecturerId.toString() === userId;
      const isEnrolled =
        req.user!.role === 'student' &&
        course.enrolledStudentIds.some((id: { toString(): string }) => id.toString() === userId);
      const isAdmin = req.user!.role === 'admin';

      if (!isLecturer && !isEnrolled && !isAdmin) {
        res.status(403).json({ error: 'Access denied to this course unit.' });
        return;
      }

      const lectures = await Lecture.find({ courseUnitId: course._id }).sort({ createdAt: -1 });
      const sessions = await AttendanceSession.find({
        courseUnitId: course._id,
        lectureId: { $in: lectures.map((l) => l._id) },
      })
        .select('-groupPhotoBase64')
        .sort({ date: -1 });

      const sessionByLecture = new Map<
        string,
        {
          _id: string;
          date: Date;
          scanMode: string;
          presentCount: number;
          totalCount: number;
        }
      >();

      for (const s of sessions) {
        if (!s.lectureId) continue;
        const key = s.lectureId.toString();
        if (!sessionByLecture.has(key)) {
          const presentCount = s.records.filter(
            (r: { status: string }) => r.status === 'Present'
          ).length;
          sessionByLecture.set(key, {
            _id: s._id.toString(),
            date: s.date,
            scanMode: s.scanMode,
            presentCount,
            totalCount: s.records.length,
          });
        }
      }

      const enriched = lectures.map((lec) => ({
        ...lec.toObject(),
        attendanceSession: sessionByLecture.get(lec._id.toString()) || null,
      }));

      res.json({ lectures: enriched });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch lectures.';
      res.status(500).json({ error: message });
    }
  }
);

export default router;
