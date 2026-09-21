# Relatório de Investigação Técnica: Consulta Pública de Protocolo & Fluxo de Recurso de Resgates

**Agente Investigador:** `survey_explorer_2` (Teamwork Explorer)  
**Data:** 28 de Agosto de 2026  
**Escopo:** `src/components/public/ProtocolConsultPage.tsx`, Schema do Banco de Dados, Storage, Fluxo de Submissão de Recurso (Appeals), Realtime Sanitizado e Validações.

---

## 1. Sumário Executivo

A investigação detalhada da base de código revelou que a infraestrutura de banco de dados e contratos de backend para a funcionalidade de **Recurso de Resgates de Parceiros** foi completamente modelada e documentada na migration `supabase/migrations/20260828170000_partner_redemption_appeals.sql` e na Edge Function `supabase/functions/gsa-auth-session/index.ts`. No entanto, o componente público de frontend `src/components/public/ProtocolConsultPage.tsx` ainda está em uma versão preliminar que apenas exibe o status de recusa sem permitir a interposição do recurso nem exibir o histórico do protocolo ou o status do recurso em andamento.

Adicionalmente, detectou-se um problema de encoding UTF-8 pré-existente no arquivo do modal administrativo (`PartnerRedemptionDetailModal.tsx` com strings corrompidas como `Solicitao`, `No foi possível`, `Fundamentao`), que viola os testes de integridade (`src/tests/partner-redemption-appeals.test.ts`) e o requisito de UTF-8 estrito.

---

## 2. Diagnóstico Atual de `ProtocolConsultPage.tsx`

### 2.1. O que já está implementado
- **Formulário de Busca de Protocolo:**
  - Campo de entrada com formatação automática em maiúsculas (`inputCodigo.toUpperCase()`).
  - Leitura automática do query param `?codigo=PROT-RES-...` ao carregar a página.
  - Atualização do histórico da URL via `window.history.pushState`.
- **Exibição de Status Atual:**
  - `status === 'concluido'`: Exibe card de sucesso com botão para acessar o link de ativação da parceria (`link_ativacao`).
  - `status === 'recusado'`: Exibe card vermelho informando que a solicitação foi recusada, acompanhado da citação em destaque do `motivo_recusa`.
  - `status === 'pendente'` ou `'analise'`: Exibe card do modo 24h com pipeline animado de 3 etapas (*1. Registrado* [verde], *2. Emissão* [âmbar pulsante], *3. WhatsApp* [cinza]).
- **Cards Complementares:**
  - Card da Logo do Parceiro com animação lúdica SVG do cachorrinho (`AnimatedPuppyRunner`).
  - Card de Dados do Solicitante (Nome, WhatsApp, E-mail).
  - Card de Acompanhamento / Datas (`created_at`, `data_ativacao`).
  - Card de Suporte Oficial GSA via WhatsApp (`5511920857756`).

### 2.2. O que está FALTANDO em `ProtocolConsultPage.tsx`
1. **Botão de Ação "Entrar com recurso" / "Contestar a recusa":**
   - No estado `status === 'recusado'`, quando ainda **não** houver recurso submetido (`!result.recurso`), deve existir um botão de destaque (ex: `"Contestar a recusa"` / `"Entrar com recurso"`) que aciona o modal/drawer de apresentação de recurso.
2. **Modal / Formulário de Submissão de Recurso:**
   - Campo de justificativa / contestação (`contestacao_cliente`): `Textarea` obrigatório com validação de tamanho (mínimo de 20 caracteres, máximo de 4.000 caracteres) e contador de caracteres em tempo real.
   - Upload de evidências/anexos: Permitir que o cliente selecione até **3 fotos ou documentos** (JPG, PNG, PDF, WEBP, máx 5MB por arquivo) com pré-visualização, remoção individual e envio.
   - Envio e Idempotência: Geração de `idempotency_key` (UUID v4) para evitar envios duplicados em caso de instabilidade de rede.
   - Desafio WhatsApp (OTP): Integração opcional com `requestPartnerAppealVerification` e `submitPartnerAppeal` ou chamada RPC direta via service.
3. **Exibição do Recurso Submetido (Enforcement de Recurso Único):**
   - Quando `result.recurso` existir, o botão de novo recurso deve ser desabilitado/ocultado e substituído pelo Card de Status do Recurso:
     - Protocolo do Recurso (ex: `REC-2026-XXXXXXXX`).
     - Data de abertura (`aberto_em`).
     - Prazo limite para análise (`prazo_analise_em` - SLA de até 5 dias).
     - Status atual: `em_analise` ("Recurso em análise"), `deferido` ("Recurso aprovado"), `indeferido` ("Recurso negado").
     - Justificativa enviada pelo cliente.
     - Motivo da decisão do administrador (`motivo_decisao`), se indeferido.
4. **Linha do Tempo Auditável (Histórico do Protocolo):**
   - Seção `"Histórico do protocolo"` renderizando `result.eventos` (`parceiros_resgates_eventos`), mostrando a ordem cronológica dos fatos:
     - `solicitacao_criada`: Solicitação registrada.
     - `solicitacao_recusada`: Solicitação recusada com o motivo.
     - `recurso_interposto`: Recurso apresentado pelo cliente.
     - `recurso_deferido` / `recurso_indeferido`: Decisão do administrador.
     - `beneficio_liberado`: Benefício ativado.
5. **Correção da Subscrição Realtime (PII Protection):**
   - O código atual assina `table: 'parceiros_resgates'` (o que falha para anônimos devido ao RLS de proteção de dados pessoais).
   - Deve assinar `table: 'parceiros_resgates_public_status'` filtrando por `tracking_key=eq.${result.tracking_key}`.

---

## 3. Arquitetura do Banco de Dados & Schemas

A arquitetura para recursos de resgates é composta pelas seguintes tabelas no schema `public`:

### 3.1. `public.parceiros_resgates` (Tabela Base)
- **Campos:** `id` (uuid PK), `parceiro_id` (uuid FK), `cliente_id` (uuid FK opcional), `nome_completo` (text), `telefone` (text), `email` (text), `codigo_gerado` (text), `tipo_resgate` (text), `link_destino` (text), `link_ativacao` (text), `cupom` (text), `voucher` (text), `status` (text: `'pendente'`, `'analise'`, `'concluido'`, `'recusado'`), `alerta_duplicidade` (boolean), `justificativa_duplicidade` (text), `motivo_recusa` (text), `recusado_em` (timestamptz), `data_ativacao` (timestamptz), `data_cancelamento` (timestamptz), `auto_redirecionado` (boolean), `created_at` (timestamptz), `updated_at` (timestamptz).
- **RLS:** Acesso anônimo direto revogado (`REVOKE ALL ON public.parceiros_resgates FROM anon;`). Consultas públicas são feitas exclusivamente pela RPC `gsa_public_consultar_protocolo`.

### 3.2. `public.parceiros_resgates_recursos` (Recursos)
- **Campos:**
  - `id` (uuid PK DEFAULT gen_random_uuid())
  - `resgate_id` (uuid NOT NULL REFERENCES parceiros_resgates(id) ON DELETE CASCADE)
  - `protocolo_recurso` (text NOT NULL UNIQUE, ex: `REC-2026-ABC12345`)
  - `contestacao_cliente` (text NOT NULL, CHECK entre 20 e 4000 caracteres)
  - `status` (text NOT NULL DEFAULT 'em_analise', CHECK em `('em_analise', 'deferido', 'indeferido')`)
  - `aberto_em` (timestamptz NOT NULL DEFAULT now())
  - `prazo_analise_em` (timestamptz NOT NULL, calculado como `now() + interval '5 days'`)
  - `analisado_em` (timestamptz)
  - `motivo_decisao` (text, obrigatório se status for `'indeferido'`, entre 10 e 2000 caracteres)
  - `analisado_por` (uuid)
  - `idempotency_key` (uuid NOT NULL UNIQUE)
  - `anexos` (jsonb DEFAULT '[]'::jsonb — para URLs/caminhos dos até 3 arquivos anexados)
  - `created_at` / `updated_at` (timestamptz)
- **Restrições de Integridade:**
  - `CONSTRAINT parceiros_resgates_recursos_unico_por_resgate UNIQUE (resgate_id)`: **Garante matematicamente que apenas 1 recurso pode existir por resgate.**

### 3.3. `public.parceiros_resgates_eventos` (Timeline Pública Auditável)
- **Campos:**
  - `id` (uuid PK)
  - `resgate_id` (uuid FK)
  - `recurso_id` (uuid FK nullable)
  - `tipo` (text, ex: `'solicitacao_criada'`, `'solicitacao_recusada'`, `'recurso_interposto'`, `'recurso_deferido'`, `'recurso_indeferido'`, `'beneficio_liberado'`)
  - `titulo` (text)
  - `descricao_publica` (text)
  - `detalhes_privados` (jsonb NOT NULL DEFAULT '{}'::jsonb)
  - `ator_tipo` (text, CHECK em `'cliente'`, `'admin'`, `'colaborador'`, `'sistema'`)
  - `ator_id` (uuid)
  - `idempotency_key` (text UNIQUE)
  - `ocorrido_em` / `created_at` (timestamptz)

### 3.4. `public.parceiros_resgates_public_status` (Realtime Sanitizado)
- **Campos:** `resgate_id` (uuid PK), `tracking_key` (uuid NOT NULL UNIQUE), `revision` (bigint DEFAULT 1), `updated_at` (timestamptz).
- **Publicação:** Presente em `pg_publication_tables` para `pubname = 'supabase_realtime'`.
- **Segurança:** Não contém nenhum dado pessoal (sem nome, telefone, e-mail). O visitante anônimo apenas escuta mudanças de revisão filtradas por sua `tracking_key`.

### 3.5. `public.parceiros_resgates_recurso_desafios` & `notificacoes`
- Desafios OTP de 6 dígitos com hash SHA-256 e expiração em 10 minutos (máximo de 5 tentativas).
- Outbox transacional `parceiros_resgates_notificacoes` para envio resiliente de WhatsApp via background worker / n8n.

---

## 4. Análise do Fluxo de Submissão de Recurso & Upload de Evidências

### 4.1. Upload de até 3 Arquivos de Evidência
- **Requisito:** "O cliente deve poder enviar uma mensagem/justificativa e anexar até 3 fotos/documentos como evidência."
- **Storage Bucket Recomendado:**
  - Bucket `parceiros-midias` (já existente no schema com permissão pública e limites de 5MB) ou `documentos_cliente` / `parceiros-recursos`.
  - Estrutura de caminhos de arquivos: `recursos/{resgate_id}/{timestamp}_{safe_filename}`.
  - Formatos suportados: Imagens (`image/jpeg`, `image/png`, `image/webp`) e Documentos (`application/pdf`).
  - Limite por arquivo: 5 MB. Máximo de 3 arquivos simultâneos.
- **Armazenamento no Recurso:**
  - Array de objetos JSON salvo junto ao recurso ou nos eventos:
    ```json
    [
      { "name": "comprovante_residencia.pdf", "url": "https://...", "size": 1048576, "type": "application/pdf" },
      { "name": "foto_documento.jpg", "url": "https://...", "size": 524288, "type": "image/jpeg" }
    ]
    ```

### 4.2. Fluxo de Submissão do Cliente
1. **Verificação de Elegibilidade:**
   - Apenas resgates com `status === 'recusado'` e `!resgate.recurso` são elegíveis.
2. **Preenchimento do Formulário:**
   - Justificativa textual (mínimo 20 caracteres).
   - Seleção de 0 a 3 arquivos de evidência.
3. **Upload dos Anexos:**
   - Upload prévio dos arquivos para o storage gerando as URLs públicas ou referências seguras.
4. **Envio do Recurso:**
   - Chamada à API/RPC de criação de recurso (`submitPartnerAppeal` ou RPC `gsa_complete_partner_appeal`).
   - Registro automático do evento `'recurso_interposto'` na timeline.
   - Disparo de notificação transacional de WhatsApp para o cliente confirmando o recebimento e o protocolo do recurso (`REC-YYYY-XXXX`).
   - Disparo de notificação para o WhatsApp do Administrador.
5. **Atualização da Interface:**
   - Exibição de feedback de sucesso (toast / alerta visual).
   - Recarregar os dados do protocolo via `consultarProtocolo(codigo)`.
   - Exibição do card de recurso em análise e histórico atualizado.

---

## 5. Inventário de Componentes de UI & Bibliotecas Existentes

| Componente / Recurso | Localização / Pacote | Utilização no Fluxo de Recurso |
| :--- | :--- | :--- |
| **AccessibleDialog / Modal** | `src/components/ui/Modal.tsx` | Base acessível para o modal de submissão de recurso e visualização de anexos. |
| **SecureAttachmentButton** | `src/components/ui/SecureAttachmentButton.tsx` | Componente padrão para download/visualização segura de anexos e mídias. |
| **FileViewerContext** | `src/contexts/FileViewerContext.tsx` | Modal integrado para visualização de imagens e PDFs na interface. |
| **Toast Notifications** | `react-hot-toast` | Feedback imediato de sucesso, alerta e erros de validação. |
| **Ícones** | `lucide-react` | `AlertCircle`, `CheckCircle2`, `Clock`, `FileText`, `Upload`, `Image`, `Paperclip`, `Send`, `X`, `Sparkles`, `ShieldCheck`, `Trash2`. |
| **Máscaras & Utilitários** | `src/lib/utils.ts` | `maskPhone`, `formatDate`, `formatDateTime`. |
| **Realtime Hook** | `src/hooks/useRealtime.ts` | Subscrição reativa com debouncing e cleanup automático. |

---

## 6. Auditoria de Encoding UTF-8 (Strict UTF-8 Compliance)

### 6.1. Detecção de Caracteres Corrompidos
Na inspeção do arquivo `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`, foram identificados caracteres quebrados decorrentes de salvamento prévio sem UTF-8 estrito:
- Linha 548: `No informado` (ao invés de `Não informado`)
- Linha 621: `Solicitao Recusada` (ao invés de `Solicitação Recusada`)
- Linha 649: `No foi possível registrar a decisão` (ao invés de `Não foi possível registrar a decisão`)
- Linha 663: `Prazo de anlise` (ao invés de `Prazo de análise`)
- Linha 671: `Contestao apresentada` (ao invés de `Contestação apresentada`)
- Linha 685: `Fundamentao da decisão` (ao invés de `Fundamentação da decisão`)

### 6.2. Regras Estritas de Correção
- Todos os arquivos `.ts`, `.tsx`, `.sql` e templates de mensagens devem ser estritamente codificados em **UTF-8 sem BOM**.
- Nenhuma string deve conter entidades corrompidas (`Ã§`, `Ã£`, `Ã©`, `\uFFFD`).
- O teste unitário `src/tests/partner-redemption-appeals.test.ts` valida especificamente a ausência dessas corruptelas.

---

## 7. Roteiro de Implementação Recomendado para o Construtor

1. **Atualizar `src/components/public/ProtocolConsultPage.tsx`:**
   - Adicionar estado para controle do modal de recurso (`isAppealModalOpen`).
   - Implementar o Card de Recurso Ativo e a Seção de Linha do Tempo (`Histórico do protocolo`).
   - Criar o componente/modal de Submissão de Recurso com Textarea de justificativa e upload de até 3 arquivos.
   - Corrigir a subscrição Realtime para a tabela sanitizada `parceiros_resgates_public_status`.
   - Garantir a presença dos textos validados pelo teste (`"Contestar a recusa"` e `"Histórico do protocolo"`).
2. **Ajustar `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`:**
   - Corrigir todas as strings corrompidas para UTF-8 válido (`"Fundamentação da decisão"`, `"Solicitação Recusada"`, `"Contestação apresentada"`, etc.).
   - Incluir a exibição dos anexos/evidências submetidos pelo cliente no recurso.
3. **Garantir a Integração com as Notificações de WhatsApp em UTF-8:**
   - Validar mensagens automáticas de confirmação de recurso aberto e de veredito (deferido/indeferido) com caracteres acentuados íntegros.
