import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileCheck2, Loader2, Upload, WalletCards } from "lucide-react";
import { toast } from "react-hot-toast";
import { Modal } from "../ui/Modal";
import { formatCurrency, formatDateTime, generateUUID } from "../../lib/utils";
import { uploadToR2 } from "../../lib/r2Storage";
import {
  cancelClientCreditWithdrawal,
  createCreditWithdrawal,
  quoteCreditWithdrawal,
  submitCreditWithdrawalDocuments
} from "../../features/creditWithdrawal/service";
const STATUS_LABELS = {
  aguardando_documentos: "Aguardando documentos",
  em_analise: "Em an\xE1lise",
  analise_reforcada: "An\xE1lise minuciosa",
  aprovado: "Aprovado para libera\xE7\xE3o",
  recusado: "N\xE3o aprovado",
  cancelado_cliente: "Cancelado",
  liberado: "Liberado"
};
function CreditWithdrawalModal({ isOpen, clientId, withdrawal, onClose, onChanged }) {
  const [current, setCurrent] = useState(withdrawal || null);
  const [value, setValue] = useState("");
  const [pixType, setPixType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [addressFile, setAddressFile] = useState(null);
  const numericValue = useMemo(() => {
    const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    return Number(normalized || 0);
  }, [value]);
  useEffect(() => {
    if (!isOpen) return;
    setCurrent(withdrawal || null);
    setValue("");
    setPixType("cpf");
    setPixKey("");
    setPhotoFile(null);
    setAddressFile(null);
  }, [isOpen, withdrawal?.id]);
  useEffect(() => {
    if (!isOpen || current) return;
    const timer = window.setTimeout(() => {
      setLoadingQuote(true);
      void quoteCreditWithdrawal(numericValue).then(setQuote).catch((error) => toast.error(error?.message || "N\xE3o foi poss\xEDvel calcular o saque.")).finally(() => setLoadingQuote(false));
    }, numericValue > 0 ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, current?.id, numericValue]);
  const handleCreate = async () => {
    if (!quote?.pode_solicitar || numericValue <= 0) {
      toast.error("Informe um valor que, somado \xE0 taxa, caiba no cr\xE9dito dispon\xEDvel.");
      return;
    }
    if (!pixKey.trim()) {
      toast.error("Informe a chave PIX para recebimento.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCreditWithdrawal(generateUUID(), numericValue, pixType, pixKey.trim());
      setCurrent({
        ...created,
        cliente_id: clientId,
        taxa_tipo: quote.taxa_tipo,
        taxa_config_valor: quote.taxa_config_valor,
        limite_disponivel_snapshot: quote.credito_disponivel_efetivo,
        valor_bloqueado: created.valor_total_fatura,
        criterio_cadastro_30d_ok: quote.criterio_cadastro_30d_ok,
        criterio_credito_100_ok: quote.criterio_credito_100_ok,
        pix_tipo: pixType,
        pix_chave_mascarada: "***",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await onChanged();
      toast.success(`Solicita\xE7\xE3o ${created.protocolo} registrada. Envie os documentos para iniciar a an\xE1lise.`);
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel solicitar o saque.");
    } finally {
      setSubmitting(false);
    }
  };
  const uploadDocument = async (file, kind) => {
    if (file.size > 10 * 1024 * 1024) throw new Error("Cada documento pode ter no m\xE1ximo 10 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const result = await uploadToR2(file, "documentos_cliente", `${clientId}/credit-withdrawal/${kind}-${Date.now()}-${generateUUID()}.${ext}`);
    return { path: result.path, name: file.name, mime_type: file.type, size: file.size };
  };
  const handleDocuments = async () => {
    if (!current || !photoFile || !addressFile) {
      toast.error("Envie o documento oficial com foto e o comprovante de endere\xE7o.");
      return;
    }
    setUploading(true);
    try {
      const [photoDocument, addressProof] = await Promise.all([
        uploadDocument(photoFile, "documento-foto"),
        uploadDocument(addressFile, "comprovante-endereco")
      ]);
      await submitCreditWithdrawalDocuments(current.id, photoDocument, addressProof);
      setCurrent({
        ...current,
        documento_foto: photoDocument,
        comprovante_endereco: addressProof,
        status: current.analise_reforcada ? "analise_reforcada" : "em_analise",
        prazo_analise: new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString()
      });
      await onChanged();
      toast.success(current.analise_reforcada ? "Documentos enviados. A an\xE1lise minuciosa foi iniciada." : "Documentos enviados. A an\xE1lise foi iniciada.");
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel enviar os documentos.");
    } finally {
      setUploading(false);
    }
  };
  const handleCancel = async () => {
    if (!current || !window.confirm("Cancelar esta solicita\xE7\xE3o de saque? O valor reservado voltar\xE1 a ficar dispon\xEDvel.")) return;
    setSubmitting(true);
    try {
      await cancelClientCreditWithdrawal(current.id);
      setCurrent({ ...current, status: "cancelado_cliente", valor_bloqueado: 0 });
      await onChanged();
      toast.success("Solicita\xE7\xE3o de saque cancelada.");
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel cancelar a solicita\xE7\xE3o.");
    } finally {
      setSubmitting(false);
    }
  };
  const activeCanCancel = Boolean(current && ["aguardando_documentos", "em_analise", "analise_reforcada"].includes(current.status));
  return /* @__PURE__ */ jsx(Modal, { isOpen, onClose, title: "Saque do Cr\xE9dito Dispon\xEDvel", size: "lg", children: /* @__PURE__ */ jsx("div", { className: "space-y-5", children: !current ? /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(WalletCards, { className: "mt-0.5 h-5 w-5 shrink-0 text-indigo-600" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-black text-indigo-950", children: "Simule antes de solicitar" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs leading-relaxed text-indigo-800", children: "O valor recebido via PIX ser\xE1 o valor do saque. A taxa \xE9 somada \xE0 opera\xE7\xE3o e o total ser\xE1 cobrado em uma \xFAnica fatura, com vencimento 30 dias ap\xF3s a libera\xE7\xE3o." })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-black text-neutral-700", children: "Valor que deseja receber via PIX" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          inputMode: "decimal",
          value,
          onChange: (event) => setValue(event.target.value),
          placeholder: "R$ 0,00",
          className: "w-full rounded-xl border border-neutral-200 px-4 py-3 text-lg font-black outline-none focus:border-indigo-400"
        }
      ),
      quote && /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[10px] text-neutral-500", children: [
        "M\xE1ximo para saque considerando a taxa: ",
        formatCurrency(quote.valor_maximo_saque)
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("label", { className: "block text-xs font-black text-neutral-700", children: [
        "Tipo de chave PIX",
        /* @__PURE__ */ jsxs("select", { value: pixType, onChange: (event) => setPixType(event.target.value), className: "mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none", children: [
          /* @__PURE__ */ jsx("option", { value: "cpf", children: "CPF" }),
          /* @__PURE__ */ jsx("option", { value: "cnpj", children: "CNPJ" }),
          /* @__PURE__ */ jsx("option", { value: "email", children: "E-mail" }),
          /* @__PURE__ */ jsx("option", { value: "telefone", children: "Telefone" }),
          /* @__PURE__ */ jsx("option", { value: "aleatoria", children: "Chave aleat\xF3ria" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "block text-xs font-black text-neutral-700", children: [
        "Chave PIX",
        /* @__PURE__ */ jsx("input", { value: pixKey, onChange: (event) => setPixKey(event.target.value), className: "mt-1 w-full rounded-xl border border-neutral-200 px-3 py-3 text-sm outline-none focus:border-indigo-400" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-neutral-200 bg-neutral-50 p-4", children: loadingQuote ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-5", children: /* @__PURE__ */ jsx(Loader2, { className: "h-5 w-5 animate-spin text-indigo-600" }) }) : quote && /* @__PURE__ */ jsxs("div", { className: "space-y-2 text-xs", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
        /* @__PURE__ */ jsx("span", { children: "Cr\xE9dito dispon\xEDvel efetivo" }),
        /* @__PURE__ */ jsx("strong", { children: formatCurrency(quote.credito_disponivel_efetivo) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
        /* @__PURE__ */ jsx("span", { children: "Valor do saque" }),
        /* @__PURE__ */ jsx("strong", { children: formatCurrency(numericValue) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          "Taxa de saque ",
          quote.taxa_tipo === "percentual" ? `(${quote.taxa_config_valor}%)` : "(fixa)"
        ] }),
        /* @__PURE__ */ jsx("strong", { children: formatCurrency(quote.taxa_calculada) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-2 flex justify-between border-t border-neutral-200 pt-2 text-sm", children: [
        /* @__PURE__ */ jsx("span", { className: "font-black", children: "Total da fatura" }),
        /* @__PURE__ */ jsx("strong", { className: "text-indigo-700", children: formatCurrency(quote.valor_total_fatura) })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-[10px] text-neutral-500", children: "Vencimento: 30 dias ap\xF3s a confirma\xE7\xE3o da libera\xE7\xE3o do saque." })
    ] }) }),
    quote && /* @__PURE__ */ jsxs("div", { className: `rounded-2xl border p-4 ${quote.analise_reforcada ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`, children: [
      /* @__PURE__ */ jsx("p", { className: `text-xs font-black ${quote.analise_reforcada ? "text-amber-900" : "text-emerald-900"}`, children: "Regras de libera\xE7\xE3o padr\xE3o" }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-2 text-xs", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          quote.criterio_cadastro_30d_ok ? /* @__PURE__ */ jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-600" }) : /* @__PURE__ */ jsx(AlertTriangle, { className: "h-4 w-4 text-amber-600" }),
          /* @__PURE__ */ jsxs("span", { children: [
            "Conta com pelo menos 30 dias \u2014 ",
            quote.criterio_cadastro_30d_ok ? "aprovada" : `n\xE3o aprovada (${quote.dias_cadastro} dias)`
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          quote.criterio_credito_100_ok ? /* @__PURE__ */ jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-600" }) : /* @__PURE__ */ jsx(AlertTriangle, { className: "h-4 w-4 text-amber-600" }),
          /* @__PURE__ */ jsxs("span", { children: [
            "Cr\xE9dito dispon\xEDvel acima de R$ 100 \u2014 ",
            quote.criterio_credito_100_ok ? "aprovada" : "n\xE3o aprovada"
          ] })
        ] })
      ] }),
      quote.analise_reforcada && /* @__PURE__ */ jsx("p", { className: "mt-3 text-[11px] font-semibold leading-relaxed text-amber-900", children: "Voc\xEA pode continuar. Como uma ou mais regras de libera\xE7\xE3o padr\xE3o ainda n\xE3o foram atendidas, a solicita\xE7\xE3o passar\xE1 por uma an\xE1lise minuciosa do sistema em at\xE9 72 horas e poder\xE1 ser aprovada ou recusada." })
    ] }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => void handleCreate(),
        disabled: submitting || loadingQuote || !quote?.pode_solicitar || !pixKey.trim(),
        className: "flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50",
        children: [
          submitting ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(WalletCards, { className: "h-4 w-4" }),
          "Solicitar saque e reservar cr\xE9dito"
        ]
      }
    )
  ] }) : current.status === "aguardando_documentos" ? /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-indigo-100 bg-indigo-50 p-4", children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs font-black uppercase tracking-wide text-indigo-800", children: current.protocolo }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm font-black text-neutral-900", children: "Agora envie os documentos obrigat\xF3rios" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs leading-relaxed text-neutral-600", children: "O sistema precisa de um documento oficial com foto e um comprovante de endere\xE7o para iniciar a an\xE1lise. O prazo de at\xE9 72 horas come\xE7a ap\xF3s o recebimento dos dois documentos." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-4 text-xs", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
        /* @__PURE__ */ jsx("span", { children: "Valor do saque" }),
        /* @__PURE__ */ jsx("strong", { children: formatCurrency(current.valor_solicitado) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-2 flex justify-between", children: [
        /* @__PURE__ */ jsx("span", { children: "Taxa de saque" }),
        /* @__PURE__ */ jsx("strong", { children: formatCurrency(current.taxa_calculada) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-2 flex justify-between border-t border-neutral-100 pt-2", children: [
        /* @__PURE__ */ jsx("span", { className: "font-black", children: "Fatura ap\xF3s libera\xE7\xE3o" }),
        /* @__PURE__ */ jsx("strong", { children: formatCurrency(current.valor_total_fatura) })
      ] })
    ] }),
    current.analise_reforcada && /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-relaxed text-amber-900", children: "Esta solicita\xE7\xE3o seguir\xE1 por an\xE1lise minuciosa porque uma ou mais regras de libera\xE7\xE3o padr\xE3o n\xE3o foram atendidas." }),
    /* @__PURE__ */ jsxs("label", { className: "block rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs font-bold text-neutral-700", children: [
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Upload, { className: "h-4 w-4" }),
        " Documento oficial com foto"
      ] }),
      /* @__PURE__ */ jsx("input", { type: "file", accept: "image/*,.pdf", className: "mt-3 block w-full text-[11px]", onChange: (event) => setPhotoFile(event.target.files?.[0] || null) }),
      photoFile && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[10px] text-emerald-700", children: [
        "Selecionado: ",
        photoFile.name
      ] })
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "block rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs font-bold text-neutral-700", children: [
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Upload, { className: "h-4 w-4" }),
        " Comprovante de endere\xE7o"
      ] }),
      /* @__PURE__ */ jsx("input", { type: "file", accept: "image/*,.pdf", className: "mt-3 block w-full text-[11px]", onChange: (event) => setAddressFile(event.target.files?.[0] || null) }),
      addressFile && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[10px] text-emerald-700", children: [
        "Selecionado: ",
        addressFile.name
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => void handleDocuments(),
        disabled: uploading || !photoFile || !addressFile,
        className: "flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-black text-white disabled:opacity-50",
        children: [
          uploading ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(FileCheck2, { className: "h-4 w-4" }),
          "Enviar documentos e iniciar an\xE1lise"
        ]
      }
    ),
    activeCanCancel && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void handleCancel(), disabled: submitting || uploading, className: "w-full rounded-xl border border-rose-200 px-4 py-3 text-xs font-black text-rose-700 disabled:opacity-50", children: "Cancelar solicita\xE7\xE3o" })
  ] }) : /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-neutral-50 p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-black uppercase tracking-wide text-neutral-700", children: current.protocolo }),
        /* @__PURE__ */ jsx("span", { className: "rounded-full bg-white px-3 py-1 text-[10px] font-black text-indigo-700 ring-1 ring-neutral-200", children: STATUS_LABELS[current.status] || current.status })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-2 text-xs sm:grid-cols-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-neutral-400", children: "Saque" }),
          /* @__PURE__ */ jsx("p", { className: "font-black", children: formatCurrency(current.valor_solicitado) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-neutral-400", children: "Taxa" }),
          /* @__PURE__ */ jsx("p", { className: "font-black", children: formatCurrency(current.taxa_calculada) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-neutral-400", children: "Fatura" }),
          /* @__PURE__ */ jsx("p", { className: "font-black text-indigo-700", children: formatCurrency(current.valor_total_fatura) })
        ] })
      ] })
    ] }),
    current.status === "analise_reforcada" && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
      /* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5 shrink-0 text-amber-600" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-black text-amber-900", children: "An\xE1lise minuciosa em andamento" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] leading-relaxed text-amber-900", children: "Uma ou mais regras de libera\xE7\xE3o padr\xE3o n\xE3o foram atendidas. O sistema avaliar\xE1 a solicita\xE7\xE3o e poder\xE1 aprovar ou recusar." })
      ] })
    ] }) }),
    ["em_analise", "analise_reforcada"].includes(current.status) && /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-indigo-100 bg-indigo-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(Clock, { className: "mt-0.5 h-5 w-5 text-indigo-600" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-black text-indigo-900", children: "Prazo de an\xE1lise: at\xE9 72 horas" }),
        current.prazo_analise && /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[10px] text-indigo-700", children: [
          "Prazo estimado at\xE9 ",
          formatDateTime(current.prazo_analise)
        ] })
      ] })
    ] }) }),
    current.status === "aprovado" && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-900", children: [
      /* @__PURE__ */ jsx("strong", { children: "Aprovado para libera\xE7\xE3o." }),
      " O valor continua reservado at\xE9 o sistema confirmar o pagamento via PIX. A fatura s\xF3 ser\xE1 criada depois da libera\xE7\xE3o."
    ] }),
    current.status === "liberado" && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-900", children: [
      /* @__PURE__ */ jsx("strong", { children: "Saque liberado via PIX." }),
      " A fatura foi gerada com vencimento em 30 dias ap\xF3s a libera\xE7\xE3o."
    ] }),
    current.motivo_decisao && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-neutral-200 bg-white p-4", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase text-neutral-500", children: "Decis\xE3o do sistema" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-neutral-700", children: current.motivo_decisao })
    ] }),
    activeCanCancel && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void handleCancel(), disabled: submitting, className: "w-full rounded-xl border border-rose-200 px-4 py-3 text-xs font-black text-rose-700 disabled:opacity-50", children: "Cancelar solicita\xE7\xE3o" })
  ] }) }) });
}
export {
  CreditWithdrawalModal
};
