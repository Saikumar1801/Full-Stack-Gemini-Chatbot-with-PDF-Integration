// src/app/api/chat-history/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in to view chat history.' }, { status: 401 });
    }

    const { data: chatMessages, error: dbError } = await supabase
      .from('chat_messages')
      .select('id, created_at, user_query, bot_response, pdf_context_used') // Select specific columns
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }); // Get messages in chronological order

    if (dbError) {
      console.error('Error fetching chat history:', dbError);
      return NextResponse.json({ error: 'Failed to fetch chat history. ' + dbError.message }, { status: 500 });
    }

    // Transform data slightly for frontend consumption if needed, e.g., consistent message structure
    const history = chatMessages.map(msg => ([
      {
        id: `${msg.id}-user`,
        text: msg.user_query,
        sender: 'user' as 'user' | 'bot', // Type assertion
        timestamp: msg.created_at,
      },
      {
        id: `${msg.id}-bot`,
        text: msg.bot_response,
        sender: 'bot' as 'user' | 'bot', // Type assertion
        pdfContextUsed: msg.pdf_context_used,
        timestamp: msg.created_at, // Bot response is part of the same interaction
      }
    ])).flat(); // Flatten the array of pairs into a single array of messages


    // Simpler alternative if you don't want to split user/bot into separate objects from one row:
    // Just return chatMessages and let the frontend map them.
    // For this example, let's return the transformed 'history' which fits the Message interface better.

    return NextResponse.json(history); // Or return chatMessages directly if preferred

  } catch (error: any) {
    console.error('Unexpected error in chat-history route:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. ' + error.message }, { status: 500 });
  }
}