# Full Stack Gemini Chatbot with PDF Integration

This project is a full-stack web application featuring a chatbot powered by Google's Gemini API. Users can register, log in, upload PDF documents for contextualized conversations, and view their chat history. The application is built with Next.js, Supabase for authentication and database, and Tailwind CSS for styling.

## Features Implemented

*   **User Authentication:** Secure user registration, login, and logout functionality using Supabase Auth.
*   **Protected Routes:** Chatbot interface is accessible only to authenticated users.
*   **PDF Upload & Processing:** Users can upload PDF documents. The text content is extracted on the server-side using `pdf-parse`.
*   **Contextual Chat with Gemini API:**
    *   Engage in general conversations with the Gemini Pro/Flash model.
    *   Chat with the AI using the content of an uploaded PDF as context for answers.
*   **Chat History Storage:** All user queries and bot responses are stored in a Supabase PostgreSQL database.
*   **View Chat History (Bonus Feature):** Authenticated users can view their past chat interactions within the interface.
*   Responsive UI built with Next.js (App Router) and Tailwind CSS.

## Tech Stack

*   **Frontend:** Next.js 14+ (App Router), React 18+, TypeScript
*   **Styling:** Tailwind CSS
*   **Backend:** Next.js API Routes
*   **Authentication:** Supabase Auth
*   **Database:** Supabase (PostgreSQL)
*   **AI Model:** Google Gemini API (`@google/generative-ai` SDK)
*   **PDF Parsing:** `pdf-parse`
*   **Deployment (Optional):** Vercel (or your chosen platform)

## Project Structure (Key Directories)

```bash
my-gemini-chatbot/
├── src/
│   ├── app/                     # Next.js App Router: Pages, API Routes, Layouts
│   │   ├── api/                 # Backend API routes (chat, upload-pdf, chat-history)
│   │   ├── chatbot/             # Chatbot page
│   │   ├── login/               # Login page
│   │   ├── register/            # Registration page
│   │   └── layout.tsx           # Main app layout
│   │   └── page.tsx             # Homepage
│   ├── components/              # Reusable UI components (if any created)
│   ├── contexts/                # React Context (e.g., AuthContext)
│   ├── lib/                     # Utility functions, Supabase clients
│   └── middleware.ts            # Next.js middleware for route protection
├── public/                    # Static assets
├── .env.local                 # Local environment variables (GITIGNORED!)
├── next.config.mjs            # Next.js configuration
├── package.json               # Project dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Setup and Installation

### Prerequisites

*   Node.js (v18.x or later recommended)
*   npm (v8.x or later) or yarn
*   A Supabase account and project.
*   A Google Cloud Platform account with the Gemini API enabled and an API key.

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd my-gemini-chatbot
```

### 2. Install Dependencies

```bash
npm install
# or
# yarn install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root of the project and add the following environment variables with your actual credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_SECRET_KEY # Keep this super secret!

# Google Gemini API Configuration
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

*   **`NEXT_PUBLIC_SUPABASE_URL`**: Found in your Supabase project settings under API > Project URL.
*   **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Found in your Supabase project settings under API > Project API Keys > `anon` `public`.
*   **`SUPABASE_SERVICE_ROLE_KEY`**: Found in your Supabase project settings under API > Project API Keys > `service_role` `secret`. **Treat this like a password.**
*   **`GEMINI_API_KEY`**: Your API key for the Google Gemini API (from Google AI Studio or Google Cloud Console).

### 4. Database Setup (Supabase)

The application requires a table named `chat_messages` in your Supabase PostgreSQL database.

**Table Schema: `chat_messages`**

| Column           | Type                       | Constraints & Defaults                         | Description                                  |
| :--------------- | :------------------------- | :--------------------------------------------- | :------------------------------------------- |
| `id`             | `uuid`                     | `PRIMARY KEY`, `DEFAULT gen_random_uuid()`     | Unique identifier for the chat message entry |
| `created_at`     | `timestamp with time zone` | `NOT NULL`, `DEFAULT now()`                    | Timestamp of when the message was created    |
| `user_id`        | `uuid`                     | `NOT NULL`, `FOREIGN KEY REFERENCES auth.users(id) ON DELETE CASCADE` | ID of the user who sent/received the message |
| `user_query`     | `text`                     | `NOT NULL`                                     | The query/input from the user                |
| `bot_response`   | `text`                     | `NULL`                                         | The response from the chatbot (Gemini)       |
| `pdf_context_used` | `boolean`                  | `NOT NULL`, `DEFAULT false`                    | Whether PDF context was used for this interaction |

**SQL for Table Creation:**
You can run the following SQL in your Supabase SQL Editor:
```sql
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  user_query text NOT NULL,
  bot_response text NULL,
  pdf_context_used boolean NOT NULL DEFAULT false,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE -- Or your preferred ON DELETE action
);

-- Grant usage on schema to Supabase roles if needed (usually default for public schema)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.chat_messages TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON TABLE public.chat_messages TO authenticated; -- Adjust permissions as needed by RLS
```

**Row Level Security (RLS) Policies:**
Ensure RLS is enabled for the `chat_messages` table. The following policies are recommended:

1.  **Allow authenticated users to INSERT their own messages:**
    ```sql
    CREATE POLICY "Allow authenticated insert own messages"
    ON "public"."chat_messages"
    AS PERMISSIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
    ```
2.  **Allow authenticated users to SELECT their own messages:**
    ```sql
    CREATE POLICY "Allow authenticated select own messages"
    ON "public"."chat_messages"
    AS PERMISSIVE
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
    ```
    *(Add DELETE/UPDATE policies if implemented and required)*

*(Alternatively, if you provided a `database_schema.sql` file, you can just say: "Run the `database_schema.sql` script in your Supabase SQL Editor to create the necessary table and RLS policies.")*

### 5. Run the Application

```bash
npm run dev
# or
# yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Linters and Build

To check for linting issues:
```bash
npm run lint
```

To build the project for production:
```bash
npm run build
```

## Sample Interactions

Please see the `sample_chat_interactions.txt` (or `.pdf`/`.xlsx`) file in this repository for examples of user queries and chatbot responses.

## Citations (If Applicable)

*   [Supabase Documentation](https://supabase.com/docs) for authentication and database patterns.
*   [Next.js Documentation](https://nextjs.org/docs) for App Router and API route guidance.
*   [Google Gemini API Documentation](https://ai.google.dev/docs) for API usage.
*   *(List any specific tutorials, Stack Overflow answers, or GitHub repositories if you adapted significant code snippets)*
*   *(If you used AI tools like ChatGPT or GitHub Copilot for significant code generation, it's good practice to mention their assistance.)*

---
