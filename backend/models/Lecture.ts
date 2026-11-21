import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILecture extends Document {
  courseUnitId: Types.ObjectId;
  title: string;
  room: string;
  createdByUid: Types.ObjectId;
  createdByRole: string;
  scheduledAt: Date;
  createdAt: Date;
}

const LectureSchema = new Schema<ILecture>({
  courseUnitId: { type: Schema.Types.ObjectId, ref: 'CourseUnit', required: true },
  title: { type: String, required: true, trim: true },
  room: { type: String, required: true, trim: true },
  createdByUid: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdByRole: { type: String, required: true },
  scheduledAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const Lecture =
  mongoose.models.Lecture || mongoose.model<ILecture>('Lecture', LectureSchema);
