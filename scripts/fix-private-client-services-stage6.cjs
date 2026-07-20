const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'components', 'client', 'ClientServicos.tsx');
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrado ${count}.`);
  source = source.replace(search, replacement);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}: marcadores nao encontrados.`);
  source = source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
}

replaceOnce(
  "import { clientOperationalWrite } from '../../lib/clientOperationalWrite';\n",
  `import { clientOperationalWrite } from '../../lib/clientOperationalWrite';
import { removePrivateDocument, uploadPrivateDocument } from '../../lib/privateStorage';
`,
  'Importar armazenamento privado'
);

replaceBetween(
  '  const handleSubmitOSDocuments = async () => {',
  '  return (',
  `  const handleSubmitOSDocuments = async () => {
    if (!selectedOS) return;

    const docsSolicitados = selectedOS.documentos_solicitados_os || [];
    if (Object.keys(pendencyFiles).length < docsSolicitados.length) {
      toast.error('Envie todos os documentos solicitados.');
      return;
    }

    const uploadedReferences: string[] = [];
    let documentsPersisted = false;
    setIsSubmittingDocs(true);

    try {
      const novosAnexos: Array<{
        nome: string;
        url: string;
        mime_type: string;
        size: number;
      }> = [];

      for (let i = 0; i < docsSolicitados.length; i++) {
        const pendingFile = pendencyFiles[i];
        if (!pendingFile) continue;

        const uploaded = await uploadPrivateDocument(pendingFile, {
          scope: 'clientes',
          ownerId: selectedOS.cliente_id || clientId,
          context: 'ordens-servico',
          contextId: selectedOS.id,
        });

        uploadedReferences.push(uploaded.reference);
        novosAnexos.push({
          nome: docsSolicitados[i],
          url: uploaded.reference,
          mime_type: uploaded.mimeType,
          size: uploaded.size,
        });
      }

      const anexosFinais = [...(selectedOS.anexos_os || []), ...novosAnexos];

      await clientOperationalWrite(clientId, 'ordens_servico', 'update', {
        anexos_os: anexosFinais,
        documentos_solicitados_os: null,
      }, { id: selectedOS.id });
      documentsPersisted = true;

      await clientOperationalWrite(clientId, 'os_notas', 'insert', {
        os_id: selectedOS.id,
        nota: 'Cliente enviou os documentos solicitados.',
      });

      await notificationService.notifyAdmin(
        '📁 Documentos de OS Recebidos',
        \`O cliente enviou os documentos solicitados para a OS \${selectedOS.codigo_os}.\`,
        'vendas',
        'os_documento_enviado',
        { tab: 'os', itemId: selectedOS.id, prioridade: 'alta' },
      );

      toast.success('Documentos enviados com segurança!');
      setPendencyFiles({});
      setSelectedOS({
        ...selectedOS,
        anexos_os: anexosFinais,
        documentos_solicitados_os: null,
      });
    } catch (err: any) {
      if (!documentsPersisted && uploadedReferences.length > 0) {
        await Promise.allSettled(uploadedReferences.map(reference => removePrivateDocument(reference)));
      }
      toast.error(handleError(err, 'enviar documentos'));
    } finally {
      setIsSubmittingDocs(false);
    }
  };`,
  'Proteger documentos solicitados da OS'
);

replaceBetween(
  '  const handleEnviar = async (e: React.FormEvent) => {',
  '  return (',
  `  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!novaMensagem.trim() && !anexoFile) || enviando) return;

    setEnviando(true);
    let uploadedReference: string | null = null;
    let messagePersisted = false;

    try {
      let mensagemTexto = novaMensagem.trim();

      if (anexoFile) {
        const uploaded = await uploadPrivateDocument(anexoFile, {
          scope: 'clientes',
          ownerId: clientId,
          context: 'ordens-servico',
          contextId: osId,
        });
        uploadedReference = uploaded.reference;

        const safeDisplayName = uploaded.fileName.replace(/\\|/g, '_');
        const anexoStr = \`[ANEXO|\${safeDisplayName}|\${uploaded.reference}|\${uploaded.mimeType}]\`;
        mensagemTexto = mensagemTexto ? \`\${mensagemTexto}\\n\\n\${anexoStr}\` : anexoStr;
      }

      await clientOperationalWrite(clientId, 'os_suporte_mensagens', 'insert', {
        os_id: osId,
        remetente_tipo: remetenteTipo,
        remetente_id: remetenteId,
        mensagem: mensagemTexto,
      });
      messagePersisted = true;

      await notificationService.notifyAdmin(
        '💬 Nova Mensagem do Cliente',
        \`O cliente enviou uma nova mensagem na OS #\${osId.slice(0, 8)}.\`,
        'demandas',
        'sistema',
        { itemId: osId, tab: 'ativas', prioridade: 'normal' },
      );

      setNovaMensagem('');
      setAnexoFile(null);
    } catch (err) {
      if (!messagePersisted && uploadedReference) {
        await removePrivateDocument(uploadedReference).catch(() => undefined);
      }
      console.error('Erro ao enviar mensagem', err);
      toast.error('Erro ao enviar mensagem.');
    } finally {
      setEnviando(false);
    }
  };`,
  'Proteger anexos do chat da OS'
);

replaceOnce(
  `            const anexoMatch = msg.mensagem.match(/\\[ANEXO\\|(.*?)\\|(.*?)\\]/);
            const textContent = msg.mensagem.replace(/\\[ANEXO\\|.*?\\|.*?\\]/, '').trim();
            const fileName = anexoMatch ? anexoMatch[1] : null;
            const fileUrl = anexoMatch ? anexoMatch[2] : null;
            const isImage = fileName?.match(/\\.(jpg|jpeg|png|gif|webp)$/i);`,
  `            const anexoMatch = msg.mensagem.match(/\\[ANEXO\\|(.*?)\\|(.*?)(?:\\|(.*?))?\\]/);
            const textContent = msg.mensagem.replace(/\\[ANEXO\\|.*?\\|.*?(?:\\|.*?)?\\]/, '').trim();
            const fileName = anexoMatch ? anexoMatch[1] : null;
            const fileUrl = anexoMatch ? anexoMatch[2] : null;`,
  'Ler anexo privado e legado'
);

replaceOnce(
  `                  {anexoMatch && (
                    <button type="button" onClick={() => openFile(fileUrl!, fileName!)} className={\`block mt-1 overflow-hidden rounded-xl border \${isMe ? 'border-white/20' : 'border-neutral-200'} transition-opacity hover:opacity-90 cursor-pointer\`}>
                      {isImage ? (
                        <img src={fileUrl!} alt={fileName!} className="max-w-[200px] max-h-[200px] object-cover" />
                      ) : (
                        <div className={\`flex items-center gap-2 p-3 \${isMe ? 'bg-white/10' : 'bg-neutral-50'}\`}>
                          <Paperclip className={\`h-5 w-5 shrink-0 \${isMe ? 'text-white' : 'text-indigo-600'}\`} />
                          <span className={\`text-xs font-semibold truncate max-w-[150px] \${isMe ? 'text-white' : 'text-neutral-700'}\`}>{fileName}</span>
                        </div>
                      )}
                    </button>
                  )}`,
  `                  {anexoMatch && (
                    <button
                      type="button"
                      onClick={() => void openFile(fileUrl!, fileName!)}
                      className={\`mt-1 flex max-w-[240px] items-center gap-2 rounded-xl border p-3 transition-opacity hover:opacity-90 \${isMe ? 'border-white/20 bg-white/10' : 'border-neutral-200 bg-neutral-50'}\`}
                    >
                      <Paperclip className={\`h-5 w-5 shrink-0 \${isMe ? 'text-white' : 'text-indigo-600'}\`} />
                      <span className={\`truncate text-xs font-semibold \${isMe ? 'text-white' : 'text-neutral-700'}\`}>{fileName}</span>
                      <Download className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
                    </button>
                  )}`,
  'Evitar URL privada como src de imagem'
);

source = source.replace(
  'onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)}',
  'accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"\n                           onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)}',
);

fs.writeFileSync(file, source, 'utf8');
console.log('ClientServicos atualizado para documentos privados.');
