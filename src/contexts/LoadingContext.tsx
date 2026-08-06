'use client';

import React, { createContext, useContext, useState, useRef } from 'react';
import GalibierLoader from '@/components/GalibierLoader';

type LoadingContextType = {
  isLoading: boolean;
  progress?: number;
  logs?: string[];
  showLoading: (initialProgress?: number, logs?: string[]) => void;
  setLoadingProgress: (progress: number) => void;
  hideLoading: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [logs, setLogs] = useState<string[] | undefined>(undefined);

  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);

  const showLoading = (initialProgress?: number, customLogs?: string[]) => {
    setProgress(initialProgress);
    setLogs(customLogs);

    // 250ms grace period: if hideLoading is called within 250ms, the loader never appears
    showTimeoutRef.current = setTimeout(() => {
      setIsLoading(true);
      startTimeRef.current = Date.now();
    }, 250);
  };

  const setLoadingProgress = (val: number) => {
    setProgress(val);
  };

  const hideLoading = () => {
    // Cancel the scheduled show if still within the grace period
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (isLoading) {
      // Ensure the loader is visible for at least 1.2s to prevent flicker
      const elapsedTime = Date.now() - startTimeRef.current;
      const MINIMUM_DISPLAY_TIME = 1200;
      const remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsedTime);

      setProgress(100);
      setLogs(undefined);
      setTimeout(() => {
        setIsLoading(false);
        setProgress(undefined);
      }, remainingTime);
    }
  };

  return (
    <LoadingContext.Provider value={{ isLoading, progress, logs, showLoading, setLoadingProgress, hideLoading }}>
      {children}
      {isLoading && <GalibierLoader progress={progress} logs={logs} />}
    </LoadingContext.Provider>
  );
}

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  return context;
};
