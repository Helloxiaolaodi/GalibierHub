'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import GalibierLoader from '@/components/GalibierLoader';

type LoadingContextType = {
  isLoading: boolean;
  progress?: number;
  showLoading: (initialProgress?: number, immediate?: boolean) => void;
  setLoadingProgress: (progress: number) => void;
  hideLoading: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  // Start with splash visible on first render — this renders in the server HTML
  // so the loader is the very first thing the user sees, before any page content.
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const isLoadingRef = useRef(true);

  const showLoading = useCallback((initialProgress?: number, immediate?: boolean) => {
    setProgress(initialProgress);

    if (immediate) {
      setIsLoading(true);
      isLoadingRef.current = true;
      startTimeRef.current = Date.now();
    } else {
      showTimeoutRef.current = setTimeout(() => {
        setIsLoading(true);
        isLoadingRef.current = true;
        startTimeRef.current = Date.now();
      }, 250);
    }
  }, []);

  const setLoadingProgress = useCallback((val: number) => {
    setProgress(val);
  }, []);

  const hideLoading = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (isLoadingRef.current) {
      const elapsedTime = Date.now() - startTimeRef.current;
      const MINIMUM_DISPLAY_TIME = 2000;
      const remainingTime = Math.max(0, MINIMUM_DISPLAY_TIME - elapsedTime);

      setProgress(100);

      setTimeout(() => {
        setIsLoading(false);
        isLoadingRef.current = false;
        setProgress(undefined);
      }, remainingTime);
    }
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, progress, showLoading, setLoadingProgress, hideLoading }}>
      {/* Render loader BEFORE children so it appears first in the server HTML */}
      {isLoading && <GalibierLoader progress={progress} />}
      {children}
    </LoadingContext.Provider>
  );
}

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  return context;
};
