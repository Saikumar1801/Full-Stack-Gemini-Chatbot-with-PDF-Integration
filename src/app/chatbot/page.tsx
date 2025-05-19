// src/app/chatbot/page.tsx
"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { useAuth } from "@/contexts/AuthContext"; // Ensure this path is correct
import { useRouter } from "next/navigation";
import {
  Send, Paperclip, User as UserIcon, Bot as BotIcon, LogOut, History, FileText, XCircle, Loader2, AlertTriangle, MessageSquarePlus
} from 'lucide-react';

interface Message {
  id: string;
  text: string | React.ReactNode; // Allow ReactNode for richer system messages
  sender: 'user' | 'bot' | 'system'; // Added 'system' sender
  pdfContextUsed?: boolean;
  timestamp?: string;
  isError?: boolean;
}

export default function ChatbotPage() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedPdfText, setUploadedPdfText] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isProcessingQuery || isUploadingPdf || isLoadingHistory;

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Authentication redirect effect
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Auto-focus text input effect
  useEffect(() => {
    if (!isBusy && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isBusy]);

  // Auto-load history effect
  useEffect(() => {
    if (user && !authLoading && !historyLoaded) {
      fetchChatHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const addSystemMessage = (text: string | React.ReactNode, isError: boolean = false, uniqueIdSuffix?: string) => {
    setMessages(prev => [...prev, {
      id: `sys-${uniqueIdSuffix || Date.now()}`,
      text,
      sender: 'system',
      timestamp: new Date().toISOString(),
      isError
    }]);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handlePdfUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!file) return;

    if (file.type !== "application/pdf") {
      setPageError("Invalid file type. Please upload a PDF.");
      return;
    }
    setPageError(null);
    setIsUploadingPdf(true);
    setPdfName(file.name);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
      setUploadedPdfText(data.text);
      addSystemMessage(<span>PDF: <strong>{file.name}</strong> uploaded successfully.</span>);
    } catch (err: any)  {
      console.error("PDF Upload Error:", err);
      addSystemMessage(`Failed to process PDF "${file.name}": ${err.message}`, true);
      setPdfName(null);
      setUploadedPdfText(null);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleSubmitQuery = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userInput.trim() || isBusy) return;

    const userQuery = userInput.trim();
    const userMessage: Message = { id: `user-${Date.now()}`, text: userQuery, sender: 'user', timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsProcessingQuery(true);
    setPageError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery, pdfText: uploadedPdfText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
      const botMessage: Message = { id: `bot-${Date.now()}`, text: data.reply, sender: 'bot', pdfContextUsed: !!uploadedPdfText, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      console.error("Chat API Error:", err);
      addSystemMessage(`Chat Error: ${err.message}`, true);
    } finally {
      setIsProcessingQuery(false);
    }
  };

  const fetchChatHistory = async () => {
    if (historyLoaded && messages.some(m => m.id === 'sys-hist-loaded' || m.id === 'sys-no-hist')) {
        return;
    }

    setIsLoadingHistory(true);
    setPageError(null);
    try {
      const response = await fetch('/api/chat-history');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
      
      const historyMessages: Message[] = data;

      setMessages(prevMessages => {
        const existingMessageIds = new Set(prevMessages.map(msg => msg.id));
        const uniqueHistoryMessages = historyMessages.filter(histMsg => !existingMessageIds.has(histMsg.id));
        const combined = [...uniqueHistoryMessages, ...prevMessages];
        combined.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
        return combined;
      });
      
      setHistoryLoaded(true);
      if (historyMessages.length === 0) {
        addSystemMessage("No previous chat history found.", false, "no-hist");
      } else {
         addSystemMessage("Chat history loaded.", false, "hist-loaded");
      }
    } catch (err: any) {
      console.error("Fetch History Error:", err);
      addSystemMessage(`Error loading history: ${err.message}`, true, "hist-err");
      setHistoryLoaded(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const clearPdfContext = () => {
    const currentPdfName = pdfName;
    setUploadedPdfText(null);
    setPdfName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if(currentPdfName) {
        addSystemMessage(<span>PDF context for <strong>{currentPdfName}</strong> has been cleared.</span>);
    } else {
        addSystemMessage("PDF context cleared.");
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <Loader2 size={48} className="animate-spin text-indigo-400" />
        <span className="ml-4 text-xl">Loading user session...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        Redirecting to login...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-800 text-slate-100 antialiased">
      {/* Header */}
      <header className="bg-slate-900 shadow-lg p-3 sm:p-4 flex justify-between items-center sticky top-0 z-50 border-b border-slate-700">
        <div className="flex items-center space-x-2">
            <MessageSquarePlus className="h-7 w-7 text-indigo-400" />
            <h1 className="text-xl sm:text-2xl font-semibold text-indigo-400">Gemini Chat</h1>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          {user.email && <span className="text-xs sm:text-sm text-slate-400 hidden md:block mr-2">{user.email}</span>}
          <button
            onClick={fetchChatHistory}
            disabled={isBusy}
            className="p-2 rounded-full hover:bg-slate-700/70 text-slate-300 hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Load Chat History"
          >
            {isLoadingHistory ? <Loader2 size={20} className="animate-spin" /> : <History size={20} />}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-slate-700/70 text-slate-300 hover:text-red-400 transition-colors"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Sticky Info Bar for PDF Context and Page Errors */}
      <div className="sticky top-[60px] sm:top-[68px] z-40 text-xs sm:text-sm">
        {pageError ? (
          <div className="bg-red-700/60 text-red-200 p-2 flex items-center justify-between space-x-2 shadow-md">
            <div className="flex items-center space-x-2">
              <AlertTriangle size={16} className="flex-shrink-0"/>
              <span>{pageError}</span>
            </div>
            <button onClick={() => setPageError(null)} className="p-1 rounded-full hover:bg-red-600/50 text-red-300 hover:text-red-100" aria-label="Dismiss Error">
              <XCircle size={18} />
            </button>
          </div>
        ) : pdfName ? (
          <div className="bg-indigo-700/60 text-indigo-200 p-2 flex items-center justify-between space-x-2 shadow-md">
            <div className="flex items-center space-x-2">
                <FileText size={16} className="flex-shrink-0" />
                <span>Active PDF: <strong className="font-medium">{pdfName}</strong></span>
            </div>
            <button onClick={clearPdfContext} className="ml-auto p-1 rounded-full hover:bg-red-600/50 text-red-300 hover:text-red-100" aria-label="Clear PDF Context">
              <XCircle size={18} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Chat Messages Area */}
      <main className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth" aria-live="polite">
        {messages.map((msg) => (
          // ** FIXED LINE BELOW **
          <div key={msg.id} className={`flex ${
              msg.sender === 'user' ? 'justify-end' :
              msg.sender === 'system' ? 'justify-center w-full' :
              'justify-start' // Default for bot
          }`}>
            <div className={`p-3 rounded-2xl shadow-md break-words ${
                msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-lg max-w-[85%] sm:max-w-[75%] md:max-w-[70%]' :
                msg.sender === 'bot' ? (msg.isError ? 'bg-red-700/90 text-red-100 rounded-bl-lg max-w-[85%] sm:max-w-[75%] md:max-w-[70%]' : 'bg-slate-700 text-slate-100 rounded-bl-lg max-w-[85%] sm:max-w-[75%] md:max-w-[70%]') :
                /* system messages */ (msg.isError ? 'bg-red-600/30 text-red-200 border border-red-500/50 w-full max-w-3xl mx-auto text-center py-2' : 'bg-slate-700/50 text-slate-300 w-full max-w-3xl mx-auto text-center py-2')
            }`}>
              {msg.sender !== 'system' && (
                <div className="flex items-center mb-1.5 text-xs">
                  {msg.sender === 'bot' ? <BotIcon size={16} className="mr-1.5 flex-shrink-0" /> : <UserIcon size={16} className="mr-1.5 flex-shrink-0" />}
                  <span className="font-semibold">{msg.sender === 'user' ? 'You' : 'Gemini Bot'}</span>
                  {msg.timestamp && <span className="text-slate-400 ml-2 opacity-80">{new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
                </div>
              )}
              <div className={`text-sm sm:text-base whitespace-pre-wrap ${msg.sender === 'system' ? 'italic' : ''}`}>{msg.text}</div>
              {msg.sender === 'bot' && msg.pdfContextUsed && !msg.isError && <p className="text-xs text-indigo-300 opacity-70 mt-1.5">(Relied on PDF context)</p>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />

        {isProcessingQuery && messages.length > 0 && messages[messages.length -1]?.sender === 'user' && (
            <div className="flex justify-start">
                 <div className="max-w-xs p-3 rounded-2xl shadow-md bg-slate-700 text-slate-100 rounded-bl-lg">
                    <div className="flex items-center text-xs">
                        <BotIcon size={16} className="mr-1.5 flex-shrink-0" /> <span className="font-semibold">Gemini Bot</span>
                    </div>
                    <div className="flex items-center mt-1.5">
                        <Loader2 size={16} className="animate-spin text-indigo-400 mr-2" />
                        <p className="text-sm">Thinking...</p>
                    </div>
                 </div>
            </div>
        )}
      </main>

      {/* Input Form Area */}
      <footer className="bg-slate-900 p-3 sm:p-4 shadow-top sticky bottom-0 z-50 border-t border-slate-700">
        <form onSubmit={handleSubmitQuery} className="flex items-center space-x-2 sm:space-x-3">
          <label
            htmlFor="pdf-upload-footer"
            className={`p-3 rounded-lg ${isUploadingPdf ? 'animate-pulse bg-indigo-700 cursor-wait' : 'bg-slate-700 hover:bg-slate-600'} ${isBusy && !isUploadingPdf ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} text-slate-300 hover:text-indigo-300 transition-colors flex items-center justify-center`}
            aria-label={isUploadingPdf ? "Uploading PDF..." : "Upload PDF for context"}
            tabIndex={isBusy ? -1 : 0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            {isUploadingPdf ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            <input id="pdf-upload-footer" type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={isBusy} ref={fileInputRef} />
          </label>

          <input
            ref={textInputRef}
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={isBusy ? "Processing your request..." : "Ask Gemini anything, or about the PDF..."}
            className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow text-sm sm:text-base"
            disabled={isBusy}
            aria-label="Chat message input"
          />
          <button
            type="submit"
            className="p-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            disabled={isBusy || !userInput.trim()}
            aria-label={isProcessingQuery ? "Sending message..." : "Send Message"}
          >
            {isProcessingQuery ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
          </button>
        </form>
      </footer>
    </div>
  );
}