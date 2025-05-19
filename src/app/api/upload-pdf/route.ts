// src/app/api/upload-pdf/route.ts
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse'; // npm install pdf-parse
                             // npm install @types/pdf-parse -D (for TypeScript types)

// Ensure `types: ["node"]` is in tsconfig.json if Buffer is unrecognized

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    // Validate file presence
    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided.' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid file type. Only PDF is allowed.' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Parse PDF from buffer
    const data = await pdf(fileBuffer);

    // Optional: Enforce content size limits for performance/security
    // const MAX_TEXT_LENGTH = 50000;
    // if (data.text.length > MAX_TEXT_LENGTH) {
    //   return NextResponse.json({ error: 'PDF content is too large.' }, { status: 413 });
    // }

    return NextResponse.json({ text: data.text });

  } catch (error: any) {
    console.error('PDF parsing error:', error);

    if (error.message?.includes('Invalid PDF')) {
      return NextResponse.json({ error: 'Invalid or corrupted PDF file.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to parse PDF. ' + error.message }, { status: 500 });
  }
}
