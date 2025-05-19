// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, BlockReason, FinishReason } from '@google/generative-ai';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  // This will cause a build error or runtime error if not set, which is good.
  // Consider a more graceful startup check in a real app.
  console.error("CRITICAL: Gemini API key is not defined.");
  // For a serverless function, throwing an error here might be okay during init.
  // Or, return an error response if this check is done per-request (less ideal).
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!); // Added '!' assuming it will be checked/present

const generationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048, // For gemini-pro, up to 8192 for gemini-1.5-flash
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  let userIdForDb: string | null = null;
  let originalUserQuery: string = "User query not available"; // For error logging

  if (!GEMINI_API_KEY) {
    console.error('/api/chat: Gemini API key is missing.');
    return NextResponse.json({ error: 'API configuration error. Please contact support.' }, { status: 500 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to chat.' }, { status: 401 });
    }
    userIdForDb = user.id;

    const body = await request.json();
    const { query, pdfText } = body;
    originalUserQuery = query || "User query not available in body";


    if (!query || typeof query !== 'string' || query.trim() === "") {
      return NextResponse.json({ error: 'Query is required and must be a non-empty string.' }, { status: 400 });
    }

    const wasPdfContextUsed = pdfText && typeof pdfText === 'string' && pdfText.trim() !== "";
    let fullPrompt = "";

    if (wasPdfContextUsed) {
      const MAX_PDF_TEXT_LENGTH = 70000; // Roughly 15k-17k tokens
      const truncatedPdfText = pdfText.length > MAX_PDF_TEXT_LENGTH
        ? pdfText.substring(0, MAX_PDF_TEXT_LENGTH) + "\n[...PDF text truncated due to length...]"
        : pdfText;

      fullPrompt = `
        Based on the following document text, please answer the user's question.
        If the answer is not found in the document, state that explicitly.
        Do not make up information not present in the document if the question implies it should come from the document.

        Document Text:
        ---
        ${truncatedPdfText}
        ---

        User Question: ${query}

        Answer:
      `;
    } else {
      fullPrompt = `User Question: ${query}\nAnswer:`;
    }

    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest", // Or "gemini-pro" / "gemini-1.0-pro"
        generationConfig,
        safetySettings,
    });

    const result = await model.generateContent(fullPrompt);

    if (!result || !result.response) {
        console.error("Gemini API did not return a response object. Full result:", JSON.stringify(result, null, 2));
        return NextResponse.json({ error: "Gemini API communication error. No response object." }, { status: 500 });
    }

    const response = result.response; // Alias for convenience
    const responseText = response.text(); // Use the helper

    if (!responseText) {
        // If text is empty, check for block reasons
        let blockReasonMessage = "Response generation failed or was blocked.";
        let statusCode = 400; // Default to Bad Request for blocked content

        const promptFeedback = response.promptFeedback;
        if (promptFeedback?.blockReason === BlockReason.SAFETY) {
            console.warn("Gemini: Response blocked due to SAFETY (promptFeedback). Ratings:", promptFeedback.safetyRatings);
            blockReasonMessage = "Your query was blocked due to safety concerns. Please rephrase.";
        } else if (promptFeedback?.blockReason) {
            console.warn(`Gemini: Prompt processing issue. Reason: ${promptFeedback.blockReason}`);
            blockReasonMessage = `There was an issue with the prompt. Reason: ${promptFeedback.blockReason}.`;
        }

        const firstCandidate = response.candidates?.[0];
        if (firstCandidate?.finishReason === FinishReason.SAFETY) {
            console.warn("Gemini: Response blocked due to SAFETY (candidate finishReason). Safety Ratings:", firstCandidate.safetyRatings);
            blockReasonMessage = "The generated response was blocked due to safety concerns. Please try a different query.";
        } else if (firstCandidate?.finishReason && firstCandidate.finishReason !== FinishReason.STOP) { // STOP is normal
            console.warn(`Gemini: Response generation stopped. Reason: ${firstCandidate.finishReason}`);
            blockReasonMessage = `Response generation incomplete. Reason: ${firstCandidate.finishReason}. Try a shorter query or PDF.`;
        }

        if (blockReasonMessage === "Response generation failed or was blocked.") { // If no specific reason found
            console.warn("Gemini API returned an empty text response. Full response object:", JSON.stringify(response, null, 2));
            blockReasonMessage = "I received an empty response from the AI. Could you try rephrasing?";
            statusCode = 500; // Potentially an internal AI error
        }
        return NextResponse.json({ error: blockReasonMessage }, { status: statusCode });
    }

    // Save to DB
    const { error: dbError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userIdForDb,
        user_query: query,
        bot_response: responseText,
        pdf_context_used: wasPdfContextUsed,
      });

    if (dbError) {
      console.error('Supabase DB Error saving chat message:', dbError);
      // Continue to return response to user even if DB save fails
    }

    return NextResponse.json({ reply: responseText });

  } catch (error: any) {
    console.error('Error in /api/chat route:', error);
    let errorMessage = 'An unexpected error occurred while processing your chat request.';
    let statusCode = 500;

    if (error.message) {
        errorMessage = error.message;
    }
    
    // Attempt to log error to DB if user context is available
    if (userIdForDb) {
        const { error: dbError } = await supabase
            .from('chat_messages')
            .insert({
                user_id: userIdForDb,
                user_query: originalUserQuery,
                bot_response: `SYSTEM ERROR: ${errorMessage}`,
                pdf_context_used: false, // Assuming PDF context wasn't the direct cause or unknown
                isError: true // Add an isError flag if your schema supports it
            });
        if (dbError) {
            console.error('Supabase DB Error saving system error message:', dbError);
        }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}