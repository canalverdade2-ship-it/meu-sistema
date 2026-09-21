import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import SignaturePad from "signature_pad";
import { Modal } from "../ui/Modal";
import "jspdf-autotable";
import { useWhatsAppDocument } from "../../hooks/useWhatsAppDocument";
import { useRealtimeSubscription } from "../../hooks/useRealtime";
import { generateExtratoPDF } from "../../lib/pdf";
import { whatsappNotificationService } from "../../lib/whatsappNotificationService";
import { uploadToR2 } from "../../lib/r2Storage";
import { supabase } from "../../lib/supabase";
import { notificationService } from "../../lib/notificationService";
import { clientOperationalWrite } from "../../lib/clientOperationalWrite";
import { callClientRpc } from "../../lib/clientRpc";
import {
  Landmark,
  FileText,
  Upload,
  CheckCircle2,
  Calendar,
  History,
  ShieldCheck,
  Clock,
  Info,
  DollarSign,
  ChevronRight,
  ArrowRight,
  Download,
  BadgeAlert,
  Loader2,
  X,
  XCircle,
  ClipboardList,
  CreditCard,
  Send,
  Package
} from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/utils";
import { toast } from "react-hot-toast";
import { validarCPF, validarCNPJ, validarEmail } from "../../utils/cpfValidator";
import { getProductDisplayCode } from "../../lib/productIdentification";
import { useConfirm } from "../../hooks/useConfirm";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CreditDisputeModal } from "./CreditDisputeModal";
import { listClientCreditDisputes } from "../../features/creditDisputes/service";
import { listClientCreditLimitCancellations, requestClientCreditLimitCancellation } from "../../features/creditLimitCancellation/service";
import { CreditWithdrawalModal } from "./CreditWithdrawalModal";
import { listClientCreditWithdrawals } from "../../features/creditWithdrawal/service";
function ClientMeuCredito({ clientId, cliente, onRefreshCliente, onNavigate, initialTab, initialItemId }) {
  const [solicitacao, setSolicitacao] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || "resumo");
  const [creditoTab, setCreditoTab] = useState("limite");
  const { isSendingWhatsApp, sendToWhatsApp } = useWhatsAppDocument();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isIncreaseModalOpen, setIsIncreaseModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [uploadingContrato, setUploadingContrato] = useState(false);
  const [cancellingIncrease, setCancellingIncrease] = useState(false);
  const confirmHook = useConfirm();
  const [showSign, setShowSign] = useState(false);
  const signCanvasRef = useRef(null);
  const signPadRef = useRef(null);
  const [limiteDesejado, setLimiteDesejado] = useState("");
  const [profileData, setProfileData] = useState({
    nome: cliente.nome || "",
    cpf: cliente.cpf || "",
    cnpj: cliente.cnpj || "",
    tipo_pessoa: cliente.tipo_pessoa || "pf",
    telefone: cliente.telefone || "",
    email: cliente.email || "",
    cep: cliente.cep || "",
    endereco: cliente.endereco || "",
    numero: cliente.numero || "",
    bairro: cliente.bairro || "",
    cidade: cliente.cidade || "",
    estado: cliente.estado || ""
  });
  const [selectedFatura, setSelectedFatura] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [creditoOrcamento, setCreditoOrcamento] = useState(null);
  const [creditoFaturasRelacionadas, setCreditoFaturasRelacionadas] = useState([]);
  const [loadingCreditoDetalhes, setLoadingCreditoDetalhes] = useState(false);
  const [faturaPointsDiscount, setFaturaPointsDiscount] = useState(null);
  const [faturaCupomDesconto, setFaturaCupomDesconto] = useState(null);
  const [filtroMesAmortizacao, setFiltroMesAmortizacao] = useState("todos");
  const [filtroMesExtrato, setFiltroMesExtrato] = useState("todos");
  const [filtroCompraAmortizacao, setFiltroCompraAmortizacao] = useState("todos");
  const [isAllAmortizacoesOpen, setIsAllAmortizacoesOpen] = useState(false);
  const [isAllExtratoOpen, setIsAllExtratoOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [creditDisputes, setCreditDisputes] = useState([]);
  const [selectedDisputeMovement, setSelectedDisputeMovement] = useState(null);
  const [creditLimitCancellations, setCreditLimitCancellations] = useState([]);
  const [creditWithdrawals, setCreditWithdrawals] = useState([]);
  const [isCreditWithdrawalModalOpen, setIsCreditWithdrawalModalOpen] = useState(false);
  const getFaturaCodigoOrcamento = (fat) => {
    if (!fat.itens_faturados || fat.itens_faturados.length === 0) return "";
    const item = fat.itens_faturados[0];
    if (item.codigo && item.codigo.startsWith("CRE-")) {
      return item.codigo.replace("CRE-", "");
    }
    const match = item.descricao?.match(/(#ODC-\d+)/);
    if (match) {
      return match[1];
    }
    return "";
  };
  const getComprasUnicas = () => {
    const codigos = /* @__PURE__ */ new Set();
    faturas.forEach((fat) => {
      const cod = getFaturaCodigoOrcamento(fat);
      if (cod) codigos.add(cod);
    });
    return Array.from(codigos).sort();
  };
  const getMesesFiltro = () => {
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Mar\xE7o",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro"
    ];
    const opcoes = [];
    const hoje = /* @__PURE__ */ new Date();
    let anoAtual = hoje.getFullYear();
    let mesAtual = hoje.getMonth();
    for (let i = 0; i < 12; i++) {
      opcoes.push({
        valor: `${anoAtual}-${String(mesAtual + 1).padStart(2, "0")}`,
        rotulo: `${meses[mesAtual]} de ${anoAtual}`
      });
      mesAtual--;
      if (mesAtual < 0) {
        mesAtual = 11;
        anoAtual--;
      }
    }
    return opcoes;
  };
  const handleOpenFaturaDetalhes = async (fat) => {
    setSelectedFatura(fat);
    setIsDetailOpen(true);
    setFaturaPointsDiscount(null);
    setFaturaCupomDesconto(null);
    setCreditoOrcamento(null);
    setCreditoFaturasRelacionadas([]);
    setLoadingCreditoDetalhes(true);
    try {
      let codigoOrcamento = "";
      if (fat.itens_faturados && fat.itens_faturados.length > 0) {
        const item = fat.itens_faturados[0];
        if (item.codigo && item.codigo.startsWith("CRE-")) {
          codigoOrcamento = item.codigo.replace("CRE-", "");
        } else {
          const match = item.descricao?.match(/(#ODC-\d+)/);
          if (match) {
            codigoOrcamento = match[1];
          }
        }
      }
      if (codigoOrcamento) {
        const { data: orcData } = await supabase.from("orcamentos").select(`
            *,
            ordens_compra (
              *,
              produtos (*)
            ),
            ordens_assinatura (
              *,
              assinaturas (*)
            )
          `).eq("codigo_orcamento", codigoOrcamento).maybeSingle();
        if (orcData) {
          setCreditoOrcamento(orcData);
          if (orcData.cupom_desconto_id) {
            const { data: cupom } = await supabase.from("cupons_loja").select("*").eq("id", orcData.cupom_desconto_id).maybeSingle();
            if (cupom) setFaturaCupomDesconto(cupom);
          }
          if (orcData.desconto_pontos_total) {
            setFaturaPointsDiscount(Number(orcData.desconto_pontos_total));
          }
          const { data: relatedFats } = await supabase.from("faturas").select("*").eq("cliente_id", clientId).eq("is_amortizacao_credito", true).order("data_vencimento", { ascending: true });
          if (relatedFats) {
            const filtered = relatedFats.filter((f) => {
              const item = f.itens_faturados?.[0];
              return item?.codigo === `CRE-${codigoOrcamento}` || item?.descricao?.includes(codigoOrcamento);
            });
            setCreditoFaturasRelacionadas(filtered);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar detalhes da fatura:", err);
    } finally {
      setLoadingCreditoDetalhes(false);
    }
  };
  const solicitarQuitacao = async () => {
    if (!creditoOrcamento) return;
    try {
      await callClientRpc("gsa_client_request_store_credit_settlement", {
        p_orcamento_id: creditoOrcamento.id
      });
      setCreditoOrcamento({ ...creditoOrcamento, status_quitacao_credito: "analise_quitacao" });
      toast.success("Solicita\xE7\xE3o de quita\xE7\xE3o enviada para an\xE1lise.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao solicitar quita\xE7\xE3o.");
    }
  };
  const gerarFaturaQuitacao = async () => {
    if (!creditoOrcamento || !creditoOrcamento.valor_quitacao_acordo) return;
    try {
      setSubmitting(true);
      const data = await callClientRpc("gsa_client_accept_store_credit_settlement", {
        p_orcamento_id: creditoOrcamento.id
      });
      const faturaId = data?.fatura_id;
      toast.success(data?.already_exists ? "A fatura de quita\xE7\xE3o j\xE1 estava gerada." : "Fatura de quita\xE7\xE3o gerada com sucesso!");
      setIsDetailOpen(false);
      loadData();
      onNavigate("financeiro", "faturas", faturaId);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar fatura de quita\xE7\xE3o.");
    } finally {
      setSubmitting(false);
    }
  };
  const recusarOfertaQuitacao = async () => {
    if (!creditoOrcamento) return;
    try {
      await callClientRpc("gsa_client_reject_store_credit_settlement", {
        p_orcamento_id: creditoOrcamento.id
      });
      setCreditoOrcamento({ ...creditoOrcamento, status_quitacao_credito: null, valor_quitacao_acordo: null });
      toast.success("Oferta recusada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao recusar oferta.");
    }
  };
  useEffect(() => {
    setProfileData({
      nome: cliente.nome || "",
      cpf: cliente.cpf || "",
      cnpj: cliente.cnpj || "",
      tipo_pessoa: cliente.tipo_pessoa || "pf",
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      cep: cliente.cep || "",
      endereco: cliente.endereco || "",
      numero: cliente.numero || "",
      bairro: cliente.bairro || "",
      cidade: cliente.cidade || "",
      estado: cliente.estado || ""
    });
  }, [cliente]);
  const loadData = async () => {
    try {
      setLoading(true);
      const { data: solData, error: solErr } = await supabase.from("loja_credito_solicitacoes").select("*").eq("cliente_id", clientId).order("created_at", { ascending: false });
      if (solErr) throw solErr;
      const currentSol = solData && solData.length > 0 ? solData[0] : null;
      setSolicitacao(currentSol);
      if (currentSol) {
        const { data: docsData, error: docsErr } = await supabase.from("loja_credito_documentos").select("*").eq("solicitacao_id", currentSol.id).order("created_at", { ascending: true });
        if (docsErr) throw docsErr;
        setDocumentos(docsData || []);
      }
      const { data: movData, error: movErr } = await supabase.from("loja_credito_movimentacoes").select("*").eq("cliente_id", clientId).order("created_at", { ascending: false });
      if (movErr) throw movErr;
      setMovimentacoes(movData || []);
      try {
        setCreditDisputes(await listClientCreditDisputes());
      } catch (disputeError) {
        console.warn("N\xE3o foi poss\xEDvel carregar as contesta\xE7\xF5es de cr\xE9dito:", disputeError);
        setCreditDisputes([]);
      }
      try {
        setCreditLimitCancellations(await listClientCreditLimitCancellations());
      } catch (cancelError) {
        console.warn("N\xE3o foi poss\xEDvel carregar os cancelamentos de limite:", cancelError);
        setCreditLimitCancellations([]);
      }
      try {
        setCreditWithdrawals(await listClientCreditWithdrawals());
      } catch (withdrawalError) {
        console.warn("N\xE3o foi poss\xEDvel carregar os saques de cr\xE9dito:", withdrawalError);
        setCreditWithdrawals([]);
      }
      const { data: fatData, error: fatErr } = await supabase.from("faturas").select("*").eq("cliente_id", clientId).eq("is_amortizacao_credito", true).order("data_vencimento", { ascending: true });
      if (fatErr) throw fatErr;
      setFaturas(fatData || []);
    } catch (err) {
      console.error("Erro ao carregar dados de cr\xE9dito:", err);
      toast.error("Erro ao carregar dados do seu cr\xE9dito.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, [clientId]);
  useRealtimeSubscription(
    [
      {
        table: "loja_credito_solicitacoes",
        filter: clientId ? `cliente_id=eq.${clientId}` : void 0,
        onChange: () => {
          loadData();
          onRefreshCliente();
        }
      },
      {
        table: "loja_credito_movimentacoes",
        filter: clientId ? `cliente_id=eq.${clientId}` : void 0,
        onChange: () => {
          loadData();
          onRefreshCliente();
        }
      },
      {
        table: "faturas",
        filter: clientId ? `cliente_id=eq.${clientId}` : void 0,
        onChange: () => {
          loadData();
          onRefreshCliente();
        }
      },
      {
        table: "clientes",
        filter: clientId ? `id=eq.${clientId}` : void 0,
        onChange: onRefreshCliente
      },
      {
        table: "loja_credito_documentos",
        onChange: loadData
      },
      {
        table: "notificacoes",
        filter: clientId ? `cliente_id=eq.${clientId}` : void 0,
        onChange: loadData
      }
    ],
    [clientId]
  );
  const activeCreditWithdrawal = creditWithdrawals.find((item) => ["aguardando_documentos", "em_analise", "analise_reforcada", "aprovado"].includes(item.status)) || null;
  const notifiedCreditWithdrawal = initialItemId ? creditWithdrawals.find((item) => item.id === initialItemId) || null : null;
  const creditWithdrawalForModal = notifiedCreditWithdrawal || activeCreditWithdrawal;
  useEffect(() => {
    if (initialItemId && creditWithdrawals.some((item) => item.id === initialItemId)) setIsCreditWithdrawalModalOpen(true);
  }, [initialItemId, creditWithdrawals]);
  const getCreditDisputeForMovement = (movementId) => creditDisputes.find((item) => item.movimentacao_id === movementId) || null;
  const isWithinDisputeWindow = (mov) => {
    if (mov.tipo !== "compra" || !mov.created_at) return false;
    return Date.now() <= new Date(mov.created_at).getTime() + 90 * 24 * 60 * 60 * 1e3;
  };
  const disputeStatusLabel = (status) => ({
    aberta: "Contesta\xE7\xE3o registrada",
    em_analise: "Contesta\xE7\xE3o em an\xE1lise",
    aguardando_documentos: "Aguardando documentos",
    deferida: "Contesta\xE7\xE3o aprovada",
    parcialmente_deferida: "Parcialmente aprovada",
    indeferida: "Contesta\xE7\xE3o n\xE3o aprovada",
    cancelada_cliente: "Contesta\xE7\xE3o cancelada",
    resolvida_por_estorno: "Resolvida por estorno"
  })[status] || "Ver contesta\xE7\xE3o";
  const renderCreditDisputeAction = (mov) => {
    if (mov.tipo !== "compra") return null;
    const dispute = getCreditDisputeForMovement(mov.id);
    if (dispute) return /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setSelectedDisputeMovement(mov), className: "mt-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[9.5px] font-black text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100", children: disputeStatusLabel(dispute.status) });
    if (!isWithinDisputeWindow(mov)) return /* @__PURE__ */ jsx("span", { className: "mt-1.5 block text-[9px] font-semibold text-neutral-400", children: "Prazo de contesta\xE7\xE3o encerrado" });
    return /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setSelectedDisputeMovement(mov), className: "mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[9.5px] font-black text-amber-700 ring-1 ring-amber-100 hover:bg-amber-100", children: "Contestar compra" });
  };
  const blockedCredit = Math.max(Number(cliente.limite_credito_bloqueado || 0), 0);
  const currentCreditUsed = Math.max(Number(cliente.limite_credito_total || 0) - Number(cliente.limite_credito_disponivel || 0), 0);
  const hasPendingCreditInvoice = faturas.some((fat) => fat.status !== "cancelado" && Number(fat.valor_final_pendente || 0) > 0.01);
  const activeCreditLimitCancellation = creditLimitCancellations.find((item) => ["solicitado", "em_analise"].includes(item.status)) || null;
  const isPreApprovedRequest = Boolean(solicitacao?.origem_pre_aprovado);
  const preApprovedAlreadyReleased = Boolean(cliente.credito_pre_aprovado_liberado_em);
  const handleRequestPreApprovedCredit = async () => {
    const confirmed = await confirmHook.confirm({
      title: "Solicitar libera\xE7\xE3o dos R$ 100,00?",
      message: "O cr\xE9dito continuar\xE1 indispon\xEDvel durante a an\xE1lise. O sistema ter\xE1 at\xE9 72 horas para aprovar ou recusar a libera\xE7\xE3o.",
      confirmLabel: "Solicitar libera\xE7\xE3o",
      cancelLabel: "Agora n\xE3o",
      variant: "info"
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const result = await callClientRpc("gsa_client_request_preapproved_credit_100");
      toast.success(result?.already_pending ? "A solicita\xE7\xE3o j\xE1 est\xE1 em an\xE1lise." : "Solicita\xE7\xE3o enviada. Prazo de an\xE1lise: at\xE9 72 horas.");
      await loadData();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel solicitar a libera\xE7\xE3o.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleRequestCreditLimitCancellation = async () => {
    if (blockedCredit > 0.01) {
      toast.error("Existe limite bloqueado por uma an\xE1lise financeira em andamento.");
      return;
    }
    if (currentCreditUsed > 0.01) {
      toast.error("O limite s\xF3 pode ser cancelado quando n\xE3o houver nenhum valor utilizado.");
      return;
    }
    if (hasPendingCreditInvoice) {
      toast.error("Quite ou regularize as faturas de cr\xE9dito pendentes antes de solicitar o cancelamento.");
      return;
    }
    const confirmed = await confirmHook.confirm({
      title: "Solicitar cancelamento do limite?",
      message: "Seu limite ser\xE1 enviado para an\xE1lise de cancelamento. At\xE9 a decis\xE3o, n\xE3o utilize o cr\xE9dito. A aprova\xE7\xE3o s\xF3 poder\xE1 ocorrer se o Limite Usado continuar em R$ 0,00.",
      confirmLabel: "Solicitar cancelamento",
      cancelLabel: "Manter meu limite",
      variant: "danger"
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const result = await requestClientCreditLimitCancellation();
      toast.success(`Solicita\xE7\xE3o ${result.protocolo} registrada.`);
      await loadData();
      onRefreshCliente();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel solicitar o cancelamento do limite.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleCreateSolicitacao = async (e, tipo = "adesao") => {
    e.preventDefault();
    const missingFields = [];
    if (!profileData.nome) missingFields.push("Nome Completo");
    if (profileData.tipo_pessoa === "pf" && !profileData.cpf) missingFields.push("CPF");
    if (profileData.tipo_pessoa === "pj" && !profileData.cnpj) missingFields.push("CNPJ");
    if (!profileData.telefone) missingFields.push("Telefone");
    if (!profileData.email) missingFields.push("E-mail");
    if (!profileData.cep) missingFields.push("CEP");
    if (!profileData.endereco) missingFields.push("Endere\xE7o");
    if (!profileData.numero) missingFields.push("N\xFAmero");
    if (missingFields.length > 0) {
      toast.error(`Preencha os campos obrigat\xF3rios: ${missingFields.join(", ")}`);
      return;
    }
    try {
      await clientOperationalWrite(clientId, "clientes", "update", {
        nome: profileData.nome,
        cpf: profileData.tipo_pessoa === "pf" ? profileData.cpf : cliente.cpf,
        cnpj: profileData.tipo_pessoa === "pj" ? profileData.cnpj : cliente.cnpj,
        telefone: profileData.telefone,
        email: profileData.email,
        cep: profileData.cep,
        endereco: profileData.endereco,
        numero: profileData.numero,
        bairro: profileData.bairro,
        cidade: profileData.cidade,
        estado: profileData.estado
      }, { id: clientId });
      const valorSolicitado = Number(limiteDesejado) || 0;
      await clientOperationalWrite(clientId, "loja_credito_solicitacoes", "insert", {
        tipo_solicitacao: tipo,
        limite_solicitado: valorSolicitado,
        status: "analise"
      });
      toast.success(
        tipo === "adesao" ? "Solicita\xE7\xE3o de cr\xE9dito enviada com sucesso! Entrou em an\xE1lise de 5 dias \xFAteis." : "Solicita\xE7\xE3o de altera\xE7\xE3o enviada! Ela ser\xE1 avaliada em at\xE9 5 dias \xFAteis."
      );
      await notificationService.notifyAdmin(
        tipo === "adesao" ? "Nova Solicita\xE7\xE3o de Cr\xE9dito \u{1F4B3}" : "Solicita\xE7\xE3o de Aumento de Cr\xE9dito \u{1F4C8}",
        `O cliente ${profileData.nome} solicitou R$ ${valorSolicitado.toFixed(2)} de limite de cr\xE9dito.`,
        "credito_loja",
        "cadastro_novo_cliente",
        { tab: "solicitacoes" }
      );
      onRefreshCliente();
      setIsRequestModalOpen(false);
      setIsIncreaseModalOpen(false);
      setLimiteDesejado("");
      loadData();
    } catch (err) {
      console.error("Erro ao enviar solicita\xE7\xE3o:", err);
      toast.error("Erro ao processar sua solicita\xE7\xE3o cadastral ou de cr\xE9dito.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleUploadDocumento = async (docId, file) => {
    try {
      setUploadingDocId(docId);
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/doc_${docId}_${Date.now()}.${fileExt}`;
      const filePath = `credito_documentos/${fileName}`;
      const { url: publicUrl, path: __r2Path } = await uploadToR2(file, "documentos_cliente", filePath);
      await clientOperationalWrite(clientId, "loja_credito_documentos", "update", {
        arquivo_url: publicUrl,
        status: "pendente",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { id: docId });
      toast.success("Documento enviado com sucesso!");
      await notificationService.notifyAdmin(
        "Documento de Cr\xE9dito Enviado \u{1F4C4}",
        `O cliente ${cliente.nome} enviou um documento solicitado para an\xE1lise de cr\xE9dito.`,
        "credito_loja",
        "documento_cliente_enviado",
        { tab: "solicitacoes" }
      );
      loadData();
    } catch (err) {
      console.error("Erro no upload do documento:", err);
      toast.error("Erro ao enviar o documento.");
    } finally {
      setUploadingDocId(null);
    }
  };
  const handleUploadContratoAssinado = async (file) => {
    if (!solicitacao) return;
    try {
      setUploadingContrato(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/contrato_assinado_${solicitacao.id}_${Date.now()}.${fileExt}`;
      const filePath = `credito_contratos/${fileName}`;
      const { url: publicUrl, path: __r2Path } = await uploadToR2(file, "documentos_cliente", filePath);
      await clientOperationalWrite(clientId, "loja_credito_solicitacoes", "update", {
        contrato_assinado_url: publicUrl,
        status: "contrato_assinado",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { id: solicitacao.id });
      toast.success("Contrato assinado enviado com sucesso!");
      await notificationService.notifyAdmin(
        "Contrato de Cr\xE9dito Assinado \u{1F58B}\uFE0F",
        `O cliente ${cliente.nome} anexou o contrato de cr\xE9dito devidamente assinado.`,
        "credito_loja",
        "emprestimo_assinado",
        { tab: "solicitacoes" }
      );
      loadData();
    } catch (err) {
      console.error("Erro no upload do contrato assinado:", err);
      toast.error("Erro ao enviar o contrato assinado.");
    } finally {
      setUploadingContrato(false);
    }
  };
  const openSignature = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowSign(true);
  };
  useEffect(() => {
    if (!showSign) return;
    const timer = setTimeout(() => {
      if (signCanvasRef.current) {
        try {
          signPadRef.current = new SignaturePad(signCanvasRef.current, { backgroundColor: "rgb(255,255,255)", penColor: "rgb(0,0,0)" });
          const canvas = signCanvasRef.current;
          canvas.width = canvas.offsetWidth * 2;
          canvas.height = canvas.offsetHeight * 2;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.scale(2, 2);
        } catch (err) {
          console.error("Erro ao instanciar SignaturePad:", err);
          toast.error("Erro ao iniciar assinatura.");
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [showSign]);
  const finishSignature = async () => {
    if (!signPadRef.current || signPadRef.current.isEmpty() || !solicitacao) {
      toast.error("Assine o contrato antes de concluir.");
      return;
    }
    try {
      setUploadingContrato(true);
      const dataUrl = signPadRef.current.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const signatureFile = new File([blob], "assinatura.png", { type: blob.type });
      const path = `credito_contratos/${clientId}/assinatura_${solicitacao.id}_${Date.now()}.png`;
      const { url: publicUrl, path: __r2Path } = await uploadToR2(signatureFile, "documentos_cliente", path);
      await clientOperationalWrite(clientId, "loja_credito_solicitacoes", "update", {
        contrato_assinado_url: publicUrl,
        status: "contrato_assinado",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { id: solicitacao.id });
      toast.success("Contrato assinado digitalmente com sucesso!");
      await notificationService.notifyAdmin(
        "Contrato de Cr\xE9dito Assinado \u{1F58B}\uFE0F",
        `O cliente ${cliente.nome} assinou o contrato de cr\xE9dito digitalmente na tela.`,
        "credito_loja",
        "emprestimo_assinado",
        { itemId: solicitacao.id, tab: "solicitacoes" }
      );
      setShowSign(false);
      loadData();
    } catch (err) {
      console.error("Erro ao assinar contrato digitalmente:", err);
      toast.error("Erro ao salvar sua assinatura digital.");
    } finally {
      setUploadingContrato(false);
    }
  };
  const renderSignaturePortal = () => {
    if (!showSign) return null;
    return ReactDOM.createPortal(
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4",
          onClick: () => setShowSign(false),
          children: /* @__PURE__ */ jsxs(
            "div",
            {
              className: "w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-black/5",
              onClick: (e) => e.stopPropagation(),
              children: [
                /* @__PURE__ */ jsxs("div", { className: "mb-5 flex items-center justify-between pb-4 border-b border-neutral-100", children: [
                  /* @__PURE__ */ jsx("h2", { className: "text-lg font-black text-neutral-900 uppercase tracking-tight", children: "Assinar Contrato" }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setShowSign(false),
                      className: "rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-all active:scale-95",
                      children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                  solicitacao?.contrato_url && /* @__PURE__ */ jsx("iframe", { src: solicitacao.contrato_url, className: "w-full h-64 rounded-xl border", title: "Contrato" }),
                  /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-xs font-black text-neutral-700 uppercase", children: "\u270D\uFE0F Assinatura do Cliente" }),
                    /* @__PURE__ */ jsx("div", { className: "bg-white rounded-xl ring-1 ring-neutral-300 overflow-hidden", style: { touchAction: "none" }, children: /* @__PURE__ */ jsx("canvas", { ref: signCanvasRef, className: "w-full", style: { height: "180px", width: "100%" } }) }),
                    /* @__PURE__ */ jsx("button", { type: "button", onClick: () => signPadRef.current?.clear(), className: "text-xs text-neutral-500 hover:text-red-500 font-bold", children: "\u{1F5D1}\uFE0F Limpar Assinatura" })
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: finishSignature,
                      disabled: uploadingContrato,
                      className: "w-full py-3 bg-[#1a1a1a] hover:bg-black text-white rounded-xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                      children: uploadingContrato ? /* @__PURE__ */ jsxs(Fragment, { children: [
                        /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }),
                        "Salvando Assinatura..."
                      ] }) : /* @__PURE__ */ jsx("span", { children: "\u2705 Concluir Assinatura" })
                    }
                  )
                ] })
              ]
            }
          )
        }
      ),
      document.body
    );
  };
  const getStatusText = (status) => {
    switch (status) {
      case "analise":
        return "Enviado para An\xE1lise";
      case "documentos_pendentes":
        return "Documentos Pendentes";
      case "pre_aprovado":
        return "Pr\xE9-Aprovado";
      case "contrato_pendente_assinatura":
        return "Aguardando Assinatura do Contrato";
      case "contrato_assinado":
        return "Contrato Assinado (Em Ativa\xE7\xE3o)";
      case "liberado":
        return "Cr\xE9dito Liberado";
      case "negado":
        return "Solicita\xE7\xE3o Recusada";
      case "cancelado":
        return "Solicita\xE7\xE3o Cancelada";
      default:
        return status;
    }
  };
  const getStatusColor = (status) => {
    switch (status) {
      case "liberado":
        return "text-emerald-600 bg-emerald-50 border-emerald-100";
      case "negado":
        return "text-rose-600 bg-rose-50 border-rose-100";
      case "cancelado":
        return "text-neutral-600 bg-neutral-50 border-neutral-200";
      case "analise":
        return "text-amber-600 bg-amber-50 border-amber-100";
      case "documentos_pendentes":
        return "text-purple-600 bg-purple-50 border-purple-100";
      case "pre_aprovado":
        return "text-indigo-600 bg-indigo-50 border-indigo-100";
      case "contrato_pendente_assinatura":
        return "text-indigo-600 bg-indigo-50 border-indigo-100";
      case "contrato_assinado":
        return "text-blue-600 bg-blue-50 border-blue-100";
      default:
        return "text-neutral-600 bg-neutral-50 border-neutral-100";
    }
  };
  const isLockoutActive = solicitacao?.status === "negado" && solicitacao.nova_tentativa_apos && new Date(solicitacao.nova_tentativa_apos) > /* @__PURE__ */ new Date();
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex justify-center items-center py-32", children: /* @__PURE__ */ jsx(Loader2, { className: "w-12 h-12 text-indigo-600 animate-spin" }) });
  }
  if ((!solicitacao || solicitacao.status === "negado" && !isLockoutActive) && Number(cliente.limite_credito_total || 0) <= 0) {
    return /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-8 max-w-5xl mx-auto", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-center max-w-2xl mx-auto mb-16", children: [
        /* @__PURE__ */ jsx("div", { className: "inline-flex h-20 w-20 items-center justify-center rounded-[2rem] bg-indigo-600 text-white shadow-xl shadow-indigo-100 mb-6", children: /* @__PURE__ */ jsx(Landmark, { className: "h-10 w-10" }) }),
        /* @__PURE__ */ jsx("h2", { className: "text-3xl md:text-5xl font-black text-[#1a1a1a] mb-4 tracking-tight", children: "GSA Store Credit" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-br from-indigo-900 via-indigo-950 to-neutral-950 text-white rounded-[3rem] p-8 md:p-14 text-center relative overflow-hidden shadow-2xl", children: [
        /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full filter blur-3xl -mr-16 -mt-16" }),
        /* @__PURE__ */ jsxs("div", { className: "relative z-10 max-w-xl mx-auto", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-2xl md:text-4xl font-black mb-4", children: "R$ 100,00 pr\xE9-aprovados para voc\xEA" }),
          /* @__PURE__ */ jsx("p", { className: "text-indigo-200/80 font-medium text-xs md:text-sm leading-relaxed mb-8", children: "Solicite a libera\xE7\xE3o. O valor entrar\xE1 em an\xE1lise por at\xE9 72 horas e somente ficar\xE1 dispon\xEDvel depois da aprova\xE7\xE3o do sistema." }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-center gap-3 sm:flex-row", children: [
            /* @__PURE__ */ jsxs("button", { onClick: () => void handleRequestPreApprovedCredit(), disabled: submitting, className: "inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-xs font-black uppercase tracking-wider text-indigo-900 shadow-xl transition-all hover:scale-105 hover:bg-neutral-50 disabled:opacity-50 md:text-sm", children: [
              submitting ? "Enviando..." : "Liberar os R$ 100",
              " ",
              /* @__PURE__ */ jsx(ArrowRight, { className: "w-4 h-4" })
            ] }),
            /* @__PURE__ */ jsx("button", { onClick: () => setIsRequestModalOpen(true), disabled: submitting, className: "inline-flex items-center justify-center gap-3 rounded-2xl border border-white/30 bg-white/10 px-8 py-4 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-white/20 md:text-sm", children: "Solicitar outro valor" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(ConfirmDialog, { ...confirmHook }),
      /* @__PURE__ */ jsx(ModalSolicitacao, { isOpen: isRequestModalOpen, onClose: () => setIsRequestModalOpen(false), profileData, setProfileData, limiteDesejado, setLimiteDesejado, onSubmit: (e) => handleCreateSolicitacao(e, "adesao"), submitting })
    ] });
  }
  if (isLockoutActive) {
    return /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-8 max-w-2xl mx-auto text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "inline-flex h-20 w-20 items-center justify-center rounded-[2rem] bg-rose-50 text-rose-600 border border-rose-100 shadow-sm mb-6 animate-bounce", children: /* @__PURE__ */ jsx(BadgeAlert, { className: "h-10 w-10" }) }),
      /* @__PURE__ */ jsx("h3", { className: "text-2xl font-black text-neutral-900 mb-2", children: "Solicita\xE7\xE3o Recusada" }),
      /* @__PURE__ */ jsx("p", { className: "text-neutral-500 text-sm leading-relaxed mb-6", children: "Sua solicita\xE7\xE3o de an\xE1lise de cr\xE9dito n\xE3o foi aceita pela equipe no momento." }),
      /* @__PURE__ */ jsxs("div", { className: "bg-rose-50 border border-rose-100 rounded-3xl p-6 mb-8 text-left", children: [
        /* @__PURE__ */ jsx("h4", { className: "text-xs font-black uppercase text-rose-800 tracking-wider mb-2", children: "Motivo da Recusa" }),
        /* @__PURE__ */ jsx("p", { className: "text-rose-900 text-sm leading-relaxed font-medium", children: solicitacao.motivo_negacao || "Perfil cadastral inconsistente com as pol\xEDticas de cr\xE9dito da loja." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-neutral-50 rounded-3xl p-6 border border-neutral-100 flex items-center justify-center gap-4", children: [
        /* @__PURE__ */ jsx(Clock, { className: "w-8 h-8 text-neutral-400" }),
        /* @__PURE__ */ jsxs("div", { className: "text-left", children: [
          /* @__PURE__ */ jsx("h5", { className: "text-xs font-black text-neutral-700 uppercase tracking-wide", children: "Nova Tentativa Permitida" }),
          /* @__PURE__ */ jsxs("p", { className: "text-neutral-500 text-sm font-medium", children: [
            "Voc\xEA poder\xE1 realizar uma nova solicita\xE7\xE3o a partir do dia ",
            /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: formatDate(solicitacao.nova_tentativa_apos) }),
            "."
          ] })
        ] })
      ] })
    ] });
  }
  const isEmAndamento = solicitacao && !["liberado", "negado", "cancelado"].includes(solicitacao.status);
  const handleCancelCreditIncrease = async () => {
    if (!solicitacao || solicitacao.tipo_solicitacao !== "alteracao" || solicitacao.status !== "analise") return;
    const confirmed = await confirmHook.confirm({
      title: "Cancelar aumento de cr\xE9dito?",
      message: "A solicita\xE7\xE3o deixar\xE1 imediatamente a fila de an\xE1lise. Esta a\xE7\xE3o n\xE3o pode ser desfeita.",
      confirmLabel: "Sim, cancelar solicita\xE7\xE3o",
      cancelLabel: "Manter em an\xE1lise",
      variant: "danger"
    });
    if (!confirmed) return;
    try {
      setCancellingIncrease(true);
      await callClientRpc("gsa_client_cancel_credit_increase_request", {
        p_solicitacao_id: solicitacao.id
      });
      toast.success("Solicita\xE7\xE3o de aumento de cr\xE9dito cancelada.");
      setIsTrackingModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel cancelar a solicita\xE7\xE3o.");
      await loadData();
    } finally {
      setCancellingIncrease(false);
    }
  };
  const renderAcompanhamento = (isModal = false) => /* @__PURE__ */ jsxs("div", { className: isModal ? "p-2" : "p-4 md:p-8 max-w-4xl mx-auto", children: [
    /* @__PURE__ */ jsx(ConfirmDialog, { ...confirmHook }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12", children: [
      /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h2", { className: "text-3xl font-black text-neutral-900 tracking-tight mt-1", children: "Acompanhamento de Cr\xE9dito" }) }),
      /* @__PURE__ */ jsx("div", { className: `px-4 py-2 rounded-full border text-xs font-bold ${getStatusColor(solicitacao.status)}`, children: getStatusText(solicitacao.status) })
    ] }),
    solicitacao.tipo_solicitacao === "alteracao" && solicitacao.status === "analise" && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => void handleCancelCreditIncrease(),
        disabled: cancellingIncrease,
        className: "mb-8 w-full rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50",
        children: cancellingIncrease ? "Cancelando solicita\xE7\xE3o..." : "Cancelar solicita\xE7\xE3o de aumento"
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "bg-indigo-50/60 border border-indigo-100 rounded-3xl p-6 mb-8 flex items-start gap-4", children: [
      /* @__PURE__ */ jsx(Info, { className: "w-5 h-5 text-indigo-600 shrink-0 mt-0.5" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-indigo-900", children: "Prazo de Resposta" }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-indigo-800 leading-relaxed mt-1", children: [
          "Nossa an\xE1lise tem o prazo padr\xE3o de at\xE9 ",
          /* @__PURE__ */ jsx("strong", { children: "5 dias \xFAteis" }),
          " para retorno da libera\xE7\xE3o de limite ou pedido de documentos adicionais."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl border border-neutral-100 shadow-sm p-8 mb-8", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-black text-neutral-900 mb-8", children: "Etapas da Solicita\xE7\xE3o" }),
      /* @__PURE__ */ jsxs("div", { className: "relative border-l-2 border-neutral-100 pl-8 space-y-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute -left-[41px] top-0.5 bg-emerald-500 rounded-full p-1.5 text-white", children: /* @__PURE__ */ jsx(CheckCircle2, { className: "w-4 h-4" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-neutral-900", children: "Solicita\xE7\xE3o Enviada" }),
            /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 mt-1", children: [
              "Limite desejado: ",
              formatCurrency(solicitacao.limite_solicitado || 0)
            ] }),
            /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-400 mt-0.5", children: [
              "Enviado em ",
              formatDateTime(solicitacao.created_at)
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: `absolute -left-[41px] top-0.5 rounded-full p-1.5 text-white ${["documentos_pendentes", "pre_aprovado", "contrato_pendente_assinatura", "contrato_assinado", "liberado"].includes(solicitacao.status) ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`, children: /* @__PURE__ */ jsx(Clock, { className: "w-4 h-4" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-neutral-900", children: "An\xE1lise de Perfil" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 mt-1", children: "Nossa equipe financeira est\xE1 avaliando o limite cadastral solicitado." })
          ] })
        ] }),
        (solicitacao.status === "documentos_pendentes" || documentos.length > 0) && /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: `absolute -left-[41px] top-0.5 rounded-full p-1.5 text-white ${["pre_aprovado", "contrato_pendente_assinatura", "contrato_assinado", "liberado"].includes(solicitacao.status) ? "bg-emerald-500" : "bg-purple-500 animate-pulse"}`, children: /* @__PURE__ */ jsx(FileText, { className: "w-4 h-4" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-neutral-900", children: "Documentos Adicionais" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 mt-1 mb-4", children: "Documenta\xE7\xE3o extra necess\xE1ria para dar prosseguimento ao limite." }),
            /* @__PURE__ */ jsx("div", { className: "space-y-3 max-w-xl", children: documentos.map((doc) => /* @__PURE__ */ jsxs("div", { className: "p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-neutral-800", children: doc.nome_documento }),
                doc.observacao && /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-500 mt-0.5", children: [
                  "Obs: ",
                  doc.observacao
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { children: doc.arquivo_url ? /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: `text-[10px] font-bold px-2 py-0.5 rounded ${doc.status === "aprovado" ? "text-emerald-700 bg-emerald-100" : doc.status === "rejeitado" ? "text-rose-700 bg-rose-100" : "text-amber-700 bg-amber-100"}`, children: doc.status === "aprovado" ? "Aprovado" : doc.status === "rejeitado" ? "Rejeitado (Reenviar)" : "Aguardando An\xE1lise" }),
                doc.status === "rejeitado" && /* @__PURE__ */ jsxs("label", { className: "cursor-pointer p-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors", title: "Reenviar documento", children: [
                  /* @__PURE__ */ jsx(Upload, { className: "w-3.5 h-3.5" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "file",
                      className: "hidden",
                      onChange: (e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDocumento(doc.id, file);
                      }
                    }
                  )
                ] })
              ] }) : /* @__PURE__ */ jsxs("label", { className: "cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all", children: [
                uploadingDocId === doc.id ? /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin text-neutral-500" }) : /* @__PURE__ */ jsx(Upload, { className: "w-3.5 h-3.5" }),
                "Upload",
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "file",
                    className: "hidden",
                    disabled: uploadingDocId !== null,
                    onChange: (e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadDocumento(doc.id, file);
                    }
                  }
                )
              ] }) })
            ] }, doc.id)) })
          ] })
        ] }),
        ["pre_aprovado", "contrato_pendente_assinatura", "contrato_assinado", "liberado"].includes(solicitacao.status) && /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx("div", { className: `absolute -left-[41px] top-0.5 rounded-full p-1.5 text-white ${["contrato_assinado", "liberado"].includes(solicitacao.status) ? "bg-emerald-500" : "bg-indigo-500 animate-pulse"}`, children: /* @__PURE__ */ jsx(ShieldCheck, { className: "w-4 h-4" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-neutral-900", children: "Aprova\xE7\xE3o & Contrata\xE7\xE3o" }),
            /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 mt-1", children: [
              "Cr\xE9dito pr\xE9-aprovado no limite de ",
              /* @__PURE__ */ jsx("strong", { className: "text-neutral-900", children: formatCurrency(solicitacao.limite_aprovado || 0) }),
              "."
            ] }),
            solicitacao.contrato_url ? /* @__PURE__ */ jsxs("div", { className: "mt-4 p-5 rounded-3xl border border-indigo-100 bg-indigo-50/20 max-w-xl", children: [
              /* @__PURE__ */ jsx("h5", { className: "text-xs font-black uppercase text-indigo-900 tracking-wider mb-2", children: "Contrato de Abertura de Cr\xE9dito" }),
              /* @__PURE__ */ jsx("p", { className: "text-[11px] text-neutral-500 leading-relaxed mb-4", children: "Para ativar o seu limite de cr\xE9dito, abra e assine o contrato digitalmente direto na tela." }),
              solicitacao.status === "contrato_pendente_assinatura" && solicitacao.motivo_negacao && /* @__PURE__ */ jsxs("div", { className: "mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs", children: [
                /* @__PURE__ */ jsx("span", { className: "font-black block uppercase text-[10px] tracking-wider text-rose-800 mb-1", children: "\u26A0\uFE0F Assinatura de Contrato Rejeitada" }),
                /* @__PURE__ */ jsx("span", { className: "font-bold", children: solicitacao.motivo_negacao })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [
                /* @__PURE__ */ jsxs(
                  "a",
                  {
                    href: solicitacao.contrato_url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm",
                    children: [
                      /* @__PURE__ */ jsx(Download, { className: "w-3.5 h-3.5" }),
                      "Baixar Contrato PDF"
                    ]
                  }
                ),
                solicitacao.contrato_assinado_url ? /* @__PURE__ */ jsxs(
                  "a",
                  {
                    href: solicitacao.contrato_assinado_url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-sm",
                    children: [
                      /* @__PURE__ */ jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600" }),
                      "Visualizar Contrato Assinado"
                    ]
                  }
                ) : /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: openSignature,
                    disabled: uploadingContrato,
                    className: "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200",
                    children: uploadingContrato ? /* @__PURE__ */ jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }) : /* @__PURE__ */ jsx("span", { children: "\u270D\uFE0F Assinar Contrato" })
                  }
                )
              ] })
            ] }) : /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-400 italic mt-2", children: "Aguarde enquanto o sistema prepara o contrato de cr\xE9dito para sua assinatura." })
          ] })
        ] })
      ] })
    ] }),
    renderSignaturePortal()
  ] });
  if (isEmAndamento && solicitacao?.tipo === "adesao") {
    return renderAcompanhamento(false);
  }
  return /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-8 max-w-6xl mx-auto space-y-8", children: [
    /* @__PURE__ */ jsx(ConfirmDialog, { ...confirmHook }),
    isEmAndamento && /* @__PURE__ */ jsxs("div", { className: "bg-indigo-50 border border-indigo-200 rounded-[2rem] p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("h4", { className: "text-sm font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Clock, { className: "w-5 h-5 text-indigo-600" }),
          isPreApprovedRequest ? "Libera\xE7\xE3o do Cr\xE9dito Pr\xE9-Aprovado em An\xE1lise" : "Solicita\xE7\xE3o de Aumento de Limite em Andamento"
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-indigo-700/80 font-semibold mt-1", children: [
          "Status atual: ",
          getStatusText(solicitacao.status)
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setIsTrackingModalOpen(true),
          className: "px-6 py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-colors shrink-0",
          children: "Acompanhar Solicita\xE7\xE3o"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between gap-1 sm:gap-2 pb-2 border-b border-neutral-100 w-full mt-2", children: [
      { id: "limite", label: "Meu Limite", icon: CreditCard },
      { id: "faturas", label: "Faturas", icon: FileText },
      { id: "extrato", label: "Extrato", icon: History }
    ].map((tab) => /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setCreditoTab(tab.id),
        className: `flex-1 flex justify-center items-center gap-1.5 sm:gap-2 px-1 sm:px-4 py-3.5 sm:py-4 text-[11px] sm:text-sm font-black uppercase tracking-[0.02em] sm:tracking-wider whitespace-nowrap transition-all border-b-2 ${creditoTab === tab.id ? "border-indigo-600 text-indigo-900 bg-indigo-50/50 rounded-t-xl" : "border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-t-xl"}`,
        children: [
          /* @__PURE__ */ jsx(tab.icon, { className: `w-4 h-4 sm:w-4 sm:h-4 ${creditoTab === tab.id ? "text-indigo-600" : "text-neutral-400"}` }),
          tab.label
        ]
      },
      tab.id
    )) }),
    creditoTab === "limite" && /* @__PURE__ */ jsxs("div", { className: "space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500", children: [
      Number(cliente.limite_credito_total || 0) < 100 && !preApprovedAlreadyReleased && !isPreApprovedRequest && /* @__PURE__ */ jsxs("div", { className: "rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase tracking-widest text-emerald-700", children: "Oferta pr\xE9-aprovada" }),
          /* @__PURE__ */ jsx("h3", { className: "mt-1 text-2xl font-black text-emerald-950", children: "R$ 100,00 em cr\xE9dito" }),
          /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs font-medium leading-relaxed text-emerald-800", children: "A libera\xE7\xE3o depende de aprova\xE7\xE3o do sistema, com prazo de an\xE1lise de at\xE9 72 horas." })
        ] }),
        /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => void handleRequestPreApprovedCredit(), disabled: submitting, className: "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-800 disabled:opacity-50 sm:mt-0 sm:w-auto", children: [
          submitting ? "Enviando..." : "Solicitar libera\xE7\xE3o",
          " ",
          /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-br from-indigo-800 via-indigo-950 to-neutral-900 text-white rounded-[2rem] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[220px]", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full -mr-8 -mt-8 filter blur-lg" }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start z-10 gap-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase font-black tracking-widest text-indigo-300", children: "GSA Store Card" }),
              /* @__PURE__ */ jsx("h3", { className: "text-xl sm:text-2xl font-black tracking-tight mt-1 truncate", title: cliente.nome, children: cliente.nome })
            ] }),
            /* @__PURE__ */ jsx(Landmark, { className: "w-8 h-8 text-indigo-400 shrink-0" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "z-10 mt-8", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[10px] text-indigo-300 font-bold uppercase tracking-wider block", children: "Cr\xE9dito Dispon\xEDvel" }),
            /* @__PURE__ */ jsx("span", { className: "text-3xl md:text-4xl font-black tracking-tight", children: formatCurrency(cliente.limite_credito_disponivel || 0) }),
            blockedCredit > 0.01 && /* @__PURE__ */ jsxs("span", { className: "mt-2 block text-[10px] font-black uppercase tracking-wider text-amber-300", children: [
              formatCurrency(blockedCredit),
              " bloqueado durante an\xE1lise"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center z-10 border-t border-white/10 pt-4 mt-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[11px] text-indigo-300 font-black uppercase tracking-wider", children: "Limite Total" }),
              /* @__PURE__ */ jsx("span", { className: "text-xl md:text-2xl font-black text-white mt-1 leading-none", children: formatCurrency(cliente.limite_credito_total || 0) })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 font-black uppercase tracking-wider", children: cliente.opcao_pagamento_parcelado ? "\xC0 Vista & Parcelado" : "\xC0 Vista (30d)" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-[2rem] border border-neutral-100 p-8 shadow-sm flex flex-col justify-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { className: "text-sm font-black text-neutral-800 uppercase tracking-wide", children: "Uso do Limite" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-400 font-medium", children: "Acompanhamento do saldo comprometido" })
          ] }),
          (() => {
            const total = cliente.limite_credito_total || 1;
            const disponivel = cliente.limite_credito_disponivel || 0;
            const utilizado = total - disponivel;
            const pct = Math.min(100, Math.max(0, utilizado / total * 100));
            const pctDisponivel = 100 - pct;
            const colorClass = pct > 85 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-indigo-600";
            return /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("div", { className: "my-4 space-y-2.5", children: [
                /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs font-bold text-neutral-700", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Utilizado: ",
                      formatCurrency(utilizado)
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      pct.toFixed(0),
                      "%"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[11px] font-bold text-neutral-500", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Dispon\xEDvel: ",
                      formatCurrency(disponivel)
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      pctDisponivel.toFixed(0),
                      "%"
                    ] })
                  ] }),
                  blockedCredit > 0.01 && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold text-amber-600", children: [
                    "Bloqueado: ",
                    formatCurrency(blockedCredit),
                    " \xB7 Utiliz\xE1vel: ",
                    formatCurrency(Math.max(disponivel - blockedCredit, 0))
                  ] })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "w-full bg-neutral-100 h-3 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: `h-full rounded-full transition-all duration-500 ${colorClass}`,
                    style: { width: `${pct}%` }
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex gap-4 text-xs font-bold text-neutral-500", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsx("div", { className: `w-2.5 h-2.5 rounded-full transition-colors duration-500 ${colorClass}` }),
                  /* @__PURE__ */ jsx("span", { children: "Comprometido" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
                  /* @__PURE__ */ jsx("div", { className: "w-2.5 h-2.5 rounded-full bg-neutral-200" }),
                  /* @__PURE__ */ jsx("span", { children: "Dispon\xEDvel" })
                ] })
              ] })
            ] });
          })()
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-neutral-900 text-white rounded-[2rem] p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h4", { className: "text-sm font-black uppercase tracking-wide text-neutral-400", children: "A\xE7\xF5es R\xE1pidas" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 font-medium mt-1", children: "Gerencie seu cr\xE9dito" }),
          activeCreditLimitCancellation ? /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[10px] font-bold text-amber-300", children: [
            "Cancelamento em an\xE1lise \u2022 ",
            activeCreditLimitCancellation.protocolo
          ] }) : blockedCredit > 0.01 ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] font-semibold text-amber-300", children: "H\xE1 limite bloqueado por an\xE1lise financeira." }) : currentCreditUsed > 0.01 ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] font-semibold text-neutral-400", children: "Cancelamento dispon\xEDvel somente com Limite Usado em R$ 0,00." }) : hasPendingCreditInvoice ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] font-semibold text-neutral-400", children: "Regularize as faturas de cr\xE9dito pendentes antes de cancelar o limite." }) : Number(cliente.limite_credito_total || 0) > 0 ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] font-semibold text-emerald-300", children: "Seu limite est\xE1 eleg\xEDvel para solicita\xE7\xE3o de cancelamento." }) : null
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setIsIncreaseModalOpen(true),
              className: "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-neutral-900 text-xs font-black uppercase tracking-wider transition-all hover:bg-neutral-50 shadow-sm whitespace-nowrap",
              children: [
                "Solicitar Aumento",
                /* @__PURE__ */ jsx(ChevronRight, { className: "w-4 h-4" })
              ]
            }
          ),
          Number(cliente.limite_credito_disponivel || 0) > 0 && /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => setIsCreditWithdrawalModalOpen(true), className: "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 text-xs font-black uppercase tracking-wider transition-all hover:bg-emerald-500/20 whitespace-nowrap", children: [
            activeCreditWithdrawal ? "Acompanhar Saque" : "Solicitar Saque",
            /* @__PURE__ */ jsx(DollarSign, { className: "w-4 h-4" })
          ] }),
          Number(cliente.limite_credito_total || 0) > 0 && /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => void handleRequestCreditLimitCancellation(), disabled: submitting || blockedCredit > 0.01 || currentCreditUsed > 0.01 || hasPendingCreditInvoice || Boolean(activeCreditLimitCancellation), className: "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 text-rose-200 text-xs font-black uppercase tracking-wider transition-all hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap", children: [
            "Cancelar Limite",
            /* @__PURE__ */ jsx(XCircle, { className: "w-4 h-4" })
          ] })
        ] })
      ] })
    ] }),
    creditoTab === "faturas" && /* @__PURE__ */ jsx("div", { className: "space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500", children: /* @__PURE__ */ jsx("div", { className: "bg-white rounded-[2rem] border border-neutral-100 shadow-sm p-6 md:p-8", children: (() => {
      const faturasFiltradas = faturas.filter((fat) => {
        let passMes = true;
        if (filtroMesAmortizacao !== "todos") {
          passMes = fat.data_vencimento ? fat.data_vencimento.startsWith(filtroMesAmortizacao) : false;
        }
        let passCompra = true;
        if (filtroCompraAmortizacao !== "todos") {
          passCompra = getFaturaCodigoOrcamento(fat) === filtroCompraAmortizacao;
        }
        return passMes && passCompra;
      }).sort((a, b) => {
        const getParcela = (cod) => {
          const match = cod?.match(/-(\d+)\/\d+/);
          return match ? parseInt(match[1], 10) : 0;
        };
        const pA = getParcela(a.codigo_fatura);
        const pB = getParcela(b.codigo_fatura);
        if (pA && pB && pA !== pB) return pA - pB;
        const vencA = a.data_vencimento ? new Date(a.data_vencimento).getTime() : 0;
        const vencB = b.data_vencimento ? new Date(b.data_vencimento).getTime() : 0;
        return vencA - vencB;
      });
      const faturasExibidas = faturasFiltradas.slice(0, 3);
      const temMaisFaturas = faturasFiltradas.length > 3;
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", children: [
          /* @__PURE__ */ jsxs("h3", { className: "text-lg font-black text-neutral-900 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Calendar, { className: "w-5 h-5 text-indigo-600" }),
            "Amortiza\xE7\xF5es de Cr\xE9dito"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: filtroCompraAmortizacao,
                onChange: (e) => setFiltroCompraAmortizacao(e.target.value),
                className: "px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "todos", children: "Todas as Compras" }),
                  getComprasUnicas().map((cod) => /* @__PURE__ */ jsx("option", { value: cod, children: cod.startsWith("#") ? cod : `#${cod}` }, cod))
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: filtroMesAmortizacao,
                onChange: (e) => setFiltroMesAmortizacao(e.target.value),
                className: "px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "todos", children: "Todos os Meses" }),
                  getMesesFiltro().map((opt) => /* @__PURE__ */ jsx("option", { value: opt.valor, children: opt.rotulo }, opt.valor))
                ]
              }
            )
          ] })
        ] }),
        faturasExibidas.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
          faturasExibidas.map((fat) => /* @__PURE__ */ jsxs("div", { className: "p-5 rounded-2xl border border-neutral-100 bg-neutral-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-sm font-bold text-neutral-900", children: "Parcela de Amortiza\xE7\xE3o" }),
                /* @__PURE__ */ jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded-full ${fat.status === "pago" ? "text-emerald-700 bg-emerald-100" : fat.status === "atrasado" ? "text-rose-700 bg-rose-100 animate-pulse" : fat.status === "cancelado" ? "text-neutral-700 bg-neutral-200" : "text-amber-700 bg-amber-100"}`, children: fat.status === "pago" ? "Pago" : fat.status === "atrasado" ? "Atrasado" : fat.status === "cancelado" ? "Cancelado" : "Aberto" })
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 mt-1", children: [
                "Fatura #",
                fat.codigo_fatura || fat.id.substring(0, 8).toUpperCase()
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-400 mt-0.5", children: [
                "Vencimento: ",
                formatDate(fat.data_vencimento)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("span", { className: "text-base font-black text-neutral-900", children: formatCurrency(fat.valor_total) }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => handleOpenFaturaDetalhes(fat),
                  className: "px-4 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-700 text-xs font-bold hover:bg-neutral-50 transition-all shadow-sm",
                  children: "Detalhes"
                }
              ),
              fat.status !== "pago" && fat.status !== "cancelado" && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => onNavigate("financeiro"),
                  className: "px-4 py-2 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold hover:bg-black transition-all shadow-sm",
                  children: "Ir para Pagamento"
                }
              )
            ] })
          ] }, fat.id)),
          temMaisFaturas && /* @__PURE__ */ jsx("div", { className: "pt-2 text-center", children: /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setIsAllAmortizacoesOpen(true),
              className: "px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors w-full sm:w-auto",
              children: [
                "Ver Mais (",
                faturasFiltradas.length - 3,
                " restantes)"
              ]
            }
          ) })
        ] }) : /* @__PURE__ */ jsx("div", { className: "text-center py-12", children: /* @__PURE__ */ jsx("p", { className: "text-neutral-400 text-sm font-medium", children: "Nenhuma amortiza\xE7\xE3o de cr\xE9dito encontrada para este per\xEDodo." }) })
      ] });
    })() }) }),
    creditoTab === "extrato" && /* @__PURE__ */ jsx("div", { className: "space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500", children: /* @__PURE__ */ jsx("div", { className: "bg-white rounded-[2rem] border border-neutral-100 shadow-sm p-6 md:p-8", children: (() => {
      const movimentacoesFiltradas = movimentacoes.filter((mov) => {
        if (filtroMesExtrato === "todos") return true;
        if (!mov.created_at) return false;
        return mov.created_at.startsWith(filtroMesExtrato);
      }).sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      const movimentacoesExibidas = movimentacoesFiltradas.slice(0, 3);
      const temMaisMovimentacoes = movimentacoesFiltradas.length > 3;
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6", children: [
          /* @__PURE__ */ jsxs("h3", { className: "text-lg font-black text-neutral-900 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(History, { className: "w-5 h-5 text-indigo-600" }),
            "Extrato de Cr\xE9dito"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: filtroMesExtrato,
                onChange: (e) => setFiltroMesExtrato(e.target.value),
                className: "px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-xs font-bold text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "todos", children: "Todos os Meses" }),
                  getMesesFiltro().map((opt) => /* @__PURE__ */ jsx("option", { value: opt.valor, children: opt.rotulo }, opt.valor))
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: async () => {
                  try {
                    const formattedMovimentacoes = movimentacoesFiltradas.map((mov) => ({
                      data: mov.created_at,
                      descricao: mov.historico || mov.descricao,
                      tipo: ["concessao_inicial", "amortizacao", "ajuste_adm_aumento", "solicitacao_aumento_aprovada", "estorno_compra"].includes(mov.tipo) ? "entrada" : "saida",
                      valor: Math.abs(mov.valor || 0)
                    }));
                    const doc = await generateExtratoPDF(formattedMovimentacoes, cliente?.nome || "Cliente", { returnDoc: true });
                    const pdfBase64 = doc.output("datauristring");
                    const mensagemBase = whatsappNotificationService.gerarMensagemWhatsApp({
                      tipo: "extrato",
                      clienteNome: cliente?.nome
                    });
                    await sendToWhatsApp(
                      cliente?.telefone,
                      mensagemBase,
                      pdfBase64,
                      `extrato_credito_${(/* @__PURE__ */ new Date()).getTime()}.pdf`
                    );
                  } catch (err) {
                    console.error(err);
                    toast.error("Erro ao gerar extrato.");
                  }
                },
                disabled: isSendingWhatsApp || movimentacoesFiltradas.length === 0,
                className: "flex items-center justify-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200 border border-emerald-200 transition-all disabled:opacity-50",
                title: "Enviar para o WhatsApp",
                children: [
                  isSendingWhatsApp ? /* @__PURE__ */ jsx("div", { className: "h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" }) : /* @__PURE__ */ jsx(Send, { className: "h-3.5 w-3.5" }),
                  /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "WhatsApp" })
                ]
              }
            )
          ] })
        ] }),
        movimentacoesExibidas.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "flow-root", children: [
          /* @__PURE__ */ jsx("ul", { className: "-mb-8", children: movimentacoesExibidas.map((mov, idx) => {
            const isPositive = ["concessao_inicial", "amortizacao", "ajuste_adm_aumento", "solicitacao_aumento_aprovada", "estorno_compra"].includes(mov.tipo);
            return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("div", { className: "relative pb-8", children: [
              idx !== movimentacoesExibidas.length - 1 && /* @__PURE__ */ jsx("span", { className: "absolute top-4 left-4 -ml-px h-full w-0.5 bg-neutral-100", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxs("div", { className: "relative flex space-x-3", children: [
                /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", { className: `h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`, children: /* @__PURE__ */ jsx(DollarSign, { className: "w-4 h-4" }) }) }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0 pt-1.5 flex justify-between gap-2", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-xs font-bold text-neutral-800 leading-tight", children: mov.descricao || getMovimentacaoTitle(mov.tipo) }),
                    /* @__PURE__ */ jsx("p", { className: "text-[9px] text-neutral-400 mt-0.5", children: formatDateTime(mov.created_at) }),
                    renderCreditDisputeAction(mov)
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "text-right shrink-0", children: /* @__PURE__ */ jsxs("span", { className: `text-xs font-black ${isPositive ? "text-emerald-600" : "text-rose-600"}`, children: [
                    isPositive ? "+" : "-",
                    formatCurrency(mov.valor)
                  ] }) })
                ] })
              ] })
            ] }) }, mov.id);
          }) }),
          temMaisMovimentacoes && /* @__PURE__ */ jsx("div", { className: "pt-6 text-center", children: /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setIsAllExtratoOpen(true),
              className: "px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors w-full",
              children: [
                "Ver Mais (",
                movimentacoesFiltradas.length - 3,
                " restantes)"
              ]
            }
          ) })
        ] }) : /* @__PURE__ */ jsx("div", { className: "text-center py-12", children: /* @__PURE__ */ jsx("p", { className: "text-neutral-400 text-sm font-medium", children: "Nenhuma movimenta\xE7\xE3o encontrada para este per\xEDodo." }) })
      ] });
    })() }) }),
    /* @__PURE__ */ jsx(
      ModalSolicitacao,
      {
        isOpen: isIncreaseModalOpen,
        onClose: () => setIsIncreaseModalOpen(false),
        profileData,
        setProfileData,
        limiteDesejado,
        setLimiteDesejado,
        onSubmit: (e) => handleCreateSolicitacao(e, "alteracao"),
        submitting,
        tipo: "alteracao",
        limiteAtual: cliente.limite_credito_total
      }
    ),
    renderSignaturePortal(),
    /* @__PURE__ */ jsx(
      Modal,
      {
        isOpen: isAllAmortizacoesOpen,
        onClose: () => setIsAllAmortizacoesOpen(false),
        title: "Todas as Amortiza\xE7\xF5es de Cr\xE9dito",
        size: "lg",
        children: /* @__PURE__ */ jsx("div", { className: "space-y-4 max-h-[65vh] overflow-y-auto pr-2", children: (() => {
          const faturasFiltradas = faturas.filter((fat) => {
            let passMes = true;
            if (filtroMesAmortizacao !== "todos") {
              passMes = fat.data_vencimento ? fat.data_vencimento.startsWith(filtroMesAmortizacao) : false;
            }
            let passCompra = true;
            if (filtroCompraAmortizacao !== "todos") {
              passCompra = getFaturaCodigoOrcamento(fat) === filtroCompraAmortizacao;
            }
            return passMes && passCompra;
          }).sort((a, b) => {
            const getParcela = (cod) => {
              const match = cod?.match(/-(\d+)\/\d+/);
              return match ? parseInt(match[1], 10) : 0;
            };
            const pA = getParcela(a.codigo_fatura);
            const pB = getParcela(b.codigo_fatura);
            if (pA && pB && pA !== pB) return pA - pB;
            const vencA = a.data_vencimento ? new Date(a.data_vencimento).getTime() : 0;
            const vencB = b.data_vencimento ? new Date(b.data_vencimento).getTime() : 0;
            return vencA - vencB;
          });
          return faturasFiltradas.map((fat) => /* @__PURE__ */ jsxs("div", { className: "p-5 rounded-2xl border border-neutral-100 bg-neutral-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-sm font-bold text-neutral-900", children: "Parcela de Amortiza\xE7\xE3o" }),
                /* @__PURE__ */ jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded-full ${fat.status === "pago" ? "text-emerald-700 bg-emerald-100" : fat.status === "atrasado" ? "text-rose-700 bg-rose-100 animate-pulse" : fat.status === "cancelado" ? "text-neutral-700 bg-neutral-200" : "text-amber-700 bg-amber-100"}`, children: fat.status === "pago" ? "Pago" : fat.status === "atrasado" ? "Atrasado" : fat.status === "cancelado" ? "Cancelado" : "Aberto" })
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-500 mt-1", children: [
                "Fatura #",
                fat.codigo_fatura || fat.id.substring(0, 8).toUpperCase()
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-neutral-400 mt-0.5", children: [
                "Vencimento: ",
                formatDate(fat.data_vencimento)
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsx("span", { className: "text-base font-black text-neutral-900", children: formatCurrency(fat.valor_total) }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => {
                    setIsAllAmortizacoesOpen(false);
                    handleOpenFaturaDetalhes(fat);
                  },
                  className: "px-4 py-2 rounded-xl border border-neutral-300 bg-white text-neutral-700 text-xs font-bold hover:bg-neutral-50 transition-all shadow-sm",
                  children: "Detalhes"
                }
              ),
              fat.status !== "pago" && fat.status !== "cancelado" && /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => {
                    setIsAllAmortizacoesOpen(false);
                    onNavigate("financeiro");
                  },
                  className: "px-4 py-2 rounded-xl bg-[#1a1a1a] text-white text-xs font-bold hover:bg-black transition-all shadow-sm",
                  children: "Ir para Pagamento"
                }
              )
            ] })
          ] }, fat.id));
        })() })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        isOpen: isAllExtratoOpen,
        onClose: () => setIsAllExtratoOpen(false),
        title: "Extrato de Cr\xE9dito Completo",
        size: "lg",
        children: /* @__PURE__ */ jsx("div", { className: "flow-root max-h-[65vh] overflow-y-auto pr-2 py-4", children: /* @__PURE__ */ jsx("ul", { className: "-mb-8", children: (() => {
          const movimentacoesFiltradas = movimentacoes.filter((mov) => {
            if (filtroMesExtrato === "todos") return true;
            if (!mov.created_at) return false;
            return mov.created_at.startsWith(filtroMesExtrato);
          }).sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          });
          return movimentacoesFiltradas.map((mov, idx) => {
            const isPositive = ["concessao_inicial", "amortizacao", "ajuste_adm_aumento", "solicitacao_aumento_aprovada", "estorno_compra"].includes(mov.tipo);
            return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("div", { className: "relative pb-8", children: [
              idx !== movimentacoesFiltradas.length - 1 && /* @__PURE__ */ jsx("span", { className: "absolute top-4 left-4 -ml-px h-full w-0.5 bg-neutral-100", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxs("div", { className: "relative flex space-x-3", children: [
                /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", { className: `h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`, children: /* @__PURE__ */ jsx(DollarSign, { className: "w-4 h-4" }) }) }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0 pt-1.5 flex justify-between gap-2", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("p", { className: "text-xs font-bold text-neutral-800 leading-tight", children: mov.descricao || getMovimentacaoTitle(mov.tipo) }),
                    /* @__PURE__ */ jsx("p", { className: "text-[9px] text-neutral-400 mt-0.5", children: formatDateTime(mov.created_at) }),
                    renderCreditDisputeAction(mov)
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "text-right shrink-0", children: /* @__PURE__ */ jsxs("span", { className: `text-xs font-black ${isPositive ? "text-emerald-600" : "text-rose-600"}`, children: [
                    isPositive ? "+" : "-",
                    formatCurrency(mov.valor)
                  ] }) })
                ] })
              ] })
            ] }) }, mov.id);
          });
        })() }) })
      }
    ),
    /* @__PURE__ */ jsx(
      CreditWithdrawalModal,
      {
        isOpen: isCreditWithdrawalModalOpen,
        clientId,
        withdrawal: creditWithdrawalForModal,
        onClose: () => setIsCreditWithdrawalModalOpen(false),
        onChanged: async () => {
          await loadData();
          onRefreshCliente();
        }
      }
    ),
    /* @__PURE__ */ jsx(
      CreditDisputeModal,
      {
        isOpen: Boolean(selectedDisputeMovement),
        movement: selectedDisputeMovement,
        dispute: selectedDisputeMovement ? getCreditDisputeForMovement(selectedDisputeMovement.id) : null,
        clientId,
        onClose: () => setSelectedDisputeMovement(null),
        onChanged: loadData
      }
    ),
    /* @__PURE__ */ jsx(Modal, { isOpen: isDetailOpen, onClose: () => setIsDetailOpen(false), title: "Detalhes da Compra / Amortiza\xE7\xE3o", size: "full", children: selectedFatura && (() => {
      if (loadingCreditoDetalhes) {
        return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center py-12", children: [
          /* @__PURE__ */ jsx(Loader2, { className: "w-8 h-8 text-indigo-600 animate-spin" }),
          /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-neutral-500 mt-2", children: "Carregando detalhes minuciosos..." })
        ] });
      }
      if (creditoOrcamento) {
        const total = Number(creditoOrcamento.total || 0);
        const desconto = Number(creditoOrcamento.desconto || 0);
        const taxaEnt = Number(creditoOrcamento.taxa_entrega || 0);
        const acrescimo = Number(creditoOrcamento.acrescimo || 0);
        const subtotalItens = total + desconto - taxaEnt - acrescimo;
        return /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-6 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-neutral-100 p-5 ring-1 ring-neutral-300", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase", children: "C\xF3digo da Fatura Atual" }),
              /* @__PURE__ */ jsx("p", { className: "font-mono text-sm font-medium text-[#1a1a1a] mt-1", children: selectedFatura.codigo_fatura })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-neutral-100 p-5 ring-1 ring-neutral-300", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase", children: "Refer\xEAncia da Compra" }),
              /* @__PURE__ */ jsx("p", { className: "font-mono text-sm font-black text-indigo-600 mt-1", children: creditoOrcamento.codigo_orcamento })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "rounded-2xl bg-neutral-100 p-5 ring-1 ring-neutral-300", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase", children: "Status da Fatura" }),
              /* @__PURE__ */ jsx("span", { className: `inline-block rounded-full px-3 py-0.5 text-[10px] font-bold tracking-widest uppercase mt-2.5 ${selectedFatura.status === "pago" ? "bg-emerald-100 text-emerald-700" : selectedFatura.status === "vencida" ? "bg-red-100 text-red-700" : selectedFatura.status === "pendente_pagamento" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`, children: selectedFatura.status === "pendente_pagamento" ? "Aguardando Pagamento" : selectedFatura.status })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("h4", { className: "flex items-center gap-2 font-medium text-[#1a1a1a]", children: [
              /* @__PURE__ */ jsx(ClipboardList, { className: "h-5 w-5 text-[#1a1a1a]/60" }),
              "Itens do Pedido Original"
            ] }),
            /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-black/5 bg-white overflow-hidden shadow-sm", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm", children: [
              /* @__PURE__ */ jsx("thead", { className: "bg-[#f8f7f5] text-[10px] font-semibold text-[#1a1a1a]/40 uppercase tracking-widest", children: /* @__PURE__ */ jsxs("tr", { children: [
                /* @__PURE__ */ jsx("th", { className: "px-6 py-4", children: "Item / Detalhes" }),
                /* @__PURE__ */ jsx("th", { className: "px-6 py-4 text-right", children: "Valor" })
              ] }) }),
              /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-black/5", children: (creditoOrcamento.ordens_compra?.length > 0 || creditoOrcamento.ordens_assinatura?.length > 0 ? [
                ...(creditoOrcamento.ordens_compra || []).map((item) => ({
                  id: item.id,
                  nome: item.produtos?.nome || "Produto",
                  codigo: item.produtos ? getProductDisplayCode(item.produtos) : "PRODUTO",
                  quantidade: item.quantidade || 1,
                  imagem: item.produtos?.imagem_url,
                  valor: item.produtos?.valor || 0
                })),
                ...(creditoOrcamento.ordens_assinatura || []).map((item) => ({
                  id: item.id,
                  nome: item.assinaturas?.nome || "Assinatura",
                  codigo: item.assinaturas?.codigo_assinatura || "ASSINATURA",
                  quantidade: item.quantidade || 1,
                  imagem: item.assinaturas?.imagem_url,
                  valor: item.assinaturas?.valor || 0
                }))
              ] : [
                {
                  id: "fallback",
                  nome: creditoOrcamento.descricao_solicitacao?.split(" x")[0] || creditoOrcamento.titulo_solicitacao || "Item do Pedido",
                  codigo: creditoOrcamento.descricao_solicitacao?.toLowerCase().match(/assinatura|plano/i) || creditoOrcamento.titulo_solicitacao?.toLowerCase().match(/assinatura|plano/i) ? "ASSINATURA VIP" : "PRODUTO",
                  quantidade: creditoOrcamento.quantidade || 1,
                  imagem: null,
                  valor: subtotalItens > 0 ? subtotalItens : creditoOrcamento.valor_total || 0
                }
              ]).map((item, idx) => /* @__PURE__ */ jsxs("tr", { children: [
                /* @__PURE__ */ jsx("td", { className: "px-6 py-5 align-top", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-4 items-center", children: [
                  /* @__PURE__ */ jsx("div", { className: "h-16 w-16 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0", children: item.imagem ? /* @__PURE__ */ jsx("img", { src: item.imagem, alt: "", className: "h-full w-full object-cover" }) : /* @__PURE__ */ jsx(Package, { className: "w-8 h-8 text-neutral-300" }) }),
                  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                    /* @__PURE__ */ jsx("span", { className: `text-[9px] font-black px-2 py-0.5 rounded-full w-fit uppercase tracking-widest ${item.codigo?.includes("ASSINATURA") ? "text-purple-600 bg-purple-50" : "text-indigo-600 bg-indigo-50"}`, children: item.codigo }),
                    /* @__PURE__ */ jsxs("p", { className: "font-bold text-[#1a1a1a] text-base tracking-tight", children: [
                      item.nome,
                      " ",
                      item.quantidade > 1 ? `(x${item.quantidade})` : ""
                    ] }),
                    item.quantidade > 1 && /* @__PURE__ */ jsxs("p", { className: "text-xs font-semibold text-neutral-400", children: [
                      "Valor unit\xE1rio: ",
                      formatCurrency(item.valor)
                    ] })
                  ] })
                ] }) }),
                /* @__PURE__ */ jsx("td", { className: "px-6 py-5 text-right text-base font-black text-[#1a1a1a] align-top", children: formatCurrency(item.valor * item.quantidade) })
              ] }, item.id || idx)) })
            ] }) }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4 pt-6 border-t border-black/5", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-xs font-black text-neutral-400 uppercase tracking-[0.2em]", children: "Resumo Financeiro da Compra" }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm font-medium text-neutral-500", children: [
                /* @__PURE__ */ jsx("span", { children: "Subtotal dos Itens" }),
                /* @__PURE__ */ jsx("span", { children: formatCurrency(subtotalItens) })
              ] }),
              taxaEnt > 0 && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm font-medium text-neutral-500", children: [
                /* @__PURE__ */ jsx("span", { children: "Frete" }),
                /* @__PURE__ */ jsx("span", { children: formatCurrency(taxaEnt) })
              ] }),
              desconto > 0 && (() => {
                const pointsDiscount = faturaPointsDiscount !== null ? faturaPointsDiscount : 0;
                const couponDiscount = Math.max(0, desconto - pointsDiscount);
                return /* @__PURE__ */ jsxs("div", { className: "space-y-1.5 bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50 my-2", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm font-black text-emerald-800", children: [
                    /* @__PURE__ */ jsx("span", { children: "Descontos Aplicados" }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      "-",
                      formatCurrency(desconto)
                    ] })
                  ] }),
                  pointsDiscount > 0 && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-emerald-600 font-bold pl-3 border-l-2 border-emerald-300", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Carteira de Pontos (",
                      Math.round(pointsDiscount * 105),
                      " pts)"
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      "-",
                      formatCurrency(pointsDiscount)
                    ] })
                  ] }),
                  couponDiscount > 0 && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-xs text-emerald-600 font-bold pl-3 border-l-2 border-emerald-300", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Cupom: ",
                      faturaCupomDesconto?.codigo_cupom || "Desconto"
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      "-",
                      formatCurrency(couponDiscount)
                    ] })
                  ] })
                ] });
              })(),
              acrescimo > 0 && /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-sm font-bold text-amber-600", children: [
                /* @__PURE__ */ jsx("span", { children: "Juros do Cr\xE9dito GSA" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  "+ ",
                  formatCurrency(acrescimo)
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between border-t border-black/5 pt-4 gap-4", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase", children: "Total Geral da Compra" }),
                  /* @__PURE__ */ jsx("p", { className: "text-2xl font-black tracking-tight text-[#1a1a1a] mt-1", children: formatCurrency(total) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "text-center sm:text-right", children: [
                  /* @__PURE__ */ jsxs("p", { className: "text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase", children: [
                    "Esta Parcela (",
                    selectedFatura.itens_faturados?.[0]?.descricao?.match(/Parcela \d+\/\d+/)?.[0] || "1/1",
                    ")"
                  ] }),
                  /* @__PURE__ */ jsx("p", { className: "text-2xl font-black tracking-tight text-indigo-600 mt-1", children: formatCurrency(selectedFatura.valor_total) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase", children: "Saldo Devedor Total" }),
                  /* @__PURE__ */ jsx("p", { className: "text-3xl font-black tracking-tight text-indigo-600 mt-1", children: formatCurrency(
                    creditoFaturasRelacionadas.filter((f) => f.status !== "pago" && f.status !== "cancelado").reduce((acc, f) => acc + (f.valor_final_pendente || f.valor_total || 0), 0)
                  ) })
                ] })
              ] })
            ] })
          ] }),
          creditoFaturasRelacionadas.length > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-4 pt-6 border-t border-black/5", children: [
            /* @__PURE__ */ jsxs("h4", { className: "text-xs font-black text-neutral-400 uppercase tracking-[0.2em] flex items-center gap-1.5", children: [
              /* @__PURE__ */ jsx(CreditCard, { className: "w-4 h-4 text-emerald-600" }),
              "Plano de Parcelamento (Amortiza\xE7\xE3o de Cr\xE9dito GSA)"
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bg-emerald-50/40 rounded-2xl p-5 border border-emerald-100/50 flex flex-col gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center text-sm font-bold text-emerald-950", children: [
                /* @__PURE__ */ jsx("span", { children: "Forma de Pagamento Usada" }),
                /* @__PURE__ */ jsx("span", { children: "Cr\xE9dito GSA" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center text-xs font-bold text-emerald-800 border-b border-emerald-100 pb-2", children: [
                /* @__PURE__ */ jsx("span", { children: "Status Geral" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  creditoFaturasRelacionadas.length,
                  " parcelas geradas ",
                  acrescimo > 0 ? "com juros" : "sem juros"
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "space-y-2.5", children: creditoFaturasRelacionadas.map((fat, idx) => {
                const isCurrent = fat.id === selectedFatura.id;
                return /* @__PURE__ */ jsxs("div", { className: `flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all ${isCurrent ? "bg-indigo-50/70 border-indigo-200 shadow-sm" : "bg-white/80 border-emerald-100/40 text-emerald-900"}`, children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center text-xs", children: [
                    /* @__PURE__ */ jsxs("span", { className: "font-bold", children: [
                      idx + 1,
                      "\xAA Parcela (",
                      fat.codigo_fatura || `Parcela ${idx + 1}`,
                      ")",
                      isCurrent && /* @__PURE__ */ jsx("span", { className: "ml-2 text-[9px] bg-indigo-600 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider", children: "Fatura Atual" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                      /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: formatCurrency(fat.valor_total) }),
                      /* @__PURE__ */ jsx("span", { className: `text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${fat.status === "pago" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : fat.status === "cancelado" ? "bg-neutral-200 text-neutral-700 border-neutral-300" : "bg-orange-100 text-orange-800 border-orange-200"}`, children: fat.status === "pago" ? "Pago" : fat.status === "cancelado" ? "Cancelado" : "Pendente" })
                    ] })
                  ] }),
                  fat.status === "pago" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between mt-1 pt-2 border-t border-emerald-100/50 text-[10px] text-emerald-700/90 font-bold", children: [
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Baixado em: ",
                      fat.data_pagamento ? formatDate(fat.data_pagamento) : "Data indispon\xEDvel"
                    ] }),
                    /* @__PURE__ */ jsxs("span", { children: [
                      "Forma de Pgto: ",
                      /* @__PURE__ */ jsx("span", { className: "uppercase", children: fat.forma_pagamento_escolhida || "N\xE3o informada" })
                    ] })
                  ] })
                ] }, fat.id);
              }) }),
              creditoOrcamento && creditoFaturasRelacionadas.filter((f) => f.status !== "pago" && f.status !== "cancelado").length > 1 && /* @__PURE__ */ jsxs("div", { className: "bg-indigo-50 rounded-2xl p-5 border border-indigo-100 mt-6", children: [
                /* @__PURE__ */ jsx("h4", { className: "text-sm font-black text-indigo-900 mb-2", children: "Op\xE7\xE3o de Quita\xE7\xE3o Antecipada" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-indigo-700/80 mb-4 font-medium", children: "Voc\xEA pode solicitar a quita\xE7\xE3o \xE0 vista de todas as parcelas restantes. O financeiro avaliar\xE1 e poder\xE1 oferecer um desconto nos juros." }),
                !creditoOrcamento.status_quitacao_credito && /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: solicitarQuitacao,
                    className: "w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-700 transition-colors shadow-sm",
                    children: "Solicitar Quita\xE7\xE3o \xE0 Vista"
                  }
                ),
                creditoOrcamento.status_quitacao_credito === "analise_quitacao" && /* @__PURE__ */ jsxs("div", { className: "bg-indigo-100 text-indigo-800 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[11px] uppercase tracking-wider", children: [
                  /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }),
                  " Em An\xE1lise pelo Financeiro..."
                ] }),
                creditoOrcamento.status_quitacao_credito === "aguardando_pagamento_quitacao" && /* @__PURE__ */ jsxs("div", { className: "space-y-4 bg-white p-4 rounded-xl border border-indigo-200 shadow-sm", children: [
                  /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1", children: "Oferta de Quita\xE7\xE3o Total" }),
                    /* @__PURE__ */ jsx("p", { className: "text-3xl font-black text-emerald-600", children: formatCurrency(creditoOrcamento.valor_quitacao_acordo || 0) }),
                    /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 font-medium mt-2", children: "Ao aceitar, uma nova fatura \xE0 vista ser\xE1 gerada e as parcelas antigas ser\xE3o canceladas." })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: gerarFaturaQuitacao,
                        disabled: submitting,
                        className: "flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-emerald-700 transition-colors disabled:opacity-50",
                        children: "Aceitar e Gerar Fatura"
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        onClick: recusarOfertaQuitacao,
                        disabled: submitting,
                        className: "px-4 py-3 bg-neutral-200 text-neutral-700 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-neutral-300 transition-colors disabled:opacity-50",
                        children: "Recusar"
                      }
                    )
                  ] })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setIsDetailOpen(false),
              className: "w-full rounded-xl bg-[#1a1a1a] py-4 text-base font-bold text-white hover:bg-black/80 transition-all mt-6",
              children: "Fechar Detalhes"
            }
          )
        ] });
      }
      return /* @__PURE__ */ jsx("div", { className: "py-6 text-center text-neutral-500 italic", children: "N\xE3o foi poss\xEDvel carregar os detalhes originais da compra." });
    })() }),
    /* @__PURE__ */ jsx(Modal, { isOpen: isTrackingModalOpen, onClose: () => setIsTrackingModalOpen(false), title: "Acompanhamento de Aumento de Limite", size: "xl", children: renderAcompanhamento(true) })
  ] });
}
function getMovimentacaoTitle(tipo) {
  switch (tipo) {
    case "concessao_inicial":
      return "Libera\xE7\xE3o Inicial";
    case "compra":
      return "Compra na GSA Store";
    case "amortizacao":
      return "Pagamento de Amortiza\xE7\xE3o";
    case "ajuste_adm_aumento":
      return "Aumento de Limite (Sistema)";
    case "ajuste_adm_reducao":
      return "Redu\xE7\xE3o de Limite (Sistema)";
    case "solicitacao_aumento_aprovada":
      return "Aumento de Limite Aprovado";
    case "estorno_compra":
      return "Estorno de Compra";
    case "cancelamento_limite":
      return "Cancelamento do Limite de Cr\xE9dito";
    default:
      return tipo;
  }
}
function ModalSolicitacao({
  isOpen,
  onClose,
  profileData,
  setProfileData,
  limiteDesejado,
  setLimiteDesejado,
  onSubmit,
  submitting,
  tipo = "adesao",
  limiteAtual = 0
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const isPersonalDataComplete = !!(profileData?.nome && profileData?.telefone && profileData?.tipo_pessoa && (profileData?.tipo_pessoa === "pf" ? profileData?.cpf : profileData?.cnpj) && profileData?.email);
  const isAddressComplete = !!(profileData?.cep && profileData?.endereco && profileData?.numero && profileData?.bairro && profileData?.cidade && profileData?.estado);
  const [isPersonalOpen, setIsPersonalOpen] = useState(!isPersonalDataComplete);
  const [isAddressOpen, setIsAddressOpen] = useState(!isAddressComplete);
  useEffect(() => {
    if (isOpen) {
      setIsPersonalOpen(!isPersonalDataComplete);
      setIsAddressOpen(!isAddressComplete);
    }
  }, [isOpen]);
  const handleCEPChange = async (value) => {
    const limpo = value.replace(/\D/g, "");
    let masked = limpo;
    if (limpo.length > 5) {
      masked = limpo.slice(0, 5) + "-" + limpo.slice(5, 8);
    }
    setProfileData((prev) => ({ ...prev, cep: masked }));
    if (limpo.length === 8) {
      setBuscandoCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setProfileData((prev) => ({
            ...prev,
            cep: masked,
            endereco: data.logradouro || prev.endereco,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            estado: data.uf || prev.estado
          }));
        } else {
          toast.error("CEP n\xE3o encontrado.");
        }
      } catch {
        toast.error("Erro ao buscar CEP.");
      } finally {
        setBuscandoCep(false);
      }
    }
  };
  if (!isOpen) return null;
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto", children: /* @__PURE__ */ jsxs(
    motion.div,
    {
      initial: { opacity: 0, scale: 0.95, y: 20 },
      animate: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: 20 },
      className: "bg-[#fdfcfb] rounded-[2.5rem] border border-black/5 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "p-6 md:p-8 border-b border-neutral-100 flex justify-between items-center shrink-0", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-xl md:text-2xl font-black text-neutral-900", children: tipo === "adesao" ? "Solicita\xE7\xE3o de Abertura de Cr\xE9dito" : "Solicitar Ajuste de Limite" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-neutral-500 mt-1", children: "Complete seus dados cadastrais obrigat\xF3rios." })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: onClose,
              className: "rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors",
              children: "\u2715"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("form", { onSubmit, className: "flex-1 overflow-y-auto p-6 md:p-8 space-y-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setIsPersonalOpen(!isPersonalOpen),
                className: "w-full flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl hover:bg-indigo-50 transition-colors",
                children: [
                  /* @__PURE__ */ jsx("h4", { className: "text-xs font-black uppercase text-indigo-600 tracking-wider", children: "Dados Pessoais / Cadastrais" }),
                  /* @__PURE__ */ jsx("span", { className: "text-indigo-600 font-bold", children: isPersonalOpen ? "\u25B2" : "\u25BC" })
                ]
              }
            ),
            isPersonalOpen && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Nome Completo *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    required: true,
                    value: profileData.nome,
                    onChange: (e) => setProfileData({ ...profileData, nome: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Telefone Celular *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "numeric",
                    required: true,
                    value: profileData.telefone,
                    onChange: (e) => setProfileData({ ...profileData, telefone: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Tipo de Pessoa *" }),
                /* @__PURE__ */ jsxs(
                  "select",
                  {
                    value: profileData.tipo_pessoa,
                    onChange: (e) => setProfileData({ ...profileData, tipo_pessoa: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "pf", children: "Pessoa F\xEDsica (PF)" }),
                      /* @__PURE__ */ jsx("option", { value: "pj", children: "Pessoa Jur\xEDdica (PJ)" })
                    ]
                  }
                )
              ] }),
              profileData.tipo_pessoa === "pf" ? /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "CPF *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "numeric",
                    required: true,
                    value: profileData.cpf,
                    onChange: (e) => setProfileData({ ...profileData, cpf: e.target.value }),
                    onBlur: (e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val && !validarCPF(val)) {
                        toast.error("CPF inv\xE1lido");
                        setProfileData({ ...profileData, cpf: "" });
                      }
                    },
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }) : /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "CNPJ *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "numeric",
                    required: true,
                    value: profileData.cnpj,
                    onChange: (e) => setProfileData({ ...profileData, cnpj: e.target.value }),
                    onBlur: (e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val && !validarCNPJ(val)) {
                        toast.error("CNPJ inv\xE1lido");
                        setProfileData({ ...profileData, cnpj: "" });
                      }
                    },
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "md:col-span-2", children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "E-mail para Faturas *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "email",
                    required: true,
                    value: profileData.email,
                    onChange: (e) => setProfileData({ ...profileData, email: e.target.value }),
                    onBlur: (e) => {
                      if (e.target.value && !validarEmail(e.target.value)) {
                        toast.error("E-mail inv\xE1lido");
                        setProfileData({ ...profileData, email: "" });
                      }
                    },
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setIsAddressOpen(!isAddressOpen),
                className: "w-full flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl hover:bg-indigo-50 transition-colors",
                children: [
                  /* @__PURE__ */ jsx("h4", { className: "text-xs font-black uppercase text-indigo-600 tracking-wider", children: "Endere\xE7o de Faturamento" }),
                  /* @__PURE__ */ jsx("span", { className: "text-indigo-600 font-bold", children: isAddressOpen ? "\u25B2" : "\u25BC" })
                ]
              }
            ),
            isAddressOpen && /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "CEP *" }),
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "text",
                      inputMode: "numeric",
                      required: true,
                      maxLength: 9,
                      placeholder: "00000-000",
                      value: profileData.cep,
                      onChange: (e) => handleCEPChange(e.target.value),
                      className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                    }
                  ),
                  buscandoCep && /* @__PURE__ */ jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "md:col-span-2", children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Endere\xE7o (Rua/Av) *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    required: true,
                    value: profileData.endereco,
                    onChange: (e) => setProfileData({ ...profileData, endereco: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "N\xFAmero *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "numeric",
                    required: true,
                    value: profileData.numero,
                    onChange: (e) => setProfileData({ ...profileData, numero: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Bairro *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    required: true,
                    value: profileData.bairro,
                    onChange: (e) => setProfileData({ ...profileData, bairro: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Cidade *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    required: true,
                    value: profileData.cidade,
                    onChange: (e) => setProfileData({ ...profileData, cidade: e.target.value }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700 mb-1", children: "Estado (UF) *" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    required: true,
                    maxLength: 2,
                    value: profileData.estado,
                    onChange: (e) => setProfileData({ ...profileData, estado: e.target.value.toUpperCase() }),
                    className: "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500"
                  }
                )
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4 pt-4 border-t border-neutral-100", children: [
            /* @__PURE__ */ jsx("h4", { className: "text-xs font-black uppercase text-indigo-600 tracking-wider", children: "Ajuste de Limite" }),
            tipo === "alteracao" && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold text-neutral-500", children: [
              "Seu limite atual: ",
              /* @__PURE__ */ jsx("span", { className: "text-[#1a1a1a]", children: formatCurrency(limiteAtual) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
                /* @__PURE__ */ jsx("label", { className: "block text-[11px] font-bold text-neutral-700", children: tipo === "adesao" ? "Valor do Limite Desejado *" : "Novo Valor de Limite Desejado *" }),
                /* @__PURE__ */ jsx("span", { className: "text-lg font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg", children: formatCurrency(Number(limiteDesejado) || 0) })
              ] }),
              tipo === "adesao" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "range",
                    min: 0,
                    max: 1e3,
                    step: 50,
                    value: limiteDesejado || 0,
                    onChange: (e) => setLimiteDesejado(e.target.value),
                    className: "w-full h-3 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between text-[10px] font-bold text-neutral-400 mt-2", children: [
                  /* @__PURE__ */ jsx("span", { children: "R$ 0,00" }),
                  /* @__PURE__ */ jsx("span", { children: "R$ 1.000,00" })
                ] })
              ] }) : /* @__PURE__ */ jsxs("div", { className: "relative mt-2", children: [
                /* @__PURE__ */ jsx("div", { className: "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none", children: /* @__PURE__ */ jsx("span", { className: "text-neutral-500 font-bold", children: "R$" }) }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "number",
                    min: 0,
                    step: "0.01",
                    required: true,
                    value: limiteDesejado,
                    onChange: (e) => setLimiteDesejado(e.target.value),
                    className: "w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-base font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500",
                    placeholder: "Digite o novo valor desejado"
                  }
                )
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "pt-6 border-t border-neutral-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onClose,
                className: "px-6 py-3 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-colors",
                children: "Cancelar"
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "submit",
                disabled: submitting,
                className: "px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                children: [
                  submitting && /* @__PURE__ */ jsx(Loader2, { className: "w-4 h-4 animate-spin" }),
                  tipo === "adesao" ? "Enviar Solicita\xE7\xE3o" : "Solicitar Altera\xE7\xE3o"
                ]
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}
export {
  ClientMeuCredito
};
