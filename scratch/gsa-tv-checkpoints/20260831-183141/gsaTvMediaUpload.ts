import { sessionService } from './sessionService';

const API_BASE = String(import.meta.env.VITE_GSA_TV_API_URL || 'https://api.147-15-43-141.nip.io/gsa-tv').replace(/\/$/, '');

export type GsaTvUploadInput = {
  file: File;
  title: string;
  mediaKind?: 'program' | 'advertising' | 'identity' | 'filler';
  advertiserName?: string;
  campaignName?: string;
  rightsConfirmed: boolean;
  onProgress?: (percent: number) => void;
};

export function uploadGsaTvMedia(input: GsaTvUploadInput): Promise<{ id: string; state: string }> {
  const session = sessionService.getCurrentSession();
  if (!session?.sessaoId || !session?.sessionToken) return Promise.reject(new Error('Sua sessão administrativa expirou. Entre novamente.'));
  if (!input.file?.size) return Promise.reject(new Error('Selecione um arquivo válido.'));
  if (!input.rightsConfirmed) return Promise.reject(new Error('Confirme os direitos de utilização do material.'));
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', `${API_BASE}/media/upload`);
    request.setRequestHeader('content-type', input.file.type || 'application/octet-stream');
    request.setRequestHeader('x-gsa-session-id', session.sessaoId);
    request.setRequestHeader('x-gsa-session-token', session.sessionToken);
    request.setRequestHeader('x-file-name', encodeURIComponent(input.file.name));
    request.setRequestHeader('x-media-title', encodeURIComponent(input.title.trim()));
    request.setRequestHeader('x-media-kind', input.mediaKind || 'program');
    request.setRequestHeader('x-rights-confirmed', String(input.rightsConfirmed));
    if (input.advertiserName) request.setRequestHeader('x-advertiser-name', encodeURIComponent(input.advertiserName.trim()));
    if (input.campaignName) request.setRequestHeader('x-campaign-name', encodeURIComponent(input.campaignName.trim()));
    request.upload.onprogress = (event) => { if (event.lengthComputable) input.onProgress?.(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error('A conexão foi interrompida durante o envio.'));
    request.onabort = () => reject(new Error('O envio foi cancelado.'));
    request.onload = () => {
      let body: any = null;
      try { body = JSON.parse(request.responseText || '{}'); } catch { body = null; }
      if (request.status >= 200 && request.status < 300) return resolve(body);
      reject(new Error(body?.error || `Não foi possível enviar o arquivo (${request.status}).`));
    };
    request.send(input.file);
  });
}
