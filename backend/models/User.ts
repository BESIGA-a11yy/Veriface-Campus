import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'admin' | 'lecturer' | 'student';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  departmentId?: Types.ObjectId;
  regNumber?: string;
  staffId?: string;
  courseProgram?: string;
  faceImageBase64?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'lecturer', 'student'], required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  regNumber: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  staffId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  courseProgram: { type: String, trim: true },
  faceImageBase64: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
