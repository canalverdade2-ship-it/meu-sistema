import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { useRealtimeSubscription } from "../../../../hooks/useRealtime";
import {
  Building2,
  Wallet,
  Calculator,
  Users,
  MessageSquare,
  Layout,
  LockKeyhole,
  Save,
  Plus,
  RefreshCw,
  Send,
  Bell,
  CreditCard,
  AlertTriangle,
  Sliders
} from "lucide-react";
import { toast } from "react-hot-toast";
import { callAdminRpc } from "../../../../lib/adminRpc";
import { sendAdminWhatsAppNotification } from "../../../../utils/n8nWhatsApp";
import { CalculatorProAdminPanel } from "../../CalculatorProAdminPanel";
import { CalculatorProPaymentConfiguration } from "../../CalculatorProPaymentConfiguration";
import { TacticalDataGrid, CommandSlideOver, StatusBadge } from "../shared";
function GovernancaConfiguracoesView() {
  const [activeTab, setActiveTab] = useState("empresa");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestAlert, setSendingTestAlert] = useState(false);
  const [company, setCompany] = useState({
    razao_social: "",
    cnpj: "",
    telefone: "",
    responsavel: ""
  });
  const [methods, setMethods] = useState([]);
  const [settings, setSettings] = useState({});
  const [methodForm, setMethodForm] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminRpc("gsa_admin_settings_snapshot");
      setCompany(data?.company || { razao_social: "", cnpj: "", telefone: "", responsavel: "" });
      setMethods(Array.isArray(data?.payment_methods) ? data.payment_methods : []);
      setSettings(data?.settings || {});
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel carregar as configura\xE7\xF5es.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeSubscription([
    { table: "system_settings", onChange: () => void load() },
    { table: "payment_methods", onChange: () => void load() },
    { table: "configuracoes", onChange: () => void load() }
  ]);
  const value = (key, fallback = "") => settings[key] ?? fallback;
  const setValue = (key, next) => setSettings((current) => ({ ...current, [key]: next }));
  const saveSettings = async (keys, successMessage) => {
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_update_settings_secure", {
        p_settings: keys.map((key) => ({ key, value: value(key) }))
      });
      toast.success(successMessage);
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel salvar as configura\xE7\xF5es.");
    } finally {
      setSaving(false);
    }
  };
  const saveCompany = async () => {
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_save_company", { p_payload: company });
      toast.success("Dados da empresa salvos e auditados com sucesso.");
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel salvar a empresa.");
    } finally {
      setSaving(false);
    }
  };
  const saveMethod = async () => {
    if (!methodForm?.nome?.trim()) {
      toast.error("Informe o nome da forma de pagamento.");
      return;
    }
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_save_payment_method", {
        p_id: methodForm.id || null,
        p_payload: methodForm
      });
      toast.success("Forma de pagamento salva com sucesso.");
      setMethodForm(null);
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel salvar a forma de pagamento.");
    } finally {
      setSaving(false);
    }
  };
  const toggleMethodStatus = async (method) => {
    if (saving) return;
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_save_payment_method", {
        p_id: method.id,
        p_payload: { ...method, ativo: !method.ativo }
      });
      toast.success(`Forma de pagamento ${method.ativo ? "desativada" : "ativada"}.`);
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel alterar a forma de pagamento.");
    } finally {
      setSaving(false);
    }
  };
  const tabs = [
    { id: "empresa", label: "Empresa & Cadastro", icon: Building2 },
    { id: "financeiro", label: "Par\xE2metros Financeiros", icon: Wallet },
    { id: "formas_pagamento", label: "M\xE9todos de Pagamento", icon: CreditCard },
    { id: "calculadoras", label: "Calculadoras Pro", icon: Calculator },
    { id: "indicacao", label: "Indica\xE7\xE3o & B\xF4nus", icon: Users },
    { id: "whatsapp", label: "WhatsApp Master", icon: MessageSquare },
    { id: "portal", label: "Popups do Portal", icon: Layout },
    { id: "seguranca", label: "Seguran\xE7a & Auditoria", icon: LockKeyhole }
  ];
  const paymentMethodColumns = [
    {
      key: "nome",
      header: "Nome do M\xE9todo",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-900 block", children: row.nome }),
        /* @__PURE__ */ jsxs("span", { className: "font-mono text-[11px] text-slate-400", children: [
          "Slug: ",
          row.slug
        ] })
      ] })
    },
    {
      key: "tipo",
      header: "Tipo de Integra\xE7\xE3o",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 uppercase", children: row.tipo })
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      sortable: true,
      render: (row) => /* @__PURE__ */ jsx(StatusBadge, { status: row.ativo ? "ativo" : "inativo", size: "xs" })
    },
    {
      key: "instrucoes",
      header: "Instru\xE7\xF5es de Pagamento",
      render: (row) => /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-600 truncate max-w-sm block", children: row.instrucoes || "Sem instru\xE7\xF5es." })
    },
    {
      key: "acoes",
      header: "A\xE7\xF5es",
      align: "right",
      render: (row) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-2", onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setMethodForm({ ...row }),
            className: "px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs",
            children: "Editar"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => void toggleMethodStatus(row),
            className: `px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${row.ativo ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`,
            children: row.ativo ? "Desativar" : "Ativar"
          }
        )
      ] })
    }
  ];
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex min-h-[400px] items-center justify-center", children: /* @__PURE__ */ jsx(RefreshCw, { className: "h-8 w-8 animate-spin text-indigo-600" }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 pb-12", children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1.5 flex-wrap bg-white p-2 rounded-xl border border-slate-200 shadow-2xs", children: tabs.map(({ id, label, icon: Icon }) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => setActiveTab(id),
        className: `px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === id ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"}`,
        children: [
          /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5" }),
          /* @__PURE__ */ jsx("span", { children: label })
        ]
      },
      id
    )) }),
    activeTab === "empresa" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100", children: /* @__PURE__ */ jsx(Building2, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Dados Oficiais da Empresa" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Identifica\xE7\xE3o jur\xEDdica e dados fiscais do Grupo GSA" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Raz\xE3o Social" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: company.razao_social || "",
                onChange: (e) => setCompany({ ...company, razao_social: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "CNPJ" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: company.cnpj || "",
                onChange: (e) => setCompany({ ...company, cnpj: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Telefone Principal" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: company.telefone || "",
                onChange: (e) => setCompany({ ...company, telefone: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Respons\xE1vel Legal" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: company.responsavel || "",
                onChange: (e) => setCompany({ ...company, responsavel: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: saveCompany,
            className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Dados da Empresa" })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100", children: /* @__PURE__ */ jsx(Users, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Cadastro Padr\xE3o & B\xF4nus de Boas-Vindas" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Par\xE2metros aplicados na cria\xE7\xE3o de novas contas" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Status do C\xF3digo Padr\xE3o" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("codigo_cadastro_padrao_ativo", "false"),
                onChange: (e) => setValue("codigo_cadastro_padrao_ativo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Ativo" }),
                  /* @__PURE__ */ jsx("option", { value: "false", children: "Desativado" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "C\xF3digo de Boas-Vindas" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: value("codigo_cadastro_padrao", "BEMVINDO"),
                onChange: (e) => setValue("codigo_cadastro_padrao", e.target.value.toUpperCase()),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 uppercase font-mono"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Tipo de Recompensa" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("bonus_cadastro_tipo", "pontos"),
                onChange: (e) => setValue("bonus_cadastro_tipo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "pontos", children: "Pontos de Fidelidade" }),
                  /* @__PURE__ */ jsx("option", { value: "carteira", children: "Cr\xE9dito em Carteira (R$)" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Valor do B\xF4nus" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "0",
                value: value("bonus_cadastro_valor", "100"),
                onChange: (e) => setValue("bonus_cadastro_valor", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: () => void saveSettings(
              ["codigo_cadastro_padrao_ativo", "codigo_cadastro_padrao", "bonus_cadastro_tipo", "bonus_cadastro_valor"],
              "Configura\xE7\xF5es de cadastro e boas-vindas salvas."
            ),
            className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Regras de Cadastro" })
            ]
          }
        ) })
      ] })
    ] }),
    activeTab === "financeiro" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsx(CalculatorProPaymentConfiguration, {}),
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100", children: /* @__PURE__ */ jsx(Wallet, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Taxa de Saque do Cr\xE9dito GSA" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Taxa pr\xE9-configurada exibida ao cliente antes da solicita\xE7\xE3o" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Tipo da taxa" }),
            /* @__PURE__ */ jsxs("select", { value: value("credito_saque_taxa_tipo", "percentual"), onChange: (e) => setValue("credito_saque_taxa_tipo", e.target.value), className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium", children: [
              /* @__PURE__ */ jsx("option", { value: "percentual", children: "Percentual sobre o saque" }),
              /* @__PURE__ */ jsx("option", { value: "fixa", children: "Valor fixo por saque" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: value("credito_saque_taxa_tipo", "percentual") === "percentual" ? "Taxa (%)" : "Taxa fixa (R$)" }),
            /* @__PURE__ */ jsx("input", { type: "number", min: "0", max: value("credito_saque_taxa_tipo", "percentual") === "percentual" ? 100 : void 0, value: value("credito_saque_taxa_valor", "0"), onChange: (e) => setValue("credito_saque_taxa_valor", e.target.value), className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium font-mono" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-[11px] leading-relaxed text-indigo-900", children: "O valor calculado \xE9 exibido antes da confirma\xE7\xE3o e fica registrado no protocolo. Altera\xE7\xF5es futuras da taxa n\xE3o modificam solicita\xE7\xF5es j\xE1 abertas." }),
        /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs("button", { type: "button", disabled: saving, onClick: () => void saveSettings(["credito_saque_taxa_tipo", "credito_saque_taxa_valor"], "Taxa de saque do cr\xE9dito salva."), className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
          saving ? "Salvando..." : "Salvar Taxa de Saque"
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100", children: /* @__PURE__ */ jsx(Wallet, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Desconto Exclusivo PIX (Loja & Servi\xE7os)" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Regras de precifica\xE7\xE3o \xE0 vista e compatibilidade com carteira/pontos" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Desconto PIX Ativo" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("loja_pix_desconto_ativo", "true"),
                onChange: (e) => setValue("loja_pix_desconto_ativo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Sim (Ativo)" }),
                  /* @__PURE__ */ jsx("option", { value: "false", children: "N\xE3o (Inativo)" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Porcentagem de Desconto (%)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "0",
                max: "100",
                value: value("loja_pix_desconto_porcentagem", "5"),
                onChange: (e) => setValue("loja_pix_desconto_porcentagem", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Aplicar Em" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("loja_pix_desconto_tipo_aplicacao", "todos"),
                onChange: (e) => setValue("loja_pix_desconto_tipo_aplicacao", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "todos", children: "Todos os Produtos e Servi\xE7os" }),
                  /* @__PURE__ */ jsx("option", { value: "categorias", children: "Apenas Categorias Selecionadas" }),
                  /* @__PURE__ */ jsx("option", { value: "produtos", children: "Apenas Produtos Selecionados" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Permitir com Pontos de Fidelidade" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("loja_pix_desconto_permitir_pontos", "false"),
                onChange: (e) => setValue("loja_pix_desconto_permitir_pontos", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "false", children: "N\xE3o (Desconto Exclusivo PIX)" }),
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Sim (Permite Acumular)" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Permitir com Saldo da Carteira" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("loja_pix_desconto_permitir_saldo_carteira", "false"),
                onChange: (e) => setValue("loja_pix_desconto_permitir_saldo_carteira", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "false", children: "N\xE3o (Desconto Exclusivo PIX)" }),
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Sim (Permite Acumular)" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: () => void saveSettings(
              [
                "loja_pix_desconto_ativo",
                "loja_pix_desconto_porcentagem",
                "loja_pix_desconto_tipo_aplicacao",
                "loja_pix_desconto_permitir_pontos",
                "loja_pix_desconto_permitir_saldo_carteira"
              ],
              "Regras de desconto PIX salvas."
            ),
            className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Regras de Desconto PIX" })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100", children: /* @__PURE__ */ jsx(CreditCard, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "M\xE9todos Ativos no Checkout" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Canais de pagamento vis\xEDveis para os clientes" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "PIX Instant\xE2neo" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("checkout_metodo_pix_ativo", "true"),
                onChange: (e) => setValue("checkout_metodo_pix_ativo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Ativo" }),
                  /* @__PURE__ */ jsx("option", { value: "false", children: "Inativo" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Cart\xE3o de Cr\xE9dito" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("checkout_metodo_cartao_ativo", "true"),
                onChange: (e) => setValue("checkout_metodo_cartao_ativo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Ativo" }),
                  /* @__PURE__ */ jsx("option", { value: "false", children: "Inativo" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Boleto Banc\xE1rio" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("checkout_metodo_boleto_ativo", "true"),
                onChange: (e) => setValue("checkout_metodo_boleto_ativo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Ativo" }),
                  /* @__PURE__ */ jsx("option", { value: "false", children: "Inativo" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: () => void saveSettings(
              ["checkout_metodo_pix_ativo", "checkout_metodo_cartao_ativo", "checkout_metodo_boleto_ativo"],
              "M\xE9todos do checkout salvos com sucesso."
            ),
            className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar M\xE9todos de Checkout" })
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-slate-100 text-slate-700", children: /* @__PURE__ */ jsx(Sliders, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Par\xE2metros Operacionais Globais" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Prazos de vencimento, saque m\xEDnimo e taxa de entrega" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Valor M\xEDnimo para Saque (R$)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "0",
                value: value("valor_minimo_saque", "50"),
                onChange: (e) => setValue("valor_minimo_saque", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Vencimento Padr\xE3o de Servi\xE7os (dias)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "1",
                value: value("vencimento_padrao_servicos", "10"),
                onChange: (e) => setValue("vencimento_padrao_servicos", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Vencimento Padr\xE3o de Produtos (dias)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "1",
                value: value("vencimento_padrao_produtos", "10"),
                onChange: (e) => setValue("vencimento_padrao_produtos", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Taxa de Entrega Padr\xE3o (R$)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "0",
                value: value("loja_taxa_entrega_padrao", "0"),
                onChange: (e) => setValue("loja_taxa_entrega_padrao", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: () => void saveSettings(
              ["valor_minimo_saque", "vencimento_padrao_servicos", "vencimento_padrao_produtos", "loja_taxa_entrega_padrao"],
              "Par\xE2metros operacionais globais salvos."
            ),
            className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Par\xE2metros Globais" })
            ]
          }
        ) })
      ] })
    ] }),
    activeTab === "formas_pagamento" && /* @__PURE__ */ jsx("div", { className: "space-y-4", children: /* @__PURE__ */ jsx(
      TacticalDataGrid,
      {
        title: "Formas de Pagamento Personalizadas",
        subtitle: "Configura\xE7\xE3o de canais de liquida\xE7\xE3o, prazos e instru\xE7\xF5es",
        data: methods,
        columns: paymentMethodColumns,
        keyExtractor: (row) => row.id || row.slug,
        isLoading: loading,
        actions: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setMethodForm({
              nome: "",
              slug: "",
              tipo: "manual",
              instrucoes: "",
              ativo: true
            }),
            className: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs",
            children: [
              /* @__PURE__ */ jsx(Plus, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: "Nova Forma de Pagamento" })
            ]
          }
        )
      }
    ) }),
    activeTab === "calculadoras" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsx(CalculatorProPaymentConfiguration, {}),
      /* @__PURE__ */ jsx(CalculatorProAdminPanel, {})
    ] }),
    activeTab === "indicacao" && /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
        /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100", children: /* @__PURE__ */ jsx(Users, { className: "h-5 w-5" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Programa Indique e Ganhe" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Mec\xE2nica de recompensas para quem indica e novos indicados" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Recompensa do Indicador" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: value("indicador_recompensa_tipo", "carteira"),
              onChange: (e) => setValue("indicador_recompensa_tipo", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
              children: [
                /* @__PURE__ */ jsx("option", { value: "carteira", children: "Cr\xE9dito em Carteira (R$)" }),
                /* @__PURE__ */ jsx("option", { value: "pontos", children: "Pontos de Fidelidade" }),
                /* @__PURE__ */ jsx("option", { value: "ambos", children: "Ambos (Carteira + Pontos)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Recompensa do Indicado" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: value("indicado_recompensa_tipo", "desconto"),
              onChange: (e) => setValue("indicado_recompensa_tipo", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
              children: [
                /* @__PURE__ */ jsx("option", { value: "desconto", children: "Cupom de Desconto (%)" }),
                /* @__PURE__ */ jsx("option", { value: "pontos", children: "Pontos de Boas-Vindas" }),
                /* @__PURE__ */ jsx("option", { value: "ambos", children: "Ambos (Desconto + Pontos)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Cr\xE9dito do Indicador (R$)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "number",
              min: "0",
              value: value("indicador_limite_carteira", value("bonus_indicador", "20")),
              onChange: (e) => {
                setValue("indicador_limite_carteira", e.target.value);
                setValue("bonus_indicador", e.target.value);
              },
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Pontos do Indicador" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "number",
              min: "0",
              value: value("indicador_valor_pontos", "50"),
              onChange: (e) => setValue("indicador_valor_pontos", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Desconto do Indicado (%)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "number",
              min: "0",
              max: "100",
              value: value("indicado_desconto_porcentagem", value("desconto_indicado_porcentagem", "10")),
              onChange: (e) => {
                setValue("indicado_desconto_porcentagem", e.target.value);
                setValue("desconto_indicado_porcentagem", e.target.value);
              },
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Pontos do Indicado" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "number",
              min: "0",
              value: value("indicado_valor_pontos", "50"),
              onChange: (e) => setValue("indicado_valor_pontos", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Template de Mensagem Compartilh\xE1vel (WhatsApp)" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              rows: 4,
              value: value("template_mensagem_indicacao", ""),
              onChange: (e) => setValue("template_mensagem_indicacao", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
              placeholder: "Ex: Ol\xE1! Conhe\xE7a os servi\xE7os do Grupo GSA com desconto especial..."
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          disabled: saving,
          onClick: () => void saveSettings(
            [
              "indicador_recompensa_tipo",
              "indicador_limite_carteira",
              "indicador_valor_pontos",
              "indicado_recompensa_tipo",
              "indicado_desconto_porcentagem",
              "indicado_valor_pontos",
              "template_mensagem_indicacao",
              "bonus_indicador",
              "desconto_indicado_porcentagem"
            ],
            "Programa de indica\xE7\xE3o salvo com sucesso."
          ),
          className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
          children: [
            /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
            /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Programa de Indica\xE7\xE3o" })
          ]
        }
      ) })
    ] }),
    activeTab === "whatsapp" && /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100", children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "WhatsApp Master \u2014 Receptor 100% de Notifica\xE7\xF5es" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "N\xFAmero administrativo receptor de alertas t\xE9cnicos e operacionais via n8n" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 flex items-start gap-3", children: [
          /* @__PURE__ */ jsx(Bell, { className: "h-4 w-4 text-emerald-700 shrink-0 mt-0.5" }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-emerald-950 leading-relaxed", children: [
            "Este n\xFAmero recebe notifica\xE7\xF5es instant\xE2neas de ",
            /* @__PURE__ */ jsx("strong", { children: "todos os eventos do sistema" }),
            ": alertas da VPS Oracle, novas ordens de servi\xE7o, solicita\xE7\xF5es de saque PIX, cadastros de fornecedores e relat\xF3rios gerenciais."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Telefone Master (com DDI e DDD, ex: 5511920857756)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: value("whatsapp_admin_notificacoes", "5511920857756"),
                onChange: (e) => setValue("whatsapp_admin_notificacoes", e.target.value.replace(/\D/g, "")),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "URL do Webhook n8n (Evolution API Dispatcher)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: value("whatsapp_n8n_webhook_url", "http://147.15.43.141:5678/webhook/send-whatsapp"),
                onChange: (e) => setValue("whatsapp_n8n_webhook_url", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "pt-2 flex flex-wrap items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              disabled: sendingTestAlert || saving,
              onClick: async () => {
                setSendingTestAlert(true);
                try {
                  const targetNumber = value("whatsapp_admin_notificacoes", "5511920857756");
                  const ok = await sendAdminWhatsAppNotification({
                    title: "Alerta de Teste de Configura\xE7\xE3o",
                    message: `Teste de recebimento de notifica\xE7\xF5es administrativas no WhatsApp registrado (${targetNumber}). O sistema n8n est\xE1 operacional!`,
                    category: "SISTEMA",
                    recipientPhone: targetNumber
                  });
                  if (ok) {
                    toast.success(`Alerta de teste enviado com sucesso para ${targetNumber}!`);
                  } else {
                    toast.error("N\xE3o foi poss\xEDvel enviar o alerta de teste. Verifique a URL do n8n.");
                  }
                } catch (e) {
                  toast.error("Erro no envio: " + (e?.message || "Erro desconhecido"));
                } finally {
                  setSendingTestAlert(false);
                }
              },
              className: "px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
              children: [
                /* @__PURE__ */ jsx(Send, { className: `h-3.5 w-3.5 ${sendingTestAlert ? "animate-bounce" : ""}` }),
                /* @__PURE__ */ jsx("span", { children: sendingTestAlert ? "Enviando Alerta..." : "Disparar Alerta de Teste Agora" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              disabled: saving,
              onClick: () => void saveSettings(
                ["whatsapp_admin_notificacoes", "whatsapp_n8n_webhook_url"],
                "WhatsApp Master de Notifica\xE7\xF5es salvo com sucesso."
              ),
              className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar WhatsApp Master" })
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100", children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-5 w-5" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Bot\xE3o Flutuante de WhatsApp no Portal" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Widget de atendimento flutuante exibido aos visitantes e clientes" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Widget Ativo" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("whatsapp_float_ativo", "true"),
                onChange: (e) => setValue("whatsapp_float_ativo", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "true", children: "Ativo" }),
                  /* @__PURE__ */ jsx("option", { value: "false", children: "Desativado" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Telefone do Atendimento" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: value("whatsapp_float_telefone", ""),
                onChange: (e) => setValue("whatsapp_float_telefone", e.target.value.replace(/\D/g, "")),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono",
                placeholder: "5511999999999"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Tooltip / R\xF3tulo" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: value("whatsapp_float_tooltip", "Falar no WhatsApp"),
                onChange: (e) => setValue("whatsapp_float_tooltip", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Posi\xE7\xE3o na Tela" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: value("whatsapp_float_posicao", "direita"),
                onChange: (e) => setValue("whatsapp_float_posicao", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "direita", children: "Canto Inferior Direito" }),
                  /* @__PURE__ */ jsx("option", { value: "esquerda", children: "Canto Inferior Esquerdo" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Mensagem Inicial Pr\xE9-digitada" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                rows: 3,
                value: value("whatsapp_float_mensagem", ""),
                onChange: (e) => setValue("whatsapp_float_mensagem", e.target.value),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                placeholder: "Ol\xE1! Gostaria de mais informa\xE7\xF5es sobre..."
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: saving,
            onClick: () => void saveSettings(
              [
                "whatsapp_float_ativo",
                "whatsapp_float_telefone",
                "whatsapp_float_mensagem",
                "whatsapp_float_tamanho",
                "whatsapp_float_posicao",
                "whatsapp_float_tooltip"
              ],
              "Configura\xE7\xF5es do bot\xE3o flutuante salvas."
            ),
            className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Bot\xE3o Flutuante" })
            ]
          }
        ) })
      ] })
    ] }),
    activeTab === "portal" && /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
        /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100", children: /* @__PURE__ */ jsx(Layout, { className: "h-5 w-5" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Modal Promocional de Indica\xE7\xE3o no Portal" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Banner modal de convers\xE3o exibido para novos visitantes" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Modal Ativo" }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: value("modal_indicacao_ativo", "true"),
              onChange: (e) => setValue("modal_indicacao_ativo", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
              children: [
                /* @__PURE__ */ jsx("option", { value: "true", children: "Ativo" }),
                /* @__PURE__ */ jsx("option", { value: "false", children: "Desativado" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "T\xEDtulo do Modal" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: value("modal_indicacao_titulo", "Voc\xEA foi indicado!"),
              onChange: (e) => setValue("modal_indicacao_titulo", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Texto do Bot\xE3o CTA" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: value("modal_indicacao_texto_botao", "Solicitar Servi\xE7os"),
              onChange: (e) => setValue("modal_indicacao_texto_botao", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "M\xF3dulo de Destino" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: value("modal_indicacao_modulo_destino", "orcamentos"),
              onChange: (e) => setValue("modal_indicacao_modulo_destino", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
          /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Descri\xE7\xE3o Informativa" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              rows: 4,
              value: value("modal_indicacao_descricao", ""),
              onChange: (e) => setValue("modal_indicacao_descricao", e.target.value),
              className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
              placeholder: "Receba descontos exclusivos em sua primeira contrata\xE7\xE3o..."
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "pt-2 flex justify-end", children: /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          disabled: saving,
          onClick: () => void saveSettings(
            [
              "modal_indicacao_ativo",
              "modal_indicacao_titulo",
              "modal_indicacao_descricao",
              "modal_indicacao_url_botao",
              "modal_indicacao_acao_botao",
              "modal_indicacao_modulo_destino",
              "modal_indicacao_texto_botao",
              "modal_indicacao_tamanho"
            ],
            "Configura\xE7\xF5es do modal no portal salvas."
          ),
          className: "px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center gap-1.5",
          children: [
            /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
            /* @__PURE__ */ jsx("span", { children: saving ? "Salvando..." : "Salvar Configura\xE7\xF5es do Portal" })
          ]
        }
      ) })
    ] }),
    activeTab === "seguranca" && /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b border-slate-100 pb-4", children: [
        /* @__PURE__ */ jsx("span", { className: "p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100", children: /* @__PURE__ */ jsx(LockKeyhole, { className: "h-5 w-5" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold text-slate-900", children: "Pol\xEDticas de Seguran\xE7a e Credenciais" }),
          /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "Arquitetura de prote\xE7\xE3o zero-trust e rota\xE7\xE3o de senhas" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 space-y-2", children: [
        /* @__PURE__ */ jsxs("p", { className: "font-bold flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(AlertTriangle, { className: "h-4 w-4 text-amber-600" }),
          "Seguran\xE7a de Credenciais Administrativas:"
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-amber-900 leading-relaxed", children: [
          "Senhas e chaves criptogr\xE1ficas n\xE3o s\xE3o gravadas em texto plano. A gera\xE7\xE3o e rota\xE7\xE3o de credenciais de colaboradores ocorre atrav\xE9s do m\xF3dulo ",
          /* @__PURE__ */ jsx("strong", { children: "Gest\xE3o de Acessos & RBAC" }),
          " com expurgo imediato de sess\xF5es ativas e log de auditoria imut\xE1vel."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      CommandSlideOver,
      {
        isOpen: Boolean(methodForm),
        onClose: () => setMethodForm(null),
        title: methodForm?.id ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento",
        subtitle: "Configura\xE7\xE3o de m\xE9todo de cobran\xE7a",
        width: "md",
        primaryAction: {
          label: saving ? "Salvando..." : "Salvar M\xE9todo",
          onClick: saveMethod,
          loading: saving,
          variant: "primary"
        },
        secondaryAction: {
          label: "Cancelar",
          onClick: () => setMethodForm(null)
        },
        children: methodForm && /* @__PURE__ */ jsx("div", { className: "space-y-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Nome do M\xE9todo *" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: methodForm.nome || "",
                onChange: (e) => setMethodForm({ ...methodForm, nome: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                placeholder: "Ex: Transfer\xEAncia Banc\xE1ria TED"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Slug Identificador *" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                value: methodForm.slug || "",
                onChange: (e) => setMethodForm({ ...methodForm, slug: e.target.value.toLowerCase() }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 font-mono",
                placeholder: "ex: ted_bancaria"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Tipo de Processamento" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: methodForm.tipo || "manual",
                onChange: (e) => setMethodForm({ ...methodForm, tipo: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "manual", children: "Manual / Comprovante" }),
                  /* @__PURE__ */ jsx("option", { value: "pix", children: "PIX Autom\xE1tico" }),
                  /* @__PURE__ */ jsx("option", { value: "gateway", children: "Gateway de Cart\xE3o" }),
                  /* @__PURE__ */ jsx("option", { value: "boleto", children: "Boleto Banc\xE1rio" })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-xs font-bold text-slate-700 mb-1", children: "Instru\xE7\xF5es para o Cliente" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                rows: 4,
                value: methodForm.instrucoes || "",
                onChange: (e) => setMethodForm({ ...methodForm, instrucoes: e.target.value }),
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500",
                placeholder: "Informe os dados banc\xE1rios ou instru\xE7\xF5es de liquida\xE7\xE3o..."
              }
            )
          ] })
        ] }) })
      }
    )
  ] });
}
export {
  GovernancaConfiguracoesView
};
