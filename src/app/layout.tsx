// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext"; // Adjust path

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gemini Chatbot",
  description: "Chatbot with PDF context using Gemini API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider> {/* Wrap with AuthProvider */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}