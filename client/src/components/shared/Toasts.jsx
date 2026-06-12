import React, { useCallback, useRef, useState } from 'react';

// Lichtgewicht toast-systeem: const { toasts, addToast } = useToasts(); <Toasts toasts={toasts} />
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const addToast = useCallback((message, type = 'error') => {
    const id = ++counter.current;
    setToasts(prev => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, addToast };
}

export function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] space-y-2 w-[90%] max-w-md pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`animate-slide-in rounded-xl px-4 py-3 text-sm font-semibold shadow-lg border text-center ${
            t.type === 'success'
              ? 'bg-pitch-800 border-grass-500 text-grass-300'
              : t.type === 'info'
                ? 'bg-pitch-800 border-gold-500 text-gold-300'
                : 'bg-pitch-800 border-red-500 text-red-300'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
