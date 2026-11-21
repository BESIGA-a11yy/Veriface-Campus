import mongoose, { Schema, Document, Types } from 'mongoose';

export type ScanMode = 'single_live' | 'classroom_group';
export type AttendanceStatus = 'Present' | 'Absent';

export interface IAttendanceRecord {
  studentId: Types.ObjectId;
  regNumber: string;
  studentName: string;
  status: AttendanceStatus;
  confidenceScore: number;
  matchedAt?: Date;
}

export interface IAttendanceSession extends Document {
  courseUnitId: Types.ObjectId;
  lectureId?: Types.ObjectId;
  lectureTitle?: string;
  lectureRoom?: string;
  date: Date;
  takenByUid: Types.ObjectId;
  takenByRole: string;
  scanMode: ScanMode;
  groupPhotoBase64?: string;
  records: IAttendanceRecord[];
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    regNumber: { type: String, required: true },
    studentName: { type: String, required: true },
    status: { type: String, enum: ['Present', 'Absent'], required: true },
    confidenceScore: { type: Number, default: 0 },
    matchedAt: { type: Date },
  },
  { _id: false }
);

const AttendanceSessionSchema = new Schema<IAttendanceSession>({
  courseUnitId: { type: Schema.Types.ObjectId, ref: 'CourseUnit', required: true },
  lectureId: { type: Schema.Types.ObjectId, ref: 'Lecture' },
  lectureTitle: { type: String, trim: true },
  lectureRoom: { type: String, trim: true },
  date: { type: Date, default: Date.now },
  takenByUid: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  takenByRole: { type: String, required: true },
  scanMode: { type: String, enum: ['single_live', 'classroom_group'], required: true },
  groupPhotoBase64: { type: String },
  records: [AttendanceRecordSchema],
});

export const AttendanceSession =
  mongoose.models.AttendanceSession ||
  mongoose.model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
