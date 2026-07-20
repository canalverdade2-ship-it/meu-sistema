import React, { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { FileViewerModal } from '../components/ui/FileViewerModal';
import { resolvePrivateFileReference } from '../lib/privateStorage';

interface FileViewerContextType {
  openFile: (url: string, fileName?: string) => Promise<void>;
  closeFile: () => void;
}

const FileViewerContext = createContext<FileViewerContextType | undefined>(undefined);

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const openFile = async (url: string, name?: string) => {
    if (!url) {
      toast.error('Arquivo indisponível.');
      return;
    }

    try {
      const resolvedUrl = await resolvePrivateFileReference(url);
      setFileUrl(resolvedUrl);
      setFileName(name || null);
      setIsOpen(true);
    } catch (error) {
      console.error('Erro ao abrir arquivo protegido:', error);
      toast.error('Não foi possível autorizar o acesso ao arquivo.');
    }
  };

  const closeFile = () => {
    setIsOpen(false);
    setTimeout(() => {
      setFileUrl(null);
      setFileName(null);
    }, 300);
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
