import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { FileText, Upload, AlertCircle, CheckCircle, Clock, XCircle, Shield, Trash2 } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { useFileViewer } from '../../contexts/FileViewerContext';
import { logService } from '../../lib/logService';
import { notificationService } from '../../lib/notificationService';

interface PrestadorDocumentosProps {
  prestadorId: string;
  initialItemId?: string;
}

interface Documento {
  id: string;
  nome: string;
  tipo: string;
  urls: string[];
  status: 'pendente' | 'aprovado' | 'reprovado' | 'em_analise';
  created_at: string;
  motivo_rejeicao?: string;
  enviado_por_admin?: boolean;
}

export function PrestadorDocumentos({ prestadorId, initialItemId }: PrestadorDocumentosProps) {
  const { openFile } = useFileViewer();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && documentos.length > 0) {
      const doc = documentos.find(d => d.id === initialItemId);
      if (doc) {
        // No explicit tabs, but we scroll to the correct list
        setTimeout(() => {
          const element = document.getElementById(`documento-${initialItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedItemId(initialItemId);
            setTimeout(() => setHighlightedItemId(null), 3000);
          }
        }, 400);
      }
    }
  }, [initialItemId, documentos.length]);
  
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocToUpload, setSelectedDocToUpload] = useState<Documento | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchDocumentos();

    const channel = supabase
      .channel(`prestador-documentos-${prestadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prestador_documentos', filter: `prestador_id=eq.${prestadorId}` }, () => {
        fetchDocumentos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prestadorId, monthFilter]);

  const fetchDocumentos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prestador_documentos')
        .select('*')
        .eq('prestador_id', prestadorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      if (data) {
        let filtered = data as Documento[];
        if (monthFilter) {
          filtered = filtered.filter(doc => doc.created_at.startsWith(monthFilter));
        }
        setDocumentos(filtered || []);
      }
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpload = (doc: Documento) => {
    setSelectedDocToUpload(doc);
    setSelectedFiles([]);
    setUploadProgress(0);
    setUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files].slice(0, 5));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 || !selectedDocToUpload) {
      toast.error('Por favor, selecione ao menos um arquivo.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const urls: string[] = [];
      const totalFiles = selectedFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedDocToUpload.tipo}-${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${prestadorId}/${fileName}`;

        setUploadProgress(10 + (i / totalFiles) * 60);
        
        const { error: uploadError } = await supabase.storage
          .from('documentos_prestador')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('documentos_prestador')
          .getPublicUrl(filePath);
        
        urls.push(publicUrlData.publicUrl);
      }

      setUploadProgress(80);

      const { error: updateError } = await supabase
        .from('prestador_documentos')
        .update({
          urls,
          status: 'em_analise',
          motivo_rejeicao: null // limpar rejeição se for reenvio
        })
        .eq('id', selectedDocToUpload.id);

      if (updateError) throw updateError;
      
      await logService.logAction({
        ator_tipo: 'prestador',
        ator_id: prestadorId,
        acao: 'UPLOAD_DOCUMENTO',
        detalhes: `Enviou ${selectedFiles.length} arquivo(s) para o documento: ${selectedDocToUpload.nome}`
      });

      await notificationService.notifyAdmin(
        '📄 Documento de Prestador Enviado',
        `O prestador enviou ${selectedFiles.length} arquivo(s) para o documento "${selectedDocToUpload.nome}".`,
        'cadastro',
        'documento_prestador_enviado',
        { tab: 'prestadores_documentos', itemId: prestadorId, contexto: { prestador_id: prestadorId, documento_id: selectedDocToUpload.id } }
      );

      toast.success('Documentos enviados com sucesso! Aguardando análise.');
      setUploadModalOpen(false);
      setSelectedFiles([]);
      fetchDocumentos();
      setUploadProgress(100);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Falha ao enviar documento. Tente novamente.');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };



  if (loading) {

    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-4 border-[#1a1a1a] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  const pendentes = documentos.filter(d => d.status === 'pendente' || d.status === 'reprovado');
  const enviados = documentos.filter(d => d.status === 'em_analise' || d.status === 'aprovado');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-50/50">
          <div>
            <h3 className="text-lg font-medium text-neutral-900">Documentos Solicitados</h3>
            <p className="text-sm text-neutral-500 mt-1">Envie os documentos requisitados pela administração.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-neutral-200">
              <Clock className="h-4 w-4 text-neutral-400" />
              <select 
                value={monthFilter} 
                onChange={e => setMonthFilter(e.target.value)} 
                className="text-xs font-bold text-neutral-700 focus:outline-none bg-transparent"
              >
                <option value="">Todos os meses</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const month = (i + 1).toString().padStart(2, '0');
                  const year = new Date().getFullYear();
                  return (
                    <option key={month} value={`${year}-${month}`}>
                      {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, i))}
                    </option>
                  );
                })}
              </select>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              {pendentes.length} pendentes
            </span>
          </div>
        </div>

        {pendentes.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <p className="font-medium text-neutral-900">Tudo certo por aqui!</p>
            <p className="text-sm mt-1">Você não possui documentos pendentes de envio.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {pendentes.map(doc => (
              <div 
                id={`documento-${doc.id}`}
                key={doc.id} 
                className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-500 ${
                  highlightedItemId === doc.id 
                    ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg rounded-xl' 
                    : 'hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                    doc.status === 'reprovado' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {doc.status === 'reprovado' ? <XCircle className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="font-medium text-neutral-900 text-base">{doc.nome}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="uppercase text-[10px] tracking-wider font-bold bg-neutral-200 px-2 py-0.5 rounded text-neutral-700">
                        {doc.tipo.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        doc.status === 'reprovado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {doc.status === 'reprovado' ? 'Reprovado / Reenvio' : 'Pendente Envio'}
                      </span>
                    </div>
                    {doc.status === 'reprovado' && doc.motivo_rejeicao && (
                      <p className="text-sm text-red-600 mt-2 bg-red-50 p-3 rounded-lg border border-red-100">
                        <span className="font-bold">Motivo:</span> {doc.motivo_rejeicao}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">

                  <button
                    onClick={() => handleOpenUpload(doc)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black shrink-0"
                  >
                    <Upload className="h-4 w-4" />
                    {doc.status === 'reprovado' ? 'Reenviar Arquivo' : 'Enviar Arquivo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-lg font-medium text-neutral-900">Seus Documentos Anexados</h3>
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800">
            {enviados.length} anexos
          </span>
        </div>

        {enviados.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Nenhum documento enviado ou processado ainda.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {enviados.map(doc => (
              <div 
                id={`documento-${doc.id}`}
                key={doc.id} 
                className={`p-4 flex items-center justify-between group transition-all duration-500 ${
                  highlightedItemId === doc.id 
                    ? 'bg-indigo-50/50 ring-2 ring-indigo-500 scale-[1.01] z-10 shadow-lg rounded-xl' 
                    : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    doc.status === 'aprovado' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{doc.nome}</span>
                        {doc.enviado_por_admin && (
                          <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <Shield className="w-3 h-3"/> Admin
                          </span>
                        )}
                      </div>
                      {doc.urls && Array.isArray(doc.urls) && (
                        <div className="flex gap-2 flex-wrap">
                          {doc.urls.map((u, i) => (
                            <button key={i} type="button" onClick={() => openFile(u, `Documento ${i+1}`)} className="text-[10px] font-bold text-indigo-600 hover:underline">
                              Ver {i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
                      <span className="uppercase text-[10px] tracking-wider font-bold bg-neutral-200 px-2 py-0.5 rounded">{doc.tipo.replace('_', ' ')}</span>
                      <span>{formatDateTime(doc.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    doc.status === 'aprovado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {doc.status === 'em_analise' && <Clock className="w-3 h-3" />}
                    {doc.status === 'aprovado' && <CheckCircle className="w-3 h-3" />}
                    {doc.status === 'aprovado' ? 'Aprovado' : 'Em Análise'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title={`Enviar: ${selectedDocToUpload?.nome}`} size="wide">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
            <p className="text-sm text-indigo-800">
              Faça o upload do arquivo solicitado. Formatos suportados: PDF, JPG, PNG (máx 10MB).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Arquivos (Até 5) *</label>
            <div className="space-y-2 mb-3">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
                  <CheckCircle className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-bold text-indigo-700 truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-indigo-500 hover:text-indigo-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {selectedFiles.length < 5 && (
              <div className="mt-1 flex justify-center rounded-xl border-2 border-dashed border-neutral-300 px-6 py-6 hover:bg-neutral-50 transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-8 w-8 text-neutral-400" />
                  <div className="flex text-sm text-neutral-600 mt-2 justify-center">
                    <label className="relative cursor-pointer rounded-md bg-transparent font-medium text-indigo-600 focus-within:outline-none hover:text-indigo-500">
                      <span>Fazer Upload</span>
                      <input type="file" multiple className="sr-only" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                    </label>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Selecionados: {selectedFiles.length}/5
                  </p>
                </div>
              </div>
            )}
          </div>
          {isUploading && (
            <div className="w-full bg-neutral-200 rounded-full h-2.5">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setUploadModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={isUploading || selectedFiles.length === 0} className="btn-primary flex-1">
              {isUploading ? 'Enviando...' : 'Enviar Documentos'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
