import React from 'react';

export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = { sm: 'w-6 h-6 border-2', md: 'w-10 h-10 border-4', lg: 'w-16 h-16 border-4' };
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
      <div className={`${sizes[size]} border-pitch-600 border-t-grass-500 rounded-full animate-spin`}></div>
      {text && <p className="text-gray-400 text-sm animate-pulse">{text}</p>}
    </div>
  );
}
