import React, { createContext, useContext, ReactNode } from 'react';

interface WorkspaceContextType {
  openWorkspaceDrawer: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
  openWorkspaceDrawer: () => void;
}

export function WorkspaceProvider({ children, openWorkspaceDrawer }: WorkspaceProviderProps) {
  return (
    <WorkspaceContext.Provider value={{ openWorkspaceDrawer }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
}