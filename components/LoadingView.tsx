import React from 'react';

interface LoadingViewProps {
  useRealImage?: boolean;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ useRealImage = false }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8 animate-pulse">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
        <svg className="absolute inset-0 m-auto w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">
        {useRealImage ? "Developing Photos..." : "Generating Skyline..."}
      </h3>
      <p className="text-slate-400 max-w-xs">
        {useRealImage 
          ? "Curating high-resolution photography from Unsplash..." 
          : "Using Gemini AI to paint a city and gather trivia. Please wait."}
      </p>
    </div>
  );
};