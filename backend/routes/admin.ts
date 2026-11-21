import { Router, type Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Department } from '../models/Department.ts';
import { User } from '../models/User.ts';
import {
  requireAuth,
  requireDatabase,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';

const router = Router();

router.use(requireDatabase);
router.use(requireAuth);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function generateUniqueStaffId(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const token = crypto.randomBytes(2).toString('hex').toUpperCase();
    const candidate = `STF-${year}-${token}`;
    const existing = await User.findOne({ staffId: candidate });
    if (!existing) {
      return candidate;
    }
  }
  return `STF-${year}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

// Create Department (Admin only)
router.post(
  '/departments',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name } = req.body;
      if (!name || !String(name).trim()) {
        res.status(400).json({ error: 'Department name is required.' });
        return;
      }

      const cleanName = String(name).trim();
      const existing = await Department.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') },
      });
      if (existing) {
        res.status(409).json({ error: `Department "${cleanName}" already exists.` });
        return;
      }

      const department = await Department.create({
        name: cleanName,
      });

      res.status(201).json({ department });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create department.';
      res.status(500).json({ error: message });
    }
  }
);

// List Departments (Admin & Lecturer)
router.get(
  '/departments',
  requireRole('admin', 'lecturer'),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const departments = await Department.find().sort({ name: 1 });
      res.json({ departments });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch departments.';
      res.status(500).json({ error: message });
    }
  }
);

// Create Lecturer Account with System-Generated Staff ID (Admin only)
router.post(
  '/lecturers',
  requireRole('admin'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, email, departmentId, password } = req.body;
      if (!name || !email || !departmentId || !password) {
        res.status(400).json({
          error: 'Name, email, department, and temporary password are all required.',
        });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const department = await Department.findById(departmentId);
      if (!department) {
        res.status(404).json({ error: 'Selected department was not found.' });
        return;
      }

      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        res.status(409).json({ error: 'A user with this email already exists.' });
        return;
      }

      if (String(password).length < 6) {
        res.status(400).json({ error: 'Temporary password must be at least 6 characters.' });
        return;
      }

      const staffId = await generateUniqueStaffId();
      const passwordHash = await bcrypt.hash(String(password), 10);

      const lecturer = await User.create({
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'lecturer',
        staffId,
        departmentId: department._id,
      });

      const populated = await User.findById(lecturer._id)
        .select('-passwordHash')
        .populate('departmentId', 'name');

      res.status(201).json({ lecturer: populated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create lecturer.';
      res.status(500).json({ error: message });
    }
  }
);

// List Lecturers (Admin only)
router.get(
  '/lecturers',
  requireRole('admin'),
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const lecturers = await User.find({ role: 'lecturer' })
        .select('-passwordHash -faceImageBase64')
        .populate('departmentId', 'name')
        .sort({ createdAt: -1 });
      res.json({ lecturers });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch lecturers.';
      res.status(500).json({ error: message });
    }
  }
);

export default router;
