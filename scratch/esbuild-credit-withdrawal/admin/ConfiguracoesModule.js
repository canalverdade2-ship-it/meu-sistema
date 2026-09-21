import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Bell, Building2, Calculator, CreditCard, Layout, LockKeyhole, MessageSquare, Plus, RefreshCw, Save, Send, Settings, Users, Wallet, X } from "lucide-react";
import { useRealtimeSubscription } from "../../hooks/useRealtime";
import { toast } from "react-hot-toast";
import { callAdminRpc } from "../../lib/adminRpc";
import { sendAdminWhatsAppNotification } from "../../utils/n8nWhatsApp";
import { CalculatorProAdminPanel } from "./CalculatorProAdminPanel";
import { CalculatorProPaymentConfiguration } from "./CalculatorProPaymentConfiguration";
function Overlay({ children, onClose }) {
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4", onMouseDown: (event) => event.target === event.currentTarget && onClose(), children: /* @__PURE__ */ jsx("div", { role: "dialog", "aria-modal": "true", className: "max-h-[92vh] w-full max-w-[96vw] sm:max-w-xl md:max-w-3xl lg:max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8", children }) });
}
function ConfiguracoesModule() {
  const [activeTab, setActiveTab] = useState("empresa");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestAlert, setSendingTestAlert] = useState(false);
  const [company, setCompany] = useState({ razao_social: "", cnpj: "", telefone: "", responsavel: "" });
  const [methods, setMethods] = useState([]);
  const [settings, setSettings] = useState({});
  const [methodForm, setMethodForm] = useState(null);
  const load = useCallback(async (isMounted = { current: true }) => {
    if (isMounted.current) setLoading(true);
    try {
      const data = await callAdminRpc("gsa_admin_settings_snapshot");
      if (isMounted.current) {
        setCompany(data?.company || { razao_social: "", cnpj: "", telefone: "", responsavel: "" });
        setMethods(Array.isArray(data?.payment_methods) ? data.payment_methods : []);
        setSettings(data?.settings || {});
      }
    } catch (error) {
      if (isMounted.current) toast.error(error?.message || "N\xE3o foi poss\xEDvel carregar as configura\xE7\xF5es.");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);
  useRealtimeSubscription({
    table: "system_settings",
    debounceMs: 300,
    onChange: () => {
      void load();
    }
  });
  useEffect(() => {
    const isMounted = { current: true };
    void load(isMounted);
    return () => {
      isMounted.current = false;
    };
  }, [load]);
  const value = (key, fallback = "") => settings[key] ?? fallback;
  const setValue = (key, next) => setSettings((current) => ({ ...current, [key]: next }));
  const saveSettings = async (keys, successMessage) => {
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_update_settings_secure", { p_settings: keys.map((key) => ({ key, value: value(key) })) });
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
      toast.success("Dados da empresa salvos e auditados.");
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel salvar a empresa.");
    } finally {
      setSaving(false);
    }
  };
  const saveMethod = async () => {
    if (!methodForm?.nome?.trim()) return toast.error("Informe o nome da forma de pagamento.");
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_save_payment_method", { p_id: methodForm.id || null, p_payload: methodForm });
      toast.success("Forma de pagamento salva e auditada.");
      setMethodForm(null);
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel salvar a forma de pagamento.");
    } finally {
      setSaving(false);
    }
  };
  const toggleMethod = async (method) => {
    if (saving) return;
    setSaving(true);
    try {
      await callAdminRpc("gsa_admin_save_payment_method", { p_id: method.id, p_payload: { ...method, ativo: !method.ativo } });
      await load();
    } catch (error) {
      toast.error(error?.message || "N\xE3o foi poss\xEDvel alterar a forma de pagamento.");
    } finally {
      setSaving(false);
    }
  };
  const tabs = [
    { id: "empresa", label: "Empresa", icon: Building2 },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
    { id: "calculadoras", label: "Calculadoras Pro", icon: Calculator },
    { id: "indicacao", label: "Indica\xE7\xE3o", icon: Users },
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
    { id: "portal", label: "Portal", icon: Layout },
    { id: "seguranca", label: "Seguran\xE7a", icon: LockKeyhole }
  ];
  if (loading) return /* @__PURE__ */ jsx("div", { className: "flex min-h-[420px] items-center justify-center", children: /* @__PURE__ */ jsx(RefreshCw, { className: "h-9 w-9 animate-spin text-indigo-600" }) });
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6 pb-10", children: [
    /* @__PURE__ */ jsx("header", { className: "rounded-[2rem] bg-neutral-950 p-6 text-white shadow-xl", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col justify-between gap-5 sm:flex-row sm:items-center", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase tracking-[0.2em] text-white/40", children: "Allowlist administrativa" }),
        /* @__PURE__ */ jsxs("h1", { className: "mt-2 flex items-center gap-3 text-2xl font-black", children: [
          /* @__PURE__ */ jsx(Settings, { className: "h-6 w-6 text-indigo-400" }),
          " Configura\xE7\xF5es Globais"
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-white/55", children: "Somente chaves e produtos conhecidos podem ser lidos ou alterados por este painel." })
      ] }),
      /* @__PURE__ */ jsxs("button", { type: "button", disabled: loading || saving, onClick: () => void load(), className: "flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-neutral-900 disabled:opacity-50", children: [
        /* @__PURE__ */ jsx(RefreshCw, { className: "h-4 w-4" }),
        " Atualizar"
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 sm:grid-cols-3 lg:grid-cols-7", children: tabs.map(({ id, label, icon: Icon }) => /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => setActiveTab(id), className: `flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${activeTab === id ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "text-neutral-500 hover:bg-neutral-50"}`, children: [
      /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }),
      label
    ] }, id)) }),
    activeTab === "empresa" && /* @__PURE__ */ jsxs("section", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs(Card, { title: "Dados da empresa", icon: Building2, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(TextField, { label: "Raz\xE3o social", value: company.razao_social || "", onChange: (next) => setCompany({ ...company, razao_social: next }) }),
          /* @__PURE__ */ jsx(TextField, { label: "CNPJ", value: company.cnpj || "", onChange: (next) => setCompany({ ...company, cnpj: next }) }),
          /* @__PURE__ */ jsx(TextField, { label: "Telefone", value: company.telefone || "", onChange: (next) => setCompany({ ...company, telefone: next }) }),
          /* @__PURE__ */ jsx(TextField, { label: "Respons\xE1vel", value: company.responsavel || "", onChange: (next) => setCompany({ ...company, responsavel: next }) })
        ] }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveCompany(), label: "Salvar dados da empresa" })
      ] }),
      /* @__PURE__ */ jsxs(Card, { title: "Cadastro padr\xE3o", icon: Users, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
          /* @__PURE__ */ jsx(SelectField, { label: "Status do c\xF3digo", value: value("codigo_cadastro_padrao_ativo", "false"), onChange: (next) => setValue("codigo_cadastro_padrao_ativo", next), options: [["true", "Ativo"], ["false", "Desativado"]] }),
          /* @__PURE__ */ jsx(TextField, { label: "C\xF3digo", value: value("codigo_cadastro_padrao", "BEMVINDO"), onChange: (next) => setValue("codigo_cadastro_padrao", next.toUpperCase()) }),
          /* @__PURE__ */ jsx(SelectField, { label: "Tipo de b\xF4nus", value: value("bonus_cadastro_tipo", "pontos"), onChange: (next) => setValue("bonus_cadastro_tipo", next), options: [["pontos", "Pontos"], ["carteira", "Carteira"]] }),
          /* @__PURE__ */ jsx(NumberField, { label: "Valor do b\xF4nus", value: value("bonus_cadastro_valor", "100"), onChange: (next) => setValue("bonus_cadastro_valor", next) })
        ] }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["codigo_cadastro_padrao_ativo", "codigo_cadastro_padrao", "bonus_cadastro_tipo", "bonus_cadastro_valor"], "Configura\xE7\xF5es de cadastro salvas.") })
      ] })
    ] }),
    activeTab === "financeiro" && /* @__PURE__ */ jsxs("section", { className: "space-y-6", children: [
      /* @__PURE__ */ jsx(CalculatorProPaymentConfiguration, {}),
      /* @__PURE__ */ jsxs(Card, { title: "Taxa de Saque do Cr\xE9dito GSA", icon: Wallet, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(SelectField, { label: "Tipo da taxa", value: value("credito_saque_taxa_tipo", "percentual"), onChange: (next) => setValue("credito_saque_taxa_tipo", next), options: [["percentual", "Percentual sobre o saque"], ["fixa", "Valor fixo por saque"]] }),
          /* @__PURE__ */ jsx(NumberField, { label: value("credito_saque_taxa_tipo", "percentual") === "percentual" ? "Taxa (%)" : "Taxa fixa (R$)", value: value("credito_saque_taxa_valor", "0"), onChange: (next) => setValue("credito_saque_taxa_valor", next) })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900", children: "O cliente v\xEA o valor do saque + taxa antes de confirmar. A configura\xE7\xE3o usada fica congelada no protocolo e a fatura vence 30 dias ap\xF3s a libera\xE7\xE3o PIX." }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["credito_saque_taxa_tipo", "credito_saque_taxa_valor"], "Taxa de saque do cr\xE9dito salva.") })
      ] }),
      /* @__PURE__ */ jsxs(Card, { title: "Desconto PIX", icon: Wallet, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: [
          /* @__PURE__ */ jsx(SelectField, { label: "Desconto PIX Ativo", value: value("loja_pix_desconto_ativo", "true"), onChange: (next) => setValue("loja_pix_desconto_ativo", next), options: [["true", "Sim"], ["false", "N\xE3o"]] }),
          /* @__PURE__ */ jsx(NumberField, { label: "Porcentagem de Desconto (%)", value: value("loja_pix_desconto_porcentagem", "5"), onChange: (next) => setValue("loja_pix_desconto_porcentagem", next) }),
          /* @__PURE__ */ jsx(SelectField, { label: "Aplicar em", value: value("loja_pix_desconto_tipo_aplicacao", "todos"), onChange: (next) => setValue("loja_pix_desconto_tipo_aplicacao", next), options: [["todos", "Todos os Produtos"], ["categorias", "Apenas Categorias Espec\xEDficas"], ["produtos", "Apenas Produtos Espec\xEDficos"]] }),
          /* @__PURE__ */ jsx(
            SelectField,
            {
              label: "Permitir com Pontos de Fidelidade",
              value: value("loja_pix_desconto_permitir_pontos", "false"),
              onChange: (next) => setValue("loja_pix_desconto_permitir_pontos", next),
              options: [
                ["false", "N\xE3o (Desconto Exclusivo PIX - Anula ao usar Pontos)"],
                ["true", "Sim (Permite Acumular com Pontos)"]
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            SelectField,
            {
              label: "Permitir com Saldo da Carteira",
              value: value("loja_pix_desconto_permitir_saldo_carteira", "false"),
              onChange: (next) => setValue("loja_pix_desconto_permitir_saldo_carteira", next),
              options: [
                ["false", "N\xE3o (Desconto Exclusivo PIX - Anula ao usar Carteira)"],
                ["true", "Sim (Permite Acumular com Carteira)"]
              ]
            }
          ),
          value("loja_pix_desconto_tipo_aplicacao", "todos") === "categorias" && /* @__PURE__ */ jsx(TextField, { label: "Nomes das Categorias (separados por v\xEDrgula)", value: value("loja_pix_desconto_categorias", ""), onChange: (next) => setValue("loja_pix_desconto_categorias", next) }),
          value("loja_pix_desconto_tipo_aplicacao", "todos") === "produtos" && /* @__PURE__ */ jsx(TextField, { label: "IDs dos Produtos (separados por v\xEDrgula)", value: value("loja_pix_desconto_produtos", ""), onChange: (next) => setValue("loja_pix_desconto_produtos", next) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200", children: [
          /* @__PURE__ */ jsx("p", { className: "font-bold", children: "Regra de Exclusividade do PIX:" }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] text-amber-800", children: 'Quando configurado como "N\xE3o (Exclusivo)", se o cliente estiver com o pagamento 100% no PIX e for aplicar Pontos ou Saldo da Carteira, o sistema exibir\xE1 o pop-up informativo dando a op\xE7\xE3o de manter o desconto ou prosseguir com o resgate anulando o desconto do PIX.' })
        ] }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["loja_pix_desconto_ativo", "loja_pix_desconto_porcentagem", "loja_pix_desconto_tipo_aplicacao", "loja_pix_desconto_categorias", "loja_pix_desconto_produtos", "loja_pix_desconto_permitir_pontos", "loja_pix_desconto_permitir_saldo_carteira"], "Configura\xE7\xF5es de Desconto PIX salvas.") })
      ] }),
      /* @__PURE__ */ jsxs(Card, { title: "M\xE9todos de Pagamento Padr\xE3o (Checkout)", icon: CreditCard, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-3", children: [
          /* @__PURE__ */ jsx(SelectField, { label: "Permitir PIX", value: value("checkout_metodo_pix_ativo", "true"), onChange: (next) => setValue("checkout_metodo_pix_ativo", next), options: [["true", "Ativo"], ["false", "Inativo"]] }),
          /* @__PURE__ */ jsx(SelectField, { label: "Permitir Cart\xE3o de Cr\xE9dito", value: value("checkout_metodo_cartao_ativo", "true"), onChange: (next) => setValue("checkout_metodo_cartao_ativo", next), options: [["true", "Ativo"], ["false", "Inativo"]] }),
          /* @__PURE__ */ jsx(SelectField, { label: "Permitir Boleto Banc\xE1rio", value: value("checkout_metodo_boleto_ativo", "true"), onChange: (next) => setValue("checkout_metodo_boleto_ativo", next), options: [["true", "Ativo"], ["false", "Inativo"]] })
        ] }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["checkout_metodo_pix_ativo", "checkout_metodo_cartao_ativo", "checkout_metodo_boleto_ativo"], "M\xE9todos de Pagamento do Checkout salvos.") })
      ] }),
      /* @__PURE__ */ jsxs(Card, { title: "Par\xE2metros financeiros", icon: Wallet, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
          /* @__PURE__ */ jsx(NumberField, { label: "Valor m\xEDnimo para saque", value: value("valor_minimo_saque", "50"), onChange: (next) => setValue("valor_minimo_saque", next) }),
          /* @__PURE__ */ jsx(NumberField, { label: "Vencimento de servi\xE7os", value: value("vencimento_padrao_servicos", "10"), onChange: (next) => setValue("vencimento_padrao_servicos", next) }),
          /* @__PURE__ */ jsx(NumberField, { label: "Vencimento de produtos", value: value("vencimento_padrao_produtos", "10"), onChange: (next) => setValue("vencimento_padrao_produtos", next) }),
          /* @__PURE__ */ jsx(NumberField, { label: "Taxa de entrega", value: value("loja_taxa_entrega_padrao", "0"), onChange: (next) => setValue("loja_taxa_entrega_padrao", next) })
        ] }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["valor_minimo_saque", "vencimento_padrao_servicos", "vencimento_padrao_produtos", "loja_taxa_entrega_padrao"], "Par\xE2metros financeiros salvos.") })
      ] }),
      /* @__PURE__ */ jsxs(Card, { title: "Formas de pagamento", icon: CreditCard, children: [
        /* @__PURE__ */ jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => setMethodForm({ nome: "", slug: "", tipo: "manual", instrucoes: "", ativo: true }), className: "flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white", children: [
          /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
          " Nova forma"
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: methods.map((method) => /* @__PURE__ */ jsxs("article", { className: "rounded-2xl border border-neutral-200 p-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h3", { className: "font-black", children: method.nome }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs uppercase text-neutral-400", children: method.tipo })
            ] }),
            /* @__PURE__ */ jsx("button", { type: "button", disabled: saving, onClick: () => void toggleMethod(method), className: `relative h-6 w-11 rounded-full disabled:opacity-50 ${method.ativo ? "bg-indigo-600" : "bg-neutral-300"}`, children: /* @__PURE__ */ jsx("span", { className: `absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${method.ativo ? "translate-x-5" : ""}` }) })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 line-clamp-3 text-sm text-neutral-500", children: method.instrucoes || "Sem instru\xE7\xF5es." }),
          /* @__PURE__ */ jsx("button", { type: "button", disabled: saving, onClick: () => setMethodForm({ ...method }), className: "mt-4 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs font-black disabled:opacity-50", children: "Editar" })
        ] }, method.id)) })
      ] })
    ] }),
    activeTab === "calculadoras" && /* @__PURE__ */ jsxs("section", { className: "space-y-5", children: [
      /* @__PURE__ */ jsx(CalculatorProPaymentConfiguration, {}),
      /* @__PURE__ */ jsx(CalculatorProAdminPanel, {})
    ] }),
    activeTab === "indicacao" && /* @__PURE__ */ jsxs(Card, { title: "Programa de indica\xE7\xE3o", icon: Users, children: [
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsx(SelectField, { label: "Recompensa do indicador", value: value("indicador_recompensa_tipo", "carteira"), onChange: (next) => setValue("indicador_recompensa_tipo", next), options: [["carteira", "Carteira"], ["pontos", "Pontos"], ["ambos", "Ambos"]] }),
        /* @__PURE__ */ jsx(SelectField, { label: "Recompensa do indicado", value: value("indicado_recompensa_tipo", "desconto"), onChange: (next) => setValue("indicado_recompensa_tipo", next), options: [["desconto", "Desconto"], ["pontos", "Pontos"], ["ambos", "Ambos"]] }),
        /* @__PURE__ */ jsx(NumberField, { label: "Limite na carteira", value: value("indicador_limite_carteira", value("bonus_indicador", "20")), onChange: (next) => {
          setValue("indicador_limite_carteira", next);
          setValue("bonus_indicador", next);
        } }),
        /* @__PURE__ */ jsx(NumberField, { label: "Pontos do indicador", value: value("indicador_valor_pontos", "50"), onChange: (next) => setValue("indicador_valor_pontos", next) }),
        /* @__PURE__ */ jsx(NumberField, { label: "Desconto do indicado (%)", value: value("indicado_desconto_porcentagem", value("desconto_indicado_porcentagem", "10")), onChange: (next) => {
          setValue("indicado_desconto_porcentagem", next);
          setValue("desconto_indicado_porcentagem", next);
        } }),
        /* @__PURE__ */ jsx(NumberField, { label: "Pontos do indicado", value: value("indicado_valor_pontos", "50"), onChange: (next) => setValue("indicado_valor_pontos", next) }),
        /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold sm:col-span-2", children: [
          "Mensagem de indica\xE7\xE3o",
          /* @__PURE__ */ jsx("textarea", { rows: 5, value: value("template_mensagem_indicacao", ""), onChange: (event) => setValue("template_mensagem_indicacao", event.target.value), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["indicador_recompensa_tipo", "indicador_limite_carteira", "indicador_valor_pontos", "indicado_recompensa_tipo", "indicado_desconto_porcentagem", "indicado_valor_pontos", "template_mensagem_indicacao", "bonus_indicador", "desconto_indicado_porcentagem"], "Programa de indica\xE7\xE3o salvo.") })
    ] }),
    activeTab === "whatsapp" && /* @__PURE__ */ jsxs("section", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxs(Card, { title: "WhatsApp Master \u2014 Notifica\xE7\xF5es Administrativas (Painel Admin)", icon: MessageSquare, children: [
        /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 mb-5 text-sm text-indigo-950 leading-relaxed", children: [
          /* @__PURE__ */ jsxs("p", { className: "font-black text-indigo-900 flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Bell, { className: "h-4 w-4 text-indigo-600" }),
            " Receptor 100% de Notifica\xE7\xF5es do Sistema"
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-indigo-800/80", children: [
            "Este n\xFAmero de WhatsApp receber\xE1 ",
            /* @__PURE__ */ jsx("strong", { children: "100% de todas as notifica\xE7\xF5es e alertas" }),
            " gerados pelo painel administrativo (alertas t\xE9cnicos de VPS/banco, solicita\xE7\xF5es de clientes, cadastro de fornecedores, demandas de colaboradores, relat\xF3rios, etc.) via API integrada no n8n."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "Telefone WhatsApp Master (Com DDD)",
              value: value("whatsapp_admin_notificacoes", "5511920857756"),
              onChange: (next) => setValue("whatsapp_admin_notificacoes", next.replace(/\D/g, ""))
            }
          ),
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "URL Webhook API n8n",
              value: value("whatsapp_n8n_webhook_url", "http://147.15.43.141:5678/webhook/send-whatsapp"),
              onChange: (next) => setValue("whatsapp_n8n_webhook_url", next)
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ jsx(
            SaveButton,
            {
              saving,
              onClick: () => void saveSettings(["whatsapp_admin_notificacoes", "whatsapp_n8n_webhook_url"], "WhatsApp Master de Notifica\xE7\xF5es salvo com sucesso."),
              label: "Salvar WhatsApp Master"
            }
          ),
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
              className: "mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-md shadow-emerald-600/20 text-sm",
              children: [
                /* @__PURE__ */ jsx(Send, { className: `h-4 w-4 ${sendingTestAlert ? "animate-bounce" : ""}` }),
                sendingTestAlert ? "Enviando Alerta..." : "Enviar Alerta de Teste Agora"
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Card, { title: "Bot\xE3o Flutuante do WhatsApp (Portal do Cliente)", icon: MessageSquare, children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(SelectField, { label: "Ativo", value: value("whatsapp_float_ativo", "true"), onChange: (next) => setValue("whatsapp_float_ativo", next), options: [["true", "Ativo"], ["false", "Desativado"]] }),
          /* @__PURE__ */ jsx(TextField, { label: "Telefone do Bot\xE3o Flutuante", value: value("whatsapp_float_telefone", ""), onChange: (next) => setValue("whatsapp_float_telefone", next.replace(/\D/g, "")) }),
          /* @__PURE__ */ jsx(TextField, { label: "Tooltip", value: value("whatsapp_float_tooltip", "Falar no WhatsApp"), onChange: (next) => setValue("whatsapp_float_tooltip", next) }),
          /* @__PURE__ */ jsx(SelectField, { label: "Tamanho", value: value("whatsapp_float_tamanho", "M"), onChange: (next) => setValue("whatsapp_float_tamanho", next), options: [["P", "Pequeno"], ["M", "M\xE9dio"], ["G", "Grande"]] }),
          /* @__PURE__ */ jsx(SelectField, { label: "Posi\xE7\xE3o", value: value("whatsapp_float_posicao", "direita"), onChange: (next) => setValue("whatsapp_float_posicao", next), options: [["direita", "Direita"], ["esquerda", "Esquerda"]] }),
          /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold sm:col-span-2", children: [
            "Mensagem inicial",
            /* @__PURE__ */ jsx("textarea", { rows: 3, value: value("whatsapp_float_mensagem", ""), onChange: (event) => setValue("whatsapp_float_mensagem", event.target.value), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" })
          ] })
        ] }),
        /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["whatsapp_float_ativo", "whatsapp_float_telefone", "whatsapp_float_mensagem", "whatsapp_float_tamanho", "whatsapp_float_posicao", "whatsapp_float_tooltip"], "Configura\xE7\xF5es do WhatsApp flutuante salvas.") })
      ] })
    ] }),
    activeTab === "portal" && /* @__PURE__ */ jsxs(Card, { title: "Modal de indica\xE7\xE3o no portal", icon: Layout, children: [
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsx(SelectField, { label: "Ativo", value: value("modal_indicacao_ativo", "true"), onChange: (next) => setValue("modal_indicacao_ativo", next), options: [["true", "Ativo"], ["false", "Desativado"]] }),
        /* @__PURE__ */ jsx(SelectField, { label: "Tamanho", value: value("modal_indicacao_tamanho", "md"), onChange: (next) => setValue("modal_indicacao_tamanho", next), options: [["sm", "Pequeno"], ["md", "M\xE9dio"], ["lg", "Grande"]] }),
        /* @__PURE__ */ jsx(TextField, { label: "T\xEDtulo", value: value("modal_indicacao_titulo", "Voc\xEA foi indicado!"), onChange: (next) => setValue("modal_indicacao_titulo", next) }),
        /* @__PURE__ */ jsx(TextField, { label: "Texto do bot\xE3o", value: value("modal_indicacao_texto_botao", "Solicitar Servi\xE7os"), onChange: (next) => setValue("modal_indicacao_texto_botao", next) }),
        /* @__PURE__ */ jsx(TextField, { label: "URL do bot\xE3o", value: value("modal_indicacao_url_botao", ""), onChange: (next) => setValue("modal_indicacao_url_botao", next) }),
        /* @__PURE__ */ jsx(TextField, { label: "M\xF3dulo de destino", value: value("modal_indicacao_modulo_destino", "orcamentos"), onChange: (next) => setValue("modal_indicacao_modulo_destino", next) }),
        /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold sm:col-span-2", children: [
          "Descri\xE7\xE3o",
          /* @__PURE__ */ jsx("textarea", { rows: 4, value: value("modal_indicacao_descricao", ""), onChange: (event) => setValue("modal_indicacao_descricao", event.target.value), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(SaveButton, { saving, onClick: () => void saveSettings(["modal_indicacao_ativo", "modal_indicacao_titulo", "modal_indicacao_descricao", "modal_indicacao_url_botao", "modal_indicacao_acao_botao", "modal_indicacao_modulo_destino", "modal_indicacao_texto_botao", "modal_indicacao_tamanho"], "Configura\xE7\xF5es do portal salvas.") })
    ] }),
    activeTab === "seguranca" && /* @__PURE__ */ jsx(Card, { title: "Seguran\xE7a de credenciais", icon: LockKeyhole, children: /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900", children: [
      /* @__PURE__ */ jsx("p", { className: "font-black", children: "Altera\xE7\xE3o de credencial administrativa removida deste formul\xE1rio." }),
      /* @__PURE__ */ jsxs("p", { className: "mt-2", children: [
        "Segredos de autentica\xE7\xE3o n\xE3o s\xE3o mais lidos ou gravados em ",
        /* @__PURE__ */ jsx("code", { children: "system_settings" }),
        " por uma RPC gen\xE9rica. A rota\xE7\xE3o deve ocorrer por um fluxo dedicado, com hash, revoga\xE7\xE3o de sess\xF5es e registro de auditoria."
      ] })
    ] }) }),
    methodForm && /* @__PURE__ */ jsxs(Overlay, { onClose: () => setMethodForm(null), children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxs("h2", { className: "text-2xl font-black", children: [
          methodForm.id ? "Editar" : "Nova",
          " forma de pagamento"
        ] }),
        /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setMethodForm(null), children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
        /* @__PURE__ */ jsx(TextField, { label: "Nome", value: methodForm.nome || "", onChange: (next) => setMethodForm({ ...methodForm, nome: next }) }),
        /* @__PURE__ */ jsx(TextField, { label: "Slug", value: methodForm.slug || "", onChange: (next) => setMethodForm({ ...methodForm, slug: next }) }),
        /* @__PURE__ */ jsx(TextField, { label: "Tipo", value: methodForm.tipo || "manual", onChange: (next) => setMethodForm({ ...methodForm, tipo: next }) }),
        /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold", children: [
          "Instru\xE7\xF5es",
          /* @__PURE__ */ jsx("textarea", { rows: 4, value: methodForm.instrucoes || "", onChange: (event) => setMethodForm({ ...methodForm, instrucoes: event.target.value }), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8 flex justify-end gap-3", children: [
        /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setMethodForm(null), className: "rounded-xl border border-neutral-200 px-5 py-3 font-bold", children: "Cancelar" }),
        /* @__PURE__ */ jsx("button", { type: "button", disabled: saving, onClick: () => void saveMethod(), className: "rounded-xl bg-indigo-600 px-6 py-3 font-black text-white disabled:opacity-50", children: "Salvar" })
      ] })
    ] })
  ] });
}
function Card({ title, icon: Icon, children }) {
  return /* @__PURE__ */ jsxs("section", { className: "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7", children: [
    /* @__PURE__ */ jsxs("h2", { className: "mb-6 flex items-center gap-3 text-lg font-black", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600", children: /* @__PURE__ */ jsx(Icon, { className: "h-5 w-5" }) }),
      title
    ] }),
    children
  ] });
}
function TextField({ label, value, onChange }) {
  return /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold", children: [
    label,
    /* @__PURE__ */ jsx("input", { value, onChange: (event) => onChange(event.target.value), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" })
  ] });
}
function NumberField({ label, value, onChange }) {
  return /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold", children: [
    label,
    /* @__PURE__ */ jsx("input", { type: "number", min: "0", value, onChange: (event) => onChange(event.target.value), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3" })
  ] });
}
function SelectField({ label, value, onChange, options }) {
  return /* @__PURE__ */ jsxs("label", { className: "block text-sm font-bold", children: [
    label,
    /* @__PURE__ */ jsx("select", { value, onChange: (event) => onChange(event.target.value), className: "mt-2 w-full rounded-xl border border-neutral-200 px-4 py-3", children: options.map(([optionValue, optionLabel]) => /* @__PURE__ */ jsx("option", { value: optionValue, children: optionLabel }, optionValue)) })
  ] });
}
function SaveButton({ saving, onClick, label = "Salvar configura\xE7\xF5es" }) {
  return /* @__PURE__ */ jsxs("button", { type: "button", disabled: saving, onClick, className: "mt-6 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50", children: [
    /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
    saving ? "Salvando..." : label
  ] });
}
export {
  ConfiguracoesModule
};
