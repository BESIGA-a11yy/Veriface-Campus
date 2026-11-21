import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isDatabaseReady } from '../config/db.ts';
import { User, type UserRole } from '../models/User.ts';

export interface AuthPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    departmentId?: string;
    regNumber?: string;
    staffId?: string;
    courseProgram?: string;
  };
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'veriface-campus-dev-jwt-secret-key';
}

export function signAuthToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function requireDatabase(_req: Request, res: Response, next: NextFunction): void {
  if (!isDatabaseReady()) {
    res.status(503).json({
      error:
        'MongoDB Atlas is not connected. Configure MONGODB_URI in your environment variables and restart the server.',
    });
    return;
  }
  next();
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication token is required.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;

    const dbUser = await User.findById(decoded.userId).select('-passwordHash -faceImageBase64');
    if (!dbUser) {
      res.status(401).json({ error: 'User account no longer exists.' });
      return;
    }

    req.user = {
      id: dbUser._id.toString(),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      departmentId: dbUser.departmentId ? dbUser.departmentId.toString() : undefined,
      regNumber: dbUser.regNumber,
      staffId: dbUser.staffId,
      courseProgram: dbUser.courseProgram,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}
