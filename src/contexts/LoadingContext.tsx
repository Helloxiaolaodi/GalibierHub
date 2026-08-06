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
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isLoadingRef = useRef(false);

  const showLoading = useCallback((initialProgress?: number, immediate?: boolean) => {
    setProgress(initialProgress);

    if (immediate) {
      // Splash screen: show immediately, no grace period
      setIsLoading(true);
      isLoadingRef.current = true;
      startTimeRef.current = Date.now();
    } else {
      // 250ms grace period: if hideLoading is called within 250ms, the loader never appears
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
    // Cancel the scheduled show if still within the grace period
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (isLoadingRef.current) {
      // Ensure the loader is visible for at least 1.2s to prevent flicker
      const elapsedTime = Date.now() - startTimeRef.current;
      const MINIMUM_DISPLAY_TIME = 1200;
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
      {children}
      {isLoading && <GalibierLoader progress={progress} />}
    </LoadingContext.Provider>
  );
}

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  return context;
};
