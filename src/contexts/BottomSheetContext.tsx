import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BottomSheetContextType {
  isBottomSheetOpen: boolean;
  setBottomSheetOpen: (isOpen: boolean) => void;
}

const BottomSheetContext = createContext<BottomSheetContextType | undefined>(undefined);

export function BottomSheetProvider({ children }: { children: ReactNode }) {
  const [isBottomSheetOpen, setBottomSheetOpen] = useState(false);

  return (
    <BottomSheetContext.Provider value={{ isBottomSheetOpen, setBottomSheetOpen }}>
      {children}
    </BottomSheetContext.Provider>
  );
}

export function useBottomSheetContext() {
  const context = useContext(BottomSheetContext);
  if (!context) {
    throw new Error('useBottomSheetContext must be used within BottomSheetProvider');
  }
  return context;
}
