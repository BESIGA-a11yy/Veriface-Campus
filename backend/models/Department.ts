import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  createdAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>({
  name: { type: String, required: true, unique: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

export const Department =
  mongoose.models.Department || mongoose.model<IDepartment>('Department', DepartmentSchema);
