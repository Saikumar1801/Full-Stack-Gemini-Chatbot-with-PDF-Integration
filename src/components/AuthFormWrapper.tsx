// src/components/AuthFormWrapper.tsx
import React from 'react';

interface AuthFormWrapperProps {
  title: string;
  children: React.ReactNode;
}

const AuthFormWrapper: React.FC<AuthFormWrapperProps> = ({ title, children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          {/* You can add a logo here */}
          {/* <img className="mx-auto h-12 w-auto" src="/logo.svg" alt="Your Company" /> */}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            {title}
          </h2>
        </div>
        <div className="bg-slate-800 shadow-2xl rounded-xl p-8 sm:p-10 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthFormWrapper;