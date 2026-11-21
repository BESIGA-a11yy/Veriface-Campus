import { GoogleGenAI, Type } from '@google/genai';

export interface EnrolledStudentFace {
  studentId: string;
  studentName: string;
  regNumber: string;
  faceImageBase64: string;
}

export interface SingleMatchResult {
  matched: boolean;
  studentId: string | null;
  studentName: string | null;
  regNumber: string | null;
  confidence: number;
}

export interface GroupMatchItem {
  studentId: string;
  studentName: string;
  regNumber: string;
  confidence: number;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseBase64DataUrl(input: string): { mimeType: string; data: string } {
  const trimmed = input.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(trimmed);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return {
    mimeType: 'image/jpeg',
    data: trimmed,
  };
}

function buildReferenceParts(students: EnrolledStudentFace[]) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  parts.push({
    text: `Below are ${students.length} enrolled student reference headshots for this course unit. Each reference photo is immediately preceded by its exact student metadata.`,
  });

  students.forEach((student, idx) => {
    const parsed = parseBase64DataUrl(student.faceImageBase64);
    parts.push({
      text: `Reference #${idx + 1}: studentId="${student.studentId}", studentName="${student.studentName}", regNumber="${student.regNumber}"`,
    });
    parts.push({
      inlineData: {
        mimeType: parsed.mimeType,
        data: parsed.data,
      },
    });
  });

  return parts;
}

export async function matchSingleLiveFace(
  capturedImageBase64: string,
  enrolledStudents: EnrolledStudentFace[]
): Promise<SingleMatchResult> {
  if (enrolledStudents.length === 0) {
    return {
      matched: false,
      studentId: null,
      studentName: null,
      regNumber: null,
      confidence: 0,
    };
  }

  const ai = getGeminiClient();
  const capturedParsed = parseBase64DataUrl(capturedImageBase64);

  const parts = [
    ...buildReferenceParts(enrolledStudents),
    {
      text: 'TARGET LIVE FRAME TO IDENTIFY: Compare the single person in this live camera frame against all enrolled student reference photos above.',
    },
    {
      inlineData: {
        mimeType: capturedParsed.mimeType,
        data: capturedParsed.data,
      },
    },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction:
        'You are a strict university biometric attendance verification engine. ' +
        'Your task is to identify the single person visible in the TARGET LIVE FRAME by comparing their facial features (eyes, eyebrows, nose bridge, jawline, mouth, and overall facial geometry) against the labeled enrolled student reference headshots. ' +
        'Ignore differences in lighting, camera angle, glasses, or clothing. ' +
        'Only return matched: true if you are confident the person in the target frame is one of the enrolled students, using their exact studentId, studentName, and regNumber from the reference labels and a confidence score from 0 to 100. ' +
        'If no face is clearly visible, if the image is obscured, or if the person does not match any enrolled student reference, return matched: false, studentId: null, studentName: null, regNumber: null, confidence: 0.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matched: { type: Type.BOOLEAN },
          studentId: { type: Type.STRING, nullable: true },
          studentName: { type: Type.STRING, nullable: true },
          regNumber: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER },
        },
        required: ['matched', 'studentId', 'studentName', 'regNumber', 'confidence'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as SingleMatchResult;

  if (!parsed.matched || !parsed.studentId) {
    return {
      matched: false,
      studentId: null,
      studentName: null,
      regNumber: null,
      confidence: 0,
    };
  }

  // Validate against actual enrolled students so no invalid ID can be returned
  const validStudent = enrolledStudents.find((s) => s.studentId === parsed.studentId);
  if (!validStudent) {
    return {
      matched: false,
      studentId: null,
      studentName: null,
      regNumber: null,
      confidence: 0,
    };
  }

  const clampedConfidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));

  return {
    matched: true,
    studentId: validStudent.studentId,
    studentName: validStudent.studentName,
    regNumber: validStudent.regNumber,
    confidence: clampedConfidence,
  };
}

export async function matchClassroomGroupFaces(
  classroomImageBase64: string,
  enrolledStudents: EnrolledStudentFace[]
): Promise<GroupMatchItem[]> {
  if (enrolledStudents.length === 0) {
    return [];
  }

  const ai = getGeminiClient();
  const capturedParsed = parseBase64DataUrl(classroomImageBase64);

  const parts = [
    ...buildReferenceParts(enrolledStudents),
    {
      text: 'TARGET LECTURE ROOM GROUP PHOTO: Scan the entire classroom photo, detect every visible student face, and match each detected student against the enrolled student reference photos above.',
    },
    {
      inlineData: {
        mimeType: capturedParsed.mimeType,
        data: capturedParsed.data,
      },
    },
  ];

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction:
        'You are a strict university biometric attendance engine for lecture halls. ' +
        'Scan the entire TARGET LECTURE ROOM GROUP PHOTO, detect every visible student face across all rows and seats, and match each face against the labeled enrolled student reference photos. ' +
        'Return a JSON array of matched enrolled students. Each item must use the exact studentId, studentName, and regNumber from the reference labels, plus a confidence score between 0 and 100. ' +
        'Never include the same studentId more than once. Never invent or guess students who are not clearly matched. If no enrolled students are matched, return an empty array [].',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            studentId: { type: Type.STRING },
            studentName: { type: Type.STRING },
            regNumber: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ['studentId', 'studentName', 'regNumber', 'confidence'],
        },
      },
    },
  });

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as GroupMatchItem[];

  if (!Array.isArray(parsed)) {
    return [];
  }

  const enrolledMap = new Map(enrolledStudents.map((s) => [s.studentId, s]));
  const deduplicated = new Map<string, GroupMatchItem>();

  for (const item of parsed) {
    if (!item?.studentId) continue;
    const validStudent = enrolledMap.get(item.studentId);
    if (!validStudent) continue;

    const confidence = Math.max(0, Math.min(100, Math.round(Number(item.confidence) || 0)));
    const existing = deduplicated.get(validStudent.studentId);
    if (!existing || confidence > existing.confidence) {
      deduplicated.set(validStudent.studentId, {
        studentId: validStudent.studentId,
        studentName: validStudent.studentName,
        regNumber: validStudent.regNumber,
        confidence,
      });
    }
  }

  return Array.from(deduplicated.values());
}
