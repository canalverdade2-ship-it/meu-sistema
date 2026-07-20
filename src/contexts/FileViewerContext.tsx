import { createContext, useContext, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { FileViewerModal } from '../components/ui/FileViewerModal';
import { resolveProviderFileUrl } from '../lib/providerStorage';

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
    const resolveAndOpen = async () => {
      try {
        const resolvedUrl = await resolveProviderFileUrl(url);
        setFileUrl(resolvedUrl);
        setFileName(name || null);
        setIsOpen(true);
      } catch (error: any) {
        console.error('Erro ao abrir arquivo:', error);
        toast.error(error?.message || 'Não foi possível abrir o arquivo.');
      }
    };
    void resolveAndOpen();
  };

  const closeFile = () => {
    setIsOpen(false);
    window.setTimeout(() => {
      setFileUrl(null);
      setFileName(null);
    }, 300);
  };

  return (
    <FileViewerContext.Provider value={{ openFile, closeFile }}>
      {children}
      <FileViewerModal isOpen={isOpen} onClose={closeFile} fileUrl={fileUrl} fileName={fileName} />
    </FileViewerContext.Provider>
  );
}

export function useFileViewer() {
  const context = useContext(FileViewerContext);
  if (!context) throw new Error('useFileViewer must be used within a FileViewerProvider');
  return context;
}
