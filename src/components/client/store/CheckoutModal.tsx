import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, ArrowLeft, MapPin, Ticket, Coins, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift, Diamond } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getProductDisplayCode } from '../../../lib/productIdentification';
import { formatCurrency, generateUUID } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
import AvailableCouponsModal from './AvailableCouponsModal';
import type { CupomLoja, Produto } from '../../../types';
import type { PromoResult } from '../../../lib/promocaoQuantidadeEngine';
import { callClientRpc } from '../../../lib/clientRpc';
import { getProductEffectivePrice, hasActiveProductDiscount, getProductQuantityPriceBreakdown } from '../../../lib/productPricing';
import { checkPixDiscountApplies } from '../../../hooks/usePixDiscount';

type CartItem = {
  id: string;
  item_id: string;
  tipo: 'produto' | 'servico' | 'assinatura';
  quantidade: number;
  item_detalhes?: Produto | any;
  prazo_meses?: number;
  isBrinde?: boolean;
};

const PENDING_STORE_COUPONS_KEY = 'gsa_pending_store_coupons';

export default function CheckoutModal({ isOpen, onClose, cartItems, promosAplicadas = [], clientId, onSuccess, travelInstallments }: { isOpen: boolean, onClose: () => void, cartItems: any[], promosAplicadas?: any[], clientId: string, onSuccess: (orderId?: string) => void, travelInstallments?: number }) {
  const checkoutRequestId = useRef<string>(generateUUID());
  const normalizedTravelInstallments = travelInstallments || 1;
  // Parcelamento da viagem | parcelas: normalizedTravelInstallments | Total do contrato
  const [step, setStep] = useState(1);
  const [endereco, setEndereco] = useState({ cep: '', logradouro: '', bairro: '', cidade: '', uf: '', numero: '', complemento: '' });
  const [isEditingEndereco, setIsEditingEndereco] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cupomDescInput, setCupomDescInput] = useState('');
  const [cupomEntInput, setCupomEntInput] = useState('');
  const [cupomDesconto, setCupomDesconto] = useState<CupomLoja | null>(null);
  const [cupomEntrega, setCupomEntrega] = useState<CupomLoja | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [taxaEntregaFixa, setTaxaEntregaFixa] = useState(0);

  // Estados para pontos
  const [saldoPontos, setSaldoPontos] = useState(0);
  const [saldoCarteira, setSaldoCarteira] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [usarSaldoCarteira, setUsarSaldoCarteira] = useState(false);
  const [pontosAplicados, setPontosAplicados] = useState(0);
  const [saldoCarteiraAplicado, setSaldoCarteiraAplicado] = useState(0);

  // Estados para crédito da loja
  const [limiteCreditoTotal, setLimiteCreditoTotal] = useState(0);
  const [limiteCreditoDisponivel, setLimiteCreditoDisponivel] = useState(0);
  const [opcaoPagamentoParcelado, setOpcaoPagamentoParcelado] = useState(false);
  const [maxParcelas, setMaxParcelas] = useState(12);
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao' | 'boleto' | 'credito_loja' | 'outros'>('pix');
  const [numParcelas, setNumParcelas] = useState(1);
  const [solicitacaoAtivaId, setSolicitacaoAtivaId] = useState<string | null>(null);
  const [jurosCreditoAvista, setJurosCreditoAvista] = useState(20);
  const [jurosCreditoParcelado, setJurosCreditoParcelado] = useState(50);
  const [lojaPixDescontoAtivo, setLojaPixDescontoAtivo] = useState(false);
  const [lojaPixDescontoPorcentagem, setLojaPixDescontoPorcentagem] = useState(5);
  const [pixSettings, setPixSettings] = useState<{ativo: boolean, porcentagem: number, tipoAplicacao: any, categorias: string[], produtos: string[]}>({
    ativo: false, porcentagem: 5, tipoAplicacao: 'todos', categorias: [], produtos: []
  });
  const [checkoutMetodoPixAtivo, setCheckoutMetodoPixAtivo] = useState(true);
  const [checkoutMetodoCartaoAtivo, setCheckoutMetodoCartaoAtivo] = useState(true);
  const [checkoutMetodoBoletoAtivo, setCheckoutMetodoBoletoAtivo] = useState(true);

  const fetchDadosCredito = async () => {
    if (!clientId) return;
    try {
      const { data: cliData, error: cliErr } = await supabase
        .from('clientes')
        .select('limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado, max_parcelas, cep, endereco, numero, bairro, cidade, estado, saldo_carteira')
        .eq('id', clientId)
        .single();
        
      if (cliErr) throw cliErr;
      if (cliData) {
        setLimiteCreditoTotal(Number(cliData.limite_credito_total || 0));
        setLimiteCreditoDisponivel(Number(cliData.limite_credito_disponivel || 0));
        setSaldoCarteira(Number(cliData.saldo_carteira || 0));
        setOpcaoPagamentoParcelado(cliData.opcao_pagamento_parcelado || false);
        setMaxParcelas(cliData.max_parcelas || 12);

        // Se tiver cep cadastrado no banco, preenche automaticamente
        if (cliData.cep) {
          setEndereco({
            cep: cliData.cep || '',
            logradouro: cliData.endereco || '',
            bairro: cliData.bairro || '',
            cidade: cliData.cidade || '',
            uf: cliData.estado || '',
            numero: cliData.numero || '',
            complemento: ''
          });
          setIsEditingEndereco(false);
        } else {
          setEndereco({ cep: '', logradouro: '', bairro: '', cidade: '', uf: '', numero: '', complemento: '' });
          setIsEditingEndereco(true);
        }
      }

      // Também busca a solicitação ativa liberada
      const { data: solData } = await supabase
        .from('loja_credito_solicitacoes')
        .select('id')
        .eq('cliente_id', clientId)
        .eq('status', 'liberado')
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (solData && solData.length > 0) {
        setSolicitacaoAtivaId(solData[0].id);
      }

      // Buscar taxas de juros de Crédito GSA do system_settings e configs do PIX
      const { data: setts } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['loja_credito_juros_avista', 'loja_credito_juros_parcelado', 'loja_pix_desconto_ativo', 'loja_pix_desconto_porcentagem', 'loja_pix_desconto_tipo_aplicacao', 'loja_pix_desconto_categorias', 'loja_pix_desconto_produtos', 'checkout_metodo_pix_ativo', 'checkout_metodo_cartao_ativo', 'checkout_metodo_boleto_ativo']);
        
      if (setts) {
        const av = setts.find(s => s.key === 'loja_credito_juros_avista');
        const pa = setts.find(s => s.key === 'loja_credito_juros_parcelado');
        if (av) setJurosCreditoAvista(Number(av.value) ?? 20);
        if (pa) setJurosCreditoParcelado(Number(pa.value) ?? 50);

        const pixD = setts.find(s => s.key === 'loja_pix_desconto_ativo');
        const pixP = setts.find(s => s.key === 'loja_pix_desconto_porcentagem');
        const pixTA = setts.find(s => s.key === 'loja_pix_desconto_tipo_aplicacao');
        const pixCat = setts.find(s => s.key === 'loja_pix_desconto_categorias');
        const pixProd = setts.find(s => s.key === 'loja_pix_desconto_produtos');
        
        const settings = {
          ativo: pixD?.value === 'true',
          porcentagem: Number(pixP?.value) || 5,
          tipoAplicacao: pixTA?.value || 'todos',
          categorias: (pixCat?.value || '').split(',').map(s => s.trim()).filter(Boolean),
          produtos: (pixProd?.value || '').split(',').map(s => s.trim()).filter(Boolean)
        };
        setPixSettings(settings);

        if (pixD) setLojaPixDescontoAtivo(settings.ativo);
        if (pixP) setLojaPixDescontoPorcentagem(settings.porcentagem);
        if (mPix) setCheckoutMetodoPixAtivo(mPix.value !== 'false');
        if (mCar) setCheckoutMetodoCartaoAtivo(mCar.value !== 'false');
        if (mBol) setCheckoutMetodoBoletoAtivo(mBol.value !== 'false');
      }
    } catch (err) {
      console.error('Erro ao buscar dados de crédito do cliente:', err);
    }
  };

  const fetchSaldoPontos = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('saldo_pontos')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      if (data) setSaldoPontos(data.saldo_pontos || 0);
    } catch (err) {
      console.error('Erro ao buscar saldo de pontos:', err);
    }
  };

  // Etapa do Checkout: 1 = Endereço, 2 = Benefícios & Cupons, 3 = Pagamento & Resumo
  const [etapaCheckout, setEtapaCheckout] = useState<1 | 2 | 3>(1);

  // Estados para o seletor de cupons
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorCategory, setSelectorCategory] = useState<'desconto' | 'entrega'>('desconto');
  const [availableCoupons, setAvailableCoupons] = useState<CupomLoja[]>([]);

  const fetchCoupons = async (category: 'desconto' | 'entrega') => {
    try {
      // Busca apenas cupons que o cliente ativou
      const { data: ativados, error: errAtivados } = await supabase
        .from('cupons_ativados')
        .select('cupom_id')
        .eq('cliente_id', clientId);

      if (errAtivados) throw errAtivados;

      const ativadosIds = (ativados || []).map((a: any) => a.cupom_id);

      if (ativadosIds.length === 0) {
        setAvailableCoupons([]);
        return;
      }

      let query = supabase
        .from('cupons_loja')
        .select('*')
        .eq('status', 'ativo')
        .eq('categoria_cupom', category)
        .in('id', ativadosIds);

      if (clientId) {
        query = query.or(`cliente_id.is.null,cliente_id.eq.${clientId}`);
      } else {
        query = query.is('cliente_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const { data: orcamentos } = await supabase
        .from('orcamentos')
        .select('cupom_desconto_id, cupom_entrega_id')
        .eq('cliente_id', clientId)
        .neq('status', 'cancelado');

      const clientUsesMap = new Map<string, number>();
      (orcamentos || []).forEach(orc => {
        if (orc.cupom_desconto_id) {
          clientUsesMap.set(orc.cupom_desconto_id, (clientUsesMap.get(orc.cupom_desconto_id) || 0) + 1);
        }
        if (orc.cupom_entrega_id) {
          clientUsesMap.set(orc.cupom_entrega_id, (clientUsesMap.get(orc.cupom_entrega_id) || 0) + 1);
        }
      });

      const now = new Date();
      const filtered = (data || []).filter(c => {
        const usesByClient = clientUsesMap.get(c.id) || 0;
        const maxUsesPerClient = c.limite_usos_por_cliente || 1;
        if (usesByClient >= maxUsesPerClient) return false;

        if (c.data_validade) {
          const [year, month, day] = String(c.data_validade).split('T')[0].split('-').map(Number);
          const expiryDate = new Date(year, month - 1, day, 23, 59, 59);
          if (expiryDate < now) return false;
        }
        if (c.limite_usos && c.total_usos >= c.limite_usos) return false;
        return true;
      });

      setAvailableCoupons(filtered);
    } catch (err) {
      console.error('Erro ao buscar cupons:', err);
    }
  };

  const handleOpenSelector = (category: 'desconto' | 'entrega') => {
    setSelectorCategory(category);
    fetchCoupons(category);
    setIsSelectorOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      // Não regenera o id de idempotência enquanto uma submissão anterior estiver em voo
      // (evita pedido duplicado quando o cliente fecha e reabre o modal em rede lenta).
      if (!isSubmitting) {
        checkoutRequestId.current = generateUUID();
      }
      setEtapaCheckout(1);
      fetchTaxaEntrega();
      fetchSaldoPontos();
      fetchDadosCredito();
      setUsarPontos(false);
      setPontosAplicados(0);
      setFormaPagamento('pix');
      setNumParcelas(1);
      setEndereco({ cep: '', logradouro: '', bairro: '', cidade: '', uf: '', numero: '', complemento: '' });
      setIsEditingEndereco(false);
    }
  }, [isOpen, clientId]);

  useEffect(() => {
    if (!isOpen || !clientId) return;

    const loadPendingCoupons = async () => {
      const rawCoupons = localStorage.getItem(PENDING_STORE_COUPONS_KEY);
      if (!rawCoupons) return;

      try {
        const parsed = JSON.parse(rawCoupons);
        const couponIds = [parsed?.cupomDescontoId, parsed?.cupomEntregaId].filter(Boolean);
        if (couponIds.length === 0) {
          localStorage.removeItem(PENDING_STORE_COUPONS_KEY);
          return;
        }

        const { data, error } = await supabase
          .from('cupons_loja')
          .select('*')
          .in('id', couponIds);

        if (error) throw error;

        const desconto = (data || []).find((cupom: CupomLoja) => cupom.id === parsed?.cupomDescontoId);
        const entrega = (data || []).find((cupom: CupomLoja) => cupom.id === parsed?.cupomEntregaId);

        if (desconto) setCupomDesconto(desconto as CupomLoja);
        if (entrega) setCupomEntrega(entrega as CupomLoja);

        localStorage.removeItem(PENDING_STORE_COUPONS_KEY);
      } catch (error) {
        console.error('[GSAStore] Erro ao carregar cupons pendentes:', error);
      }
    };

    loadPendingCoupons();
  }, [isOpen, clientId]);

  const fetchTaxaEntrega = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'loja_taxa_entrega_padrao').maybeSingle();
      if (data) setTaxaEntregaFixa(parseFloat(data.value) || 0);
    } catch (err) {
      console.error('Erro ao buscar taxa de entrega:', err);
    }
  };

  const temProdutos = cartItems.some((c: CartItem) => c.tipo === 'produto');
  const enderecoCompletoValido = Boolean(
    endereco.cep?.trim()
    && endereco.logradouro?.trim()
    && endereco.numero?.trim()
    && endereco.bairro?.trim()
    && endereco.cidade?.trim()
    && endereco.uf?.trim(),
  );
  const subtotalInicial = cartItems.reduce((acc: number, cur: CartItem) => {
    if (cur.tipo === 'produto') {
      return acc + getProductQuantityPriceBreakdown(cur.item_detalhes, cur.quantidade).subtotalFinal;
    }
    return acc + ((cur.item_detalhes?.valor || 0) * cur.quantidade);
  }, 0);

  const subtotalContrato = cartItems.reduce((acc: number, cur: CartItem) => {
    const multiplicadorPeriodo = cur.tipo === 'assinatura' ? (cur.prazo_meses || 1) : 1;
    if (cur.tipo === 'produto') {
      return acc + (getProductQuantityPriceBreakdown(cur.item_detalhes, cur.quantidade).subtotalFinal * multiplicadorPeriodo);
    }
    return acc + ((cur.item_detalhes?.valor || 0) * cur.quantidade * multiplicadorPeriodo);
  }, 0);

  const descontoPromocoes = (promosAplicadas || []).reduce((acc: number, promo: PromoResult) => {
    if (promo.status === 'ativa' && promo.desconto_aplicado) {
      return acc + promo.desconto_aplicado.valor_desconto;
    }
    return acc;
  }, 0);
  
  const subtotalComPromos = Math.max(0, subtotalInicial - descontoPromocoes);

  // 1. Lógica de pontos fidelidade (1 ponto = R$ 0,01) - Pontos têm prioridade absoluta sobre o cupom
  const maxPontosEmCentavos = Math.floor(subtotalComPromos * 100);
  const maxPontosValidos = Math.min(saldoPontos, Math.max(0, maxPontosEmCentavos));

  const handleTogglePontos = (checked: boolean) => {
    setUsarPontos(checked);
    if (checked) {
      setPontosAplicados(maxPontosValidos);
    } else {
      setPontosAplicados(0);
    }
  };

  const handlePontosChange = (val: number) => {
    if (isNaN(val) || val < 0) {
      setPontosAplicados(0);
      return;
    }
    const cleanVal = Math.min(val, maxPontosValidos);
    setPontosAplicados(cleanVal);
  };

  const descontoPontos = usarPontos ? Number((Math.min(pontosAplicados, maxPontosValidos) * 0.01).toFixed(2)) : 0;
  const subtotalAposPontos = Number(Math.max(0, subtotalComPromos - descontoPontos).toFixed(2));

  // 2. Calcula descontos lógicos baseado no cupom selecionado
  const calcularDesconto = () => {
    if (!cupomDesconto) return 0;
    
    // Calcula base de desconto
    let baseCalculo = subtotalAposPontos;
    if (cupomDesconto.produto_id) {
      // Cupom restrito a um produto
      const itemEsp = cartItems.find((c: CartItem) => c.item_id === cupomDesconto.produto_id);
      if (!itemEsp) return 0; // não devia acontecer, pois a validação barra
      const descontoPromocionalDoProduto = (promosAplicadas || []).reduce((acc: number, promo: PromoResult) => {
        if (promo.status !== 'ativa') return acc;
        if (promo.desconto_aplicado?.produto_id === cupomDesconto.produto_id) {
          return acc + Number(promo.desconto_aplicado.valor_desconto || 0);
        }
        return acc;
      }, 0);
      const unitVal = itemEsp.tipo === 'produto' ? (getProductQuantityPriceBreakdown(itemEsp.item_detalhes, itemEsp.quantidade).subtotalFinal / itemEsp.quantidade) : (itemEsp.item_detalhes?.valor || 0);
      baseCalculo = Math.max(0, (unitVal * itemEsp.quantidade) - descontoPromocionalDoProduto);
    }

    let desc = 0;
    if (cupomDesconto.tipo_desconto === 'porcentagem') {
      desc = baseCalculo * ((cupomDesconto.valor_desconto || 0) / 100);
    } else {
      desc = cupomDesconto.valor_desconto || 0;
    }

    // O cupom é aplicado após os pontos, limitando-se ao valor restante para não negativar nem ultrapassar
    return Math.min(desc, subtotalAposPontos);
  };

  const descontoCalculado = Number(calcularDesconto().toFixed(2));
  
  // Taxa de entrega final (0 se cupom de frete grátis, caso contrário a taxa fixa se houver produtos)
  const taxaEntregaFinal = (temProdutos && !cupomEntrega) ? taxaEntregaFixa : (cupomEntrega?.tipo_entrega === 'taxa_fixa' ? (cupomEntrega.taxa_fixa_entrega || 0) : 0);

  const totalAntesCarteira = Number(Math.max(subtotalComPromos - descontoPontos - descontoCalculado + taxaEntregaFinal, 0).toFixed(2));

  // 1.5 Lógica de Saldo na Carteira Virtual
  // Saldo negativo nunca pode virar "desconto negativo" (aumentando o total).
  const saldoCarteiraUtilizavel = Math.max(0, saldoCarteira);
  const maxSaldoValido = Number(Math.min(saldoCarteiraUtilizavel, totalAntesCarteira).toFixed(2));
  
  const handleToggleSaldoCarteira = (checked: boolean) => {
    setUsarSaldoCarteira(checked);
    if (checked) {
      setSaldoCarteiraAplicado(maxSaldoValido);
    } else {
      setSaldoCarteiraAplicado(0);
    }
  };

  const handleSaldoCarteiraChange = (val: number) => {
    if (isNaN(val) || val < 0) {
      setSaldoCarteiraAplicado(0);
      return;
    }
    const cleanVal = Number(Math.min(val, maxSaldoValido).toFixed(2));
    setSaldoCarteiraAplicado(cleanVal);
  };

  const descontoCarteira = usarSaldoCarteira ? Number(Math.min(saldoCarteiraAplicado, maxSaldoValido).toFixed(2)) : 0;

  // Se o carrinho/total diminuir, reduz automaticamente os valores aplicados
  // para que a tela e o que é enviado ao servidor nunca fiquem dessincronizados.
  useEffect(() => {
    setPontosAplicados((prev) => (prev > maxPontosValidos ? maxPontosValidos : prev));
  }, [maxPontosValidos]);

  useEffect(() => {
    setSaldoCarteiraAplicado((prev) => (prev > maxSaldoValido ? maxSaldoValido : prev));
  }, [maxSaldoValido]);

  const totalHoje = Number(Math.max(totalAntesCarteira - descontoCarteira, 0).toFixed(2));
  
  // Taxa de juros do Crédito GSA: à vista aplica a taxa base; parcelado aplica a taxa base
  // + a taxa por parcela adicional (conforme configuração em Admin > Crédito).
  const calcularTaxaJuros = (parcelas: number) =>
    parcelas <= 1 ? jurosCreditoAvista : jurosCreditoAvista + (jurosCreditoParcelado * parcelas);

  const taxaJurosAplicada = formaPagamento === 'credito_loja'
    ? calcularTaxaJuros(numParcelas)
    : 0;
  const valorJurosCredito = formaPagamento === 'credito_loja'
    ? parseFloat((totalHoje * (taxaJurosAplicada / 100)).toFixed(2))
    : 0;
    
  const eligiblePixSubtotal = cartItems.reduce((acc: number, item: any) => {
    if (item.tipo === 'produto' && checkPixDiscountApplies(item.item_detalhes, pixSettings)) {
      const unitVal = (getProductQuantityPriceBreakdown(item.item_detalhes, item.quantidade).subtotalFinal / item.quantidade) || (item.item_detalhes?.valor || 0);
      return acc + (unitVal * item.quantidade);
    }
    return acc;
  }, 0);

  // O desconto PIX incide sobre os itens elegíveis no carrinho (após desconto de pontos proporcionais, se quisermos ser super estritos, mas aqui usamos o subtotal bruto deles).
  // E evitamos dar mais desconto do que o totalHoje (que já deduziu carteira etc)
  const maxPixDiscountBase = Math.min(eligiblePixSubtotal, totalHoje);

  const pixDiscountValue = (formaPagamento === 'pix' && lojaPixDescontoAtivo)
    ? parseFloat((maxPixDiscountBase * (lojaPixDescontoPorcentagem / 100)).toFixed(2))
    : 0;

  const totalHojeFinal = totalHoje + valorJurosCredito - pixDiscountValue;
  const totalContratoFinal = totalHojeFinal + (subtotalContrato - subtotalInicial);

  const isTravelCheckout = cartItems.some((c: CartItem) => c.tipo === ('pacote_viagem' as any));

  // Revalida reativamente os cupons quando o carrinho muda (item removido, quantidade alterada)
  useEffect(() => {
    if (!isOpen) return;

    if (cupomEntrega) {
      if (!temProdutos) {
        setCupomEntrega(null);
        toast.error('Cupom de entrega removido: não há mais produtos físicos no carrinho.');
      } else if (
        cupomEntrega.tipo_entrega === 'frete_gratis_minimo' &&
        subtotalInicial < (cupomEntrega.valor_minimo_compra || 0)
      ) {
        setCupomEntrega(null);
        toast.error(
          `Cupom de frete grátis removido: a compra mínima é ${formatCurrency(cupomEntrega.valor_minimo_compra || 0)}.`,
        );
      }
    }

    if (cupomDesconto?.produto_id) {
      const itemNoCarrinho = cartItems.find((c: CartItem) => c.item_id === cupomDesconto.produto_id);
      if (!itemNoCarrinho) {
        setCupomDesconto(null);
        toast.error('Cupom removido: o produto exigido por este cupom não está mais no carrinho.');
      }
    }

    if (cupomDesconto && (cupomDesconto.valor_minimo_compra || 0) > 0 && subtotalInicial < (cupomDesconto.valor_minimo_compra || 0)) {
      setCupomDesconto(null);
      toast.error(
        `Cupom removido: a compra mínima para este cupom é ${formatCurrency(cupomDesconto.valor_minimo_compra || 0)}.`,
      );
    }

  }, [isOpen, subtotalInicial, temProdutos, cartItems, cupomEntrega, cupomDesconto]);

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco(p => ({ ...p, cep: limpo, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf }));
      } else {
        toast.error('CEP não encontrado.');
      }
    } catch {
      toast.error('Erro ao buscar CEP.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const aplicarCupom = async (codigo: string, tipo: 'desconto' | 'entrega') => {
    if (!codigo) return;
    try {
      const { data, error } = await supabase.from('cupons_loja').select('*').eq('codigo_cupom', codigo.toUpperCase()).single();
      if (error || !data) {
        toast.error('Cupom inválido ou não encontrado.');
        return;
      }
      
      const cupom = data as CupomLoja;
      
      // Validações básicas
      if (cupom.status !== 'ativo') return toast.error('Este cupom não está mais ativo.');
      if (Number(cupom.limite_usos || 0) > 0 && Number(cupom.total_usos || 0) >= Number(cupom.limite_usos)) return toast.error('Limite de uso do cupom esgotado.');
      if (cupom.data_validade) {
        const [year, month, day] = String(cupom.data_validade).split('T')[0].split('-').map(Number);
        const expiryDate = new Date(year, month - 1, day, 23, 59, 59);
        if (expiryDate < new Date()) return toast.error('Cupom expirado.');
      }
      if (cupom.cliente_id && cupom.cliente_id !== clientId) return toast.error('Este cupom é exclusivo para outro cliente.');

      // Verifica se o cliente ativou este cupom em Meus Cupons
      const { data: ativacao, error: errAtiv } = await supabase
        .from('cupons_ativados')
        .select('id')
        .eq('cliente_id', clientId)
        .eq('cupom_id', cupom.id)
        .maybeSingle();

      if (errAtiv) throw errAtiv;

      if (!ativacao) {
        return toast.error('Você precisa ativar este cupom primeiro. Vá em Meus Cupons e clique em "Ativar Cupom" antes de usar no checkout.', { duration: 5000 });
      }

      // Verifica se já atingiu o limite de usos do cliente
      const { data: orcUsados } = await supabase
        .from('orcamentos')
        .select('id')
        .eq('cliente_id', clientId)
        .neq('status', 'cancelado')
        .or(`cupom_desconto_id.eq.${cupom.id},cupom_entrega_id.eq.${cupom.id}`);

      const limiteCliente = cupom.limite_usos_por_cliente || 1;
      if (orcUsados && orcUsados.length >= limiteCliente) {
        return toast.error(`Você já atingiu o limite de ${limiteCliente} uso(s) deste cupom.`);
      }
      
      // Validação de tipo
      if (tipo === 'desconto' && cupom.categoria_cupom === 'entrega') return toast.error('Este é um cupom de entrega.');
      if (tipo === 'entrega' && cupom.categoria_cupom !== 'entrega') return toast.error('Este não é um cupom de entrega.');
      
      // Validação de produto específico
      if (cupom.produto_id) {
        const itemNoCarrinho = cartItems.find((c: CartItem) => c.item_id === cupom.produto_id);
        if (!itemNoCarrinho) {
          // Busca o nome e o código do produto para uma mensagem mais clara
          const { data: prodData } = await supabase.from('produtos').select('nome, codigo_produto, codigo_barras, identificador_preferencial').eq('id', cupom.produto_id).single();
          const nomeProd = prodData?.nome || 'um produto específico';
          const codProd = prodData ? getProductDisplayCode(prodData as any) : '---';
          return toast.error(`Este cupom é exclusivo para o item [${codProd}] ${nomeProd}. Adicione-o ao carrinho para aplicar o desconto.`);
        }
      }

      // Validação Extra de Entrega
      if (tipo === 'entrega') {
        if (!temProdutos) return toast.error('Você não tem produtos físicos no carrinho para usar cupom de entrega.');
        if (cupom.tipo_entrega === 'frete_gratis_minimo' && subtotalInicial < (cupom.valor_minimo_compra || 0)) {
          return toast.error(`A compra mínima para este frete grátis é ${formatCurrency(cupom.valor_minimo_compra || 0)}.`);
        }
        setCupomEntrega(cupom);
        setCupomEntInput('');
        toast.success('Benefício de entrega aplicado!');
      } else {
        // Cupom de desconto também respeita o valor mínimo de compra configurado.
        if ((cupom.valor_minimo_compra || 0) > 0 && subtotalInicial < (cupom.valor_minimo_compra || 0)) {
          return toast.error(`A compra mínima para usar este cupom é ${formatCurrency(cupom.valor_minimo_compra || 0)}.`);
        }
        setCupomDesconto(cupom);
        setCupomDescInput('');
        toast.success('Desconto aplicado com sucesso!');
      }

    } catch {
      toast.error('Erro ao processar cupom.');
    }
  };

  const handleFinalizar = async () => {
    // Trava síncrona contra duplo-clique (o estado do React pode não ter propagado ainda).
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await executarFinalizacao();
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const executarFinalizacao = async () => {
    // Verificar se houve alteração de preço no banco antes de fechar
    try {
      const productIds = cartItems.filter((c: any) => c.tipo === 'produto').map((c: any) => c.item_id);
      if (productIds.length > 0) {
        const { data: dbProducts } = await supabase
          .from('produtos')
          .select('id, valor, valor_promocional, desconto_ativo, desconto_fim_em, desconto_prazo_tipo, desconto_limite_quantidade_ativo, desconto_quantidade_limite, desconto_quantidade_utilizada, visivel_na_loja, estoque_disponivel')
          .in('id', productIds);
        if (dbProducts) {
          let priceChanged = false;
          for (const item of cartItems) {
            if (item.tipo !== 'produto') continue;
            const dbProd = dbProducts.find((p: any) => p.id === item.item_id);
            if (dbProd) {
              // Verifica se a promoção expirou no banco
              let isStillActive = dbProd.desconto_ativo;
              if (isStillActive && dbProd.desconto_prazo_tipo === 'determinado' && dbProd.desconto_fim_em) {
                if (new Date() >= new Date(dbProd.desconto_fim_em)) {
                  isStillActive = false;
                }
              }
              // Verifica se a cota de quantidade foi esgotada
              if (isStillActive && dbProd.desconto_limite_quantidade_ativo && dbProd.desconto_quantidade_limite) {
                const restante = dbProd.desconto_quantidade_limite - (dbProd.desconto_quantidade_utilizada || 0);
                if (restante <= 0) {
                  isStillActive = false;
                }
              }
              const currentDbPrice = isStillActive ? dbProd.valor_promocional : dbProd.valor;
              const cartPrice = getProductQuantityPriceBreakdown(item.item_detalhes, item.quantidade).subtotalFinal / item.quantidade;
              if (Math.abs((currentDbPrice || 0) - cartPrice) > 0.001) {
                priceChanged = true;
                break;
              }
            }
          }
          if (priceChanged) {
            toast.error('O preço de alguns produtos no seu carrinho foi atualizado. Recarregando...');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Erro ao validar alteração de preço:', err);
      toast.error('Não foi possível validar preços e estoque. Tente novamente.');
      return;
    }


    const hasInvalidOrDeleted = cartItems.some((c: any) => 
      !c.item_detalhes 
      || (c.tipo === 'produto' && c.item_detalhes?.controle_estoque && (c.item_detalhes?.estoque_disponivel <= 0))
    );
    if (hasInvalidOrDeleted) {
      toast.error('Remova os produtos excluídos ou esgotados do carrinho antes de finalizar.');
      return;
    }

    // Quantidade solicitada não pode ultrapassar o estoque disponível.
    const itemSemEstoqueSuficiente = cartItems.find((c: any) => (
      c.tipo === 'produto'
      && c.item_detalhes?.controle_estoque
      && Number(c.quantidade || 0) > Number(c.item_detalhes?.estoque_disponivel || 0)
    ));
    if (itemSemEstoqueSuficiente) {
      toast.error(
        `Estoque insuficiente para "${itemSemEstoqueSuficiente.item_detalhes?.nome || 'um produto'}": `
        + `restam ${Number(itemSemEstoqueSuficiente.item_detalhes?.estoque_disponivel || 0)} unidade(s).`,
      );
      return;
    }

    if (temProdutos && !enderecoCompletoValido) {
      toast.error('Endereço completo é obrigatório para entrega de produtos (CEP, logradouro, número, bairro, cidade e UF).');
      return;
    }

    // Revalida saldo de carteira, pontos e limite de crédito imediatamente antes do envio
    // (podem ter sido consumidos em outra aba/pedido concorrente).
    try {
      const { data: freshCli, error: freshErr } = await supabase
        .from('clientes')
        .select('limite_credito_disponivel, saldo_carteira, saldo_pontos')
        .eq('id', clientId)
        .single();
      if (freshErr) throw freshErr;

      const freshLimite = Number(freshCli?.limite_credito_disponivel || 0);
      const freshCarteira = Number(freshCli?.saldo_carteira || 0);
      const freshPontos = Number(freshCli?.saldo_pontos || 0);

      setLimiteCreditoDisponivel(freshLimite);
      setSaldoCarteira(freshCarteira);
      setSaldoPontos(freshPontos);

      if (usarSaldoCarteira && saldoCarteiraAplicado > freshCarteira + 0.001) {
        toast.error('Seu saldo em carteira mudou. Revise o valor aplicado antes de finalizar.');
        setSaldoCarteiraAplicado(Number(Math.min(saldoCarteiraAplicado, freshCarteira).toFixed(2)));
        return;
      }

      if (usarPontos && pontosAplicados > freshPontos) {
        toast.error('Seu saldo de pontos mudou. Revise a quantidade aplicada antes de finalizar.');
        setPontosAplicados(Math.min(pontosAplicados, freshPontos));
        return;
      }

      if (formaPagamento === 'credito_loja' && totalHojeFinal > freshLimite) {
        toast.error(
          `Crédito GSA insuficiente: esta compra exige ${formatCurrency(totalHojeFinal)} `
          + `(com juros) e você tem ${formatCurrency(freshLimite)} disponível.`,
        );
        return;
      }
    } catch (err) {
      console.error('Erro ao revalidar saldos do cliente:', err);
      toast.error('Não foi possível validar seus saldos. Tente novamente.');
      return;
    }

    // Revalida os cupons aplicados imediatamente antes do envio (podem ter expirado
    // ou esgotado o limite de usos enquanto o checkout ficou aberto).
    try {
      const cupomIds = [cupomDesconto?.id, cupomEntrega?.id].filter(Boolean) as string[];
      if (cupomIds.length > 0) {
        const { data: freshCupons, error: cupErr } = await supabase
          .from('cupons_loja')
          .select('id, status, data_validade, total_usos, limite_usos')
          .in('id', cupomIds);
        if (cupErr) throw cupErr;

        const invalido = (id?: string | null) => {
          if (!id) return false;
          const c: any = (freshCupons || []).find((f: any) => f.id === id);
          if (!c) return true;
          if (c.status !== 'ativo') return true;
          if (Number(c.limite_usos || 0) > 0 && Number(c.total_usos || 0) >= Number(c.limite_usos)) return true;
          if (c.data_validade) {
            const [y, m, d] = String(c.data_validade).split('T')[0].split('-').map(Number);
            if (new Date(y, m - 1, d, 23, 59, 59) < new Date()) return true;
          }
          return false;
        };

        if (invalido(cupomDesconto?.id)) {
          setCupomDesconto(null);
          toast.error('O cupom de desconto aplicado não é mais válido e foi removido. Revise o total antes de finalizar.');
          return;
        }
        if (invalido(cupomEntrega?.id)) {
          setCupomEntrega(null);
          toast.error('O cupom de entrega aplicado não é mais válido e foi removido. Revise o total antes de finalizar.');
          return;
        }
      }
    } catch (err) {
      console.error('Erro ao revalidar cupons:', err);
      toast.error('Não foi possível validar os cupons aplicados. Tente novamente.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isTravelCheckout) {
        // Fluxo de checkout de viagem
        const pacote = cartItems.find((c: any) => c.tipo === 'pacote_viagem');
        const data = await callClientRpc<any>('gsa_client_checkout_travel', {
          p_payload: {
            request_id: checkoutRequestId.current,
            proposta_id: pacote.item_id,
            forma_pagamento: formaPagamento,
            parcelas: normalizedTravelInstallments,
          }
        });
        
        toast.success('🎉 Viagem Confirmada com Sucesso!');
        checkoutRequestId.current = generateUUID();
        onSuccess(data.transacao_id);
      } else {
        // Fluxo normal da loja
        const enderecoCompleto = temProdutos ? endereco : null;
        const data = await callClientRpc<any>('gsa_client_checkout_store', {
          p_payload: {
            request_id: checkoutRequestId.current,
            carrinho: cartItems.map((item: CartItem) => ({
              item_id: item.item_id,
              tipo: item.tipo,
              quantidade: item.quantidade,
              ...(item.tipo === 'assinatura' ? { prazo_meses: item.prazo_meses || 1 } : {}),
            })),
            forma_pagamento: formaPagamento,
            // Envia exatamente o que foi descontado na tela (valores já limitados
            // ao subtotal/saldo atual), evitando debitar mais pontos ou saldo do
            // que o desconto realmente concedido quando o carrinho muda.
            pontos_usados: usarPontos ? Math.min(pontosAplicados, maxPontosValidos) : 0,
            saldo_carteira_usado: descontoCarteira,
            cupom_desconto_id: cupomDesconto?.id || null,
            cupom_entrega_id: cupomEntrega?.id || null,
            endereco_entrega: enderecoCompleto,
            parcelas: opcaoPagamentoParcelado ? numParcelas : 1,
          }
        });

        toast.success('🎉 Pedido Confirmado com Sucesso!');
        checkoutRequestId.current = generateUUID();
        onSuccess(data.orcamento_id);
      }
      
    } catch (e: any) {
      console.error('Erro no checkout RPC:', e);
      const raw = String(e?.message || '');
      const friendly = /produto indispon/i.test(raw)
        ? 'Um dos produtos do carrinho saiu do catálogo. Abra o carrinho e remova o item indisponível para concluir a compra.'
        : raw || 'Falha ao processar compra. Tente novamente.';
      toast.error(friendly);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finalizar Compra" size="wide">
      <div className="bg-neutral-50 rounded-b-3xl flex flex-col min-h-0 max-h-[85vh]">
        
        {/* Barra de Progresso Visual das 3 Etapas */}
        <div className="bg-white border-b border-neutral-200/80 px-4 sm:px-8 py-3.5 shrink-0">
          <div className="flex items-center justify-between relative max-w-xl mx-auto">
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-neutral-200 rounded-full z-0"></div>
            <div 
              className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-[#17345f] rounded-full z-0 transition-all duration-300"
              style={{
                width: etapaCheckout === 1 ? '0%' : etapaCheckout === 2 ? '50%' : 'calc(100% - 3rem)'
              }}
            ></div>
            
            {/* Passo 1: Endereço */}
            <button
              type="button"
              onClick={() => setEtapaCheckout(1)}
              className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-md ${
                etapaCheckout > 1 
                  ? 'bg-[#17345f] text-white' 
                  : etapaCheckout === 1 
                    ? 'bg-[#17345f] text-white ring-4 ring-indigo-100' 
                    : 'bg-white text-neutral-400 border-2 border-neutral-300'
              }`}>
                {etapaCheckout > 1 ? <Check className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${etapaCheckout === 1 ? 'text-[#17345f]' : 'text-neutral-500'}`}>
                1. Endereço
              </span>
            </button>

            {/* Passo 2: Cupons & Benefícios */}
            <button
              type="button"
              onClick={() => {
                if (temProdutos && !enderecoCompletoValido) {
                  toast.error('Preencha o endereço de entrega completo para avançar.');
                  return;
                }
                setEtapaCheckout(2);
              }}
              className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-md ${
                etapaCheckout > 2 
                  ? 'bg-[#17345f] text-white' 
                  : etapaCheckout === 2 
                    ? 'bg-[#17345f] text-white ring-4 ring-indigo-100' 
                    : 'bg-white text-neutral-400 border-2 border-neutral-300'
              }`}>
                {etapaCheckout > 2 ? <Check className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${etapaCheckout === 2 ? 'text-[#17345f]' : 'text-neutral-500'}`}>
                2. Benefícios
              </span>
            </button>

            {/* Passo 3: Pagamento & Resumo */}
            <button
              type="button"
              onClick={() => {
                if (temProdutos && !enderecoCompletoValido) {
                  toast.error('Preencha o endereço de entrega completo para avançar.');
                  return;
                }
                setEtapaCheckout(3);
              }}
              className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-md ${
                etapaCheckout === 3 
                  ? 'bg-[#17345f] text-white ring-4 ring-indigo-100' 
                  : 'bg-white text-neutral-400 border-2 border-neutral-300'
              }`}>
                <CreditCard className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${etapaCheckout === 3 ? 'text-[#17345f]' : 'text-neutral-500'}`}>
                3. Pagamento
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ETAPA 1: CONFIRMAR ENDEREÇO DE ENTREGA */}
        {/* ========================================================================= */}
        {etapaCheckout === 1 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 custom-scrollbar max-w-3xl mx-auto w-full">
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wider">
                      Endereço de Entrega
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-semibold">
                      {temProdutos ? 'Confirme o local para envio dos seus produtos' : 'Confirmação de identificação para o pedido'}
                    </p>
                  </div>
                </div>

                {temProdutos && endereco.cep && !isEditingEndereco && (
                  <button 
                    type="button"
                    onClick={() => setIsEditingEndereco(true)}
                    className="text-xs font-bold text-[#17345f] hover:text-[#0c2242] uppercase tracking-wider flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 cursor-pointer shadow-xs transition-all"
                  >
                    ✏️ Alterar
                  </button>
                )}
              </div>

              {temProdutos ? (
                !isEditingEndereco && endereco.cep ? (
                  <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-8 -mt-8 pointer-events-none" />
                    <div className="space-y-2 relative z-10">
                      <p className="text-base text-neutral-900 font-bold leading-normal">
                        {endereco.logradouro}, {endereco.numero}
                        {endereco.complemento && ` - ${endereco.complemento}`}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-neutral-600">
                        <p><strong className="text-neutral-800">Bairro:</strong> {endereco.bairro}</p>
                        <p><strong className="text-neutral-800">Cidade:</strong> {endereco.cidade} - {endereco.uf}</p>
                        <p><strong className="text-neutral-800">CEP:</strong> <span className="font-mono">{endereco.cep}</span></p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {endereco.cep && (
                      <div className="flex justify-end">
                        <button 
                          type="button"
                          onClick={() => {
                            fetchDadosCredito();
                            setIsEditingEndereco(false);
                          }}
                          className="text-xs font-bold text-neutral-500 hover:text-neutral-700 uppercase tracking-wider cursor-pointer"
                        >
                          Cancelar alteração / Usar endereço cadastrado
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">CEP *</label>
                        <input 
                          type="text" 
                          value={endereco.cep} 
                          onChange={e => { 
                            setEndereco({...endereco, cep: e.target.value}); 
                            if(e.target.value.length >= 8) buscarCep(e.target.value); 
                          }} 
                          className="w-full mt-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                          placeholder="XXXXX-XXX" 
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-neutral-500 uppercase">Logradouro *</label>
                        <input type="text" readOnly value={endereco.logradouro} className="w-full mt-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-600" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">Número *</label>
                        <input type="text" value={endereco.numero} onChange={e => setEndereco({...endereco, numero: e.target.value})} className="w-full mt-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">Complemento</label>
                        <input type="text" value={endereco.complemento} onChange={e => setEndereco({...endereco, complemento: e.target.value})} className="w-full mt-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">Bairro *</label>
                        <input type="text" readOnly value={endereco.bairro} className="w-full mt-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-600" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase">Cidade / UF *</label>
                        <input type="text" readOnly value={`${endereco.cidade} - ${endereco.uf}`} className="w-full mt-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-600" />
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3">
                  <Package className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-xs font-bold text-indigo-900 leading-normal">
                    Seu pedido contém apenas serviços ou assinaturas digitais e não necessita de entrega física.
                  </p>
                </div>
              )}
            </div>

            {/* Mini Box de Conferência */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-neutral-800 tracking-wider">Itens no Pedido</h4>
                  <p className="text-xs text-neutral-500 font-medium">
                    {cartItems.reduce((acc: number, c: CartItem) => acc + c.quantidade, 0)} {cartItems.reduce((acc: number, c: CartItem) => acc + c.quantidade, 0) === 1 ? 'item selecionado' : 'itens selecionados'}
                  </p>
                </div>
              </div>
              <span className="text-base font-black text-neutral-900">{formatCurrency(subtotalInicial)}</span>
            </div>

            {/* Botão de Avançar Etapa 1 */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={temProdutos && !enderecoCompletoValido}
                onClick={() => {
                  if (temProdutos && !enderecoCompletoValido) {
                    toast.error('Preencha todos os campos obrigatórios do endereço de entrega.');
                    return;
                  }
                  setEtapaCheckout(2);
                }}
                className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                Avançar para Cupons & Benefícios
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 2: CUPONS, PONTOS VIP E CARTEIRA */}
        {/* ========================================================================= */}
        {etapaCheckout === 2 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 custom-scrollbar max-w-3xl mx-auto w-full">
            
            {/* Seção Cupons da Loja */}
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-neutral-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-600" /> Cupons da Loja
              </h3>
              
              {/* Cupom Desconto */}
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1 mb-2"><Tag className="w-3 h-3" /> Cupom de Desconto</label>
                {cupomDesconto ? (
                  <div className="flex flex-col gap-2 bg-white border border-blue-200 p-3 rounded-xl">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-sm font-bold text-blue-700">{cupomDesconto.codigo_cupom} - {cupomDesconto.tipo_desconto === 'porcentagem' ? `${cupomDesconto.valor_desconto}% OFF` : `R$ ${cupomDesconto.valor_desconto} OFF`}</span>
                      <button onClick={() => setCupomDesconto(null)} className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer">Remover</button>
                    </div>
                    {cupomDesconto.produto_id && (() => {
                      const benefitedItem = cartItems.find(c => c.item_id === cupomDesconto.produto_id);
                      const itemCode = (benefitedItem?.tipo === 'produto' ? getProductDisplayCode(benefitedItem?.item_detalhes as any) : (benefitedItem?.item_detalhes?.codigo_produto || benefitedItem?.item_detalhes?.codigo_servico || benefitedItem?.item_detalhes?.codigo_assinatura || ''));
                      return (
                        <div className="flex items-start gap-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                          <AlertCircle className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold text-blue-600 leading-tight">
                            Regra do Cupom: Desconto aplicado exclusivamente ao item <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">{itemCode}</span> - <span className="underline italic">"{benefitedItem?.item_detalhes?.nome || 'selecionado'}"</span>.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text" value={cupomDescInput} onChange={e => setCupomDescInput(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="flex-1 px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm font-mono uppercase" />
                      <button onClick={() => aplicarCupom(cupomDescInput, 'desconto')} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-sm cursor-pointer">Aplicar</button>
                    </div>
                    <button 
                      onClick={() => handleOpenSelector('desconto')}
                      className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors ml-1 cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      Ver Cupons Disponíveis
                    </button>
                  </div>
                )}
              </div>

              {/* Cupom Entrega */}
              {temProdutos && (
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <label className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1 mb-2"><Package className="w-3 h-3" /> Benefício de Entrega</label>
                  {cupomEntrega ? (
                    <div className="flex flex-col gap-2 bg-white border border-emerald-200 p-3 rounded-xl">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-sm font-bold text-emerald-700">{cupomEntrega.codigo_cupom} - {cupomEntrega.tipo_entrega === 'frete_gratis' ? 'Frete Grátis' : 'Frete Fixo'}</span>
                        <button onClick={() => setCupomEntrega(null)} className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer">Remover</button>
                      </div>
                      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-emerald-800">
                            {cupomEntrega.tipo_entrega === 'frete_gratis' || cupomEntrega.tipo_entrega === 'frete_gratis_minimo' 
                              ? 'Frete Grátis' 
                              : `Frete Fixo de ${formatCurrency(cupomEntrega.taxa_fixa_entrega || 0)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input type="text" value={cupomEntInput} onChange={e => setCupomEntInput(e.target.value.toUpperCase())} placeholder="CÓDIGO DE ENTREGA" className="flex-1 px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-mono uppercase" />
                        <button onClick={() => aplicarCupom(cupomEntInput, 'entrega')} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-all active:scale-95 shadow-sm cursor-pointer">Aplicar</button>
                      </div>
                      <button 
                        onClick={() => handleOpenSelector('entrega')}
                        className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 uppercase tracking-widest hover:text-emerald-900 transition-colors ml-1 cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5" />
                        Ver Benefícios de Entrega
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sessão de Resgate de Pontos VIP */}
            {!isTravelCheckout && (
              <div className="relative overflow-hidden rounded-2xl border border-purple-800/40 bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-900 p-5 sm:p-6 text-white shadow-lg">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-400/10 blur-xl"></div>
                
                <div className="relative z-10 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-amber-400 p-2.5 text-purple-950 shadow-md shadow-amber-400/20">
                      <Coins className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-white">Resgatar Pontos VIP</h3>
                      <p className="text-[10px] font-bold text-purple-200/90">Cada 100 pontos equivalem a R$ 1,00</p>
                    </div>
                  </div>

                  <label className="relative inline-flex cursor-pointer items-center">
                    <input 
                      type="checkbox" 
                      checked={usarPontos} 
                      disabled={saldoPontos <= 0 || maxPontosValidos <= 0}
                      onChange={e => handleTogglePontos(e.target.checked)}
                      className="peer sr-only" 
                    />
                    <div className="h-6 w-11 rounded-full border-2 border-purple-400/60 bg-purple-950/90 shadow-inner after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-purple-200 after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:border-amber-400 peer-checked:bg-amber-400 peer-checked:after:translate-x-full peer-checked:after:border-purple-900 peer-focus:outline-none"></div>
                  </label>
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-200/80">Seu Saldo:</span>
                    <span className="font-black text-amber-300 flex items-center gap-1.5">
                      👑 {saldoPontos.toLocaleString()} pontos ({formatCurrency(saldoPontos / 100)})
                    </span>
                  </div>

                  {usarPontos && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 border-t border-purple-800/60 pt-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-grow">
                          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-purple-200">Pontos a Usar</label>
                          <input 
                            type="number" 
                            value={pontosAplicados || ''} 
                            min="0"
                            max={maxPontosValidos}
                            onChange={e => handlePontosChange(parseInt(e.target.value) || 0)}
                            className="w-full rounded-xl border border-purple-400/30 bg-white px-3 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400" 
                            placeholder="Ex: 500"
                          />
                        </div>
                        <div className="shrink-0 text-right">
                          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-purple-200">Desconto Aplicado</label>
                          <span className="block pt-1.5 text-base font-black text-amber-300">
                            - {formatCurrency(descontoPontos)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {saldoPontos >= 100 && maxPontosValidos >= 100 && (
                          <button 
                            type="button"
                            onClick={() => handlePontosChange(100)}
                            className="rounded-lg border border-purple-400/40 bg-purple-900/60 px-2.5 py-1 text-[10px] font-black text-amber-200 transition-all hover:bg-purple-800 active:scale-95 cursor-pointer"
                          >
                            100 pts
                          </button>
                        )}
                        {saldoPontos >= 500 && maxPontosValidos >= 500 && (
                          <button 
                            type="button"
                            onClick={() => handlePontosChange(500)}
                            className="rounded-lg border border-purple-400/40 bg-purple-900/60 px-2.5 py-1 text-[10px] font-black text-amber-200 transition-all hover:bg-purple-800 active:scale-95 cursor-pointer"
                          >
                            500 pts
                          </button>
                        )}
                        {saldoPontos >= 1000 && maxPontosValidos >= 1000 && (
                          <button 
                            type="button"
                            onClick={() => handlePontosChange(1000)}
                            className="rounded-lg border border-purple-400/40 bg-purple-900/60 px-2.5 py-1 text-[10px] font-black text-amber-200 transition-all hover:bg-purple-800 active:scale-95 cursor-pointer"
                          >
                            1.000 pts
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handlePontosChange(maxPontosValidos)}
                          className="ml-auto rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-black text-purple-950 transition-all hover:bg-amber-300 active:scale-95 shadow-sm shadow-amber-400/20 cursor-pointer"
                        >
                          Usar Máximo ({maxPontosValidos.toLocaleString()} pts)
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Sessão de Saldo da Carteira Virtual */}
            {!isTravelCheckout && (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-700/50 bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 p-5 sm:p-6 text-white shadow-lg">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-400/10 blur-xl"></div>
                
                <div className="relative z-10 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-emerald-400 p-2.5 text-emerald-950 shadow-md shadow-emerald-400/20">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-white">Usar Saldo da Carteira</h3>
                      <p className="text-[10px] font-bold text-emerald-200/90">Abata o valor com seu saldo disponível</p>
                    </div>
                  </div>

                  <label className="relative inline-flex cursor-pointer items-center">
                    <input 
                      type="checkbox" 
                      checked={usarSaldoCarteira} 
                      disabled={saldoCarteira <= 0 || maxSaldoValido <= 0}
                      onChange={e => handleToggleSaldoCarteira(e.target.checked)}
                      className="peer sr-only" 
                    />
                    <div className="h-6 w-11 rounded-full border-2 border-emerald-300/60 bg-emerald-950/90 shadow-inner after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-emerald-200 after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:border-emerald-400 peer-checked:bg-emerald-400 peer-checked:after:translate-x-full peer-checked:after:border-emerald-500 peer-focus:outline-none"></div>
                  </label>
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-200/80">Seu Saldo:</span>
                    <span className="font-black text-emerald-300">
                      {formatCurrency(saldoCarteira)}
                    </span>
                  </div>

                  {usarSaldoCarteira && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 border-t border-emerald-800/60 pt-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-grow">
                          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-emerald-200">Valor a Usar</label>
                          <input 
                            type="number" 
                            value={saldoCarteiraAplicado ? Number(saldoCarteiraAplicado.toFixed(2)) : ''} 
                            min="0"
                            max={maxSaldoValido}
                            step="0.01"
                            onChange={e => handleSaldoCarteiraChange(parseFloat(e.target.value) || 0)}
                            className="w-full rounded-xl border border-emerald-400/30 bg-white px-3 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" 
                            placeholder="Ex: 50.00"
                          />
                        </div>
                        <div className="shrink-0 text-right">
                          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-emerald-200">Desconto Aplicado</label>
                          <span className="block pt-1.5 text-base font-black text-emerald-300">
                            - {formatCurrency(descontoCarteira)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button 
                          type="button"
                          onClick={() => handleSaldoCarteiraChange(maxSaldoValido)}
                          className="ml-auto rounded-lg bg-emerald-400 px-2.5 py-1 text-[10px] font-black text-emerald-950 transition-all hover:bg-emerald-300 active:scale-95 shadow-sm shadow-emerald-400/20 cursor-pointer"
                        >
                          Usar Máximo ({formatCurrency(maxSaldoValido)})
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Navegação da Etapa 2 */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setEtapaCheckout(1)}
                className="px-6 py-3.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Endereço
              </button>

              <button
                type="button"
                onClick={() => setEtapaCheckout(3)}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
              >
                Avançar para Pagamento
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 3: PAGAMENTO (ESTREITO/ENFILEIRADO) & RESUMO DO PEDIDO (AMPLO) */}
        {/* ========================================================================= */}
        {etapaCheckout === 3 && (
          <div className="flex flex-col lg:flex-row min-h-0 flex-1">
            
            {/* Coluna Esquerda: Opção de Pagamento Compacta e Enfileirada */}
            <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 p-4 sm:p-5 overflow-y-auto max-h-[85vh] custom-scrollbar border-b lg:border-b-0 lg:border-r border-neutral-200 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-neutral-100 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">Forma de Pagamento</h3>
                    <p className="text-[10px] text-neutral-400 font-bold">Selecione uma opção</p>
                  </div>
                </div>
                
                {/* Opções Enfileiradas Verticalmente */}
                <div className="flex flex-col gap-2.5">
                  {checkoutMetodoPixAtivo && (
                    <button
                      type="button"
                      onClick={() => setFormaPagamento('pix')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                        formaPagamento === 'pix'
                          ? 'border-indigo-600 bg-indigo-50/30 text-indigo-950 shadow-sm'
                          : 'border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${formaPagamento === 'pix' ? 'bg-indigo-600' : 'bg-neutral-300'}`}></div>
                        <div>
                          <span className="font-black text-xs block leading-tight">PIX</span>
                          <span className="text-[10px] text-neutral-400 block font-medium">Aprovação imediata</span>
                        </div>
                      </div>
                      {lojaPixDescontoAtivo && (
                        <span className="shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                          -{lojaPixDescontoPorcentagem}% OFF
                        </span>
                      )}
                    </button>
                  )}

                  {checkoutMetodoCartaoAtivo && (
                    <button
                      type="button"
                      onClick={() => setFormaPagamento('cartao')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                        formaPagamento === 'cartao'
                          ? 'border-indigo-600 bg-indigo-50/30 text-indigo-950 shadow-sm'
                          : 'border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${formaPagamento === 'cartao' ? 'bg-indigo-600' : 'bg-neutral-300'}`}></div>
                        <div>
                          <span className="font-black text-xs block leading-tight">Cartão de Crédito</span>
                          <span className="text-[10px] text-neutral-400 block font-medium">Em até {maxParcelas}x</span>
                        </div>
                      </div>
                    </button>
                  )}

                  {checkoutMetodoBoletoAtivo && (
                    <button
                      type="button"
                      onClick={() => setFormaPagamento('boleto')}
                      className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-left cursor-pointer ${
                        formaPagamento === 'boleto'
                          ? 'border-indigo-600 bg-indigo-50/30 text-indigo-950 shadow-sm'
                          : 'border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${formaPagamento === 'boleto' ? 'bg-indigo-600' : 'bg-neutral-300'}`}></div>
                        <div>
                          <span className="font-black text-xs block leading-tight">Boleto Bancário</span>
                          <span className="text-[10px] text-neutral-400 block font-medium">À vista (1 a 3 dias)</span>
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={limiteCreditoTotal <= 0}
                    onClick={() => {
                      const totalInicialComJuros = totalHoje * (1 + calcularTaxaJuros(numParcelas) / 100);
                      if (totalInicialComJuros > limiteCreditoDisponivel) {
                        toast.error(`Saldo de crédito disponível insuficiente (${formatCurrency(limiteCreditoDisponivel)}).`);
                        return;
                      }
                      setFormaPagamento('credito_loja');
                    }}
                    className={`flex flex-col items-start p-3.5 rounded-xl border-2 transition-all text-left relative cursor-pointer ${
                      limiteCreditoTotal <= 0
                        ? 'opacity-50 cursor-not-allowed border-neutral-100 bg-neutral-50/50 text-neutral-400'
                        : formaPagamento === 'credito_loja'
                          ? 'border-emerald-600 bg-emerald-50/20 text-emerald-950 shadow-sm'
                          : 'border-neutral-200/80 bg-white text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 w-full mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${formaPagamento === 'credito_loja' ? 'bg-emerald-600' : 'bg-neutral-300'}`}></div>
                      <span className="font-black text-xs block leading-tight">Crédito GSA Store</span>
                    </div>
                    {limiteCreditoTotal <= 0 ? (
                      <span className="text-[9px] text-neutral-400 font-bold ml-5">Não contratado / sem limite</span>
                    ) : (
                      <div className="ml-5 space-y-0.5">
                        <span className="text-[10px] text-neutral-500 font-medium block">
                          Disponível: <strong className={(totalHoje * (1 + calcularTaxaJuros(numParcelas) / 100)) > limiteCreditoDisponivel ? 'text-red-500 font-black' : 'text-emerald-700 font-black'}>{formatCurrency(limiteCreditoDisponivel)}</strong>
                        </span>
                        {(totalHoje * (1 + calcularTaxaJuros(numParcelas) / 100)) > limiteCreditoDisponivel && (
                          <span className="text-[8px] text-red-600 font-black uppercase tracking-wider block bg-red-100 px-1 py-0.2 rounded">Saldo Insuficiente</span>
                        )}
                      </div>
                    )}
                  </button>
                </div>

                {formaPagamento === 'credito_loja' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-neutral-100/80 border border-neutral-200 rounded-xl space-y-2"
                  >
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Parcelas</label>
                    {opcaoPagamentoParcelado ? (
                      <select
                        value={numParcelas}
                        onChange={e => setNumParcelas(parseInt(e.target.value))}
                        className="w-full px-2.5 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={1}>À vista (30 dias) - {formatCurrency(totalHoje * (1 + calcularTaxaJuros(1) / 100))}</option>
                        {Array.from({ length: Math.max(0, maxParcelas - 1) }, (_, i) => i + 2).map(n => {
                          const taxaN = calcularTaxaJuros(n);
                          const totalComJuros = totalHoje * (1 + taxaN / 100);
                          const valorParcela = totalComJuros / n;
                          return (
                            <option key={n} value={n}>{n}x de {formatCurrency(valorParcela)} (+{taxaN}%)</option>
                          );
                        })}
                      </select>
                    ) : (
                      <span className="text-[10px] text-neutral-600 block">Pagamento Único (30 dias)</span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Botão de Retorno para Etapa 2 */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setEtapaCheckout(2)}
                  className="w-full px-3 py-2.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para Benefícios
                </button>
              </div>
            </div>

            {/* Coluna Direita: Resumo Amplo do Pedido (Ocupando praticamente todo o modal) */}
            <div className="flex-1 p-4 sm:p-6 lg:p-7 overflow-y-auto max-h-[85vh] custom-scrollbar bg-neutral-100/80 flex flex-col">
              <div className="w-full bg-[#1a1a1a] rounded-[2rem] p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden flex-1 flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
                
                <div>
                  <div className="flex items-center justify-between mb-5 relative z-10 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
                        <ShoppingCart className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black uppercase tracking-wider text-white">Resumo do Pedido</h3>
                        <p className="text-xs text-neutral-400 font-medium">Confira todos os itens e valores antes de confirmar</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-neutral-200 bg-white/10 px-3 py-1.5 rounded-xl">
                      {cartItems.reduce((acc: number, c: CartItem) => acc + c.quantidade, 0)} {cartItems.reduce((acc: number, c: CartItem) => acc + c.quantidade, 0) === 1 ? 'item selecionado' : 'itens selecionados'}
                    </span>
                  </div>
                  
                  {/* Lista Ampla dos Itens com Scroll Generoso */}
                  <div className="space-y-3 mb-6 relative z-10 max-h-[46vh] overflow-y-auto pr-2 custom-scrollbar">
                    {cartItems.map((c: CartItem) => {
                      const itemSubtotalEfetivo = c.tipo === 'produto'
                        ? getProductQuantityPriceBreakdown(c.item_detalhes, c.quantidade).subtotalFinal
                        : (c.item_detalhes?.valor || 0) * c.quantidade;

                      const itemSubtotalOriginal = (c.item_detalhes?.valor || 0) * c.quantidade;

                      const itemPixEligivel = formaPagamento === 'pix' && lojaPixDescontoAtivo
                        && c.tipo === 'produto'
                        && checkPixDiscountApplies(c.item_detalhes, pixSettings);
                      const itemPrecoComPix = itemPixEligivel
                        ? parseFloat((itemSubtotalEfetivo * (1 - lojaPixDescontoPorcentagem / 100)).toFixed(2))
                        : itemSubtotalEfetivo;

                      return (
                        <div key={c.id} className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                          <div className="pr-4 min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-neutral-300 px-2 py-0.5 rounded">
                                {c.quantidade}x {c.tipo}
                              </span>
                              <span className="font-mono text-indigo-300 text-[11px] font-bold">
                                {c.tipo === 'produto' ? getProductDisplayCode(c.item_detalhes as any) : ((c.item_detalhes as any)?.codigo_produto || (c.item_detalhes as any)?.codigo_servico || (c.item_detalhes as any)?.codigo_assinatura || '')}
                              </span>
                            </div>
                            <span className="font-bold text-sm leading-tight text-white block">
                              {c.item_detalhes?.nome}
                            </span>
                          </div>

                          <div className="text-right flex-shrink-0">
                            {itemPixEligivel ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs text-neutral-400 line-through leading-none">
                                  {formatCurrency(itemSubtotalEfetivo)}
                                </span>
                                <span className="font-black text-emerald-400 text-sm leading-none">
                                  {formatCurrency(itemPrecoComPix)}
                                </span>
                                <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md leading-none mt-1">
                                  -{lojaPixDescontoPorcentagem}% PIX
                                </span>
                              </div>
                            ) : c.tipo === 'produto' && hasActiveProductDiscount(c.item_detalhes) ? (
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-neutral-400 line-through">
                                  {formatCurrency(itemSubtotalOriginal)}
                                </span>
                                <span className="font-bold text-emerald-400 text-sm">
                                  {formatCurrency(itemSubtotalEfetivo)}
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-white text-sm block">
                                {formatCurrency(itemSubtotalEfetivo)}
                              </span>
                            )}
                            <span className="text-[10px] font-extrabold text-amber-400 flex items-center justify-end gap-1 mt-1">
                              <Diamond className="w-2.5 h-2.5 fill-current shrink-0" />
                              +{Math.floor(c.tipo === 'produto' && hasActiveProductDiscount(c.item_detalhes) ? getProductQuantityPriceBreakdown(c.item_detalhes, c.quantidade).subtotalFinal : (c.item_detalhes?.valor || 0) * c.quantidade)} pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Brindes no Resumo */}
                    {promosAplicadas.filter((p: any) => p.status === 'ativa' && p.item_brinde).map((promo: any, index: number) => (
                      <div key={`resumo-brinde-${promo.promocao_id}-${index}`} className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <div className="pr-2">
                          <span className="text-indigo-300 block text-[10px] font-bold">
                            {promo.item_brinde?.quantidade}x · BRINDE EXCLUSIVO
                          </span>
                          <span className="font-bold text-sm text-indigo-100 block">{promo.item_brinde?.produto_nome}</span>
                        </div>
                        <span className="font-black text-emerald-400 uppercase text-xs">Grátis</span>
                      </div>
                    ))}
                    
                    {/* Descontos no Resumo */}
                    {promosAplicadas.filter((p: any) => p.status === 'ativa' && p.desconto_aplicado).map((promo: any, index: number) => (
                      <div key={`resumo-desc-${promo.promocao_id}-${index}`} className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="pr-2">
                          <span className="text-emerald-300 block text-[10px] font-bold uppercase tracking-wider">
                            DESCONTO PROMOCIONAL
                          </span>
                          <span className="font-bold text-sm text-emerald-100 block">{promo.desconto_aplicado?.produto_nome}</span>
                        </div>
                        <span className="font-black text-emerald-400 uppercase text-xs">- {formatCurrency(promo.desconto_aplicado?.valor_desconto || 0)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Subtotais e Descontos */}
                  <div className="border-t border-white/10 pt-4 space-y-2.5 relative z-10 text-xs sm:text-sm">
                    <div className="flex justify-between text-neutral-300">
                      <span>{cartItems.every((c: CartItem) => c.tipo === 'produto') ? 'Subtotal' : 'Subtotal (1ª Parc.)'}</span>
                      <span className="font-bold">{formatCurrency(subtotalInicial)}</span>
                    </div>
                    
                    {descontoPromocoes > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Descontos Promocionais</span>
                        <span>-{formatCurrency(descontoPromocoes)}</span>
                      </div>
                    )}
                    
                    {pixDiscountValue > 0 && (
                      <div className="flex justify-between items-center font-black rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-300 text-base">🏷️</span>
                          <div>
                            <span className="text-emerald-300 text-xs sm:text-sm block font-black uppercase tracking-wider">Desconto PIX</span>
                            <span className="text-emerald-400/70 text-[10px]">Economia de {lojaPixDescontoPorcentagem}% no pagamento à vista via PIX</span>
                          </div>
                        </div>
                        <span className="text-emerald-300 font-black text-sm sm:text-base">-{formatCurrency(pixDiscountValue)}</span>
                      </div>
                    )}
                    
                    {cupomDesconto && (
                      <div className="flex justify-between text-blue-400 font-bold">
                        <span>Desconto Cupom ({cupomDesconto.codigo_cupom})</span>
                        <span>-{formatCurrency(descontoCalculado)}</span>
                      </div>
                    )}
                    
                    {usarPontos && descontoPontos > 0 && (
                      <div className="flex justify-between text-[#d6bbfb] font-bold">
                        <span>Desconto VIP (Pontos)</span>
                        <span>-{formatCurrency(descontoPontos)}</span>
                      </div>
                    )}
                    
                    {usarSaldoCarteira && descontoCarteira > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Uso de Saldo da Carteira</span>
                        <span>-{formatCurrency(descontoCarteira)}</span>
                      </div>
                    )}
                    
                    {temProdutos && (
                      <div className="flex justify-between text-xs font-bold text-red-400">
                        <span>Frete Total</span>
                        <span>
                          {cupomEntrega 
                            ? (cupomEntrega.tipo_entrega === 'frete_gratis' || cupomEntrega.tipo_entrega === 'frete_gratis_minimo' ? 'Grátis (Cupom)' : formatCurrency(cupomEntrega.taxa_fixa_entrega || 0)) 
                            : (temProdutos ? formatCurrency(taxaEntregaFixa) : 'A calcular')}
                        </span>
                      </div>
                    )}
                    
                    {formaPagamento === 'credito_loja' && (
                      <div className="flex justify-between text-amber-400 font-bold">
                        <span>Juros Crédito (+{taxaJurosAplicada}%)</span>
                        <span>+{formatCurrency(valorJurosCredito)}</span>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t border-neutral-800">
                      <div className="flex justify-between items-end mb-1">
                        <div>
                          <span className="text-xs font-bold text-neutral-400 block">Total Hoje</span>
                          <span className="text-[10px] text-neutral-500 font-medium">À vista ou 1ª parcela</span>
                        </div>
                        <span className="text-2xl sm:text-4xl font-black text-white">{formatCurrency(totalHojeFinal)}</span>
                      </div>
                      
                      <div className="flex justify-end mb-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#d8bd73] bg-[#d8bd73]/10 px-2.5 py-1 rounded-lg">
                          <Gift className="w-3 h-3" /> Ganhe + {Math.floor(totalHojeFinal)} pontos fidelidade GSA
                        </span>
                      </div>

                      {((subtotalContrato - subtotalInicial) > 0) && (
                        <div className="flex justify-between items-end mt-1 text-neutral-400">
                          <span className="text-xs">Total do Contrato</span>
                          <span className="text-base font-black">{formatCurrency(totalContratoFinal)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botão de Finalização dentro do Card de Resumo Amplo */}
                <div className="mt-5 pt-2">
                  <button 
                    onClick={handleFinalizar}
                    disabled={
                      isSubmitting
                      || (temProdutos && !enderecoCompletoValido)
                      || (formaPagamento === 'credito_loja' && totalHojeFinal > limiteCreditoDisponivel)
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white py-4 rounded-xl font-black text-base transition-all shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 relative z-10 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    Confirmar Pedido
                  </button>
                  {temProdutos && !enderecoCompletoValido && (
                    <p className="mt-2 text-center text-xs font-semibold text-amber-400 leading-tight">
                      Preencha o endereço completo para continuar.
                    </p>
                  )}
                  {formaPagamento === 'credito_loja' && totalHojeFinal > limiteCreditoDisponivel && (
                    <p className="mt-2 text-center text-xs font-semibold text-red-400 leading-tight">
                      Crédito GSA insuficiente ({formatCurrency(limiteCreditoDisponivel)} disponível).
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AvailableCouponsModal 
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        coupons={availableCoupons}
        onSelect={(code) => {
          if (selectorCategory === 'desconto') {
            setCupomDescInput(code);
            aplicarCupom(code, 'desconto');
          } else {
            setCupomEntInput(code);
            aplicarCupom(code, 'entrega');
          }
        }}
        category={selectorCategory}
      />
    </Modal>
  );
}
