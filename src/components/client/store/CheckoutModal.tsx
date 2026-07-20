import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
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

type CartItem = {
  id: string;
  item_id: string;
  tipo: 'produto' | 'servico' | 'assinatura' | 'pacote_viagem';
  quantidade: number;
  item_detalhes?: Produto | any;
  prazo_meses?: number;
  isBrinde?: boolean;
};

const PENDING_STORE_COUPONS_KEY = 'gsa_pending_store_coupons';

export default function CheckoutModal({ isOpen, onClose, cartItems, promosAplicadas = [], clientId, onSuccess }: { isOpen: boolean, onClose: () => void, cartItems: any[], promosAplicadas?: any[], clientId: string, onSuccess: (orderId?: string) => void }) {
  const checkoutRequestId = useRef<string>(generateUUID());
  const [step, setStep] = useState(1);
  const [endereco, setEndereco] = useState({ cep: '', logradouro: '', bairro: '', cidade: '', uf: '', numero: '', complemento: '' });
  const [isEditingEndereco, setIsEditingEndereco] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cupomDescInput, setCupomDescInput] = useState('');
  const [cupomEntInput, setCupomEntInput] = useState('');
  const [cupomDesconto, setCupomDesconto] = useState<CupomLoja | null>(null);
  const [cupomEntrega, setCupomEntrega] = useState<CupomLoja | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [formaPagamento, setFormaPagamento] = useState<'outros' | 'credito_loja'>('outros');
  const [numParcelas, setNumParcelas] = useState(1);
  const [travelInstallments, setTravelInstallments] = useState(1);
  const [solicitacaoAtivaId, setSolicitacaoAtivaId] = useState<string | null>(null);
  const [jurosCreditoAvista, setJurosCreditoAvista] = useState(20);
  const [jurosCreditoParcelado, setJurosCreditoParcelado] = useState(50);

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

      // Buscar taxas de juros de Crédito GSA do system_settings
      const { data: setts } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['loja_credito_juros_avista', 'loja_credito_juros_parcelado']);
        
      if (setts) {
        const av = setts.find(s => s.key === 'loja_credito_juros_avista');
        const pa = setts.find(s => s.key === 'loja_credito_juros_parcelado');
        if (av) setJurosCreditoAvista(Number(av.value) ?? 20);
        if (pa) setJurosCreditoParcelado(Number(pa.value) ?? 50);
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

      const usedSet = new Set<string>();
      (orcamentos || []).forEach(orc => {
        if (orc.cupom_desconto_id) usedSet.add(orc.cupom_desconto_id);
        if (orc.cupom_entrega_id) usedSet.add(orc.cupom_entrega_id);
      });

      const now = new Date();
      const filtered = (data || []).filter(c => {
        if (usedSet.has(c.id)) return false; // Impede uso de cupons já usados pelo cliente

        if (c.data_validade) {
          const [year, month, day] = c.data_validade.split('-').map(Number);
          const expiryDate = new Date(year, month - 1, day, 23, 59, 59);
          if (expiryDate < now) return false;
        }
        const hasUses = c.total_usos < c.limite_usos;
        return hasUses;
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
      checkoutRequestId.current = generateUUID();
      fetchTaxaEntrega();
      fetchSaldoPontos();
      fetchDadosCredito();
      setUsarPontos(false);
      setPontosAplicados(0);
      setFormaPagamento('outros');
      setNumParcelas(1);
      const travelItem = cartItems.find((item: any) => item.tipo === 'pacote_viagem');
      setTravelInstallments(Math.max(1, Number(travelItem?.item_detalhes?.parcelamento_permitido || 1)));
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

  const travelItem = cartItems.find((item: any) => item.tipo === 'pacote_viagem');
  const isTravelCheckout = Boolean(travelItem);
  const travelMaxInstallments = Math.max(1, Number(travelItem?.item_detalhes?.parcelamento_permitido || 1));
  const normalizedTravelInstallments = Math.min(Math.max(travelInstallments, 1), travelMaxInstallments);
  const travelContractTotal = Number(travelItem?.item_detalhes?.valor_total_contrato ?? travelItem?.item_detalhes?.valor ?? 0) * Number(travelItem?.quantidade || 1);
  const travelInstallmentValue = travelContractTotal / normalizedTravelInstallments;

  const temProdutos = cartItems.some((c: CartItem) => c.tipo === 'produto');
  const subtotalInicial = cartItems.reduce((acc: number, cur: CartItem) => {
    if (cur.tipo === 'produto') {
      return acc + getProductQuantityPriceBreakdown(cur.item_detalhes, cur.quantidade).subtotalFinal;
    }
    if (cur.tipo === 'pacote_viagem') {
      return acc + (((cur.item_detalhes?.valor_total_contrato ?? cur.item_detalhes?.valor) || 0) * cur.quantidade / normalizedTravelInstallments);
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

  const descontoPontos = usarPontos ? (Math.min(pontosAplicados, maxPontosValidos) * 0.01) : 0;
  const subtotalAposPontos = Math.max(0, subtotalComPromos - descontoPontos);

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

  const descontoCalculado = calcularDesconto();
  
  // Taxa de entrega final (0 se cupom de frete grátis, caso contrário a taxa fixa se houver produtos)
  const taxaEntregaFinal = (temProdutos && !cupomEntrega) ? taxaEntregaFixa : (cupomEntrega?.tipo_entrega === 'taxa_fixa' ? (cupomEntrega.taxa_fixa_entrega || 0) : 0);

  const totalAntesCarteira = Math.max(subtotalComPromos - descontoPontos - descontoCalculado + taxaEntregaFinal, 0);

  // 1.5 Lógica de Saldo na Carteira Virtual
  const maxSaldoValido = Math.min(saldoCarteira, totalAntesCarteira);
  
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
    const cleanVal = Math.min(val, maxSaldoValido);
    setSaldoCarteiraAplicado(cleanVal);
  };

  const descontoCarteira = usarSaldoCarteira ? Math.min(saldoCarteiraAplicado, maxSaldoValido) : 0;
  
  const totalHoje = Math.max(totalAntesCarteira - descontoCarteira, 0);
  
  const taxaJurosAplicada = formaPagamento === 'credito_loja' 
    ? (numParcelas === 1 ? jurosCreditoAvista : jurosCreditoAvista + (jurosCreditoParcelado * numParcelas))
    : 0;
  const valorJurosCredito = formaPagamento === 'credito_loja'
    ? parseFloat((totalHoje * (taxaJurosAplicada / 100)).toFixed(2))
    : 0;
  const totalHojeFinal = totalHoje + valorJurosCredito;
  const totalContratoFinal = totalHojeFinal + (subtotalContrato - subtotalInicial);

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
      if (cupom.total_usos >= cupom.limite_usos) return toast.error('Limite de uso do cupom esgotado.');
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

      // Verifica se já foi usado
      const { data: orcUsados } = await supabase
        .from('orcamentos')
        .select('id')
        .eq('cliente_id', clientId)
        .neq('status', 'cancelado')
        .or(`cupom_desconto_id.eq.${cupom.id},cupom_entrega_id.eq.${cupom.id}`)
        .limit(1);

      if (orcUsados && orcUsados.length > 0) {
        return toast.error('Você já utilizou este cupom em outro pedido.');
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
        setCupomDesconto(cupom);
        setCupomDescInput('');
        toast.success('Desconto aplicado com sucesso!');
      }
    } catch {
      toast.error('Erro ao processar cupom.');
    }
  };

  const handleFinalizar = async () => {
    // Verificar se houve alteração de preço no banco antes de fechar
    try {
      const productIds = cartItems.filter((c: any) => c.tipo === 'produto').map((c: any) => c.item_id);
      if (productIds.length > 0) {
        const { data: dbProducts } = await supabase
          .from('produtos')
          .select('id, valor, valor_promocional, desconto_ativo, desconto_fim_em, desconto_prazo_tipo, desconto_limite_quantidade_ativo, desconto_quantidade_limite, desconto_quantidade_utilizada')
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
    }

    const hasOutOfStock = cartItems.some((c: any) => c.tipo === 'produto' && c.item_detalhes?.controle_estoque && (c.item_detalhes?.estoque_disponivel <= 0));
    if (hasOutOfStock) {
      toast.error('Remova os produtos esgotados do carrinho antes de finalizar.');
      return;
    }

    if (temProdutos && (!endereco.cep || !endereco.numero)) {
      toast.error('Endereço completo é obrigatório para entrega de produtos.');
      return;
    }

    if (formaPagamento === 'credito_loja') {
      if (totalHojeFinal > limiteCreditoDisponivel) {
        toast.error('Saldo de crédito disponível insuficiente para esta compra (incluindo taxas de juros).');
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      if (isTravelCheckout) {
        // Fluxo de checkout de viagem
        const pacote = cartItems.find((c: any) => c.tipo === 'pacote_viagem');
        const data = await callClientRpc<any>('gsa_client_checkout_travel', {
          p_payload: {
            proposta_id: pacote.item_id,
            forma_pagamento: formaPagamento,
            parcelas: normalizedTravelInstallments,
          }
        });
        
        toast.success(`Cobrança gerada em ${normalizedTravelInstallments} parcela(s).`);
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
            pontos_usados: usarPontos ? pontosAplicados : 0,
            saldo_carteira_usado: usarSaldoCarteira ? saldoCarteiraAplicado : 0,
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
      toast.error(e.message || 'Falha ao processar compra. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finalizar Compra" size="wide">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          
          {/* Sessão de Endereço */}
          {temProdutos && (
            <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest">📍 Endereço de Entrega</h3>
                {endereco.cep && !isEditingEndereco && (
                  <button 
                    type="button"
                    onClick={() => setIsEditingEndereco(true)}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1 transition-all bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl hover:bg-indigo-100 cursor-pointer"
                  >
                    ✏️ Alterar Endereço
                  </button>
                )}
              </div>

              {!isEditingEndereco && endereco.cep ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-8 -mt-8 pointer-events-none" />
                  <div className="space-y-2 relative z-10">
                    <p className="text-sm text-neutral-800 font-bold leading-normal">
                      {endereco.logradouro}, {endereco.numero}
                      {endereco.complemento && ` - ${endereco.complemento}`}
                    </p>
                    <p className="text-xs text-neutral-500 font-medium">
                      Bairro: <span className="text-neutral-700 font-semibold">{endereco.bairro}</span>
                    </p>
                    <p className="text-xs text-neutral-500 font-medium">
                      Cidade: <span className="text-neutral-700 font-semibold">{endereco.cidade} - {endereco.uf}</span>
                    </p>
                    <p className="text-xs text-neutral-500 font-medium">
                      CEP: <span className="text-neutral-700 font-semibold font-mono">{endereco.cep}</span>
                    </p>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">CEP *</label>
                      <input 
                        type="text" 
                        value={endereco.cep} 
                        onChange={e => { 
                          setEndereco({...endereco, cep: e.target.value}); 
                          if(e.target.value.length >= 8) buscarCep(e.target.value); 
                        }} 
                        className="w-full mt-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm" 
                        placeholder="XXXXX-XXX" 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-neutral-500 uppercase">Logradouro</label>
                      <input type="text" readOnly value={endereco.logradouro} className="w-full mt-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-600" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">Número *</label>
                      <input type="text" value={endereco.numero} onChange={e => setEndereco({...endereco, numero: e.target.value})} className="w-full mt-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">Complemento</label>
                      <input type="text" value={endereco.complemento} onChange={e => setEndereco({...endereco, complemento: e.target.value})} className="w-full mt-1 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">Bairro</label>
                      <input type="text" readOnly value={endereco.bairro} className="w-full mt-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-600" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-neutral-500 uppercase">Cidade / UF</label>
                      <input type="text" readOnly value={`${endereco.cidade} - ${endereco.uf}`} className="w-full mt-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-600" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isTravelCheckout && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">Parcelamento da viagem</h3>
                  <p className="mt-1 text-xs font-medium text-neutral-500">Total do contrato: {formatCurrency(travelContractTotal)}</p>
                </div>
                <select
                  value={normalizedTravelInstallments}
                  onChange={(event) => setTravelInstallments(Number(event.target.value))}
                  className="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-sm font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: travelMaxInstallments }, (_, index) => index + 1).map((installments) => (
                    <option key={installments} value={installments}>
                      {installments}x de {formatCurrency(travelContractTotal / installments)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-3">
                <span className="text-xs font-bold text-neutral-500">Primeira parcela</span>
                <span className="text-lg font-black text-indigo-700">{formatCurrency(travelInstallmentValue)}</span>
              </div>
            </div>
          )}

          {/* Sessão Cupons */}
          <div className={isTravelCheckout ? 'hidden' : 'space-y-4'}>
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest">Cupons da Loja</h3>
            
            {/* Cupom Desconto */}
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <label className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1 mb-2"><Tag className="w-3 h-3" /> Cupom de Desconto</label>
              {cupomDesconto ? (
                <div className="flex flex-col gap-2 bg-white border border-blue-200 p-3 rounded-xl">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-sm font-bold text-blue-700">{cupomDesconto.codigo_cupom}</span>
                    <button onClick={() => setCupomDesconto(null)} className="text-xs font-bold text-red-500 hover:text-red-700">Remover</button>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-blue-800">
                        {cupomDesconto.tipo_desconto === 'porcentagem' ? `${cupomDesconto.valor_desconto}% de desconto` : `Desconto de ${formatCurrency(cupomDesconto.valor_desconto || 0)}`}
                      </p>
                      <p className="text-[10px] font-medium text-blue-600">
                        Total descontado: {formatCurrency(descontoCalculado)}
                      </p>
                    </div>
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
                    <button onClick={() => aplicarCupom(cupomDescInput, 'desconto')} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-sm">Aplicar</button>
                  </div>
                  <button 
                    onClick={() => handleOpenSelector('desconto')}
                    className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800 transition-colors ml-1"
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
                      <button onClick={() => setCupomEntrega(null)} className="text-xs font-bold text-red-500 hover:text-red-700">Remover</button>
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
                      <button onClick={() => aplicarCupom(cupomEntInput, 'entrega')} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-all active:scale-95 shadow-sm">Aplicar</button>
                    </div>
                    <button 
                      onClick={() => handleOpenSelector('entrega')}
                      className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-800 transition-colors ml-1"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      Ver Benefícios de Entrega
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sessão de Pontos Fidelidade GSA VIP */}
          <div className={`${isTravelCheckout ? 'hidden' : ''} bg-gradient-to-r from-purple-50 via-indigo-50/30 to-purple-50 rounded-2xl p-5 border border-purple-100/80 shadow-sm relative overflow-hidden`}>
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-200/20 rounded-full blur-xl"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/10">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-neutral-900 uppercase tracking-widest">Resgatar Pontos VIP</h3>
                  <p className="text-[10px] text-neutral-500 font-bold">Cada 100 pontos equivalem a R$ 1,00</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={usarPontos} 
                  disabled={saldoPontos <= 0 || maxPontosValidos <= 0}
                  onChange={e => handleTogglePontos(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-bold">Seu Saldo:</span>
                <span className="font-black text-neutral-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-current" />
                  {saldoPontos.toLocaleString()} pontos ({formatCurrency(saldoPontos * 0.01)})
                </span>
              </div>

              {usarPontos && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 border-t border-purple-100/50 space-y-3"
                >
                  <div className="flex gap-3 items-center">
                    <div className="flex-grow">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Pontos a Usar</label>
                      <input 
                        type="number" 
                        value={pontosAplicados || ''} 
                        min="0"
                        max={maxPontosValidos}
                        onChange={e => handlePontosChange(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                        placeholder="Ex: 500"
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Desconto Aplicado</label>
                      <span className="text-base font-black text-purple-600 block pt-1.5">
                        - {formatCurrency(descontoPontos)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {saldoPontos >= 100 && maxPontosValidos >= 100 && (
                      <button 
                        type="button"
                        onClick={() => handlePontosChange(100)}
                        className="px-2.5 py-1 bg-white hover:bg-purple-50 border border-purple-200 text-[10px] font-black text-purple-700 rounded-lg transition-all active:scale-95"
                      >
                        100 pts
                      </button>
                    )}
                    {saldoPontos >= 500 && maxPontosValidos >= 500 && (
                      <button 
                        type="button"
                        onClick={() => handlePontosChange(500)}
                        className="px-2.5 py-1 bg-white hover:bg-purple-50 border border-purple-200 text-[10px] font-black text-purple-700 rounded-lg transition-all active:scale-95"
                      >
                        500 pts
                      </button>
                    )}
                    {saldoPontos >= 1000 && maxPontosValidos >= 1000 && (
                      <button 
                        type="button"
                        onClick={() => handlePontosChange(1000)}
                        className="px-2.5 py-1 bg-white hover:bg-purple-50 border border-purple-200 text-[10px] font-black text-purple-700 rounded-lg transition-all active:scale-95"
                      >
                        1.000 pts
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => handlePontosChange(maxPontosValidos)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 shadow-sm shadow-purple-500/10 ml-auto"
                    >
                      Usar Máximo ({maxPontosValidos.toLocaleString()} pts)
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Sessão de Saldo da Carteira Virtual */}
          <div className={`${isTravelCheckout ? 'hidden' : ''} bg-gradient-to-r from-emerald-50 via-emerald-50/30 to-emerald-50 rounded-2xl p-5 border border-emerald-100/80 shadow-sm relative overflow-hidden mt-4`}>
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-200/20 rounded-full blur-xl"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/10">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-neutral-900 uppercase tracking-widest">Usar Saldo da Carteira</h3>
                  <p className="text-[10px] text-neutral-500 font-bold">Abata o valor com seu saldo disponível</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={usarSaldoCarteira} 
                  disabled={saldoCarteira <= 0 || maxSaldoValido <= 0}
                  onChange={e => handleToggleSaldoCarteira(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-bold">Seu Saldo:</span>
                <span className="font-black text-neutral-800 flex items-center gap-1">
                  {formatCurrency(saldoCarteira)}
                </span>
              </div>

              {usarSaldoCarteira && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-2 border-t border-emerald-100/50 space-y-3"
                >
                  <div className="flex gap-3 items-center">
                    <div className="flex-grow">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Valor a Usar</label>
                      <input 
                        type="number" 
                        value={saldoCarteiraAplicado || ''} 
                        min="0"
                        max={maxSaldoValido}
                        step="0.01"
                        onChange={e => handleSaldoCarteiraChange(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                        placeholder="Ex: 50.00"
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-1">Desconto Aplicado</label>
                      <span className="text-base font-black text-emerald-600 block pt-1.5">
                        - {formatCurrency(descontoCarteira)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button 
                      type="button"
                      onClick={() => handleSaldoCarteiraChange(maxSaldoValido)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all active:scale-95 shadow-sm shadow-emerald-500/10 ml-auto"
                    >
                      Usar Máximo ({formatCurrency(maxSaldoValido)})
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Opção de Pagamento (Novo Módulo Meu Crédito) */}
          <div className={`${isTravelCheckout ? 'hidden' : ''} bg-[#fcfcfc] rounded-[2rem] p-6 border-2 border-neutral-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest">Opção de Pagamento</h3>
                <p className="text-[10px] text-neutral-400 font-bold">Escolha como deseja pagar o seu pedido</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => { setFormaPagamento('outros'); }}
                className={`flex flex-col items-start p-5 rounded-2xl border-2 transition-all font-bold text-sm text-left ${
                  formaPagamento === 'outros'
                    ? 'border-indigo-600 bg-indigo-50/20 text-indigo-900 shadow-md shadow-indigo-100/50'
                    : 'border-neutral-100 bg-white text-neutral-600 hover:border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${formaPagamento === 'outros' ? 'bg-indigo-600' : 'bg-neutral-300'}`}></div>
                  <span className="font-black text-xs uppercase tracking-wider">Formas Padrão</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-medium leading-normal">Pague via Pix, Boleto ou Cartão. Faturas para pagamento geradas no painel.</span>
              </button>

              <button
                type="button"
                disabled={limiteCreditoTotal <= 0}
                onClick={() => {
                  const totalInicialComJuros = totalHoje * (1 + jurosCreditoAvista / 100);
                  if (totalInicialComJuros > limiteCreditoDisponivel) {
                    toast.error(`Saldo de crédito disponível insuficiente para esta compra (incluindo juros de ${jurosCreditoAvista}%).`);
                    return;
                  }
                  setFormaPagamento('credito_loja');
                }}
                className={`flex flex-col items-start p-5 rounded-2xl border-2 transition-all font-bold text-sm text-left relative ${
                  limiteCreditoTotal <= 0
                    ? 'opacity-50 cursor-not-allowed border-neutral-100 bg-neutral-50/50 text-neutral-400'
                    : formaPagamento === 'credito_loja'
                      ? 'border-emerald-600 bg-emerald-50/10 text-emerald-950 shadow-md shadow-emerald-100/50'
                      : 'border-neutral-100 bg-white text-neutral-600 hover:border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${formaPagamento === 'credito_loja' ? 'bg-emerald-600' : 'bg-neutral-300'}`}></div>
                  <span className="font-black text-xs uppercase tracking-wider">Crédito GSA Store</span>
                </div>
                {limiteCreditoTotal <= 0 ? (
                  <span className="text-[10px] text-neutral-400 font-bold leading-normal">Crédito GSA Store não contratado ou sem limite. Solicite no painel.</span>
                ) : (
                  <div className="space-y-1">
                    <span className="text-[10px] text-neutral-400 font-bold leading-normal block">Disponível: <strong className={(formaPagamento === 'credito_loja' ? totalHojeFinal : (totalHoje * (1 + jurosCreditoAvista / 100))) > limiteCreditoDisponivel ? 'text-red-500 font-black' : 'text-emerald-600 font-black'}>{formatCurrency(limiteCreditoDisponivel)}</strong> / {formatCurrency(limiteCreditoTotal)}</span>
                    {(formaPagamento === 'credito_loja' ? totalHojeFinal : (totalHoje * (1 + jurosCreditoAvista / 100))) > limiteCreditoDisponivel && (
                      <span className="text-[9px] text-red-500 font-black uppercase tracking-wider block bg-red-50 px-1.5 py-0.5 rounded w-fit">Saldo Insuficiente</span>
                    )}
                  </div>
                )}
              </button>
            </div>

            {formaPagamento === 'credito_loja' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-5 bg-white border border-neutral-150 rounded-2xl space-y-4"
              >
                <div>
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Opção de Parcelamento</label>
                  {opcaoPagamentoParcelado ? (
                    <div className="space-y-3">
                      <select
                        value={numParcelas}
                        onChange={e => setNumParcelas(parseInt(e.target.value))}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        <option value={1}>À vista (30 dias) - {formatCurrency(totalHoje * (1 + jurosCreditoAvista / 100))} (+{jurosCreditoAvista}% juros)</option>
                        {Array.from({ length: Math.max(0, maxParcelas - 1) }, (_, i) => i + 2).map(n => {
                          const totalComJuros = totalHoje * (1 + jurosCreditoParcelado / 100);
                          const valorParcela = totalComJuros / n;
                          return (
                            <option key={n} value={n}>{n}x de {formatCurrency(valorParcela)} (+{jurosCreditoParcelado}% juros)</option>
                          );
                        })}
                      </select>
                      <div className="p-3.5 bg-indigo-50/30 rounded-xl border border-indigo-100 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-indigo-700 font-bold leading-normal">
                          As faturas de amortização de crédito serão lançadas no seu painel financeiro para pagamento a cada 30 dias com a taxa de juros aplicada.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-xl flex items-center justify-between text-xs font-bold text-neutral-600">
                      <div className="flex flex-col">
                        <span>Pagamento Único (30 dias)</span>
                        <span className="text-[10px] text-neutral-400 font-bold">Sem opção de parcelamento para sua conta (Juros de {jurosCreditoAvista}% aplicado)</span>
                      </div>
                      <span className="text-indigo-600 text-sm font-black">{formatCurrency(totalHoje * (1 + jurosCreditoAvista / 100))}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Resumo */}
        <div className="w-full lg:w-[320px] bg-[#1a1a1a] rounded-3xl p-6 text-white h-fit shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <h3 className="text-lg font-black uppercase tracking-wider mb-6 relative z-10">Resumo</h3>
          
          <div className="space-y-4 mb-6 relative z-10 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {cartItems.map((c: CartItem) => (
              <div key={c.id} className="flex justify-between items-start text-sm">
                <div className="pr-4">
                  <span className="text-neutral-400 block text-[10px] mb-0.5">
                    {c.tipo === 'pacote_viagem' ? `1ª de ${normalizedTravelInstallments} parcela(s)` : `${c.quantidade}x ${c.tipo}`} · <span className="font-mono text-indigo-300">{c.tipo === 'produto' ? getProductDisplayCode(c.item_detalhes as any) : ((c.item_detalhes as any)?.codigo_produto || (c.item_detalhes as any)?.codigo_servico || (c.item_detalhes as any)?.codigo_assinatura || '')}</span>
                  </span>
                  <span className="font-bold truncate max-w-[150px] block leading-tight">{c.item_detalhes?.nome}</span>
                </div>
                <div className="text-right">
                  {c.tipo === 'produto' && hasActiveProductDiscount(c.item_detalhes) && (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-neutral-400 line-through">
                        {formatCurrency((c.item_detalhes.valor || 0) * c.quantidade)}
                      </span>
                      <span className="font-bold text-indigo-200">
                        {formatCurrency(getProductQuantityPriceBreakdown(c.item_detalhes, c.quantidade).subtotalFinal)}
                      </span>
                    </div>
                  )}
                  {(!hasActiveProductDiscount(c.item_detalhes) || c.tipo !== 'produto') && (
                    <span className="font-bold text-white">
                      {formatCurrency(((c.item_detalhes?.valor || 0) * c.quantidade) / (c.tipo === 'pacote_viagem' ? normalizedTravelInstallments : 1))}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {/* Brindes no Resumo */}
            {promosAplicadas.filter((p: any) => p.status === 'ativa' && p.item_brinde).map((promo: any, index: number) => (
              <div key={`resumo-brinde-${promo.promocao_id}-${index}`} className="flex justify-between items-start text-sm bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20 mt-2">
                <div className="pr-4">
                  <span className="text-indigo-300 block text-[10px] mb-0.5 font-bold">
                    {promo.item_brinde?.quantidade}x produto · BRINDE ESPECIAL
                  </span>
                  <span className="font-bold truncate max-w-[150px] block leading-tight text-indigo-100">{promo.item_brinde?.produto_nome}</span>
                  <span className="text-[9px] text-indigo-400">{promo.nome}</span>
                </div>
                <span className="font-black text-emerald-400 uppercase text-xs mt-1">Grátis</span>
              </div>
            ))}
            
            {/* Descontos no Resumo */}
            {promosAplicadas.filter((p: any) => p.status === 'ativa' && p.desconto_aplicado).map((promo: any, index: number) => (
              <div key={`resumo-desc-${promo.promocao_id}-${index}`} className="flex justify-between items-start text-sm bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 mt-2">
                <div className="pr-4">
                  <span className="text-emerald-300 block text-[10px] mb-0.5 font-bold uppercase tracking-wider">
                    DESCONTO APLICADO
                  </span>
                  <span className="font-bold truncate max-w-[150px] block leading-tight text-emerald-100">{promo.desconto_aplicado?.produto_nome}</span>
                  <span className="text-[9px] text-emerald-400">{promo.nome}</span>
                </div>
                <span className="font-black text-emerald-400 uppercase text-xs mt-1">- {formatCurrency(promo.desconto_aplicado?.valor_desconto || 0)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3 relative z-10 text-sm">
            <div className="flex justify-between text-neutral-300">
              <span>{cartItems.every((c: CartItem) => c.tipo === 'produto') ? 'Subtotal' : 'Subtotal Inicial (1ª Parc.)'}</span>
              <span>{formatCurrency(subtotalInicial)}</span>
            </div>
             {descontoPromocoes > 0 && (
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Descontos Promocionais</span>
                <span>-{formatCurrency(descontoPromocoes)}</span>
              </div>
            )}
             {cupomDesconto && (
              <div className="flex justify-between text-blue-400 font-bold">
                <span>Desconto Cupom</span>
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
                <span>Uso de Saldo (Carteira)</span>
                <span>-{formatCurrency(descontoCarteira)}</span>
              </div>
            )}
            {temProdutos && (
              <div className="flex justify-between text-sm font-bold text-red-400">
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
                <span>Juros Crédito GSA (+{taxaJurosAplicada}%)</span>
                <span>+{formatCurrency(valorJurosCredito)}</span>
              </div>
            )}
            
            <div className="border-t border-white/10 pt-4 mt-2 flex justify-between items-end">
              {cartItems.some(c => c.tipo === 'assinatura') || (isTravelCheckout && normalizedTravelInstallments > 1) ? (
                <>
                  <div className="flex flex-col">
                    <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">A Pagar Hoje</span>
                    <span className="text-neutral-500 text-[10px] uppercase font-bold mt-1">Total do Contrato: {formatCurrency(totalContratoFinal)}</span>
                  </div>
                  <span className="text-3xl font-black text-white">{formatCurrency(totalHojeFinal)}</span>
                </>
              ) : (
                <>
                  <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Total Final</span>
                  <span className="text-3xl font-black text-white">{formatCurrency(totalHojeFinal)}</span>
                </>
              )}
            </div>
          </div>

          <button 
            onClick={handleFinalizar}
            disabled={isSubmitting || (temProdutos && (!endereco.cep || !endereco.numero))}
            className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white py-4 rounded-xl font-bold text-sm transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-2 relative z-10"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Confirmar Pedido
          </button>
        </div>
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
