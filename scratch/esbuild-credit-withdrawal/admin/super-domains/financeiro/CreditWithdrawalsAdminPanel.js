import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, ExternalLink, Eye, FileText, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRealtimeSubscription } from "../../../../hooks/useRealtime";
import { useConfirm } from "../../../../hooks/useConfirm";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import { formatCurrency, formatDateTime } from "../../../../lib/utils";
import { getPrivateR2Url } from "../../../../lib/r2Storage";
import {
  confirmAdminCreditWithdrawalPix,
  decideAdminCreditWithdrawal,
  getAdminCreditWithdrawalDetails,
  listAdminCreditWithdrawals
} from "../../../../features/creditWithdrawal/service";
import { TacticalDataGrid } from "../shared/TacticalDataGrid";
import { CommandSlideOver } from "../shared/CommandSlideOver";
const ACTIVE = ["aguardando_documentos", "em_analise", "analise_reforcada", "aprovado"];
const LABELS = {
  aguardando_documentos: "Aguardando documentos",
  em_analise: "Em an\xE1lise",
  analise_reforcada: "An\xE1lise minuciosa",
  aprovado: "Aprovado para PIX",
  recusado: "N\xE3o aprovado",
  cancelado_cliente: "Cancelado pelo cliente",
  liberado: "Liberado"
};
function badgeClass(status) {
  if (status === "liberado") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "recusado" || status === "cancelado_cliente") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "analise_reforcada") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "aprovado") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}
function CreditWithdrawalsAdminPanel({ initialItemId }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState("ativas");
  const [reason, setReason] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const confirmHook = useConfirm();
  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await listAdminCreditWithdrawals();
      setItems(data);
      if (initialItemId) {
        const found = data.find((item) => item.id === initialItemId);
        if (found) setSelected(await getAdminCreditWithdrawalDetails(found.id));
      }
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel carregar os saques de cr\xE9dito.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void fetchItems();
  }, []);
  useRealtimeSubscription([
    { table: "notificacoes", onChange: () => void fetchItems() },
    { table: "clientes", onChange: () => void fetchItems() },
    { table: "faturas", onChange: () => void fetchItems() },
    { table: "loja_credito_movimentacoes", onChange: () => void fetchItems() }
  ]);
  const visible = useMemo(() => items.filter((item) => {
    if (filter === "todas") return true;
    const active = ACTIVE.includes(item.status);
    return filter === "ativas" ? active : !active;
  }), [items, filter]);
  const openItem = async (item) => {
    setActionLoading(true);
    try {
      setSelected(await getAdminCreditWithdrawalDetails(item.id));
      setReason("");
      setPaymentReference("");
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel abrir a solicita\xE7\xE3o.");
    } finally {
      setActionLoading(false);
    }
  };
  const openDocument = async (path) => {
    if (!path) return;
    try {
      const url = await getPrivateR2Url(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel abrir o documento.");
    }
  };
  const handleDecision = async (approve) => {
    if (!selected) return;
    if (!approve && reason.trim().length < 5) {
      toast.error("Informe o motivo da n\xE3o aprova\xE7\xE3o.");
      return;
    }
    const confirmed = await confirmHook.confirm({
      title: approve ? "Aprovar saque para libera\xE7\xE3o?" : "N\xE3o aprovar este saque?",
      message: approve ? "Esta a\xE7\xE3o apenas aprova a an\xE1lise. O cr\xE9dito continuar\xE1 reservado e nenhuma fatura ser\xE1 criada at\xE9 a confirma\xE7\xE3o do PIX pago." : "A reserva ser\xE1 liberada e o cliente receber\xE1 o motivo da decis\xE3o.",
      confirmLabel: approve ? "Aprovar para libera\xE7\xE3o" : "Confirmar n\xE3o aprova\xE7\xE3o",
      cancelLabel: "Voltar",
      variant: approve ? "info" : "danger"
    });
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await decideAdminCreditWithdrawal(selected.id, approve, reason);
      await fetchItems();
      setSelected(await getAdminCreditWithdrawalDetails(selected.id));
      toast.success(approve ? "Saque aprovado para libera\xE7\xE3o PIX." : "Saque n\xE3o aprovado.");
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel concluir a decis\xE3o.");
    } finally {
      setActionLoading(false);
    }
  };
  const handleConfirmPix = async () => {
    if (!selected) return;
    if (paymentReference.trim().length < 3) {
      toast.error("Informe a refer\xEAncia ou comprovante do pagamento PIX.");
      return;
    }
    const confirmed = await confirmHook.confirm({
      title: "Confirmar que o PIX foi pago?",
      message: `Ao confirmar, o sistema consumir\xE1 ${formatCurrency(selected.valor_total_fatura)} do limite e gerar\xE1 uma fatura com vencimento em 30 dias. Use somente ap\xF3s o PIX de ${formatCurrency(selected.valor_solicitado)} ter sido efetivamente enviado ao cliente.`,
      confirmLabel: "Confirmar PIX pago",
      cancelLabel: "Ainda n\xE3o foi pago",
      variant: "danger"
    });
    if (!confirmed) return;
    setActionLoading(true);
    try {
      await confirmAdminCreditWithdrawalPix(selected.id, paymentReference);
      await fetchItems();
      setSelected(await getAdminCreditWithdrawalDetails(selected.id));
      toast.success("PIX confirmado e fatura de 30 dias gerada.");
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel confirmar a libera\xE7\xE3o do PIX.");
    } finally {
      setActionLoading(false);
    }
  };
  const columns = [
    { key: "protocolo", header: "Protocolo", width: "150px", render: (row) => /* @__PURE__ */ jsx("span", { className: "font-mono text-[11px] font-black text-slate-900", children: row.protocolo }) },
    { key: "cliente_nome", header: "Cliente", render: (row) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-xs font-bold text-slate-900", children: row.cliente_nome || "Cliente" }),
      /* @__PURE__ */ jsx("p", { className: "text-[10px] text-slate-500", children: row.cliente_email || row.cliente_telefone || "\u2014" })
    ] }) },
    { key: "valor_solicitado", header: "Saque", width: "110px", align: "right", render: (row) => /* @__PURE__ */ jsx("span", { className: "font-mono text-xs font-black", children: formatCurrency(row.valor_solicitado) }) },
    { key: "taxa_calculada", header: "Taxa", width: "100px", align: "right", render: (row) => /* @__PURE__ */ jsx("span", { className: "font-mono text-xs font-bold text-slate-600", children: formatCurrency(row.taxa_calculada) }) },
    { key: "valor_total_fatura", header: "Fatura", width: "110px", align: "right", render: (row) => /* @__PURE__ */ jsx("span", { className: "font-mono text-xs font-black text-indigo-700", children: formatCurrency(row.valor_total_fatura) }) },
    { key: "analise_reforcada", header: "An\xE1lise", width: "125px", render: (row) => row.analise_reforcada ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-800 ring-1 ring-amber-200", children: "Minuciosa" }) : /* @__PURE__ */ jsx("span", { className: "rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-200", children: "Padr\xE3o" }) },
    { key: "status", header: "Status", width: "135px", render: (row) => /* @__PURE__ */ jsx("span", { className: `rounded-full border px-2 py-1 text-[9px] font-black ${badgeClass(row.status)}`, children: LABELS[row.status] || row.status }) },
    { key: "acao", header: "", width: "45px", align: "right", render: (row) => /* @__PURE__ */ jsx("button", { type: "button", onClick: (event) => {
      event.stopPropagation();
      void openItem(row);
    }, className: "rounded p-1.5 text-slate-600 hover:bg-slate-100", children: /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4" }) }) }
  ];
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx(ConfirmDialog, { ...confirmHook }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-indigo-50 p-2 text-indigo-700", children: /* @__PURE__ */ jsx(Banknote, { className: "h-4 w-4" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs font-black text-slate-900", children: "Saques de Cr\xE9dito" }),
          /* @__PURE__ */ jsx("p", { className: "text-[10px] text-slate-500", children: "An\xE1lise documental, libera\xE7\xE3o PIX e fatura em 30 dias." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs("select", { value: filter, onChange: (event) => setFilter(event.target.value), className: "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold", children: [
          /* @__PURE__ */ jsx("option", { value: "ativas", children: "Ativas" }),
          /* @__PURE__ */ jsx("option", { value: "encerradas", children: "Encerradas" }),
          /* @__PURE__ */ jsx("option", { value: "todas", children: "Todas" })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void fetchItems(), className: "rounded-lg border border-slate-200 p-2 text-slate-600", children: /* @__PURE__ */ jsx(RefreshCw, { className: `h-3.5 w-3.5 ${loading ? "animate-spin" : ""}` }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      TacticalDataGrid,
      {
        title: "Solicita\xE7\xF5es de Saque do Cr\xE9dito",
        subtitle: "A confirma\xE7\xE3o do PIX \xE9 separada da aprova\xE7\xE3o e \xE9 a \xFAnica etapa que gera a fatura.",
        data: visible,
        columns,
        keyExtractor: (row) => row.id,
        isLoading: loading,
        onRowClick: (row) => void openItem(row)
      }
    ),
    /* @__PURE__ */ jsx(CommandSlideOver, { isOpen: Boolean(selected), onClose: () => setSelected(null), title: selected ? `Saque ${selected.protocolo}` : "Saque de Cr\xE9dito", subtitle: selected?.cliente_nome || "", width: "lg", children: selected && /* @__PURE__ */ jsxs("div", { className: "space-y-5 text-xs", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-slate-500", children: "Valor do saque" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 font-mono text-lg font-black", children: formatCurrency(selected.valor_solicitado) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-slate-500", children: "Taxa" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 font-mono text-lg font-black", children: formatCurrency(selected.taxa_calculada) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-indigo-100 bg-indigo-50 p-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-indigo-600", children: "Fatura prevista" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 font-mono text-lg font-black text-indigo-700", children: formatCurrency(selected.valor_total_fatura) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: `rounded-xl border p-4 ${selected.analise_reforcada ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`, children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 font-black", children: [
          /* @__PURE__ */ jsx(AlertTriangle, { className: `h-4 w-4 ${selected.analise_reforcada ? "text-amber-600" : "text-emerald-600"}` }),
          selected.analise_reforcada ? "An\xE1lise minuciosa" : "Elegibilidade padr\xE3o atendida"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 grid gap-1 text-[11px] sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            "30 dias de cadastro: ",
            /* @__PURE__ */ jsx("strong", { children: selected.criterio_cadastro_30d_ok ? "Aprovado" : "N\xE3o aprovado" })
          ] }),
          /* @__PURE__ */ jsxs("span", { children: [
            "Cr\xE9dito acima de R$ 100: ",
            /* @__PURE__ */ jsx("strong", { children: selected.criterio_credito_100_ok ? "Aprovado" : "N\xE3o aprovado" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50 p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: `rounded-full border px-2.5 py-1 text-[10px] font-black ${badgeClass(selected.status)}`, children: LABELS[selected.status] || selected.status }),
          /* @__PURE__ */ jsxs("span", { className: "text-[10px] text-slate-500", children: [
            "Solicitado em ",
            formatDateTime(selected.created_at)
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            "PIX: ",
            /* @__PURE__ */ jsxs("strong", { children: [
              selected.pix_tipo.toUpperCase(),
              " \u2022 ",
              selected.pix_chave || selected.pix_chave_mascarada || "\u2014"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("span", { children: [
            "Reserva atual: ",
            /* @__PURE__ */ jsx("strong", { children: formatCurrency(selected.valor_bloqueado) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("button", { type: "button", disabled: !selected.documento_foto?.path, onClick: () => void openDocument(selected.documento_foto?.path), className: "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 font-black text-slate-700 disabled:opacity-40", children: [
          /* @__PURE__ */ jsx(FileText, { className: "h-4 w-4" }),
          " Documento com foto ",
          /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5" })
        ] }),
        /* @__PURE__ */ jsxs("button", { type: "button", disabled: !selected.comprovante_endereco?.path, onClick: () => void openDocument(selected.comprovante_endereco?.path), className: "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 font-black text-slate-700 disabled:opacity-40", children: [
          /* @__PURE__ */ jsx(FileText, { className: "h-4 w-4" }),
          " Comprovante de endere\xE7o ",
          /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5" })
        ] })
      ] }),
      ["em_analise", "analise_reforcada"].includes(selected.status) && /* @__PURE__ */ jsxs("div", { className: "space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4", children: [
        /* @__PURE__ */ jsx("textarea", { rows: 3, value: reason, onChange: (event) => setReason(event.target.value), placeholder: "Motivo obrigat\xF3rio para n\xE3o aprovar; opcional para aprova\xE7\xE3o...", className: "w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none" }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => void handleDecision(false), disabled: actionLoading || reason.trim().length < 5, className: "flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 font-black text-rose-700 disabled:opacity-50", children: [
            /* @__PURE__ */ jsx(XCircle, { className: "h-4 w-4" }),
            " N\xE3o aprovar"
          ] }),
          /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => void handleDecision(true), disabled: actionLoading, className: "flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 font-black text-white disabled:opacity-50", children: [
            actionLoading ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(CheckCircle2, { className: "h-4 w-4" }),
            " Aprovar para PIX"
          ] })
        ] })
      ] }),
      selected.status === "aprovado" && /* @__PURE__ */ jsxs("div", { className: "space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4", children: [
        /* @__PURE__ */ jsx("p", { className: "font-black text-rose-900", children: "Confirma\xE7\xE3o financeira da libera\xE7\xE3o" }),
        /* @__PURE__ */ jsxs("p", { className: "text-[11px] leading-relaxed text-rose-800", children: [
          "S\xF3 confirme depois que o PIX de ",
          formatCurrency(selected.valor_solicitado),
          " tiver sido efetivamente enviado. A confirma\xE7\xE3o consumir\xE1 ",
          formatCurrency(selected.valor_total_fatura),
          " do limite e criar\xE1 a fatura com vencimento em 30 dias."
        ] }),
        /* @__PURE__ */ jsx("input", { value: paymentReference, onChange: (event) => setPaymentReference(event.target.value), placeholder: "Refer\xEAncia, ID ou comprovante do PIX...", className: "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none" }),
        /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => void handleConfirmPix(), disabled: actionLoading || paymentReference.trim().length < 3, className: "flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2.5 font-black text-white disabled:opacity-50", children: [
          actionLoading ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx(Banknote, { className: "h-4 w-4" }),
          " Confirmar PIX pago e gerar fatura"
        ] })
      ] }),
      selected.motivo_decisao && /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-4", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase text-slate-500", children: "Motivo da decis\xE3o" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-slate-700", children: selected.motivo_decisao })
      ] }),
      (selected.eventos || []).length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx("p", { className: "font-black text-slate-900", children: "Linha do tempo" }),
        selected.eventos.map((event) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-100 bg-white p-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("strong", { className: "text-slate-800", children: event.titulo }),
            /* @__PURE__ */ jsx("span", { className: "text-[9px] text-slate-400", children: formatDateTime(event.ocorrido_em) })
          ] }),
          event.descricao && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] leading-relaxed text-slate-500", children: event.descricao })
        ] }, event.id))
      ] })
    ] }) })
  ] });
}
export {
  CreditWithdrawalsAdminPanel
};
