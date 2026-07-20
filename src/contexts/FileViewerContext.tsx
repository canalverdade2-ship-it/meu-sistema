import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FileViewerModal } from '../components/ui/FileViewerModal';

interface FileViewerContextType {
  openFile: (url: string, fileName?: string) => void;
  closeFile: () => void;
}

const FileViewerContext = createContext<FileViewerContextType | undefined>(undefined);

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const openFile = (url: string, name?: string) => {
    setFileUrl(url);
    setFileName(name || null);
    setIsOpen(true);
  };

  const closeFile = () => {
    setIsOpen(false);
    setTimeout(() => {
      setFileUrl(null);
      setFileName(null);
    }, 300); // Allow animation to finish
  };

  return (
    <FileViewerContext.Provider value={{ openFile, closeFile }}>
      {children}
      <FileViewerModal 
        isOpen={isOpen} 
        onClose={closeFile} 
        fileUrl={fileUrl} 
        fileName={fileName} 
      />
    </FileViewerContext.Provider>
  );
}

export function useFileViewer() {
  const context = useContext(FileViewerContext);
  if (context === undefined) {
    throw new Error('useFileViewer must be used within a FileViewerProvider');
  }
  return context;
}
