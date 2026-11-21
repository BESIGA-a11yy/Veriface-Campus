import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';
import { CourseUnit } from '../models/CourseUnit.ts';
import {
  requireAuth,
  requireDatabase,
  signAuthToken,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

router.use(requireDatabase);

router.post('/register-student', async (req, res: Response): Promise<void> => {
  try {
    const { name, regNumber, courseProgram, email, password, faceImageBase64 } = req.body;

    if (!name || !regNumber || !courseProgram || !email || !password || !faceImageBase64) {
      res.status(400).json({
        error:
          'All fields are required: full name, registration number, course/program, email, password, and a reference headshot photo.',
      });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedReg = String(regNumber).trim().toUpperCase();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const existingReg = await User.findOne({ regNumber: normalizedReg });
    if (existingReg) {
      res.status(409).json({ error: 'A student with this registration number already exists.' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const student = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'student',
      regNumber: normalizedReg,
      courseProgram: String(courseProgram).trim(),
      faceImageBase64: String(faceImageBase64),
    });

    const token = signAuthToken({
      userId: student._id.toString(),
      role: student.role,
      email: student.email,
    });

    res.status(201).json({
      token,
      user: {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        role: student.role,
        regNumber: student.regNumber,
        courseProgram: student.courseProgram,
        hasFacePhoto: Boolean(student.faceImageBase64),
        classRepCourseIds: [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Student registration failed.';
    res.status(500).json({ error: message });
  }
});

router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    let classRepCourseIds: string[] = [];
    if (user.role === 'student') {
      const repCourses = await CourseUnit.find({ classRepIds: user._id }).select('_id');
      classRepCourseIds = repCourses.map((c) => c._id.toString());
    }

    const token = signAuthToken({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId ? user.departmentId.toString() : undefined,
        regNumber: user.regNumber,
        staffId: user.staffId,
        courseProgram: user.courseProgram,
        hasFacePhoto: Boolean(user.faceImageBase64),
        classRepCourseIds,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    res.status(500).json({ error: message });
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const dbUser = await User.findById(req.user.id)
      .select('-passwordHash')
      .populate('departmentId', 'name');

    if (!dbUser) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    let classRepCourseIds: string[] = [];
    if (dbUser.role === 'student') {
      const repCourses = await CourseUnit.find({ classRepIds: dbUser._id }).select('_id');
      classRepCourseIds = repCourses.map((c) => c._id.toString());
    }

    res.json({
      user: {
        id: dbUser._id.toString(),
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        department: dbUser.departmentId || null,
        departmentId:
          dbUser.departmentId && typeof dbUser.departmentId === 'object' && '_id' in dbUser.departmentId
            ? dbUser.departmentId._id.toString()
            : dbUser.departmentId?.toString(),
        regNumber: dbUser.regNumber,
        staffId: dbUser.staffId,
        courseProgram: dbUser.courseProgram,
        hasFacePhoto: Boolean(dbUser.faceImageBase64),
        faceImageBase64: dbUser.role === 'student' ? dbUser.faceImageBase64 : undefined,
        classRepCourseIds,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load profile.';
    res.status(500).json({ error: message });
  }
});

export default router;
