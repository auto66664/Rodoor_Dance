"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 2200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`fixed bottom-[25px] left-1/2 z-50 -translate-x-1/2 rounded-[10px] bg-[#ffd22e] px-[22px] py-[13px] font-bold text-[#111] transition duration-300 pointer-events-none ${
          show ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
        }`}
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}
