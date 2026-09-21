import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import {
  Landmark,
  DollarSign,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Eye,
  Send,
  Gavel
} from "lucide-react";
import { supabase } from "../../../../lib/supabase";
import { useRealtimeSubscription } from "../../../../hooks/useRealtime";
import { callAdminRpc } from "../../../../lib/adminRpc";
import { formatCurrency, formatDate, formatDateTime, maskCurrency } from "../../../../lib/utils";
import { toast } from "react-hot-toast";
import { TacticalDataGrid } from "../shared/TacticalDataGrid";
import { CommandSlideOver } from "../shared/CommandSlideOver";
import { StatusBadge } from "../shared/StatusBadge";
import { CreditDisputesAdminPanel } from "./CreditDisputesAdminPanel";
import { CreditLimitCancellationsAdminPanel } from "./CreditLimitCancellationsAdminPanel";
import { CreditWithdrawalsAdminPanel } from "./CreditWithdrawalsAdminPanel";
function EmprestimosCreditoView({
  initialSubTab = "emprestimos",
  initialItemId,
  colaboradorNome,
  colaboradorId
}) {
  const [activeTab, setActiveTab] = useState(initialSubTab);
  const [emprestimos, setEmprestimos] = useState([]);
  const [selectedEmprestimo, setSelectedEmprestimo] = useState(null);
  const [isEmprestimoDrawerOpen, setIsEmprestimoDrawerOpen] = useState(false);
  const [loadingEmprestimos, setLoadingEmprestimos] = useState(true);
  const [isProposalDrawerOpen, setIsProposalDrawerOpen] = useState(false);
  const [proposalData, setProposalData] = useState({
    valorAprovado: "",
    taxaJuros: "3.5",
    prazoMeses: "12",
    taxaServico: "50",
    mensagem: "Proposta de microcr\xE9dito aprovada pela mesa de cr\xE9dito GSA.",
    validadeDias: 7
  });
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [isPayoffDrawerOpen, setIsPayoffDrawerOpen] = useState(false);
  const [payoffValor, setPayoffValor] = useState("");
  const [submittingPayoff, setSubmittingPayoff] = useState(false);
  const [creditoSolicitacoes, setCreditoSolicitacoes] = useState([]);
  const [selectedCredito, setSelectedCredito] = useState(null);
  const [isCreditoDrawerOpen, setIsCreditoDrawerOpen] = useState(false);
  const [loadingCredito, setLoadingCredito] = useState(true);
  const [isPreApproveDrawerOpen, setIsPreApproveDrawerOpen] = useState(false);
  const [creditLimitAprovado, setCreditLimitAprovado] = useState("");
  const [submittingPreApprove, setSubmittingPreApprove] = useState(false);
  const fetchEmprestimos = async () => {
    setLoadingEmprestimos(true);
    try {
      const { data, error } = await supabase.from("emprestimos").select(`
          *,
          clientes(id, nome, cpf, cnpj, email, telefone, saldo_carteira, codigo_cliente),
          emprestimo_parcelas(id, numero_parcela, valor, data_vencimento, status),
          emprestimo_documentos(id, tipo, arquivo_url, status)
        `).order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        setEmprestimos(data);
        if (initialItemId && activeTab === "emprestimos") {
          const emp = data.find((e) => e.id === initialItemId);
          if (emp) {
            setSelectedEmprestimo(emp);
            setIsEmprestimoDrawerOpen(true);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar empr\xE9stimos:", err);
    } finally {
      setLoadingEmprestimos(false);
    }
  };
  const fetchCredito = async () => {
    setLoadingCredito(true);
    try {
      const { data, error } = await supabase.from("loja_credito_solicitacoes").select(`
          *,
          clientes(id, nome, cpf, cnpj, email, telefone, codigo_cliente)
        `).order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        setCreditoSolicitacoes(data);
        if (initialItemId && activeTab === "credito") {
          const cred = data.find((c) => c.id === initialItemId);
          if (cred) {
            setSelectedCredito(cred);
            setIsCreditoDrawerOpen(true);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar solicita\xE7\xF5es de cr\xE9dito:", err);
    } finally {
      setLoadingCredito(false);
    }
  };
  useEffect(() => {
    fetchEmprestimos();
    fetchCredito();
  }, []);
  useRealtimeSubscription([
    { table: "emprestimos", onChange: fetchEmprestimos },
    { table: "emprestimo_parcelas", onChange: fetchEmprestimos },
    { table: "loja_credito_solicitacoes", onChange: fetchCredito }
  ]);
  const handleEnviarProposta = async () => {
    if (!selectedEmprestimo) return;
    const numValor = Number(proposalData.valorAprovado.replace(/[^\d]/g, "")) / 100;
    if (isNaN(numValor) || numValor <= 0) {
      toast.error("Informe um valor de cr\xE9dito v\xE1lido.");
      return;
    }
    setSubmittingProposal(true);
    try {
      const res = await callAdminRpc("gsa_admin_emprestimo_enviar_proposta", {
        p_emprestimo_id: selectedEmprestimo.id,
        p_valor_aprovado: numValor,
        p_taxa_juros: Number(proposalData.taxaJuros),
        p_prazo_meses: Number(proposalData.prazoMeses),
        p_taxa_servico: Number(proposalData.taxaServico),
        p_mensagem: proposalData.mensagem,
        p_validade_dias: Number(proposalData.validadeDias)
      });
      if (res && !res.success) throw new Error(res.error || "Erro ao enviar proposta.");
      toast.success("Proposta de empr\xE9stimo enviada ao cliente com sucesso!");
      setIsProposalDrawerOpen(false);
      setIsEmprestimoDrawerOpen(false);
      fetchEmprestimos();
    } catch (err) {
      console.error("Erro ao enviar proposta:", err);
      toast.error(err?.message || "Erro ao enviar proposta.");
    } finally {
      setSubmittingProposal(false);
    }
  };
  const handleAprovarEmprestimoDireto = async (emp) => {
    try {
      const res = await callAdminRpc("gsa_admin_emprestimo_aprovar", {
        p_emprestimo_id: emp.id
      });
      if (res && !res.success) throw new Error(res.error || "Erro ao aprovar.");
      toast.success("Empr\xE9stimo aprovado com sucesso!");
      fetchEmprestimos();
    } catch (err) {
      toast.error(err?.message || "Erro ao aprovar empr\xE9stimo.");
    }
  };
  const handleEnviarOfertaQuitacao = async () => {
    if (!selectedEmprestimo) return;
    const numValor = Number(payoffValor.replace(/[^\d]/g, "")) / 100;
    if (isNaN(numValor) || numValor <= 0) {
      toast.error("Informe um valor de quita\xE7\xE3o v\xE1lido.");
      return;
    }
    setSubmittingPayoff(true);
    try {
      const res = await callAdminRpc("gsa_admin_emprestimo_enviar_oferta_quitacao", {
        p_emprestimo_id: selectedEmprestimo.id,
        p_valor_oferta: numValor
      });
      if (res && !res.success) throw new Error(res.error || "Erro ao enviar oferta.");
      toast.success("Oferta de quita\xE7\xE3o antecipada enviada ao cliente!");
      setIsPayoffDrawerOpen(false);
      fetchEmprestimos();
    } catch (err) {
      toast.error(err?.message || "Erro ao enviar oferta de quita\xE7\xE3o.");
    } finally {
      setSubmittingPayoff(false);
    }
  };
  const handlePreAprovarCredito = async () => {
    if (!selectedCredito) return;
    if (selectedCredito.origem_pre_aprovado) {
      setSubmittingPreApprove(true);
      try {
        const res = await callAdminRpc("gsa_admin_approve_preapproved_credit_100", { p_solicitacao_id: selectedCredito.id });
        if (res && !res.success) throw new Error(res.error || "Erro ao liberar cr\xE9dito.");
        toast.success("Cr\xE9dito pr\xE9-aprovado de R$ 100,00 liberado para o cliente.");
        setIsPreApproveDrawerOpen(false);
        setIsCreditoDrawerOpen(false);
        fetchCredito();
      } catch (err) {
        toast.error(err?.message || "Erro ao liberar cr\xE9dito.");
      } finally {
        setSubmittingPreApprove(false);
      }
      return;
    }
    const numValor = Number(creditLimitAprovado.replace(/[^\d]/g, "")) / 100;
    if (isNaN(numValor) || numValor <= 0) {
      toast.error("Informe o limite de cr\xE9dito aprovado.");
      return;
    }
    setSubmittingPreApprove(true);
    try {
      const res = await callAdminRpc("gsa_admin_preaprovar_credito", {
        p_solicitacao_id: selectedCredito.id,
        p_limite_aprovado: numValor
      });
      if (res && !res.success) throw new Error(res.error || "Erro ao pr\xE9-aprovar cr\xE9dito.");
      toast.success("Cr\xE9dito pr\xE9-aprovado com sucesso!");
      setIsPreApproveDrawerOpen(false);
      setIsCreditoDrawerOpen(false);
      fetchCredito();
    } catch (err) {
      toast.error(err?.message || "Erro ao pr\xE9-aprovar cr\xE9dito.");
    } finally {
      setSubmittingPreApprove(false);
    }
  };
  const handleRecusarCredito = async (cred) => {
    const reason = prompt("Informe a justificativa da recusa de cr\xE9dito:");
    if (!reason || !reason.trim()) return;
    try {
      const res = await callAdminRpc("gsa_admin_recusar_credito", {
        p_solicitacao_id: cred.id,
        p_motivo: reason.trim()
      });
      if (res && !res.success) throw new Error(res.error || "Erro ao recusar cr\xE9dito.");
      toast.success("Solicita\xE7\xE3o de cr\xE9dito recusada.");
      fetchCredito();
    } catch (err) {
      toast.error(err?.message || "Erro ao recusar cr\xE9dito.");
    }
  };
  const emprestimoColumns = [
    {
      key: "id",
      header: "Contrato / Protocolo",
      width: "140px",
      render: (row) => /* @__PURE__ */ jsxs("span", { className: "font-mono font-bold text-slate-900 text-xs", children: [
        "#",
        row.id.slice(0, 8)
      ] })
    },
    {
      key: "cliente",
      header: "Cliente / Proponente",
      render: (row) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "font-semibold text-slate-900 text-xs truncate", children: row.clientes?.nome || "Cliente n\xE3o identificado" }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] text-slate-500 font-mono", children: row.clientes?.cpf || row.clientes?.codigo_cliente || "\u2014" })
      ] })
    },
    {
      key: "valor_solicitado",
      header: "Valor Solicitado",
      align: "right",
      width: "130px",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsx("span", { className: "font-mono font-bold text-slate-900 text-xs", children: formatCurrency(row.valor_solicitado || row.valor_aprovado) })
    },
    {
      key: "parcelas",
      header: "Parcelas",
      align: "center",
      width: "100px",
      render: (row) => /* @__PURE__ */ jsxs("span", { className: "font-mono text-xs text-slate-700", children: [
        row.prazo_meses || row.numero_parcelas || "\u2014",
        "x"
      ] })
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      width: "130px",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsx(StatusBadge, { status: row.status, size: "xs" })
    },
    {
      key: "acoes",
      header: "A\xE7\xF5es R\xE1pidas",
      align: "right",
      width: "160px",
      render: (row) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1.5", onClick: (e) => e.stopPropagation(), children: [
        ["analise", "solicitado", "pendente"].includes(row.status) && /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => {
              setSelectedEmprestimo(row);
              setProposalData({
                valorAprovado: maskCurrency((row.valor_solicitado || 1e3).toString()),
                taxaJuros: "3.5",
                prazoMeses: (row.prazo_meses || 12).toString(),
                taxaServico: "50",
                mensagem: "Proposta de microcr\xE9dito formalizada.",
                validadeDias: 7
              });
              setIsProposalDrawerOpen(true);
            },
            title: "Montar Proposta de Empr\xE9stimo",
            className: "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors",
            children: [
              /* @__PURE__ */ jsx(Send, { className: "h-3 w-3" }),
              /* @__PURE__ */ jsx("span", { children: "Proposta" })
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setSelectedEmprestimo(row);
              setIsEmprestimoDrawerOpen(true);
            },
            title: "Inspecionar Contrato",
            className: "p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors",
            children: /* @__PURE__ */ jsx(Eye, { className: "h-3.5 w-3.5" })
          }
        )
      ] })
    }
  ];
  const creditoColumns = [
    {
      key: "id",
      header: "Solicita\xE7\xE3o",
      width: "130px",
      render: (row) => /* @__PURE__ */ jsxs("span", { className: "font-mono font-bold text-slate-900 text-xs", children: [
        "#",
        row.id.slice(0, 8)
      ] })
    },
    {
      key: "cliente",
      header: "Cliente Solicitante",
      render: (row) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "font-semibold text-slate-900 text-xs truncate", children: row.clientes?.nome || "Cliente n\xE3o identificado" }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] text-slate-500 font-mono", children: row.clientes?.cpf || row.clientes?.cnpj || "\u2014" })
      ] })
    },
    {
      key: "limite_solicitado",
      header: "Limite Solicitado",
      align: "right",
      width: "140px",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsx("span", { className: "font-mono font-bold text-slate-900 text-xs", children: formatCurrency(row.limite_solicitado || row.limite_aprovado) })
    },
    {
      key: "status",
      header: "Status An\xE1lise",
      align: "center",
      width: "140px",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsx(StatusBadge, { status: row.status, size: "xs" })
    },
    {
      key: "acoes",
      header: "A\xE7\xF5es R\xE1pidas",
      align: "right",
      width: "160px",
      render: (row) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1.5", onClick: (e) => e.stopPropagation(), children: [
        ["analise", "documentos_pendentes"].includes(row.status) && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => {
                setSelectedCredito(row);
                setCreditLimitAprovado(maskCurrency((row.limite_solicitado || 1e3).toString()));
                setIsPreApproveDrawerOpen(true);
              },
              className: "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors",
              children: [
                /* @__PURE__ */ jsx(CheckCircle2, { className: "h-3 w-3" }),
                /* @__PURE__ */ jsx("span", { children: row.origem_pre_aprovado ? "Aprovar R$ 100" : "Pr\xE9-Aprovar" })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => handleRecusarCredito(row),
              className: "p-1 rounded text-rose-600 hover:bg-rose-50",
              children: /* @__PURE__ */ jsx(XCircle, { className: "h-4 w-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setSelectedCredito(row);
              setIsCreditoDrawerOpen(true);
            },
            className: "p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors",
            children: /* @__PURE__ */ jsx(Eye, { className: "h-3.5 w-3.5" })
          }
        )
      ] })
    }
  ];
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4 animate-fade-up", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 flex-wrap", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center bg-slate-200/70 p-1 rounded-xl border border-slate-200 gap-1", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setActiveTab("emprestimos"),
            className: `px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "emprestimos" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`,
            children: [
              /* @__PURE__ */ jsx(Landmark, { className: "h-3.5 w-3.5 text-indigo-600" }),
              /* @__PURE__ */ jsx("span", { children: "Mesa de Empr\xE9stimos & Financiamentos" }),
              /* @__PURE__ */ jsx("span", { className: "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800", children: emprestimos.filter((e) => ["solicitado", "analise", "pendente"].includes(e.status)).length })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setActiveTab("credito"),
            className: `px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "credito" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`,
            children: [
              /* @__PURE__ */ jsx(ShieldCheck, { className: "h-3.5 w-3.5 text-emerald-600" }),
              /* @__PURE__ */ jsx("span", { children: "Cr\xE9dito da Loja & Limites" }),
              /* @__PURE__ */ jsx("span", { className: "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800", children: creditoSolicitacoes.filter((c) => ["analise", "documentos_pendentes"].includes(c.status)).length })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setActiveTab("contestacoes"),
            className: `px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "contestacoes" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`,
            children: [
              /* @__PURE__ */ jsx(Gavel, { className: "h-3.5 w-3.5 text-amber-600" }),
              /* @__PURE__ */ jsx("span", { children: "Contesta\xE7\xF5es" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setActiveTab("saques_credito"),
            className: `px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "saques_credito" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`,
            children: [
              /* @__PURE__ */ jsx(DollarSign, { className: "h-3.5 w-3.5 text-indigo-600" }),
              /* @__PURE__ */ jsx("span", { children: "Saques de Cr\xE9dito" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setActiveTab("cancelamentos_limite"),
            className: `px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === "cancelamentos_limite" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`,
            children: [
              /* @__PURE__ */ jsx(XCircle, { className: "h-3.5 w-3.5 text-rose-600" }),
              /* @__PURE__ */ jsx("span", { children: "Cancelar Limites" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => {
            fetchEmprestimos();
            fetchCredito();
          },
          title: "Recarregar Dados",
          className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs",
          children: [
            /* @__PURE__ */ jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
            /* @__PURE__ */ jsx("span", { children: "Atualizar" })
          ]
        }
      )
    ] }),
    activeTab === "saques_credito" ? /* @__PURE__ */ jsx(CreditWithdrawalsAdminPanel, { initialItemId }) : activeTab === "cancelamentos_limite" ? /* @__PURE__ */ jsx(CreditLimitCancellationsAdminPanel, { initialItemId }) : activeTab === "contestacoes" ? /* @__PURE__ */ jsx(CreditDisputesAdminPanel, { initialItemId }) : activeTab === "emprestimos" ? /* @__PURE__ */ jsx(
      TacticalDataGrid,
      {
        title: "Esteira de Microcr\xE9dito & Empr\xE9stimos",
        subtitle: "An\xE1lise de score de risco, elabora\xE7\xE3o de propostas e despacho de contratos.",
        data: emprestimos,
        columns: emprestimoColumns,
        keyExtractor: (row) => row.id,
        isLoading: loadingEmprestimos,
        onRowClick: (row) => {
          setSelectedEmprestimo(row);
          setIsEmprestimoDrawerOpen(true);
        }
      }
    ) : /* @__PURE__ */ jsx(
      TacticalDataGrid,
      {
        title: "Subscri\xE7\xE3o de Limites de Cr\xE9dito Loja",
        subtitle: "Avalia\xE7\xE3o cadastral de pessoa f\xEDsica e jur\xEDdica para libera\xE7\xE3o de compras a prazo.",
        data: creditoSolicitacoes,
        columns: creditoColumns,
        keyExtractor: (row) => row.id,
        isLoading: loadingCredito,
        onRowClick: (row) => {
          setSelectedCredito(row);
          setIsCreditoDrawerOpen(true);
        }
      }
    ),
    /* @__PURE__ */ jsx(
      CommandSlideOver,
      {
        isOpen: isEmprestimoDrawerOpen,
        onClose: () => setIsEmprestimoDrawerOpen(false),
        title: selectedEmprestimo ? `Contrato de Empr\xE9stimo #${selectedEmprestimo.id.slice(0, 8)}` : "Detalhes",
        subtitle: selectedEmprestimo ? `Cliente: ${selectedEmprestimo.clientes?.nome}` : "",
        badge: selectedEmprestimo ? /* @__PURE__ */ jsx(StatusBadge, { status: selectedEmprestimo.status, size: "sm" }) : void 0,
        width: "lg",
        footer: selectedEmprestimo && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between w-full flex-wrap gap-2", children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: selectedEmprestimo.status === "ativo" && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => {
                setPayoffValor(maskCurrency((selectedEmprestimo.valor_aprovado * 0.85).toString()));
                setIsPayoffDrawerOpen(true);
              },
              className: "px-3 py-2 text-xs font-bold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-colors",
              children: "Oferta de Quita\xE7\xE3o Antecipada"
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: ["solicitado", "analise", "pendente"].includes(selectedEmprestimo.status) && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => {
                setProposalData({
                  valorAprovado: maskCurrency((selectedEmprestimo.valor_solicitado || 1e3).toString()),
                  taxaJuros: "3.5",
                  prazoMeses: (selectedEmprestimo.prazo_meses || 12).toString(),
                  taxaServico: "50",
                  mensagem: "Proposta formalizada pela mesa de cr\xE9dito.",
                  validadeDias: 7
                });
                setIsProposalDrawerOpen(true);
              },
              className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-2xs",
              children: "Montar Proposta de Cr\xE9dito"
            }
          ) })
        ] }),
        children: selectedEmprestimo && /* @__PURE__ */ jsxs("div", { className: "space-y-6 text-xs", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-500", children: "Valor Solicitado" }),
              /* @__PURE__ */ jsx("p", { className: "text-base font-mono font-bold text-slate-900 mt-0.5", children: formatCurrency(selectedEmprestimo.valor_solicitado) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 shadow-2xs", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-wider text-indigo-700", children: "Valor Aprovado" }),
              /* @__PURE__ */ jsx("p", { className: "text-base font-mono font-bold text-indigo-950 mt-0.5", children: formatCurrency(selectedEmprestimo.valor_aprovado || selectedEmprestimo.valor_solicitado) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-500", children: "Prazo / Parcelas" }),
              /* @__PURE__ */ jsxs("p", { className: "text-sm font-mono font-bold text-slate-900 mt-0.5", children: [
                selectedEmprestimo.prazo_meses || 12,
                "x de ~",
                formatCurrency((selectedEmprestimo.valor_aprovado || selectedEmprestimo.valor_solicitado) / (selectedEmprestimo.prazo_meses || 12))
              ] })
            ] })
          ] }),
          selectedEmprestimo.emprestimo_parcelas && selectedEmprestimo.emprestimo_parcelas.length > 0 && /* @__PURE__ */ jsxs("div", { className: "p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-xs font-bold text-slate-900 uppercase tracking-wider", children: "Cronograma de Amortiza\xE7\xE3o" }),
            /* @__PURE__ */ jsx("div", { className: "divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden font-mono", children: selectedEmprestimo.emprestimo_parcelas.map((p) => /* @__PURE__ */ jsxs("div", { className: "p-2.5 flex items-center justify-between bg-slate-50/50", children: [
              /* @__PURE__ */ jsxs("span", { children: [
                "Parcela ",
                p.numero_parcela,
                " (",
                formatDate(p.data_vencimento),
                ")"
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "font-bold", children: formatCurrency(p.valor) }),
                /* @__PURE__ */ jsx(StatusBadge, { status: p.status, size: "xs" })
              ] })
            ] }, p.id)) })
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      CommandSlideOver,
      {
        isOpen: isProposalDrawerOpen,
        onClose: () => setIsProposalDrawerOpen(false),
        title: "Enviar Proposta Formal de Empr\xE9stimo",
        subtitle: selectedEmprestimo ? `Proponente: ${selectedEmprestimo.clientes?.nome}` : "",
        width: "md",
        primaryAction: {
          label: "Enviar Proposta ao Cliente",
          onClick: handleEnviarProposta,
          loading: submittingProposal,
          variant: "primary",
          icon: /* @__PURE__ */ jsx(Send, { className: "h-4 w-4" })
        },
        secondaryAction: {
          label: "Cancelar",
          onClick: () => setIsProposalDrawerOpen(false)
        },
        children: /* @__PURE__ */ jsxs("div", { className: "space-y-4 text-xs", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Valor Aprovado (R$) *" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: proposalData.valorAprovado,
                  onChange: (e) => setProposalData((prev) => ({ ...prev, valorAprovado: maskCurrency(e.target.value) })),
                  className: "w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Taxa de Juros Mensal (%) *" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  step: "0.1",
                  value: proposalData.taxaJuros,
                  onChange: (e) => setProposalData((prev) => ({ ...prev, taxaJuros: e.target.value })),
                  className: "w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Prazo em Meses *" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  value: proposalData.prazoMeses,
                  onChange: (e) => setProposalData((prev) => ({ ...prev, prazoMeses: e.target.value })),
                  className: "w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Taxa de Abertura / TAC (R$)" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  value: proposalData.taxaServico,
                  onChange: (e) => setProposalData((prev) => ({ ...prev, taxaServico: e.target.value })),
                  className: "w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Mensagem Formal da Proposta" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                rows: 3,
                value: proposalData.mensagem,
                onChange: (e) => setProposalData((prev) => ({ ...prev, mensagem: e.target.value })),
                className: "w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 shadow-2xs"
              }
            )
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      CommandSlideOver,
      {
        isOpen: isPayoffDrawerOpen,
        onClose: () => setIsPayoffDrawerOpen(false),
        title: "Oferta de Quita\xE7\xE3o com Desconto",
        width: "sm",
        primaryAction: {
          label: "Enviar Oferta",
          onClick: handleEnviarOfertaQuitacao,
          loading: submittingPayoff,
          variant: "primary"
        },
        secondaryAction: {
          label: "Cancelar",
          onClick: () => setIsPayoffDrawerOpen(false)
        },
        children: /* @__PURE__ */ jsxs("div", { className: "space-y-4 text-xs", children: [
          /* @__PURE__ */ jsx("div", { className: "p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900", children: "Envie uma proposta de quita\xE7\xE3o com desconto sobre os juros vincendos para antecipa\xE7\xE3o de saldo devedor." }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Valor Promocional para Quita\xE7\xE3o (R$) *" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: payoffValor,
                onChange: (e) => setPayoffValor(maskCurrency(e.target.value)),
                className: "w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
              }
            )
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      CommandSlideOver,
      {
        isOpen: isPreApproveDrawerOpen,
        onClose: () => setIsPreApproveDrawerOpen(false),
        title: selectedCredito?.origem_pre_aprovado ? "Aprovar Libera\xE7\xE3o de R$ 100,00" : "Pr\xE9-Aprovar Limite de Cr\xE9dito Loja",
        subtitle: selectedCredito ? `Cliente: ${selectedCredito.clientes?.nome}` : "",
        width: "sm",
        primaryAction: {
          label: selectedCredito?.origem_pre_aprovado ? "Aprovar e Liberar R$ 100,00" : "Confirmar Pr\xE9-Aprova\xE7\xE3o",
          onClick: handlePreAprovarCredito,
          loading: submittingPreApprove,
          variant: "success"
        },
        secondaryAction: {
          label: "Cancelar",
          onClick: () => setIsPreApproveDrawerOpen(false)
        },
        children: /* @__PURE__ */ jsx("div", { className: "space-y-4 text-xs", children: selectedCredito?.origem_pre_aprovado ? /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900", children: [
          "O cliente solicitou a oferta universal de limite total de R$ 100,00. Ao aprovar, o limite ser\xE1 elevado at\xE9 R$ 100,00, preservando o valor j\xE1 utilizado.",
          /* @__PURE__ */ jsxs("p", { className: "mt-2 font-bold", children: [
            "Prazo da an\xE1lise: ",
            selectedCredito.prazo_analise ? formatDateTime(selectedCredito.prazo_analise) : "72 horas"
          ] })
        ] }) : /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 uppercase tracking-wider", children: "Limite Aprovado (R$) *" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: creditLimitAprovado,
              onChange: (e) => setCreditLimitAprovado(maskCurrency(e.target.value)),
              className: "w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900 shadow-2xs"
            }
          )
        ] }) })
      }
    ),
    /* @__PURE__ */ jsx(
      CommandSlideOver,
      {
        isOpen: isCreditoDrawerOpen,
        onClose: () => setIsCreditoDrawerOpen(false),
        title: selectedCredito ? `Solicita\xE7\xE3o de Cr\xE9dito #${selectedCredito.id.slice(0, 8)}` : "Detalhes",
        subtitle: selectedCredito ? `Cliente: ${selectedCredito.clientes?.nome}` : "",
        badge: selectedCredito ? /* @__PURE__ */ jsx(StatusBadge, { status: selectedCredito.status, size: "sm" }) : void 0,
        width: "md",
        children: selectedCredito && /* @__PURE__ */ jsxs("div", { className: "space-y-4 text-xs", children: [
          /* @__PURE__ */ jsxs("div", { className: "p-4 rounded-xl bg-slate-50 border border-slate-200", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold uppercase text-slate-500", children: "Limite Solicitado" }),
            /* @__PURE__ */ jsx("p", { className: "text-xl font-mono font-bold text-slate-900", children: formatCurrency(selectedCredito.limite_solicitado) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-xs font-bold text-slate-900 uppercase", children: "Dados do Cliente" }),
            /* @__PURE__ */ jsx("p", { className: "font-bold", children: selectedCredito.clientes?.nome }),
            /* @__PURE__ */ jsx("p", { className: "text-slate-500 font-mono", children: selectedCredito.clientes?.cpf || selectedCredito.clientes?.cnpj }),
            /* @__PURE__ */ jsx("p", { className: "text-slate-500", children: selectedCredito.clientes?.telefone || selectedCredito.clientes?.email })
          ] })
        ] })
      }
    )
  ] });
}
export {
  EmprestimosCreditoView
};
