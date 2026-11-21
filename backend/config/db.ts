import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';
import { Department } from '../models/Department.ts';

let isConnected = false;

export async function connectDatabase(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn(
      '[Database] MONGODB_URI is not configured. API routes requiring MongoDB will return 503 until configured.'
    );
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('[Database] Connected to MongoDB Atlas.');

    // Drop legacy unique index on Department.code if it exists
    try {
      const indexes = await Department.collection.indexes();
      if (indexes.some((idx) => idx.name === 'code_1')) {
        await Department.collection.dropIndex('code_1');
        console.log('[Database] Dropped legacy departments.code_1 index.');
      }
    } catch {
      // Collection may not exist yet; ignore
    }

    await seedDefaultAdmin();
    return true;
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error);
    isConnected = false;
    return false;
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

async function seedDefaultAdmin(): Promise<void> {
  const configuredEmail = process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  if (configuredEmail && configuredPassword) {
    const existingConfigured = await User.findOne({ email: configuredEmail });
    if (!existingConfigured) {
      const passwordHash = await bcrypt.hash(configuredPassword, 10);
      await User.create({
        name: 'System Administrator',
        email: configuredEmail,
        passwordHash,
        role: 'admin',
        staffId: 'SYS-ADMIN-001',
      });
      console.log(`[Seed] System Admin created (${configuredEmail}).`);
    }
    return;
  }

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    return;
  }

  const defaultEmail = 'admin@veriface.edu';
  const defaultPassword = 'Admin@2026';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await User.create({
    name: 'System Administrator',
    email: defaultEmail,
    passwordHash,
    role: 'admin',
    staffId: 'SYS-ADMIN-001',
  });

  console.log(`[Seed] Default System Admin created (${defaultEmail}).`);
}
