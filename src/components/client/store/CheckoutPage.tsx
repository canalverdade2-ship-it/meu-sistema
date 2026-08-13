import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, Package, MapPin, Tag, Check, AlertCircle, Loader2, 
  ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Coins, CreditCard, 
  Wallet, Gift, Diamond, ShieldCheck, Lock, QrCode, FileText, 
  Building, RefreshCw, CheckCircle2, Plus, Minus, Sparkles, ExternalLink,
  Truck, Edit3
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getProductDisplayCode } from '../../../lib/productIdentification';
import { formatCurrency, generateUUID } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import AvailableCouponsModal from './AvailableCouponsModal';
import type { CupomLoja, Produto, Servico, Assinatura } from '../../../types';
import { PromoResult, avaliarPromocoes } from '../../../lib/promocaoQuantidadeEngine';
import { callClientRpc } from '../../../lib/clientRpc';
import { getProductEffectivePrice, hasActiveProductDiscount, getProductQuantityPriceBreakdown } from '../../../lib/productPricing';
import { checkPixDiscountApplies } from '../../../hooks/usePixDiscount';
import { routes } from '../../../routing/routeCatalog';
import { navigate } from '../../../routing/navigationService';
import { useSEO } from '../../../hooks/useSEO';

type CartItem = {
  id: string;
  item_id: string;
  tipo: 'produto' | 'servico' | 'assinatura';
  quantidade: number;
  item_detalhes?: Produto | Servico | Assinatura | any;
  prazo_meses?: number;
  isBrinde?: boolean;
};

const PENDING_STORE_CHECKOUT_KEY = 'gsa_pending_store_checkout';
const PENDING_STORE_COUPONS_KEY = 'gsa_pending_store_coupons';

interface CheckoutPageProps {
  clientId?: string;
  onRequireAuth?: () => void;
  onBack?: () => void;
}

export function CheckoutPage({ clientId, onRequireAuth, onBack }: CheckoutPageProps) {
  useSEO({
    title: 'Finalizar Compra — Loja GSA Store',
    description: 'Finalize seu pedido com segurança, praticidade e os melhores benefícios exclusivos.',
    type: 'website'
  });

  const checkoutRequestId = useRef<string>(generateUUID());
  const isSubmittingRef = useRef(false);

  // Estados de dados da página
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [promosAplicadas, setPromosAplicadas] = useState<PromoResult[]>([]);
  const [promocoesAtivas, setPromocoesAtivas] = useState<any[]>([]);
  const [promosAtivadasIds, setPromosAtivadasIds] = useState<Set<string>>(new Set());

  // Etapas:
  // 1 = Endereço & Cupons da Loja
  // 2 = Benefícios (Pontos VIP, Saldo Carteira) & Forma de Pagamento
  // 3 = Resumo Completo do Pedido & Confirmação Final
  const [etapaCheckout, setEtapaCheckout] = useState<1 | 2 | 3>(1);

  // Endereço
  const [endereco, setEndereco] = useState({ 
    cep: '', 
    logradouro: '', 
    bairro: '', 
    cidade: '', 
    uf: '', 
    numero: '', 
    complemento: '' 
  });
  const [isEditingEndereco, setIsEditingEndereco] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Cupons
  const [cupomDescInput, setCupomDescInput] = useState('');
  const [cupomEntInput, setCupomEntInput] = useState('');
  const [cupomDesconto, setCupomDesconto] = useState<CupomLoja | null>(null);
  const [cupomEntrega, setCupomEntrega] = useState<CupomLoja | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorCategory, setSelectorCategory] = useState<'desconto' | 'entrega'>('desconto');
  const [availableCoupons, setAvailableCoupons] = useState<CupomLoja[]>([]);

  // Pontos VIP e Carteira
  const [saldoPontos, setSaldoPontos] = useState(0);
  const [saldoCarteira, setSaldoCarteira] = useState(0);
  const [usarPontos, setUsarPontos] = useState(false);
  const [usarSaldoCarteira, setUsarSaldoCarteira] = useState(false);
  const [pontosAplicados, setPontosAplicados] = useState(0);
  const [saldoCarteiraAplicado, setSaldoCarteiraAplicado] = useState(0);

  // Taxa de entrega fixa
  const [taxaEntregaFixa, setTaxaEntregaFixa] = useState(0);

  // Crédito GSA Store e Configurações de Pagamento
  const [limiteCreditoTotal, setLimiteCreditoTotal] = useState(0);
  const [limiteCreditoDisponivel, setLimiteCreditoDisponivel] = useState(0);
  const [opcaoPagamentoParcelado, setOpcaoPagamentoParcelado] = useState(false);
  const [maxParcelas, setMaxParcelas] = useState(12);
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao' | 'boleto' | 'credito_loja' | 'outros'>('pix');
  const [numParcelas, setNumParcelas] = useState(1);
  const [solicitacaoAtivaId, setSolicitacaoAtivaId] = useState<string | null>(null);
  const [jurosCreditoAvista, setJurosCreditoAvista] = useState(20);
  const [jurosCreditoParcelado, setJurosCreditoParcelado] = useState(50);
  const [lojaPixDescontoAtivo, setLojaPixDescontoAtivo] = useState(true);
  const [lojaPixDescontoPorcentagem, setLojaPixDescontoPorcentagem] = useState(5);
  const [lojaPixDescontoPermitirPontos, setLojaPixDescontoPermitirPontos] = useState(false);
  const [lojaPixDescontoPermitirCarteira, setLojaPixDescontoPermitirCarteira] = useState(false);
  const [modalAlertaPix, setModalAlertaPix] = useState<{
    tipo: 'carteira' | 'pontos' | 'troca_pix';
    pendingValue?: number;
  } | null>(null);
  const [pixSettings, setPixSettings] = useState<{ativo: boolean, porcentagem: number, tipoAplicacao: any, categorias: string[], produtos: string[]}>({
    ativo: true, porcentagem: 5, tipoAplicacao: 'todos', categorias: [], produtos: []
  });
  const [checkoutMetodoPixAtivo, setCheckoutMetodoPixAtivo] = useState(true);
  const [checkoutMetodoCartaoAtivo, setCheckoutMetodoCartaoAtivo] = useState(true);
  const [checkoutMetodoBoletoAtivo, setCheckoutMetodoBoletoAtivo] = useState(true);

  // Submissão
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Carregar itens do carrinho
  const fetchCartItems = async () => {
    setLoadingCart(true);
    try {
      if (!clientId) {
        // Visitante
        const raw = localStorage.getItem(PENDING_STORE_CHECKOUT_KEY);
        if (!raw) {
          setCartItems([]);
          setLoadingCart(false);
          return;
        }
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch { parsed = { items: [] }; }
        const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
        if (rawItems.length === 0) {
          setCartItems([]);
          setLoadingCart(false);
          return;
        }

        const productIds = rawItems.filter((c: any) => c.tipo === 'produto').map((c: any) => c.item_id);
        const serviceIds = rawItems.filter((c: any) => c.tipo === 'servico').map((c: any) => c.item_id);
        const subIds = rawItems.filter((c: any) => c.tipo === 'assinatura').map((c: any) => c.item_id);

        const [prodRes, servRes, subRes] = await Promise.all([
          productIds.length > 0 ? supabase.from('produtos').select('*').in('id', productIds) : Promise.resolve({ data: [] }),
          serviceIds.length > 0 ? supabase.from('servicos').select('*').in('id', serviceIds) : Promise.resolve({ data: [] }),
          subIds.length > 0 ? supabase.from('assinaturas').select('*').in('id', subIds) : Promise.resolve({ data: [] })
        ]);

        const prodMap = new Map((prodRes.data || []).map((p: any) => [p.id, p]));
        const servMap = new Map((servRes.data || []).map((s: any) => [s.id, s]));
        const subMap = new Map((subRes.data || []).map((s: any) => [s.id, s]));

        const enriched: CartItem[] = rawItems.map((item: any) => {
          let detalhes = null;
          if (item.tipo === 'produto') detalhes = prodMap.get(item.item_id);
          else if (item.tipo === 'servico') detalhes = servMap.get(item.item_id);
          else if (item.tipo === 'assinatura') detalhes = subMap.get(item.item_id);

          return {
            id: `guest-${item.tipo}-${item.item_id}`,
            item_id: item.item_id,
            tipo: item.tipo,
            quantidade: item.quantidade || 1,
            prazo_meses: item.prazo_meses,
            item_detalhes: detalhes
          };
        }).filter(item => Boolean(item.item_detalhes));

        setCartItems(enriched);
        setLoadingCart(false);
        return;
      }

      // Cliente Autenticado
      const { data: cartData, error: cartErr } = await supabase
        .from('loja_carrinhos')
        .select('*')
        .eq('cliente_id', clientId);

      if (cartErr) throw cartErr;

      const items = cartData || [];
      if (items.length === 0) {
        setCartItems([]);
        setLoadingCart(false);
        return;
      }

      const productIds = items.filter((c: any) => c.tipo === 'produto').map((c: any) => c.item_id);
      const serviceIds = items.filter((c: any) => c.tipo === 'servico').map((c: any) => c.item_id);
      const subIds = items.filter((c: any) => c.tipo === 'assinatura').map((c: any) => c.item_id);

      const [prodRes, servRes, subRes] = await Promise.all([
        productIds.length > 0 ? supabase.from('produtos').select('*').in('id', productIds) : Promise.resolve({ data: [] }),
        serviceIds.length > 0 ? supabase.from('servicos').select('*').in('id', serviceIds) : Promise.resolve({ data: [] }),
        subIds.length > 0 ? supabase.from('assinaturas').select('*').in('id', subIds) : Promise.resolve({ data: [] })
      ]);

      const prodMap = new Map((prodRes.data || []).map((p: any) => [p.id, p]));
      const servMap = new Map((servRes.data || []).map((s: any) => [s.id, s]));
      const subMap = new Map((subRes.data || []).map((s: any) => [s.id, s]));

      const enriched: CartItem[] = items.map((item: any) => {
        let detalhes = null;
        if (item.tipo === 'produto') detalhes = prodMap.get(item.item_id);
        else if (item.tipo === 'servico') detalhes = servMap.get(item.item_id);
        else if (item.tipo === 'assinatura') detalhes = subMap.get(item.item_id);

        return {
          id: item.id,
          item_id: item.item_id,
          tipo: item.tipo,
          quantidade: item.quantidade || 1,
          prazo_meses: item.prazo_meses,
          item_detalhes: detalhes
        };
      });

      setCartItems(enriched);
    } catch (err) {
      console.error('[CheckoutPage] Erro ao carregar carrinho:', err);
      toast.error('Erro ao carregar carrinho.');
    } finally {
      setLoadingCart(false);
    }
  };

  // 2. Carregar promoções
  const fetchPromos = async () => {
    try {
      const { data: promos } = await supabase
        .from('promocoes_quantidade')
        .select('*')
        .eq('ativo', true);
      setPromocoesAtivas(promos || []);

      if (clientId) {
        const { data: ativadas } = await supabase
          .from('promocoes_ativadas')
          .select('promocao_id')
          .eq('cliente_id', clientId);
        setPromosAtivadasIds(new Set((ativadas || []).map((a: any) => a.promocao_id)));
      }
    } catch (err) {
      console.error('[CheckoutPage] Erro ao carregar promoções:', err);
    }
  };

  useEffect(() => {
    if (cartItems.length > 0 && promocoesAtivas.length > 0) {
      const aplicadas = avaliarPromocoes(cartItems, promocoesAtivas, promosAtivadasIds);
      setPromosAplicadas(aplicadas);
    } else {
      setPromosAplicadas([]);
    }
  }, [cartItems, promocoesAtivas, promosAtivadasIds]);

  // 3. Carregar dados de crédito, taxas e endereço
  const fetchDadosCredito = async () => {
    try {
      if (clientId) {
        const { data: cliData, error: cliErr } = await supabase
          .from('clientes')
          .select('limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado, max_parcelas, cep, endereco, numero, bairro, cidade, estado, saldo_carteira, saldo_pontos')
          .eq('id', clientId)
          .single();
          
        if (!cliErr && cliData) {
          setLimiteCreditoTotal(Number(cliData.limite_credito_total || 0));
          setLimiteCreditoDisponivel(Number(cliData.limite_credito_disponivel || 0));
          setSaldoCarteira(Number(cliData.saldo_carteira || 0));
          setSaldoPontos(Number(cliData.saldo_pontos || 0));
          setOpcaoPagamentoParcelado(cliData.opcao_pagamento_parcelado || false);
          setMaxParcelas(cliData.max_parcelas || 12);

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
            setIsEditingEndereco(true);
          }
        }

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
      }

      const { data: setts } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'loja_taxa_entrega_padrao',
          'loja_credito_juros_avista', 
          'loja_credito_juros_parcelado', 
          'loja_pix_desconto_ativo', 
          'loja_pix_desconto_porcentagem', 
          'loja_pix_desconto_tipo_aplicacao',
          'loja_pix_desconto_categorias',
          'loja_pix_desconto_produtos',
          'loja_pix_desconto_permitir_pontos',
          'loja_pix_desconto_permitir_saldo_carteira',
          'checkout_metodo_pix_ativo', 
          'checkout_metodo_cartao_ativo', 
          'checkout_metodo_boleto_ativo'
        ]);
        
      if (setts) {
        const taxaEnt = setts.find(s => s.key === 'loja_taxa_entrega_padrao');
        if (taxaEnt) setTaxaEntregaFixa(parseFloat(taxaEnt.value) || 0);

        const av = setts.find(s => s.key === 'loja_credito_juros_avista');
        const pa = setts.find(s => s.key === 'loja_credito_juros_parcelado');
        if (av) setJurosCreditoAvista(Number(av.value) ?? 20);
        if (pa) setJurosCreditoParcelado(Number(pa.value) ?? 50);

        const pixD = setts.find(s => s.key === 'loja_pix_desconto_ativo');
        const pixP = setts.find(s => s.key === 'loja_pix_desconto_porcentagem');
        const pixTA = setts.find(s => s.key === 'loja_pix_desconto_tipo_aplicacao');
        const pixCat = setts.find(s => s.key === 'loja_pix_desconto_categorias');
        const pixProd = setts.find(s => s.key === 'loja_pix_desconto_produtos');
        const pixPermPontos = setts.find(s => s.key === 'loja_pix_desconto_permitir_pontos');
        const pixPermCart = setts.find(s => s.key === 'loja_pix_desconto_permitir_saldo_carteira');

        const settings = {
          ativo: pixD ? pixD.value === 'true' : true,
          porcentagem: Number(pixP?.value) || 5,
          tipoAplicacao: pixTA?.value || 'todos',
          categorias: (pixCat?.value || '').split(',').map(s => s.trim()).filter(Boolean),
          produtos: (pixProd?.value || '').split(',').map(s => s.trim()).filter(Boolean)
        };
        setPixSettings(settings);

        if (pixD) setLojaPixDescontoAtivo(settings.ativo);
        if (pixP && Number(pixP.value) > 0) setLojaPixDescontoPorcentagem(settings.porcentagem);
        if (pixPermPontos) setLojaPixDescontoPermitirPontos(pixPermPontos.value === 'true');
        if (pixPermCart) setLojaPixDescontoPermitirCarteira(pixPermCart.value === 'true');

        const mPix = setts.find(s => s.key === 'checkout_metodo_pix_ativo');
        const mCar = setts.find(s => s.key === 'checkout_metodo_cartao_ativo');
        const mBol = setts.find(s => s.key === 'checkout_metodo_boleto_ativo');

        if (mPix) setCheckoutMetodoPixAtivo(mPix.value !== 'false');
        if (mCar) setCheckoutMetodoCartaoAtivo(mCar.value !== 'false');
        if (mBol) setCheckoutMetodoBoletoAtivo(mBol.value !== 'false');
      }
    } catch (err) {
      console.error('[CheckoutPage] Erro ao carregar dados:', err);
    }
  };

  useEffect(() => {
    fetchCartItems();
    fetchPromos();
    fetchDadosCredito();
  }, [clientId]);

  // 4. Carregar cupons pendentes
  useEffect(() => {
    if (!clientId) return;

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
        console.error('[CheckoutPage] Erro ao carregar cupons pendentes:', error);
      }
    };

    loadPendingCoupons();
  }, [clientId]);

  const fetchCoupons = async (category: 'desconto' | 'entrega') => {
    if (!clientId) {
      setAvailableCoupons([]);
      return;
    }
    try {
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

      const { data, error } = await supabase
        .from('cupons_loja')
        .select('*')
        .eq('status', 'ativo')
        .eq('categoria_cupom', category)
        .in('id', ativadosIds)
        .or(`cliente_id.is.null,cliente_id.eq.${clientId}`);

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
      console.error('[CheckoutPage] Erro ao buscar cupons:', err);
    }
  };

  const handleOpenSelector = (category: 'desconto' | 'entrega') => {
    if (!clientId) {
      toast('Entre para ver seus cupons ativados.');
      if (onRequireAuth) onRequireAuth();
      return;
    }
    setSelectorCategory(category);
    fetchCoupons(category);
    setIsSelectorOpen(true);
  };

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco(p => ({ 
          ...p, 
          cep: limpo, 
          logradouro: data.logradouro || '', 
          bairro: data.bairro || '', 
          cidade: data.localidade || '', 
          uf: data.uf || '' 
        }));
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
    if (!clientId) {
      toast('Entre ou cadastre-se para aplicar cupons.');
      if (onRequireAuth) onRequireAuth();
      return;
    }
    try {
      const { data, error } = await supabase
        .from('cupons_loja')
        .select('*')
        .eq('codigo_cupom', codigo.toUpperCase())
        .single();
        
      if (error || !data) {
        toast.error('Cupom inválido ou não encontrado.');
        return;
      }
      
      const cupom = data as CupomLoja;
      
      if (cupom.status !== 'ativo') return toast.error('Este cupom não está mais ativo.');
      if (Number(cupom.limite_usos || 0) > 0 && Number(cupom.total_usos || 0) >= Number(cupom.limite_usos)) {
        return toast.error('Limite de uso do cupom esgotado.');
      }
      if (cupom.data_validade) {
        const [year, month, day] = String(cupom.data_validade).split('T')[0].split('-').map(Number);
        const expiryDate = new Date(year, month - 1, day, 23, 59, 59);
        if (expiryDate < new Date()) return toast.error('Cupom expirado.');
      }
      if (cupom.cliente_id && cupom.cliente_id !== clientId) {
        return toast.error('Este cupom é exclusivo para outro cliente.');
      }

      const { data: ativacao, error: errAtiv } = await supabase
        .from('cupons_ativados')
        .select('id')
        .eq('cliente_id', clientId)
        .eq('cupom_id', cupom.id)
        .maybeSingle();

      if (errAtiv) throw errAtiv;

      if (!ativacao) {
        return toast.error('Você precisa ativar este cupom primeiro em Meus Cupons antes de usar no checkout.', { duration: 5000 });
      }

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
      
      if (tipo === 'desconto' && cupom.categoria_cupom === 'entrega') return toast.error('Este é um cupom de entrega.');
      if (tipo === 'entrega' && cupom.categoria_cupom !== 'entrega') return toast.error('Este não é um cupom de entrega.');
      
      if (cupom.produto_id) {
        const itemNoCarrinho = cartItems.find((c: CartItem) => c.item_id === cupom.produto_id);
        if (!itemNoCarrinho) {
          const { data: prodData } = await supabase.from('produtos').select('nome, codigo_produto, codigo_barras, identificador_preferencial').eq('id', cupom.produto_id).single();
          const nomeProd = prodData?.nome || 'um produto específico';
          const codProd = prodData ? getProductDisplayCode(prodData as any) : '---';
          return toast.error(`Este cupom é exclusivo para o item [${codProd}] ${nomeProd}. Adicione-o ao carrinho para aplicar o desconto.`);
        }
      }

      if (tipo === 'entrega') {
        if (!temProdutos) return toast.error('Você não tem produtos físicos no carrinho para usar cupom de entrega.');
        if (cupom.tipo_entrega === 'frete_gratis_minimo' && subtotalInicial < (cupom.valor_minimo_compra || 0)) {
          return toast.error(`A compra mínima para este frete grátis é ${formatCurrency(cupom.valor_minimo_compra || 0)}.`);
        }
        setCupomEntrega(cupom);
        setCupomEntInput('');
        toast.success('Benefício de entrega aplicado!');
      } else {
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

  // Cálculos de Valores
  const temProdutos = cartItems.some((c: CartItem) => c.tipo === 'produto');
  const enderecoCompletoValido = Boolean(
    endereco.cep?.trim()
    && endereco.logradouro?.trim()
    && endereco.numero?.trim()
    && endereco.bairro?.trim()
    && endereco.cidade?.trim()
    && endereco.uf?.trim()
  );

  const isPix = formaPagamento === 'pix';
  const pixPercentage = lojaPixDescontoPorcentagem > 0 ? lojaPixDescontoPorcentagem : 5;

  const subtotalInicial = cartItems.reduce((acc: number, cur: CartItem) => {
    if (cur.tipo === 'produto') {
      return acc + getProductQuantityPriceBreakdown(cur.item_detalhes, cur.quantidade).subtotalFinal;
    }
    return acc + ((cur.item_detalhes?.valor || 0) * cur.quantidade);
  }, 0);

  const descontoPromocoes = (promosAplicadas || []).reduce((acc: number, promo: PromoResult) => {
    if (promo.status === 'ativa' && promo.desconto_aplicado) {
      return acc + promo.desconto_aplicado.valor_desconto;
    }
    return acc;
  }, 0);
  
  const subtotalComPromos = Math.max(0, subtotalInicial - descontoPromocoes);

  // Pontos VIP
  const maxPontosEmCentavos = Math.floor(subtotalComPromos * 100);
  const maxPontosValidos = Math.min(saldoPontos, Math.max(0, maxPontosEmCentavos));

  // Regra de Exclusividade PIX
  const isPixDescontoAtivoNoMomento = isPix && lojaPixDescontoAtivo;

  const handleTogglePontos = (checked: boolean) => {
    if (checked) {
      if (isPixDescontoAtivoNoMomento && !lojaPixDescontoPermitirPontos && !usarPontos) {
        setModalAlertaPix({ tipo: 'pontos', pendingValue: maxPontosValidos });
        return;
      }
      setUsarPontos(true);
      setPontosAplicados(maxPontosValidos);
    } else {
      setUsarPontos(false);
      setPontosAplicados(0);
    }
  };

  const handlePontosChange = (val: number) => {
    if (isNaN(val) || val <= 0) {
      setUsarPontos(false);
      setPontosAplicados(0);
      return;
    }
    const cleanVal = Math.min(val, maxPontosValidos);
    if (!usarPontos && isPixDescontoAtivoNoMomento && !lojaPixDescontoPermitirPontos) {
      setModalAlertaPix({ tipo: 'pontos', pendingValue: cleanVal });
      return;
    }
    setUsarPontos(true);
    setPontosAplicados(cleanVal);
  };

  const descontoPontos = usarPontos ? Number((Math.min(pontosAplicados, maxPontosValidos) * 0.01).toFixed(2)) : 0;
  const subtotalAposPontos = Number(Math.max(0, subtotalComPromos - descontoPontos).toFixed(2));

  // Cupom de Desconto
  const calcularDesconto = () => {
    if (!cupomDesconto) return 0;
    
    let baseCalculo = subtotalAposPontos;
    if (cupomDesconto.produto_id) {
      const itemEsp = cartItems.find((c: CartItem) => c.item_id === cupomDesconto.produto_id);
      if (!itemEsp) return 0;
      const descontoPromocionalDoProduto = (promosAplicadas || []).reduce((acc: number, promo: PromoResult) => {
        if (promo.status !== 'ativa') return acc;
        if (promo.desconto_aplicado?.produto_id === cupomDesconto.produto_id) {
          return acc + Number(promo.desconto_aplicado.valor_desconto || 0);
        }
        return acc;
      }, 0);
      const unitVal = itemEsp.tipo === 'produto' 
        ? (getProductQuantityPriceBreakdown(itemEsp.item_detalhes, itemEsp.quantidade).subtotalFinal / itemEsp.quantidade) 
        : (itemEsp.item_detalhes?.valor || 0);
      baseCalculo = Math.max(0, (unitVal * itemEsp.quantidade) - descontoPromocionalDoProduto);
    }

    let desc = 0;
    if (cupomDesconto.tipo_desconto === 'porcentagem') {
      desc = baseCalculo * ((cupomDesconto.valor_desconto || 0) / 100);
    } else {
      desc = cupomDesconto.valor_desconto || 0;
    }

    return Math.min(desc, subtotalAposPontos);
  };

  const descontoCalculado = Number(calcularDesconto().toFixed(2));
  
  // Taxa de entrega
  const taxaEntregaFinal = (temProdutos && !cupomEntrega) 
    ? taxaEntregaFixa 
    : (cupomEntrega?.tipo_entrega === 'taxa_fixa' ? (cupomEntrega.taxa_fixa_entrega || 0) : 0);

  // Desconto PIX Geral (incide sobre os produtos do carrinho quando PIX for selecionado)
  const eligiblePixSubtotal = cartItems.reduce((acc: number, item: any) => {
    if (item.tipo === 'produto' && checkPixDiscountApplies(item.item_detalhes, pixSettings)) {
      const unitVal = (getProductQuantityPriceBreakdown(item.item_detalhes, item.quantidade).subtotalFinal / item.quantidade) || (item.item_detalhes?.valor || 0);
      return acc + (unitVal * item.quantidade);
    }
    return acc;
  }, 0);

  // Regra de Exclusividade do Desconto PIX:
  // O desconto de 5% no PIX só é válido para pagamento exclusivo no PIX (sem carteira e sem pontos, se as regras estiverem desativadas)
  const pixDiscountBlockedByPoints = usarPontos && pontosAplicados > 0 && !lojaPixDescontoPermitirPontos;
  const pixDiscountBlockedByWallet = usarSaldoCarteira && saldoCarteiraAplicado > 0 && !lojaPixDescontoPermitirCarteira;
  const isPixDiscountEligible = isPix && lojaPixDescontoAtivo && !pixDiscountBlockedByPoints && !pixDiscountBlockedByWallet;

  const baseCalculoPix = Math.max(0, eligiblePixSubtotal - (descontoCalculado || 0));
  const pixDiscountValue = isPixDiscountEligible
    ? parseFloat((baseCalculoPix * (pixPercentage / 100)).toFixed(2))
    : 0;

  // Total Líquido antes de abater o saldo da carteira (já considerando cupons, pontos, frete e desconto PIX)
  const totalAntesCarteira = Number(Math.max(0, subtotalComPromos - descontoPontos - descontoCalculado - pixDiscountValue + taxaEntregaFinal).toFixed(2));

  // Carteira Virtual
  const saldoCarteiraUtilizavel = Math.max(0, saldoCarteira);
  const maxSaldoValido = Number(Math.min(saldoCarteiraUtilizavel, totalAntesCarteira).toFixed(2));
  
  const handleToggleSaldoCarteira = (checked: boolean) => {
    if (checked) {
      if (isPixDescontoAtivoNoMomento && !lojaPixDescontoPermitirCarteira && !usarSaldoCarteira) {
        setModalAlertaPix({ tipo: 'carteira', pendingValue: maxSaldoValido });
        return;
      }
      setUsarSaldoCarteira(true);
      setSaldoCarteiraAplicado(maxSaldoValido);
    } else {
      setUsarSaldoCarteira(false);
      setSaldoCarteiraAplicado(0);
    }
  };

  const handleSaldoCarteiraChange = (val: number) => {
    if (isNaN(val) || val <= 0) {
      setUsarSaldoCarteira(false);
      setSaldoCarteiraAplicado(0);
      return;
    }
    const cleanVal = Number(Math.min(val, maxSaldoValido).toFixed(2));
    if (!usarSaldoCarteira && isPixDescontoAtivoNoMomento && !lojaPixDescontoPermitirCarteira) {
      setModalAlertaPix({ tipo: 'carteira', pendingValue: cleanVal });
      return;
    }
    setUsarSaldoCarteira(true);
    setSaldoCarteiraAplicado(cleanVal);
  };

  const descontoCarteira = usarSaldoCarteira ? Number(Math.min(saldoCarteiraAplicado, maxSaldoValido).toFixed(2)) : 0;

  const handleSelectPix = () => {
    const hasRedemption = (usarPontos && pontosAplicados > 0 && !lojaPixDescontoPermitirPontos) || 
                          (usarSaldoCarteira && saldoCarteiraAplicado > 0 && !lojaPixDescontoPermitirCarteira);
    if (formaPagamento !== 'pix' && hasRedemption && lojaPixDescontoAtivo) {
      setModalAlertaPix({ tipo: 'troca_pix' });
      return;
    }
    setFormaPagamento('pix');
  };

  useEffect(() => {
    setPontosAplicados((prev) => (prev > maxPontosValidos ? maxPontosValidos : prev));
  }, [maxPontosValidos]);

  useEffect(() => {
    setSaldoCarteiraAplicado((prev) => (prev > maxSaldoValido ? maxSaldoValido : prev));
  }, [maxSaldoValido]);

  const totalHojeSemJuros = Number(Math.max(0, totalAntesCarteira - descontoCarteira).toFixed(2));
  
  // Juros de Crédito GSA
  const calcularTaxaJuros = (parcelas: number) =>
    parcelas <= 1 ? jurosCreditoAvista : jurosCreditoAvista + (jurosCreditoParcelado * parcelas);

  const taxaJurosAplicada = formaPagamento === 'credito_loja'
    ? calcularTaxaJuros(numParcelas)
    : 0;
  const valorJurosCredito = formaPagamento === 'credito_loja'
    ? parseFloat((totalHojeSemJuros * (taxaJurosAplicada / 100)).toFixed(2))
    : 0;

  const totalHojeFinal = Number(Math.max(0, totalHojeSemJuros + valorJurosCredito).toFixed(2));
  const totalPontosGanhos = Math.floor(totalHojeFinal);

  // Revalidação de Cupons
  useEffect(() => {
    if (cupomEntrega) {
      if (!temProdutos) {
        setCupomEntrega(null);
        toast.error('Cupom de entrega removido: não há mais produtos físicos no carrinho.');
      } else if (
        cupomEntrega.tipo_entrega === 'frete_gratis_minimo' &&
        subtotalInicial < (cupomEntrega.valor_minimo_compra || 0)
      ) {
        setCupomEntrega(null);
        toast.error(`Cupom de frete grátis removido: a compra mínima é ${formatCurrency(cupomEntrega.valor_minimo_compra || 0)}.`);
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
      toast.error(`Cupom removido: a compra mínima para este cupom é ${formatCurrency(cupomDesconto.valor_minimo_compra || 0)}.`);
    }
  }, [subtotalInicial, temProdutos, cartItems, cupomEntrega, cupomDesconto]);

  // Finalização
  const handleFinalizar = async () => {
    if (isSubmittingRef.current) return;

    if (!clientId) {
      toast('Entre ou cadastre-se para concluir seu pedido.');
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (temProdutos && !enderecoCompletoValido) {
      setEtapaCheckout(1);
      toast.error('Preencha todos os campos do endereço de entrega.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const productIds = cartItems.filter((c: any) => c.tipo === 'produto').map((c: any) => c.item_id);
      if (productIds.length > 0) {
        const { data: dbProducts } = await supabase
          .from('produtos')
          .select('id, valor, valor_promocional, desconto_ativo, desconto_fim_em, desconto_prazo_tipo, desconto_limite_quantidade_ativo, desconto_quantidade_limite, desconto_quantidade_utilizada, visivel_na_loja, estoque_disponivel, controle_estoque')
          .in('id', productIds);
          
        if (dbProducts) {
          let priceChanged = false;
          for (const item of cartItems) {
            if (item.tipo !== 'produto') continue;
            const dbProd = dbProducts.find((p: any) => p.id === item.item_id);
            if (dbProd) {
              let isStillActive = dbProd.desconto_ativo;
              if (isStillActive && dbProd.desconto_prazo_tipo === 'determinado' && dbProd.desconto_fim_em) {
                if (new Date() >= new Date(dbProd.desconto_fim_em)) isStillActive = false;
              }
              if (isStillActive && dbProd.desconto_limite_quantidade_ativo && dbProd.desconto_quantidade_limite) {
                const restante = dbProd.desconto_quantidade_limite - (dbProd.desconto_quantidade_utilizada || 0);
                if (restante <= 0) isStillActive = false;
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
            setTimeout(() => window.location.reload(), 2000);
            return;
          }
        }
      }

      const hasInvalidOrDeleted = cartItems.some((c: any) => 
        !c.item_detalhes 
        || (c.tipo === 'produto' && c.item_detalhes?.controle_estoque && (c.item_detalhes?.estoque_disponivel <= 0))
      );
      if (hasInvalidOrDeleted) {
        toast.error('Remova os produtos excluídos ou esgotados do carrinho antes de finalizar.');
        return;
      }

      const itemSemEstoqueSuficiente = cartItems.find((c: any) => (
        c.tipo === 'produto'
        && c.item_detalhes?.controle_estoque
        && Number(c.quantidade || 0) > Number(c.item_detalhes?.estoque_disponivel || 0)
      ));
      if (itemSemEstoqueSuficiente) {
        toast.error(
          `Estoque insuficiente para "${itemSemEstoqueSuficiente.item_detalhes?.nome || 'um produto'}": `
          + `restam ${Number(itemSemEstoqueSuficiente.item_detalhes?.estoque_disponivel || 0)} unidade(s).`
        );
        return;
      }

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
          + `(com juros) e você tem ${formatCurrency(freshLimite)} disponível.`
        );
        return;
      }

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

      localStorage.removeItem(PENDING_STORE_CHECKOUT_KEY);
      localStorage.removeItem(PENDING_STORE_COUPONS_KEY);
      window.dispatchEvent(new CustomEvent('gsa-cart-updated'));

      navigate(routes.marketplace.store.orderSuccess(data.orcamento_id));
    } catch (e: any) {
      console.error('[CheckoutPage] Erro no RPC:', e);
      const raw = String(e?.message || '');
      const friendly = /produto indispon/i.test(raw)
        ? 'Um dos produtos do carrinho saiu do catálogo. Remova-o antes de concluir a compra.'
        : raw || 'Falha ao processar compra. Tente novamente.';
      toast.error(friendly);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col text-neutral-900 selection:bg-[#17345f] selection:text-white">
      {/* Header Seguro e Elevado do Checkout */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            
            {/* Voltar para a Loja */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onBack ? onBack() : navigate(routes.marketplace.store.products())}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-2xs transition-all hover:bg-neutral-50 hover:text-neutral-900 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar para a Loja</span>
              </button>
            </div>

            {/* Título Centralizado do Checkout */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#17345f] text-white shadow-xs">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="text-sm font-black uppercase tracking-wider text-[#17345f]">
                Finalizar Compra
              </span>
            </div>

            {/* Selo de Segurança */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/80 shadow-2xs">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Ambiente 100% Seguro</span>
              <span className="sm:hidden">Seguro</span>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex-1 w-full">
        {loadingCart ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 text-[#17345f] animate-spin" />
            <p className="mt-4 text-sm font-bold text-neutral-600 animate-pulse">Carregando dados do seu pedido...</p>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="mx-auto max-w-md bg-white rounded-3xl p-8 text-center border border-neutral-200/80 shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400">
              <ShoppingBag className="h-10 w-10" />
            </div>
            <h2 className="mt-5 text-xl font-black text-neutral-900">Seu carrinho está vazio</h2>
            <p className="mt-2 text-xs text-neutral-500 font-medium leading-relaxed">
              Você não possui nenhum produto ou assinatura selecionado no momento para finalizar.
            </p>
            <button
              type="button"
              onClick={() => navigate(routes.marketplace.store.products())}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17345f] py-3.5 text-xs font-black text-white shadow-md shadow-[#17345f]/20 transition-all hover:bg-[#102746] cursor-pointer"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Explorar Produtos da Loja</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Indicador de Progresso Visual das 3 Etapas */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-200/90 shadow-xs">
              <div className="relative flex items-center justify-between max-w-2xl mx-auto">
                <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-neutral-100 rounded-full z-0"></div>
                <div 
                  className="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-[#17345f] rounded-full z-0 transition-all duration-300"
                  style={{
                    width: etapaCheckout === 1 ? '0%' : etapaCheckout === 2 ? '50%' : 'calc(100% - 4rem)'
                  }}
                ></div>

                {/* Passo 1: Endereço & Cupons */}
                <button
                  type="button"
                  onClick={() => setEtapaCheckout(1)}
                  className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all shadow-xs ${
                    etapaCheckout > 1 
                      ? 'bg-emerald-600 text-white' 
                      : etapaCheckout === 1 
                        ? 'bg-[#17345f] text-white ring-4 ring-[#17345f]/15' 
                        : 'bg-white text-neutral-400 border border-neutral-200'
                  }`}>
                    {etapaCheckout > 1 ? <Check className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${
                    etapaCheckout === 1 ? 'text-[#17345f]' : etapaCheckout > 1 ? 'text-emerald-700' : 'text-neutral-400'
                  }`}>
                    1. Endereço & Cupons
                  </span>
                </button>

                {/* Passo 2: Benefícios & Pagamento */}
                <button
                  type="button"
                  onClick={() => {
                    if (temProdutos && !enderecoCompletoValido) {
                      toast.error('Preencha todo o endereço de entrega antes de avançar.');
                      return;
                    }
                    setEtapaCheckout(2);
                  }}
                  className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all shadow-xs ${
                    etapaCheckout > 2 
                      ? 'bg-emerald-600 text-white' 
                      : etapaCheckout === 2 
                        ? 'bg-[#17345f] text-white ring-4 ring-[#17345f]/15' 
                        : 'bg-white text-neutral-400 border border-neutral-200'
                  }`}>
                    {etapaCheckout > 2 ? <Check className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${
                    etapaCheckout === 2 ? 'text-[#17345f]' : etapaCheckout > 2 ? 'text-emerald-700' : 'text-neutral-400'
                  }`}>
                    2. Benefícios & Pagamento
                  </span>
                </button>

                {/* Passo 3: Resumo Completo do Pedido */}
                <button
                  type="button"
                  onClick={() => {
                    if (temProdutos && !enderecoCompletoValido) {
                      toast.error('Preencha todo o endereço de entrega antes de avançar.');
                      return;
                    }
                    setEtapaCheckout(3);
                  }}
                  className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all shadow-xs ${
                    etapaCheckout === 3 
                      ? 'bg-[#17345f] text-white ring-4 ring-[#17345f]/15' 
                      : 'bg-white text-neutral-400 border border-neutral-200'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${
                    etapaCheckout === 3 ? 'text-[#17345f]' : 'text-neutral-400'
                  }`}>
                    3. Resumo do Pedido
                  </span>
                </button>
              </div>
            </div>

            {/* Grid Principal: Se for Etapa 1 ou 2 -> Form na Esquerda + Preview na Direita. Se for Etapa 3 -> Resumo Completo Amplo! */}
            {etapaCheckout !== 3 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                
                {/* Coluna da Esquerda: Formulários da Etapa 1 ou Etapa 2 */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* ========================================================= */}
                  {/* ETAPA 1: CONFIRMAÇÃO DO ENDEREÇO & CUPONS DA LOJA */}
                  {/* ========================================================= */}
                  {etapaCheckout === 1 && (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm space-y-6 animate-in fade-in duration-300">
                      
                      {/* Seção de Endereço */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                              <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                              <h2 className="text-base font-black text-neutral-900 uppercase tracking-wide">
                                Endereço de Entrega
                              </h2>
                              <p className="text-xs text-neutral-500 font-medium">
                                {temProdutos ? 'Informe onde deseja receber seus produtos' : 'Itens digitais (não requerem entrega física)'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {!temProdutos ? (
                          <div className="rounded-2xl bg-blue-50/60 p-4 border border-blue-100 flex items-start gap-3">
                            <Package className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-extrabold text-blue-900">Itens Digitais e Serviços</h4>
                              <p className="text-xs text-blue-800/80 font-medium leading-relaxed">
                                Seu carrinho contém apenas serviços ou assinaturas digitais com liberação imediata. Não é cobrado frete.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {enderecoCompletoValido && !isEditingEndereco ? (
                              <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-5 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                                      <Check className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">Endereço Confirmado</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingEndereco(true)}
                                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                                  >
                                    Alterar endereço
                                  </button>
                                </div>
                                <div className="text-xs text-neutral-700 font-medium space-y-0.5 pl-8">
                                  <p className="font-bold text-neutral-900">{endereco.logradouro}, {endereco.numero} {endereco.complemento ? `(${endereco.complemento})` : ''}</p>
                                  <p>{endereco.bairro} — {endereco.cidade}/{endereco.uf}</p>
                                  <p className="font-mono text-neutral-500">CEP: {endereco.cep}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4 pt-1">
                                <div className="flex flex-col sm:flex-row gap-3">
                                  <div className="w-full sm:w-1/2 space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-700 uppercase">CEP *</label>
                                    <div className="relative">
                                      <input 
                                        type="text" 
                                        placeholder="00000-000" 
                                        value={endereco.cep} 
                                        onChange={e => {
                                          const val = e.target.value;
                                          setEndereco(p => ({ ...p, cep: val }));
                                          if (val.replace(/\D/g, '').length === 8) buscarCep(val);
                                        }}
                                        maxLength={9}
                                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all" 
                                      />
                                      {buscandoCep && (
                                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin absolute right-3 top-3" />
                                      )}
                                    </div>
                                  </div>

                                  <div className="w-full sm:w-1/2 space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-700 uppercase">Número *</label>
                                    <input 
                                      type="text" 
                                      placeholder="Ex: 123" 
                                      value={endereco.numero} 
                                      onChange={e => setEndereco(p => ({ ...p, numero: e.target.value }))}
                                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all" 
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-neutral-700 uppercase">Logradouro (Rua / Av) *</label>
                                  <input 
                                    type="text" 
                                    placeholder="Nome da rua ou avenida" 
                                    value={endereco.logradouro} 
                                    onChange={e => setEndereco(p => ({ ...p, logradouro: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all" 
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-700 uppercase">Complemento</label>
                                    <input 
                                      type="text" 
                                      placeholder="Apto, Bloco, etc." 
                                      value={endereco.complemento} 
                                      onChange={e => setEndereco(p => ({ ...p, complemento: e.target.value }))}
                                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all" 
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-neutral-700 uppercase">Bairro *</label>
                                    <input 
                                      type="text" 
                                      placeholder="Bairro" 
                                      value={endereco.bairro} 
                                      onChange={e => setEndereco(p => ({ ...p, bairro: e.target.value }))}
                                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all" 
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-neutral-700 uppercase">Cidade *</label>
                                      <input 
                                        type="text" 
                                        placeholder="Cidade" 
                                        value={endereco.cidade} 
                                        onChange={e => setEndereco(p => ({ ...p, cidade: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all" 
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-bold text-neutral-700 uppercase">UF *</label>
                                      <input 
                                        type="text" 
                                        placeholder="SP" 
                                        maxLength={2}
                                        value={endereco.uf} 
                                        onChange={e => setEndereco(p => ({ ...p, uf: e.target.value.toUpperCase() }))}
                                        className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-[#17345f] focus:outline-none focus:bg-white transition-all text-center" 
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Seção de Cupons da Loja */}
                      <div className="space-y-4 pt-4 border-t border-neutral-100">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <Tag className="h-5 w-5 text-indigo-600" />
                            <div>
                              <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                                Cupons da Loja
                              </h3>
                              <p className="text-[11px] text-neutral-500 font-medium">
                                Aplique cupons de desconto e benefícios de frete
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Cupom Desconto */}
                          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 space-y-2.5">
                            <label className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                              <Tag className="h-3.5 w-3.5 text-blue-600" /> Cupom de Desconto
                            </label>
                            {cupomDesconto ? (
                              <div className="flex items-center justify-between bg-white border border-blue-200 px-3.5 py-2.5 rounded-xl text-xs">
                                <span className="font-mono font-black text-blue-700">
                                  {cupomDesconto.codigo_cupom} — {cupomDesconto.tipo_desconto === 'porcentagem' ? `${cupomDesconto.valor_desconto}% OFF` : `R$ ${cupomDesconto.valor_desconto} OFF`}
                                </span>
                                <button 
                                  onClick={() => setCupomDesconto(null)} 
                                  className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer"
                                >
                                  Remover
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={cupomDescInput} 
                                    onChange={e => setCupomDescInput(e.target.value.toUpperCase())} 
                                    placeholder="CÓDIGO DO CUPOM" 
                                    className="flex-1 px-3.5 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono uppercase font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                  />
                                  <button 
                                    onClick={() => aplicarCupom(cupomDescInput, 'desconto')} 
                                    className="px-4 py-2 bg-blue-600 text-white font-black rounded-xl text-xs hover:bg-blue-700 cursor-pointer shadow-xs transition-all"
                                  >
                                    Aplicar
                                  </button>
                                </div>
                                <button 
                                  onClick={() => handleOpenSelector('desconto')}
                                  className="text-[10px] font-black text-blue-600 uppercase tracking-wider hover:text-blue-800 cursor-pointer block pt-0.5"
                                >
                                  Ver Cupons Disponíveis
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Cupom Entrega */}
                          {temProdutos && (
                            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-2.5">
                              <label className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5 text-emerald-600" /> Benefício de Frete
                              </label>
                              {cupomEntrega ? (
                                <div className="flex items-center justify-between bg-white border border-emerald-200 px-3.5 py-2.5 rounded-xl text-xs">
                                  <span className="font-mono font-black text-emerald-700">
                                    {cupomEntrega.codigo_cupom} — {cupomEntrega.tipo_entrega === 'frete_gratis' ? 'Frete Grátis' : 'Frete Fixo'}
                                  </span>
                                  <button 
                                    onClick={() => setCupomEntrega(null)} 
                                    className="text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer"
                                  >
                                    Remover
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      value={cupomEntInput} 
                                      onChange={e => setCupomEntInput(e.target.value.toUpperCase())} 
                                      placeholder="CÓDIGO DE FRETE" 
                                      className="flex-1 px-3.5 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-mono uppercase font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                    />
                                    <button 
                                      onClick={() => aplicarCupom(cupomEntInput, 'entrega')} 
                                      className="px-4 py-2 bg-emerald-600 text-white font-black rounded-xl text-xs hover:bg-emerald-700 cursor-pointer shadow-xs transition-all"
                                    >
                                      Aplicar
                                    </button>
                                  </div>
                                  <button 
                                    onClick={() => handleOpenSelector('entrega')}
                                    className="text-[10px] font-black text-emerald-700 uppercase tracking-wider hover:text-emerald-900 cursor-pointer block pt-0.5"
                                  >
                                    Ver Benefícios de Frete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botão de Avanço da Etapa 1 */}
                      <div className="flex items-center justify-end pt-4 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (temProdutos && !enderecoCompletoValido) {
                              toast.error('Preencha todo o endereço de entrega antes de prosseguir.');
                              return;
                            }
                            setEtapaCheckout(2);
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#17345f] px-8 py-3.5 text-xs font-black text-white shadow-md shadow-[#17345f]/20 transition-all hover:bg-[#102746] cursor-pointer"
                        >
                          <span>Avançar para Benefícios & Pagamento</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* ETAPA 2: RESGATE DE PONTOS, SALDO DA CARTEIRA & FORMA DE PAGAMENTO */}
                  {/* ========================================================= */}
                  {etapaCheckout === 2 && (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm space-y-6 animate-in fade-in duration-300">
                      
                      {/* Seção de Fidelidade e Carteira */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                              <Gift className="h-5 w-5" />
                            </div>
                            <div>
                              <h2 className="text-base font-black text-neutral-900 uppercase tracking-wide">
                                Resgate de Pontos & Saldo da Carteira
                              </h2>
                              <p className="text-xs text-neutral-500 font-medium">
                                Abata o valor do pedido com seus pontos VIP ou saldo em conta
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Box de Pontos VIP */}
                          <div className="rounded-2xl border border-purple-800/40 bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-900 p-5 text-white shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="rounded-xl bg-amber-400 p-2 text-purple-950 shadow-xs">
                                  <Coins className="h-4 w-4" />
                                </div>
                                <div>
                                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Resgatar Pontos VIP</h3>
                                  <p className="text-[10px] text-purple-200 font-medium">100 pts = R$ 1,00</p>
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
                                <div className="h-6 w-11 rounded-full bg-purple-950 peer-checked:bg-amber-400 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-purple-950 border border-purple-400/40"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-2 border-t border-purple-800/50">
                              <span className="text-purple-200/80">Saldo Disponível:</span>
                              <span className="font-black text-amber-300">
                                👑 {saldoPontos.toLocaleString()} pts ({formatCurrency(saldoPontos / 100)})
                              </span>
                            </div>

                            {usarPontos && (
                              <div className="space-y-2.5 pt-2">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    value={pontosAplicados || ''} 
                                    min="0"
                                    max={maxPontosValidos}
                                    onChange={e => handlePontosChange(parseInt(e.target.value) || 0)}
                                    className="flex-1 rounded-xl border border-purple-400/40 bg-white px-3.5 py-2 text-xs font-black text-neutral-900 focus:outline-none" 
                                    placeholder="Ex: 500"
                                  />
                                  <span className="text-xs font-black text-amber-300 shrink-0">
                                    - {formatCurrency(descontoPontos)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {saldoPontos >= 100 && maxPontosValidos >= 100 && (
                                    <button type="button" onClick={() => handlePontosChange(100)} className="rounded-lg bg-purple-900/80 px-2.5 py-1 text-[10px] font-black text-amber-200 cursor-pointer hover:bg-purple-800">100 pts</button>
                                  )}
                                  {saldoPontos >= 500 && maxPontosValidos >= 500 && (
                                    <button type="button" onClick={() => handlePontosChange(500)} className="rounded-lg bg-purple-900/80 px-2.5 py-1 text-[10px] font-black text-amber-200 cursor-pointer hover:bg-purple-800">500 pts</button>
                                  )}
                                  <button type="button" onClick={() => handlePontosChange(maxPontosValidos)} className="ml-auto rounded-lg bg-amber-400 px-3 py-1 text-[10px] font-black text-purple-950 cursor-pointer hover:bg-amber-300">Máximo ({maxPontosValidos.toLocaleString()} pts)</button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Box de Saldo da Carteira Virtual */}
                          <div className="rounded-2xl border border-emerald-700/50 bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-900 p-5 text-white shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="rounded-xl bg-emerald-400 p-2 text-emerald-950 shadow-xs">
                                  <Wallet className="h-4 w-4" />
                                </div>
                                <div>
                                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Usar Saldo da Carteira</h3>
                                  <p className="text-[10px] text-emerald-200 font-medium">Abata o valor do seu saldo</p>
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
                                <div className="h-6 w-11 rounded-full bg-emerald-950 peer-checked:bg-emerald-400 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-emerald-950 border border-emerald-300/40"></div>
                              </label>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-2 border-t border-emerald-800/60">
                              <span className="text-emerald-200/80">Saldo Disponível:</span>
                              <span className="font-black text-emerald-300">{formatCurrency(saldoCarteira)}</span>
                            </div>

                            {usarSaldoCarteira && (
                              <div className="space-y-2.5 pt-2">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    value={saldoCarteiraAplicado ? Number(saldoCarteiraAplicado.toFixed(2)) : ''} 
                                    min="0"
                                    max={maxSaldoValido}
                                    step="0.01"
                                    onChange={e => handleSaldoCarteiraChange(parseFloat(e.target.value) || 0)}
                                    className="flex-1 rounded-xl border border-emerald-400/40 bg-white px-3.5 py-2 text-xs font-black text-neutral-900 focus:outline-none" 
                                    placeholder="Ex: 50.00"
                                  />
                                  <span className="text-xs font-black text-emerald-300 shrink-0">
                                    - {formatCurrency(descontoCarteira)}
                                  </span>
                                </div>
                                <button type="button" onClick={() => handleSaldoCarteiraChange(maxSaldoValido)} className="block ml-auto rounded-lg bg-emerald-400 px-3 py-1 text-[10px] font-black text-emerald-950 cursor-pointer hover:bg-emerald-300">Usar Máximo ({formatCurrency(maxSaldoValido)})</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Seção de Escolha de Forma de Pagamento */}
                      <div className="space-y-4 pt-4 border-t border-neutral-100">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <CreditCard className="h-5 w-5 text-emerald-600" />
                            <div>
                              <h3 className="text-sm font-black text-neutral-900 uppercase tracking-wide">
                                Escolha a Forma de Pagamento
                              </h3>
                              <p className="text-[11px] text-neutral-500 font-medium">
                                Selecione como deseja realizar o pagamento deste pedido
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* PIX */}
                          {checkoutMetodoPixAtivo && (
                            <div 
                              onClick={handleSelectPix}
                              className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                formaPagamento === 'pix' 
                                  ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/10' 
                                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                              }`}
                            >
                              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                formaPagamento === 'pix' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 bg-white'
                              }`}>
                                {formaPagamento === 'pix' && <div className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-neutral-900 uppercase">PIX Instantâneo</span>
                                  {lojaPixDescontoAtivo && isPixDiscountEligible ? (
                                    <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                                      -{pixPercentage}% OFF
                                    </span>
                                  ) : lojaPixDescontoAtivo && (pixDiscountBlockedByPoints || pixDiscountBlockedByWallet) ? (
                                    <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-bold" title="Desconto de 5% no PIX não aplicável devido ao uso de saldo/pontos">
                                      Sem desc. (Saldo/Pontos)
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
                                  {isPixDiscountEligible 
                                    ? `Aprovação imediata e desconto de ${pixPercentage}% no PIX.`
                                    : (pixDiscountBlockedByPoints || pixDiscountBlockedByWallet)
                                    ? `Aprovação imediata via PIX (desconto de ${pixPercentage}% anulado pelo uso de saldo/pontos).`
                                    : 'Aprovação imediata do pedido via PIX.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Cartão de Crédito */}
                          {checkoutMetodoCartaoAtivo && (
                            <div 
                              onClick={() => setFormaPagamento('cartao')}
                              className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                formaPagamento === 'cartao' 
                                  ? 'border-[#17345f] bg-blue-50/30 shadow-xs ring-2 ring-[#17345f]/10' 
                                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                              }`}
                            >
                              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                formaPagamento === 'cartao' ? 'border-[#17345f] bg-[#17345f] text-white' : 'border-neutral-300 bg-white'
                              }`}>
                                {formaPagamento === 'cartao' && <div className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1 space-y-1">
                                <span className="text-xs font-black text-neutral-900 uppercase block">Cartão de Crédito</span>
                                <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
                                  Valor cheio sem desconto, parcele em até 12x.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Boleto Bancário */}
                          {checkoutMetodoBoletoAtivo && (
                            <div 
                              onClick={() => setFormaPagamento('boleto')}
                              className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                formaPagamento === 'boleto' 
                                  ? 'border-[#17345f] bg-blue-50/30 shadow-xs ring-2 ring-[#17345f]/10' 
                                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                              }`}
                            >
                              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                formaPagamento === 'boleto' ? 'border-[#17345f] bg-[#17345f] text-white' : 'border-neutral-300 bg-white'
                              }`}>
                                {formaPagamento === 'boleto' && <div className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1 space-y-1">
                                <span className="text-xs font-black text-neutral-900 uppercase block">Boleto Bancário</span>
                                <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
                                  Valor integral à vista com compensação bancária.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Crédito GSA Store */}
                          {solicitacaoAtivaId && limiteCreditoDisponivel > 0 && (
                            <div 
                              onClick={() => setFormaPagamento('credito_loja')}
                              className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                formaPagamento === 'credito_loja' 
                                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-600/10' 
                                  : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
                              }`}
                            >
                              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                formaPagamento === 'credito_loja' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-neutral-300 bg-white'
                              }`}>
                                {formaPagamento === 'credito_loja' && <div className="h-2 w-2 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="text-xs font-black text-indigo-950 uppercase">Crédito GSA Store</span>
                                  <span className="text-[11px] font-black text-indigo-700">Disp: {formatCurrency(limiteCreditoDisponivel)}</span>
                                </div>
                                <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
                                  Compre agora e pague parcelado com seu limite pré-aprovado.
                                </p>

                                {formaPagamento === 'credito_loja' && opcaoPagamentoParcelado && (
                                  <div className="pt-2 border-t border-indigo-200/60 flex flex-col gap-1.5">
                                    <label className="text-[11px] font-bold text-neutral-700">Parcelamento:</label>
                                    <select
                                      value={numParcelas}
                                      onChange={e => setNumParcelas(parseInt(e.target.value) || 1)}
                                      className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none"
                                    >
                                      {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(p => (
                                        <option key={p} value={p}>
                                          {p}x de {formatCurrency(totalHojeFinal / p)} ({calcularTaxaJuros(p)}% juros)
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Navegação da Etapa 2 */}
                      <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => setEtapaCheckout(1)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-xs font-black text-neutral-700 shadow-2xs hover:bg-neutral-50 cursor-pointer"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>Voltar para Endereço & Cupons</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEtapaCheckout(3)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-[#17345f] px-8 py-3.5 text-xs font-black text-white shadow-md shadow-[#17345f]/20 transition-all hover:bg-[#102746] cursor-pointer"
                        >
                          <span>Avançar para Resumo do Pedido</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna da Direita: Preview Rápido nas Etapas 1 e 2 */}
                <div className="lg:col-span-5">
                  <div className="sticky top-24 rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-[#17345f]" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                          Prévia do Pedido
                        </h3>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-bold text-neutral-600">
                        {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    {/* Itens compactos */}
                    <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 divide-y divide-neutral-100 text-xs">
                      {cartItems.map((item) => {
                        const isProduct = item.tipo === 'produto';
                        const regularPrice = item.item_detalhes?.valor || 0;
                        const basePrice = isProduct ? (getProductQuantityPriceBreakdown(item.item_detalhes, item.quantidade).subtotalFinal / item.quantidade) : regularPrice;
                        const itemSubtotalBase = basePrice * item.quantidade;
                        const itemPixDiscount = (isPixDiscountEligible && isProduct && checkPixDiscountApplies(item.item_detalhes, pixSettings)) 
                          ? Number((itemSubtotalBase * (pixPercentage / 100)).toFixed(2)) 
                          : 0;
                        const itemFinalPrice = Number(Math.max(0, itemSubtotalBase - itemPixDiscount).toFixed(2));
                        const itemPontos = Math.floor(itemFinalPrice);

                        return (
                          <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                            <div className="truncate flex-1 min-w-0">
                              <span className="font-bold text-neutral-900 truncate block">{item.item_detalhes?.nome || 'Item'}</span>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-medium">
                                <span>{item.quantidade}x</span>
                                <span className="text-amber-700 font-bold">👑 +{itemPontos} pts</span>
                                {isPixDiscountEligible && itemPixDiscount > 0 && (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">-{pixPercentage}% PIX</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {isPixDiscountEligible && itemPixDiscount > 0 && (
                                <span className="text-[10px] font-semibold text-neutral-400 line-through block">
                                  {formatCurrency(itemSubtotalBase)}
                                </span>
                              )}
                              <span className={`font-black ${isPixDiscountEligible && itemPixDiscount > 0 ? 'text-emerald-700' : 'text-neutral-900'}`}>
                                {formatCurrency(itemFinalPrice)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Discriminação Completa de Lançamentos na Prévia */}
                    <div className="border-t border-neutral-200/80 pt-3 space-y-2 text-xs font-medium text-neutral-600">
                      <div className="flex justify-between">
                        <span>Subtotal dos itens</span>
                        <span className="font-bold text-neutral-900">{formatCurrency(subtotalInicial)}</span>
                      </div>

                      {descontoPromocoes > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Descontos promocionais</span>
                          <span>- {formatCurrency(descontoPromocoes)}</span>
                        </div>
                      )}

                      {descontoPontos > 0 && (
                        <div className="flex justify-between text-amber-700 font-bold">
                          <span>Pontos VIP ({pontosAplicados.toLocaleString()} pts)</span>
                          <span>- {formatCurrency(descontoPontos)}</span>
                        </div>
                      )}

                      {descontoCalculado > 0 && (
                        <div className="flex justify-between text-blue-600 font-bold">
                          <span>Cupom ({cupomDesconto?.codigo_cupom})</span>
                          <span>- {formatCurrency(descontoCalculado)}</span>
                        </div>
                      )}

                      {descontoCarteira > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Saldo da Carteira</span>
                          <span>- {formatCurrency(descontoCarteira)}</span>
                        </div>
                      )}

                      {temProdutos && (
                        <div className="flex justify-between">
                          <span>Frete / Entrega</span>
                          <span className={`font-bold ${taxaEntregaFinal === 0 ? 'text-emerald-700 uppercase tracking-wider' : 'text-neutral-900'}`}>
                            {taxaEntregaFinal === 0 ? 'Frete Grátis' : formatCurrency(taxaEntregaFinal)}
                          </span>
                        </div>
                      )}

                      {isPix && pixDiscountValue > 0 && (
                        <div className="flex items-center justify-between text-emerald-700 font-black bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/60">
                          <span className="flex items-center gap-1">
                            <QrCode className="h-3.5 w-3.5" /> Desconto {pixPercentage}% PIX:
                          </span>
                          <span>- {formatCurrency(pixDiscountValue)}</span>
                        </div>
                      )}

                      {formaPagamento === 'credito_loja' && valorJurosCredito > 0 && (
                        <div className="flex justify-between text-indigo-700 font-bold">
                          <span>Juros Crédito GSA ({taxaJurosAplicada}%)</span>
                          <span>+ {formatCurrency(valorJurosCredito)}</span>
                        </div>
                      )}

                      <div className="border-t border-neutral-200 pt-2.5 flex items-baseline justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-800">Total Previsto:</span>
                        <span className="text-xl font-black text-[#17345f]">{formatCurrency(totalHojeFinal)}</span>
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 p-2.5 text-center text-xs font-black text-amber-800 border border-amber-200/80 flex items-center justify-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-600" />
                      <span>Ganhe +{totalPontosGanhos} pontos VIP nesta compra</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* ETAPA 3: RESUMO COMPLETO DO PEDIDO (AMPLO E DETALHADO) */
              /* ========================================================= */
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Cards de Confirmação Rápida (Grid de 3 Colunas) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1: Endereço de Entrega */}
                  <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#17345f] flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-blue-600" /> Entrega
                        </span>
                        <button 
                          onClick={() => setEtapaCheckout(1)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                      {temProdutos ? (
                        <div className="text-xs text-neutral-700 font-medium leading-relaxed">
                          <p className="font-bold text-neutral-900">{endereco.logradouro}, {endereco.numero}</p>
                          <p>{endereco.bairro} — {endereco.cidade}/{endereco.uf}</p>
                          <p className="text-[10px] text-neutral-500 font-mono">CEP: {endereco.cep}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500 font-medium">Serviços / Assinaturas digitais sem entrega física.</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                      <Truck className="h-3.5 w-3.5" />
                      <span>{taxaEntregaFinal === 0 ? 'Frete Grátis' : `Frete: ${formatCurrency(taxaEntregaFinal)}`}</span>
                    </div>
                  </div>

                  {/* Card 2: Forma de Pagamento */}
                  <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#17345f] flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-emerald-600" /> Pagamento
                        </span>
                        <button 
                          onClick={() => setEtapaCheckout(2)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                      <div className="text-xs text-neutral-700 font-medium">
                        {formaPagamento === 'pix' && (
                          <p className="font-black text-emerald-700 flex items-center gap-1.5">
                            <QrCode className="h-4 w-4" />
                            <span>PIX Instantâneo {isPixDiscountEligible ? `(-${pixPercentage}% OFF)` : (pixDiscountBlockedByPoints || pixDiscountBlockedByWallet) ? '(Sem desc. por uso de saldo/pontos)' : ''}</span>
                          </p>
                        )}
                        {formaPagamento === 'cartao' && <p className="font-bold text-neutral-900">Cartão de Crédito (Valor Cheio)</p>}
                        {formaPagamento === 'boleto' && <p className="font-bold text-neutral-900">Boleto Bancário (Valor Cheio)</p>}
                        {formaPagamento === 'credito_loja' && (
                          <p className="font-bold text-indigo-900">
                            Crédito GSA Store ({numParcelas}x de {formatCurrency(totalHojeFinal / numParcelas)})
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Processamento criptografado</span>
                    </div>
                  </div>

                  {/* Card 3: Benefícios Aplicados */}
                  <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#17345f] flex items-center gap-1.5">
                          <Tag className="h-4 w-4 text-amber-600" /> Benefícios
                        </span>
                        <button 
                          onClick={() => setEtapaCheckout(2)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" /> Editar
                        </button>
                      </div>
                      <div className="text-xs text-neutral-700 font-medium space-y-0.5">
                        {cupomDesconto && <p className="text-blue-700 font-bold">Cupom: {cupomDesconto.codigo_cupom}</p>}
                        {usarPontos && <p className="text-amber-700 font-bold">Pontos: {pontosAplicados.toLocaleString()} pts (-{formatCurrency(descontoPontos)})</p>}
                        {usarSaldoCarteira && <p className="text-emerald-700 font-bold">Carteira: -{formatCurrency(descontoCarteira)}</p>}
                        {!cupomDesconto && !usarPontos && !usarSaldoCarteira && (
                          <p className="text-neutral-400">Nenhum benefício adicional aplicado.</p>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutral-100 text-[11px] font-black text-amber-800 flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5 text-amber-600" />
                      <span>+{totalPontosGanhos} pts a ganhar</span>
                    </div>
                  </div>
                </div>

                {/* Tabela de Itens e Discriminação Financeira Completa */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm space-y-6">
                  
                  {/* Cabeçalho da Lista */}
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17345f]/10 text-[#17345f]">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-neutral-900 uppercase tracking-wide">
                          Itens do Pedido
                        </h2>
                        <p className="text-xs text-neutral-500 font-medium">
                          {cartItems.length} {cartItems.length === 1 ? 'item selecionado' : 'itens selecionados'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lista Completa dos Itens com Desconto PIX e Pontos por Item */}
                  <div className="divide-y divide-neutral-100">
                    {cartItems.map((item) => {
                      const isProduct = item.tipo === 'produto';
                      const displayCode = isProduct ? getProductDisplayCode(item.item_detalhes as any) : null;
                      const hasDiscount = isProduct && hasActiveProductDiscount(item.item_detalhes);
                      const regularPrice = item.item_detalhes?.valor || 0;
                      const basePrice = isProduct ? (getProductQuantityPriceBreakdown(item.item_detalhes, item.quantidade).subtotalFinal / item.quantidade) : regularPrice;
                      const itemSubtotalBase = basePrice * item.quantidade;

                      // Se PIX estiver ativo e elegível, aplica desconto no item
                      const itemPixDiscount = (isPixDiscountEligible && isProduct && checkPixDiscountApplies(item.item_detalhes, pixSettings)) 
                        ? Number((itemSubtotalBase * (pixPercentage / 100)).toFixed(2)) 
                        : 0;
                      const itemFinalPrice = Number(Math.max(0, itemSubtotalBase - itemPixDiscount).toFixed(2));
                      const itemPontos = Math.floor(itemFinalPrice);

                      return (
                        <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            {item.item_detalhes?.imagem_url ? (
                              <img 
                                src={item.item_detalhes.imagem_url} 
                                alt={item.item_detalhes.nome} 
                                className="h-16 w-16 rounded-2xl object-cover border border-neutral-200 shrink-0" 
                              />
                            ) : (
                              <div className="h-16 w-16 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0 text-neutral-400">
                                <Package className="h-8 w-8" />
                              </div>
                            )}

                            <div className="space-y-1.5 min-w-0">
                              <h4 className="text-sm font-black text-neutral-900 truncate">
                                {item.item_detalhes?.nome || 'Item do Catálogo'}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2.5 text-xs text-neutral-500 font-medium">
                                {displayCode && <span className="font-mono bg-neutral-100 px-2 py-0.5 rounded text-[11px] font-bold">{displayCode}</span>}
                                <span>Quantidade: <strong className="text-neutral-800">{item.quantidade}x</strong></span>
                                {item.prazo_meses && <span>({item.prazo_meses} meses)</span>}
                                
                                {/* Badge de Pontos VIP do Item */}
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/70">
                                  <Coins className="h-3 w-3 text-amber-600" />
                                  +{itemPontos} pts
                                </span>

                                {/* Badge de Desconto PIX se for PIX */}
                                {isPixDiscountEligible && itemPixDiscount > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                    <QrCode className="h-3 w-3" />
                                    -{pixPercentage}% no PIX
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right sm:shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center">
                            {isPixDiscountEligible && itemPixDiscount > 0 ? (
                              <>
                                {/* Preço Cheio Riscado no PIX */}
                                <span className="text-xs font-semibold text-neutral-400 line-through block">
                                  {formatCurrency(itemSubtotalBase)}
                                </span>
                                {/* Preço com Desconto no PIX */}
                                <span className="text-base font-black text-emerald-700">
                                  {formatCurrency(itemFinalPrice)}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600">
                                  Economia de {formatCurrency(itemPixDiscount)}
                                </span>
                              </>
                            ) : (
                              <>
                                {/* Se não for PIX com desconto (Cartão, Boleto, ou PIX sem desconto): Exibe o valor cheio */}
                                {hasDiscount && regularPrice * item.quantidade > itemSubtotalBase && (
                                  <span className="text-xs font-semibold text-neutral-400 line-through block">
                                    {formatCurrency(regularPrice * item.quantidade)}
                                  </span>
                                )}
                                <span className="text-base font-black text-neutral-900">
                                  {formatCurrency(itemSubtotalBase)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fechamento de Valores Completo */}
                  <div className="border-t border-neutral-200/90 pt-6 space-y-3 max-w-md ml-auto text-xs font-medium text-neutral-600">
                    <div className="flex justify-between">
                      <span>Subtotal dos itens</span>
                      <span className="font-bold text-neutral-900">{formatCurrency(subtotalInicial)}</span>
                    </div>

                    {descontoPromocoes > 0 && (
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Descontos promocionais</span>
                        <span>- {formatCurrency(descontoPromocoes)}</span>
                      </div>
                    )}

                    {descontoPontos > 0 && (
                      <div className="flex justify-between text-amber-700 font-bold">
                        <span>Resgate de Pontos VIP ({pontosAplicados.toLocaleString()} pts)</span>
                        <span>- {formatCurrency(descontoPontos)}</span>
                      </div>
                    )}

                    {descontoCalculado > 0 && (
                      <div className="flex justify-between text-blue-600 font-bold">
                        <span>Cupom de Desconto ({cupomDesconto?.codigo_cupom})</span>
                        <span>- {formatCurrency(descontoCalculado)}</span>
                      </div>
                    )}

                    {descontoCarteira > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Saldo da Carteira</span>
                        <span>- {formatCurrency(descontoCarteira)}</span>
                      </div>
                    )}

                    {temProdutos && (
                      <div className="flex justify-between">
                        <span>Taxa de Entrega / Frete</span>
                        <span className={`font-bold ${taxaEntregaFinal === 0 ? 'text-emerald-700 uppercase tracking-wider' : 'text-neutral-900'}`}>
                          {taxaEntregaFinal === 0 ? 'Frete Grátis' : formatCurrency(taxaEntregaFinal)}
                        </span>
                      </div>
                    )}

                    {/* Desconto Total no PIX (Apenas quando a forma de pagamento for PIX com desconto elegível) */}
                    {isPixDiscountEligible && pixDiscountValue > 0 && (
                      <div className="flex justify-between items-center text-emerald-700 font-black bg-emerald-50/90 border border-emerald-200/80 px-3.5 py-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-emerald-600" />
                          <span>Desconto Total no PIX ({pixPercentage}%)</span>
                        </div>
                        <span className="text-sm font-black">- {formatCurrency(pixDiscountValue)}</span>
                      </div>
                    )}

                    {/* Juros de Crédito GSA se for Crédito GSA Parcelado */}
                    {formaPagamento === 'credito_loja' && valorJurosCredito > 0 && (
                      <div className="flex justify-between text-indigo-700 font-bold">
                        <span>Juros Crédito GSA ({taxaJurosAplicada}%)</span>
                        <span>+ {formatCurrency(valorJurosCredito)}</span>
                      </div>
                    )}

                    {/* Total Geral Dinâmico */}
                    <div className="border-t border-neutral-200 pt-4 flex items-baseline justify-between">
                      <div>
                        <span className="text-base font-black text-neutral-900 block">Total Final a Pagar</span>
                        <span className="text-xs text-neutral-500 font-medium">
                          {isPix ? (isPixDiscountEligible ? `No PIX com ${pixPercentage}% de desconto` : 'No PIX (sem desconto por uso de saldo/pontos)') : formaPagamento === 'cartao' ? 'No Cartão de Crédito (Valor Cheio)' : 'À vista ou parcelado'}
                        </span>
                      </div>
                      <span className="text-3xl font-black text-[#17345f] tracking-tight">
                        {formatCurrency(totalHojeFinal)}
                      </span>
                    </div>
                  </div>

                  {/* Rodapé de Ação Final */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setEtapaCheckout(2)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-6 py-4 text-xs font-black text-neutral-700 shadow-2xs hover:bg-neutral-50 cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Voltar para Benefícios & Pagamento</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalizar}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto flex-1 sm:max-w-md inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17345f] px-8 py-4 text-sm font-black text-white shadow-xl shadow-[#17345f]/25 transition-all hover:bg-[#102746] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Processando Pedido...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          <span>Confirmar & Finalizar Pedido</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pop-up Modal Informativo de Exclusividade do Desconto PIX */}
      {modalAlertaPix && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-neutral-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 border border-amber-500/30">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-neutral-900 leading-snug">
                  {modalAlertaPix.tipo === 'troca_pix'
                    ? `Aplicar Desconto de ${pixPercentage}% no PIX`
                    : `Desconto Exclusivo no PIX (${pixPercentage}%)`
                  }
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {modalAlertaPix.tipo === 'troca_pix'
                    ? `Aplicar o desconto de ${pixPercentage}% no PIX desativará os resgates de saldo e pontos de fidelidade, pois o desconto é exclusivo para pagamento 100% no PIX. Deseja desativar os resgates para aplicar o desconto de ${pixPercentage}%?`
                    : modalAlertaPix.tipo === 'carteira'
                    ? `O desconto de ${pixPercentage}% no PIX é exclusivo para pagamento integral via PIX. Ao aplicar o saldo da sua carteira, o desconto de ${pixPercentage}% no PIX será anulado (mas você ainda poderá pagar o valor restante via PIX normalmente).`
                    : `O desconto de ${pixPercentage}% no PIX é exclusivo para pagamento integral via PIX. Ao resgatar pontos VIP para desconto, o desconto de ${pixPercentage}% no PIX será anulado (mas você ainda poderá pagar o valor restante via PIX normalmente).`
                  }
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50/60 p-3.5 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
              {modalAlertaPix.tipo === 'troca_pix' ? (
                <>
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-neutral-500">Opção 1:</span>
                    <span className="text-emerald-700 font-extrabold">Aplicar {pixPercentage}% PIX (Desativa resgates)</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-neutral-500">Opção 2:</span>
                    <span className="text-neutral-700 font-extrabold">Manter resgates (Sem desc. PIX)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-neutral-500">Opção 1:</span>
                    <span className="text-emerald-700 font-extrabold">Manter {pixPercentage}% de Desconto no PIX</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-neutral-500">Opção 2:</span>
                    <span className="text-purple-700 font-extrabold">
                      {modalAlertaPix.tipo === 'carteira' ? 'Resgatar Saldo da Carteira (Anula Desc. PIX)' : 'Resgatar Pontos VIP (Anula Desc. PIX)'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {modalAlertaPix.tipo === 'troca_pix' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setFormaPagamento('pix');
                      setModalAlertaPix(null);
                      toast(`Forma de pagamento alterada para PIX (mantendo resgates).`);
                    }}
                    className="w-full rounded-xl border border-neutral-300 bg-white py-3 px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all cursor-pointer text-center"
                  >
                    Manter resgates
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormaPagamento('pix');
                      setUsarPontos(false);
                      setPontosAplicados(0);
                      setUsarSaldoCarteira(false);
                      setSaldoCarteiraAplicado(0);
                      setModalAlertaPix(null);
                      toast.success(`Desconto de ${pixPercentage}% no PIX aplicado! Resgates desativados.`);
                    }}
                    className="w-full rounded-xl bg-emerald-600 py-3 px-3 text-xs font-black text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all cursor-pointer text-center"
                  >
                    Aplicar desconto de {pixPercentage}%
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setModalAlertaPix(null);
                      toast(`Desconto de ${pixPercentage}% no PIX mantido.`);
                    }}
                    className="w-full rounded-xl border border-neutral-300 bg-white py-3 px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition-all cursor-pointer text-center"
                  >
                    Continuar com desconto
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const tipo = modalAlertaPix.tipo;
                      const pending = modalAlertaPix.pendingValue;
                      setModalAlertaPix(null);
                      if (tipo === 'carteira') {
                        setUsarSaldoCarteira(true);
                        setSaldoCarteiraAplicado(pending ?? maxSaldoValido);
                        toast.success('Saldo da carteira aplicado. Desconto do PIX anulado.');
                      } else {
                        setUsarPontos(true);
                        setPontosAplicados(pending ?? maxPontosValidos);
                        toast.success('Pontos VIP aplicados. Desconto do PIX anulado.');
                      }
                    }}
                    className="w-full rounded-xl bg-indigo-600 py-3 px-3 text-xs font-black text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer text-center"
                  >
                    {modalAlertaPix.tipo === 'carteira' ? 'Resgatar saldo' : 'Resgatar pontos'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Cupons Ativados */}
      <AvailableCouponsModal
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        coupons={availableCoupons}
        category={selectorCategory}
        subtotal={subtotalInicial}
        selectedCouponCode={selectorCategory === 'desconto' ? cupomDesconto?.codigo_cupom : cupomEntrega?.codigo_cupom}
        onSelect={(code) => {
          if (selectorCategory === 'desconto') {
            setCupomDescInput(code);
            aplicarCupom(code, 'desconto');
          } else {
            setCupomEntInput(code);
            aplicarCupom(code, 'entrega');
          }
          setIsSelectorOpen(false);
        }}
      />
    </div>
  );
}

export default CheckoutPage;
