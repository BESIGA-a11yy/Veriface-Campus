# VeriFace Campus — Automated Student Attendance via Facial Recognition

Full-stack biometric student attendance system built with React, Vite, Tailwind CSS, Express.js, MongoDB Atlas (Mongoose ODM), JWT + bcryptjs RBAC, and the Google Gemini API (`@google/genai` using `gemini-4-hydrogen`).

## Architecture Overview

- **Frontend (`/src`)**: React + TypeScript + Tailwind CSS + Lucide icons.
  - Client-side JPEG compression (`maxWidth: 800px`, `quality: 0.7`) for student headshots and lecture room group photos.
  - Role-based dashboards for **System Admin**, **Lecturer**, **Class Representative**, and **Student**.
  - **Dual-Mode AI Scanner** (`Mode A: One-by-One Live Scan` & `Mode B: Live Lecture Room Group Photo Scan`).
- **Backend (`/backend`, `/server.ts`)**: Node.js + Express + Mongoose ODM + `@google/genai`.
  - Mongoose models in `/backend/models`: `Department`, `User`, `CourseUnit`, `AttendanceSession`.
  - JWT + RBAC middleware in `/backend/middleware/auth.ts`.
  - Gemini Vision matching service in `/backend/services/geminiVision.ts` using `gemini-4-hydrogen`.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env` (or configure secrets in your hosting environment):
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `JWT_SECRET`: Secret key for signing JWT authentication tokens.
   - `GEMINI_API_KEY`: Your Google Gemini API key.

3. **Run the Application**
   - **Integrated Server (Port 3000)**:
     ```bash
     npm run dev
     ```
   - **Split React + Express via Concurrently**:
     ```bash
     npm run dev:split
     ```
   - **Production Build & Start**:
     ```bash
     npm run build
     npm start
     ```

4. **Default Seeded System Admin**
   On server startup, if no `admin` user exists in MongoDB, a default System Admin account is seeded automatically:
   - **Email**: `admin@veriface.edu`
   - **Password**: `Admin@2026`
