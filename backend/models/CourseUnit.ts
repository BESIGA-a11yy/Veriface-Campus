import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICourseUnit extends Document {
  courseCode: string;
  courseName: string;
  departmentId: Types.ObjectId;
  lecturerId: Types.ObjectId;
  classRepIds: Types.ObjectId[];
  enrolledStudentIds: Types.ObjectId[];
  enrollmentCode: string;
  semester: string;
  createdAt: Date;
}

const CourseUnitSchema = new Schema<ICourseUnit>({
  courseCode: { type: String, required: true, uppercase: true, trim: true },
  courseName: { type: String, required: true, trim: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  lecturerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  classRepIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  enrolledStudentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  enrollmentCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  semester: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

export const CourseUnit =
  mongoose.models.CourseUnit || mongoose.model<ICourseUnit>('CourseUnit', CourseUnitSchema);
