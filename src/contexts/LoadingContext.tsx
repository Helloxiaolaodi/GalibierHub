'use client';

import React, { createContext, useContext, useState } from 'react';
import GalibierLoader from '@/components/GalibierLoader';

type LoadingContextType = {
  isLoading: boolean;
  progress?: number;
  showLoading: (initialProgress?: number) => void;
  setLoadingProgress: (progress: number) => void;
  hideLoading: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const showLoading = (initialProgress?: number) => {
    setProgress(initialProgress);
    setIsLoading(true);
  };

  const setLoadingProgress = (val: number) => {
    setProgress(val);
  };

  const hideLoading = () => {
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(undefined);
    }, 400);
  };

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
