// src/app/chatbot/page.tsx
"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Send, Paperclip, User as UserIcon, Bot as BotIcon, LogOut, History } from 'lucide-react'; // Added History icon

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  pdfContextUsed?: boolean;
  timestamp?: string; // Added for historical messages
}

export default function ChatbotPage() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedPdfText, setUploadedPdfText] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // New state for history loading
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false); // To prevent multiple loads

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handlePdfUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    // ... (same as before)
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    setPdfName(file.name);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload PDF');
      }

      const data = await response.json();
      setUploadedPdfText(data.text);
      setMessages(prev => [...prev, { id: Date.now().toString(), text: `Successfully uploaded and processed: ${file.name}`, sender: 'bot', timestamp: new Date().toISOString() }]);
    } catch (err: any) {
      console.error("PDF Upload Error:", err);
      setError(err.message || "An error occurred during PDF upload.");
      setPdfName(null);
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  const handleSubmitQuery = async (e: FormEvent<HTMLFormElement>) => {
    // ... (same as before, but add timestamp)
    e.preventDefault();
    if (!userInput.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text: userInput, sender: 'user', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    const currentQuery = userInput; // Store before clearing
    setUserInput('');
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, pdfText: uploadedPdfText }), // Use stored query
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from chatbot');
      }

      const data = await response.json();
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply,
        sender: 'bot',
        pdfContextUsed: !!uploadedPdfText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (err: any) {
      console.error("Chat API Error:", err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${err.message || "An error occurred."}`,
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchChatHistory = async () => {
    if (historyLoaded) {
        setMessages(prev => [...prev, {id: Date.now().toString(), text: "Chat history already loaded.", sender: 'bot', timestamp: new Date().toISOString()}]);
        return;
    }
    setIsLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch('/api/chat-history');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch history');
      }
      const historyData: Message[] = await response.json();
      // Prepend history to current messages, ensuring no duplicates if any session messages were already history
      // A more robust approach might involve checking IDs if loading multiple times or merging.
      // For simplicity, we'll prepend and sort, assuming `historyLoaded` prevents redundant full loads.
      setMessages(prevMessages => {
        // Create a Set of existing message IDs for quick lookup
        const existingMessageIds = new Set(prevMessages.map(msg => msg.id));
        // Filter out history messages that are already in the current messages array
        const uniqueHistoryMessages = historyData.filter(histMsg => !existingMessageIds.has(histMsg.id));
        // Combine unique history with current messages and sort by timestamp
        const combined = [...uniqueHistoryMessages, ...prevMessages];
        combined.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
        return combined;
      });
      setHistoryLoaded(true); // Mark history as loaded
      if (historyData.length === 0) {
        setMessages(prev => [...prev, {id: Date.now().toString(), text: "No previous chat history found.", sender: 'bot', timestamp: new Date().toISOString()}]);
      } else {
        setMessages(prev => [...prev, {id: Date.now().toString(), text: "Chat history loaded.", sender: 'bot', timestamp: new Date().toISOString()}]);
      }
    } catch (err: any) {
      console.error("Fetch History Error:", err);
      setError(err.message || "An error occurred while fetching history.");
      setMessages(prev => [...prev, {id: Date.now().toString(), text: `Error loading history: ${err.message}`, sender: 'bot', timestamp: new Date().toISOString()}]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Optional: Automatically load history when the component mounts and user is available
  useEffect(() => {
    if (user && !authLoading && !historyLoaded) {
      fetchChatHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]); // Removed historyLoaded from deps to allow manual reload button to work if desired

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading user...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Redirecting to login...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gemini Chatbot</h1>
        <div className="flex items-center space-x-2 sm:space-x-3">
          {user.email && <span className="text-sm text-gray-600 hidden md:block">{user.email}</span>}
          <button
            onClick={fetchChatHistory}
            disabled={isLoadingHistory || isProcessing}
            className={`p-2 rounded-md ${isLoadingHistory || isProcessing ? 'bg-gray-300' : 'bg-purple-500 hover:bg-purple-600'} text-white transition-colors`}
            title="Load Chat History"
          >
            <History size={20} />
          </button>
          <label htmlFor="pdf-upload" className={`p-2 rounded-md cursor-pointer ${isProcessing ? 'bg-gray-300' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors`}>
            <Paperclip size={20} />
            <input id="pdf-upload" type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={isProcessing} />
          </label>
          <button
            onClick={handleLogout}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* PDF Info & Error Display (same as before) ... */}
      {pdfName && (
        <div className="p-2 bg-blue-100 text-blue-700 text-sm text-center">
          Context: {pdfName} {uploadedPdfText ? `(${Math.round(uploadedPdfText.length / 1024)} KB processed)` : ''}
          <button onClick={() => { setUploadedPdfText(null); setPdfName(null); setMessages(prev => [...prev, {id: Date.now().toString(), text: "PDF context cleared.", sender: 'bot', timestamp: new Date().toISOString()}]);}} className="ml-2 text-red-500 hover:text-red-700 font-semibold">[Clear]</button>
        </div>
      )}
      {error && <div className="p-3 bg-red-100 text-red-700 text-sm text-center">{error}</div>}


      {/* Chat Messages */}
      <main className="flex-grow overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl p-3 rounded-lg shadow ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'}`}>
              <div className="flex items-center mb-1">
                {msg.sender === 'bot' ? <BotIcon size={18} className="mr-2 text-indigo-500" /> : <UserIcon size={18} className="mr-2 text-gray-100" />}
                <span className="font-semibold text-sm">{msg.sender === 'user' ? 'You' : 'Gemini Bot'}</span>
                {msg.timestamp && <span className="text-xs opacity-60 ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>}
              </div>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.sender === 'bot' && msg.pdfContextUsed && <p className="text-xs opacity-70 mt-1">(Used PDF context)</p>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {isProcessing && messages[messages.length -1]?.sender === 'user' && (
            <div className="flex justify-start">
                 <div className="max-w-xs p-3 rounded-lg shadow bg-white text-gray-800">
                    <div className="flex items-center">
                        <BotIcon size={18} className="mr-2 text-indigo-500" /> <span className="font-semibold text-sm">Gemini Bot</span>
                    </div>
                    <p className="animate-pulse">Thinking...</p>
                 </div>
            </div>
        )}
      </main>

      {/* Input Form (same as before) ... */}
      <footer className="bg-white p-4 shadow-t-md">
        <form onSubmit={handleSubmitQuery} className="flex items-center space-x-3">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={isProcessing || isLoadingHistory ? "Processing..." : "Type your message..."}
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            disabled={isProcessing || isLoadingHistory}
          />
          <button
            type="submit"
            className={`p-3 rounded-lg ${isProcessing || isLoadingHistory ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors`}
            disabled={isProcessing || isLoadingHistory}
          >
            <Send size={24} />
          </button>
        </form>
      </footer>
    </div>
  );
}