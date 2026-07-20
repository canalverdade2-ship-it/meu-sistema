import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BarChart3, BriefcaseBusiness, Building2, ClipboardCheck, Copy, CreditCard, FileCheck, Headphones, Landmark, Layers3, Loader2, Lock, LogIn, Maximize, PackageCheck, Search, ShieldAlert, ShieldCheck, ShoppingBag, Sparkles, Store, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { maskCPF, maskCNPJ, maskPhone, formatCurrency, copyToClipboard } from '../lib/utils';
import { validarCPF, validarCNPJ, validarEmail } from '../utils/cpfValidator';
import { Modal } from '../components/ui/Modal';
import { logService } from '../lib/logService';
import { sessionService } from '../lib/sessionService';
import { LogoGSA } from '../components/ui/LogoGSA';
import { PinInput } from '../components/ui/PinInput';
import { consultarCEP } from '../utils/viaCep';
import { GSAEnterpriseHome } from '../components/public/GSAEnterpriseHome';

interface HomeProps {
  onLoginClient: (id: string, isRecovery?: boolean) => void;
  onLoginAdmin: (adminDetails: { type: 'admin' | 'colaborador', id?: string, modulos?: string[] }) => void;
  onLoginPrestador: (id: string) => void;
  onGuestStore?: () => void;
  initialPublicPage?: 'home' | 'services' | 'systems';
  onPublicPageChange?: (page: 'home' | 'services' | 'systems') => void;
  onLoginPage?: () => void;
  loginOnly?: boolean;
  onBackHome?: () => void;
}

export function Home({ onLoginClient, onLoginAdmin, onLoginPrestador, onGuestStore, initialPublicPage = 'home', onPublicPageChange, onLoginPage, loginOnly = false, onBackHome }: HomeProps) {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'gestao' | 'colaborador' | 'prestador'>('prestador');
  const [prestadorCode, setPrestadorCode] = useState('');
  const [isPrestadorRegisterOpen, setIsPrestadorRegisterOpen] = useState(false);
  const [prestadorData, setPrestadorData] = useState({
    tipo_cadastro: 'cpf' as 'cpf' | 'cnpj',
    nome_razao: '',
    nome_responsavel: '',
    documento: '',
    email: '',
    telefone: '',
    cep: '',
    numero: '',
    area_servico: '',
    observacoes: ''
  });
  const [documento, setDocumento] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj'>('pf');
  const [publicAudience, setPublicAudience] = useState<'PF' | 'PJ'>('PF');
  const [publicPage, setPublicPage] = useState<'home' | 'services' | 'systems'>(initialPublicPage);

  useEffect(() => {
    setPublicPage(initialPublicPage);
  }, [initialPublicPage]);

  const handlePublicPageChange = (page: 'home' | 'services' | 'systems') => {
    setPublicPage(page);
    onPublicPageChange?.(page);
  };


  // --- PIN Auth States (Cliente) ---
  const [clientLoginStep, setClientLoginStep] = useState<'documento' | 'pin' | 'create_pin' | 'blocked' | 'recovery'>('documento');
  const [clientRecoveryEmail, setClientRecoveryEmail] = useState('');
  const [clientPin, setClientPin] = useState('');
  const [clientPinConfirm, setClientPinConfirm] = useState('');
  const [clientFirstAccessPhone, setClientFirstAccessPhone] = useState('');
  const [clientPinError, setClientPinError] = useState(false);
  const [clientPinInfo, setClientPinInfo] = useState<{ id: string; nome: string; status: string } | null>(null);
  const [clientAttemptsLeft, setClientAttemptsLeft] = useState<number | null>(null);

  // --- PIN Auth States (Prestador) ---
  const [prestadorLoginStep, setPrestadorLoginStep] = useState<'documento' | 'pin' | 'create_pin' | 'blocked'>('documento');
  const [prestadorPin, setPrestadorPin] = useState('');
  const [prestadorPinConfirm, setPrestadorPinConfirm] = useState('');
  const [prestadorFirstAccessPhone, setPrestadorFirstAccessPhone] = useState('');
  const [prestadorPinError, setPrestadorPinError] = useState(false);
  const [prestadorPinInfo, setPrestadorPinInfo] = useState<{ id: string; nome: string; status: string } | null>(null);
  const [prestadorAttemptsLeft, setPrestadorAttemptsLeft] = useState<number | null>(null);

  useEffect(() => {
    setDocumento('');
  }, [tipoPessoa]);

  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'login' | 'voucher' | 'confirm' | 'register'>('login');
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherTab, setVoucherTab] = useState<'com-indicacao' | 'sem-indicacao'>('com-indicacao');
  const [defaultCodeSettings, setDefaultCodeSettings] = useState({
    ativo: false,
    codigo: '',
    tipo: 'pontos',
    valor: 0
  });
  const [registrationData, setRegistrationData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cep: '',
    numero: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    observacoes: '',
    data_cadastro: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchDefaultCodeSettings();

    const channel = supabase
      .channel('system-settings-updates-home')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings'
      }, () => {
        fetchDefaultCodeSettings();
      })
      .subscribe();

    // Check for revoked access message
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('msg') === 'revoked') {
      toast.error('Seu acesso foi encerrado pelo administrador. Entre em contato com o suporte para mais informações.', {
        duration: 10000,
        position: 'top-center',
        icon: <ShieldAlert className="h-5 w-5 text-red-600" />
      });
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const handleOpenLogin = () => {
      setOnboardingStep('login');
      setClientLoginStep('documento');
      setIsClientModalOpen(true);
    };
    window.addEventListener('open-client-login', handleOpenLogin);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('open-client-login', handleOpenLogin);
    };
  }, []);

  const fetchDefaultCodeSettings = async () => {
    const { data } = await supabase.from('system_settings').select('key, value');
    if (data) {
      const ativo = data.find(s => s.key === 'codigo_cadastro_padrao_ativo')?.value === 'true';
      const codigo = data.find(s => s.key === 'codigo_cadastro_padrao')?.value || 'BEMVINDO';
      const tipo = data.find(s => s.key === 'bonus_cadastro_tipo')?.value || 'pontos';
      const valor = parseFloat(data.find(s => s.key === 'bonus_cadastro_valor')?.value || '100');
      setDefaultCodeSettings({ ativo, codigo, tipo, valor });
    }
  };

  // Reset PIN states when closing modals
  const resetClientPinStates = () => {
    setClientLoginStep('documento');
    setClientPin('');
    setClientPinConfirm('');
    setClientFirstAccessPhone('');
    setClientPinError(false);
    setClientPinInfo(null);
    setClientAttemptsLeft(null);
  };

  const resetPrestadorPinStates = () => {
    setPrestadorLoginStep('documento');
    setPrestadorPin('');
    setPrestadorPinConfirm('');
    setPrestadorFirstAccessPhone('');
    setPrestadorPinError(false);
    setPrestadorPinInfo(null);
    setPrestadorAttemptsLeft(null);
  };

  // Step 1: Client enters CPF/CNPJ → check if document exists
  const handleClientDocumentCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanDoc = documento.replace(/\D/g, '');
      const client = await sessionService.lookupPortalAccount(cleanDoc, 'cliente');

      if (client?.exists) {
        if (client.status === 'inativo' && client.cadastro_aprovado !== false) {
          toast.error('Cliente inativo. Entre em contato com o suporte.');
          return;
        }

        if (client.blocked) {
          setClientPinInfo({ id: client.id, nome: client.nome, status: client.status });
          setClientLoginStep('blocked');
          return;
        }

        setClientPinInfo({ id: client.id, nome: client.nome, status: client.status });

        if (client.has_pin) {
          // Has PIN → go to PIN entry
          setClientLoginStep('pin');
        } else {
          // No PIN → go to PIN creation
          setClientLoginStep('create_pin');
        }
      } else {
        toast.error('Cliente não encontrado. Se for seu primeiro acesso, clique em "Meu Primeiro Acesso".');
      }
    } catch (err) {
      toast.error('Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2a: Client enters PIN → verify via RPC
  const handleClientPinVerify = async () => {
    if (clientPin.length !== 4) return;
    setLoading(true);
    setClientPinError(false);
    try {
      const cleanDoc = documento.replace(/\D/g, '');
      const data = await sessionService.loginWithPin(cleanDoc, clientPin, 'cliente');

      if (data.valid) {
        const clientId = data.id;
        const clientNome = data.nome;
        await logService.logAction({ ator_tipo: 'cliente', ator_id: clientId, ator_nome: clientNome, acao: 'LOGIN', detalhes: 'Acesso via portal principal' });
        toast.success('Login bem-sucedido.');
        onLoginClient(clientId);
      } else if (data.error === 'blocked') {
        setClientLoginStep('blocked');
      } else if (data.error === 'wrong_pin') {
        setClientPinError(true);
        setClientPin('');
        setClientAttemptsLeft(data.attempts_left);
        toast.error(`Senha incorreta. ${data.attempts_left} tentativa(s) restante(s).`);
      } else {
        toast.error(data.error || 'Credenciais inválidas.');
      }
    } catch (err) {
      toast.error('Erro ao verificar senha.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: Client creates PIN on first access
  const handleClientCreatePin = async () => {
    if (clientPin.length !== 4 || clientPinConfirm.length !== 4) {
      toast.error('Preencha todos os dígitos.');
      return;
    }
    if (clientPin !== clientPinConfirm) {
      setClientPinError(true);
      setClientPinConfirm('');
      toast.error('As senhas não coincidem. Tente novamente.');
      return;
    }
    if (clientFirstAccessPhone.replace(/\D/g, '').length < 10) {
      toast.error('Informe o telefone cadastrado com DDD para confirmar sua identidade.');
      return;
    }
    setLoading(true);
    try {
      const cleanDoc = documento.replace(/\D/g, '');
      const data = await sessionService.setPinAndLogin(
        cleanDoc,
        clientFirstAccessPhone.replace(/\D/g, ''),
        clientPin,
        'cliente',
      );

      if (data.success) {
        const clientId = data.id;
        const clientNome = data.nome || clientPinInfo?.nome || '';
        await logService.logAction({ ator_tipo: 'cliente', ator_id: clientId, ator_nome: clientNome, acao: 'LOGIN', detalhes: 'Primeiro acesso - Senha criada e acesso efetuado' });
        toast.success('Senha criada com sucesso! Bem-vindo(a).');
        onLoginClient(clientId);
      } else {
        toast.error(data.error || 'Erro ao cadastrar senha.');
      }
    } catch (err) {
      toast.error('Erro ao cadastrar senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateVoucher = async () => {
    if (!voucherInput) return toast.error('Informe o celular cadastrado na indicação.');

    if (voucherInput === 'BEMVINDO') {
      toast.success('Cadastro liberado!');
      setOnboardingStep('register');
      return;
    }

    setLoading(true);
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.rpc('gsa_public_lookup_referral', {
        p_token: voucherInput
      });

      if (error) throw error;
      
      if (!data?.valid) {
        toast.error(data?.error || 'Não foi possível validar a indicação.');
        return;
      }

      const fullIndicacao = {
        ...data,
        id: data.indicacao_id || null,
        isDefaultCode: data.kind === 'default'
      };
      setReferralInfo(fullIndicacao);
      setRegistrationData(prev => ({
        ...prev,
        nome: fullIndicacao.indicado_nome || '',
        telefone: fullIndicacao.whatsapp_indicado ? maskPhone(fullIndicacao.whatsapp_indicado) : ''
      }));
      setOnboardingStep(fullIndicacao.isDefaultCode ? 'register' : 'confirm');
    } catch (err: any) {
      console.error('Erro na validação:', err);
      toast.error(err?.message || 'Ocorreu um erro ao validar a indicação.');
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registrationData.telefone) {
      const cleanPhone = registrationData.telefone.replace(/\D/g, '');
      if (cleanPhone.length !== 11) {
        return toast.error('O telefone deve conter exatamente 11 números (DDD + 9 dígitos).');
      }
    }

    setLoading(true);
    try {
      const cleanDoc = documento.replace(/\D/g, '');
      const cleanCep = registrationData.cep.replace(/\D/g, '');
      if (tipoPessoa === 'pf' && !validarCPF(cleanDoc)) return toast.error('CPF inválido.');
      if (tipoPessoa === 'pj' && !validarCNPJ(cleanDoc)) return toast.error('CNPJ inválido.');

      const payload: Record<string, unknown> = {
        ...registrationData,
        telefone: registrationData.telefone.replace(/\D/g, ''),
        cep: cleanCep,
        tipo_pessoa: tipoPessoa,
        [tipoPessoa === 'pf' ? 'cpf' : 'cnpj']: cleanDoc
      };

      const { data, error } = await supabase.rpc('gsa_public_register_client', {
        p_referral_token: voucherInput,
        p_payload: payload
      });
      if (error) throw error;

      toast.success(
        data?.status === 'pendente'
          ? 'Cadastro enviado com sucesso! Aguarde a aprovação administrativa.'
          : 'Cadastro realizado com sucesso! Faça login agora.'
      );
      setOnboardingStep('login');
      setDocumento('');
      setVoucherInput('');
      setReferralInfo(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao realizar cadastro.', { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await sessionService.loginAdmin(adminCode);

      if (data && data.valid) {
        await logService.logAction({ ator_tipo: 'admin', acao: 'LOGIN', detalhes: 'Acesso Master' });
        toast.success('Acesso autorizado (Admin).');
        onLoginAdmin({ type: 'admin' });
      } else {
        toast.error(data?.error || 'Código de acesso master inválido.');
      }
    } catch (err) {
      toast.error('Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleColaboradorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await sessionService.loginColaborador(adminCode);

      if (result && result.valid) {
        await logService.logAction({ ator_tipo: 'colaborador', ator_id: result.id, ator_nome: result.nome, acao: 'LOGIN', detalhes: 'Acesso ao painel administrativo' });
        toast.success(`Bem-vindo, ${result.nome}.`);
        onLoginAdmin({ 
          type: 'colaborador', 
          id: result.id, 
          modulos: result.modulos || []
        });
      } else {
        toast.error(result?.error || 'Código de colaborador inválido ou usuário inativo.');
      }
    } catch (err) {
      toast.error('Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Prestador enters document → check if it exists
  const handlePrestadorDocumentCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDoc = prestadorCode.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      return toast.error('Informe um CPF ou CNPJ válido.');
    }
    setLoading(true);
    try {
      const data = await sessionService.lookupPortalAccount(cleanDoc, 'prestador');

      if (data?.exists) {
        if (['suspenso', 'desligado', 'reprovado'].includes(data.status)) {
          return toast.error('Este cadastro encontra-se bloqueado ou indisponível. Contate o suporte.');
        }

        if (data.blocked) {
          setPrestadorPinInfo({ id: data.id, nome: data.nome, status: data.status });
          setPrestadorLoginStep('blocked');
          return;
        }

        setPrestadorPinInfo({ id: data.id, nome: data.nome, status: data.status });

        if (data.has_pin) {
          setPrestadorLoginStep('pin');
        } else {
          setPrestadorLoginStep('create_pin');
        }
      } else {
        toast.error('Documento não encontrado ou cadastro inexistente.');
      }
    } catch (err) {
      toast.error('Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2a: Prestador enters PIN → verify via RPC
  const handlePrestadorPinVerify = async () => {
    if (prestadorPin.length !== 4) return;
    setLoading(true);
    setPrestadorPinError(false);
    try {
      const cleanDoc = prestadorCode.replace(/\D/g, '');
      const data = await sessionService.loginWithPin(cleanDoc, prestadorPin, 'prestador');

      if (data.valid) {
        const pId = data.id;
        const pNome = data.nome;

        await logService.logAction({ ator_tipo: 'prestador', ator_id: pId, ator_nome: pNome, acao: 'LOGIN', detalhes: 'Acesso ao portal do prestador via documento' });
        toast.success('Acesso autorizado.');
        onLoginPrestador(pId);
      } else if (data.error === 'blocked') {
        setPrestadorLoginStep('blocked');
      } else if (data.error === 'wrong_pin') {
        setPrestadorPinError(true);
        setPrestadorPin('');
        setPrestadorAttemptsLeft(data.attempts_left);
        toast.error(`Senha incorreta. ${data.attempts_left} tentativa(s) restante(s).`);
      } else {
        toast.error(data.error || 'Credenciais inválidas.');
      }
    } catch (err) {
      toast.error('Erro ao verificar senha.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: Prestador creates PIN on first access
  const handlePrestadorCreatePin = async () => {
    if (prestadorPin.length !== 4 || prestadorPinConfirm.length !== 4) {
      toast.error('Preencha todos os dígitos.');
      return;
    }
    if (prestadorPin !== prestadorPinConfirm) {
      setPrestadorPinError(true);
      setPrestadorPinConfirm('');
      toast.error('As senhas não coincidem. Tente novamente.');
      return;
    }
    if (prestadorFirstAccessPhone.replace(/\D/g, '').length < 10) {
      toast.error('Informe o telefone cadastrado com DDD para confirmar sua identidade.');
      return;
    }
    setLoading(true);
    try {
      const cleanDoc = prestadorCode.replace(/\D/g, '');
      const data = await sessionService.setPinAndLogin(
        cleanDoc,
        prestadorFirstAccessPhone.replace(/\D/g, ''),
        prestadorPin,
        'prestador',
      );

      if (data.success) {
        const pId = data.id;
        const pNome = data.nome || prestadorPinInfo?.nome || '';
        await logService.logAction({ ator_tipo: 'prestador', ator_id: pId, ator_nome: pNome, acao: 'LOGIN', detalhes: 'Primeiro acesso - Senha criada e acesso efetuado' });
        toast.success('Senha criada com sucesso! Bem-vindo(a).');
        onLoginPrestador(pId);
      } else {
        toast.error(data.error || 'Erro ao cadastrar senha.');
      }
    } catch (err) {
      toast.error('Erro ao cadastrar senha.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrestadorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanDoc = prestadorData.documento.replace(/\D/g, '');
      const cleanPhone = prestadorData.telefone.replace(/\D/g, '');
      const cleanCep = prestadorData.cep.replace(/\D/g, '');

      if (prestadorData.tipo_cadastro === 'cpf' && cleanDoc.length !== 11) {
        toast.error('CPF inválido.');
        setLoading(false);
        return;
      }
      if (prestadorData.tipo_cadastro === 'cnpj' && cleanDoc.length !== 14) {
        toast.error('CNPJ inválido.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.rpc('gsa_public_register_provider', {
        p_payload: {
          ...prestadorData,
          documento: cleanDoc,
          telefone: cleanPhone,
          cep: cleanCep
        }
      });
      if (error) throw error;

      toast.success('Pré-cadastro realizado com sucesso! Aguarde a análise.');
      setIsPrestadorRegisterOpen(false);
      setPrestadorData({
        tipo_cadastro: 'cpf',
        nome_razao: '',
        nome_responsavel: '',
        documento: '',
        email: '',
        telefone: '',
        cep: '',
        numero: '',
        area_servico: '',
        observacoes: ''
      });
    } catch (err: any) {
      console.error('Erro detalhado no pré-cadastro:', err);
      if (err && typeof err === 'object') {
        console.error('Mensagem:', err.message);
        console.error('Detalhes:', err.details);
        console.error('Dica:', err.hint);
        console.error('Código:', err.code);
      }
      toast.error(err?.message || 'Erro ao realizar pré-cadastro.', { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const publicServices = [
    { icon: BriefcaseBusiness, title: 'Servicos administrativos', text: 'Organizacao de demandas, contratos, documentos e rotinas para empresas e clientes.' },
    { icon: CreditCard, title: 'Credito e financeiro', text: 'Solucoes para acompanhar faturas, credito, pagamentos e solicitacoes em um so lugar.' },
    { icon: Headphones, title: 'Suporte e atendimento', text: 'Abertura de chamados, acompanhamento e historico para manter tudo rastreavel.' },
  ];

  const publicProducts = [
    { icon: ShoppingBag, title: 'Produtos GSA', text: 'Itens e ofertas disponiveis para consulta antes da compra.' },
    { icon: PackageCheck, title: 'Assinaturas', text: 'Planos recorrentes e beneficios para quem usa os servicos com frequencia.' },
    { icon: Sparkles, title: 'Promocoes', text: 'Campanhas e vantagens que podem ser ativadas na area do cliente.' },
  ];

  const enterprisePillars = [
    { icon: BriefcaseBusiness, title: 'Servicos especializados', text: 'Pacotes administrativos para pessoa fisica, MEI e empresas, organizados por necessidade real do cliente.' },
    { icon: ShoppingBag, title: 'Produtos e loja', text: 'Vitrine para ofertas, itens, campanhas e compras futuras em uma experiencia integrada.' },
    { icon: PackageCheck, title: 'Assinaturas e recorrencia', text: 'Planos continuos para clientes que precisam de acompanhamento, suporte e rotinas mensais.' },
    { icon: Headphones, title: 'Atendimento e suporte', text: 'Relacionamento consultivo, com abertura de solicitacoes e acompanhamento dentro da area logada.' },
  ];

  const trustMetrics = [
    ['360', 'hub de solucoes'],
    ['PF + PJ', 'atendimento completo'],
    ['24h', 'experiencia digital'],
    ['1 portal', 'historico centralizado'],
  ];

  const customerJourney = [
    { icon: Search, title: 'Descobrir', text: 'O cliente entende tudo que a GSA oferece sem precisar estar logado.' },
    { icon: ClipboardCheck, title: 'Escolher', text: 'Servicos, produtos e assinaturas ficam organizados por perfil e prioridade.' },
    { icon: ShieldCheck, title: 'Entrar', text: 'Quando decidir contratar, o cliente acessa a area segura com CPF/CNPJ e PIN.' },
    { icon: BarChart3, title: 'Acompanhar', text: 'Pedidos, faturas, suporte, beneficios e historico ficam dentro do portal.' },
  ];

  const audienceSummary = {
    PF: {
      label: 'Pessoa fisica',
      headline: 'Resolucao administrativa para a vida pessoal',
      text: 'Previdencia, MEI, DETRAN, direitos PcD, imposto de renda, contratos, CPF, FGTS e organizacao financeira em uma esteira profissional.',
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80'
    },
    PJ: {
      label: 'Empresas',
      headline: 'Operacao administrativa para empresas que querem escala',
      text: 'BPO financeiro, faturamento, cobranca, compras, controladoria, beneficios, comissoes, RDV e compliance fiscal em uma estrutura unica.',
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80'
    }
  };

  const servicePackages = [
    {
      audience: 'PF' as const,
      title: 'Pacote Futuro Garantido',
      subtitle: 'Solucoes previdenciarias e beneficios INSS',
      description: 'Planejamento previdenciario, aposentadorias, beneficios por incapacidade, BPC/LOAS, pensao por morte e recursos administrativos.',
      services: [
        { name: 'Planejamento Previdenciario', desc: 'Calculo de tempo de contribuicao, simulacao de valores e analise do melhor momento.' },
        { name: 'Aposentadorias', desc: 'Idade, Tempo de Contribuicao, Especial, Rural e Pessoa com Deficiencia.' },
        { name: 'Beneficios por Incapacidade', desc: 'Auxilio-doenca e Aposentadoria por Invalidez.' },
        { name: 'Beneficios Assistenciais e Pensao', desc: 'BPC/LOAS, Pensao por Morte e Salario Maternidade.' },
        { name: 'Assessoria Administrativa', desc: 'Recursos administrativos, revisao de beneficios e acertos de CNIS.' }
      ]
    },
    {
      audience: 'PF' as const,
      title: 'Pacote Microempreendedor',
      subtitle: 'Servicos para MEI',
      description: 'Gestao completa para o microempreendedor manter a empresa regularizada, emitir documentos e resolver pendencias.',
      services: [
        { name: 'Gestao do MEI', desc: 'Abertura, formalizacao e baixa do registro MEI.' },
        { name: 'Notas Fiscais', desc: 'Emissao de notas fiscais de produtos e servicos.' },
        { name: 'Regularizacao', desc: 'Regularizacao de pendencias, declaracoes anuais, parcelamento de dividas DAS e emissao de guias.' }
      ]
    },
    {
      audience: 'PF' as const,
      title: 'Pacote Direcao Livre',
      subtitle: 'Solucoes veiculares e CNH',
      description: 'Regularizacao documental para condutores e veiculos, incluindo licenciamento, transferencia, renovacao e defesa de infracoes.',
      services: [
        { name: 'Regularizacao de Veiculos', desc: 'Licenciamento, transferencia, primeiro emplacamento, baixa de gravame, alteracao de caracteristicas, segunda via de CRV e procuracoes.' },
        { name: 'Habilitacao CNH', desc: 'Renovacao simples ou EAR, inclusao de atividade remunerada, PID, CNH definitiva e alteracao de dados.' },
        { name: 'Defesa de Infracoes', desc: 'Indicacao de condutor, recurso de multas e defesa de suspensao ou cassacao da CNH.' }
      ]
    },
    {
      audience: 'PF' as const,
      title: 'Pacote Direitos PcD',
      subtitle: 'Assessoria administrativa e isencoes',
      description: 'Suporte para isencoes fiscais e direitos administrativos da pessoa com deficiencia.',
      services: [
        { name: 'Isencao de Impostos na Compra de Veiculos', desc: 'Processo completo para isencao de IPI e ICMS.' },
        { name: 'Isencao de IPVA', desc: 'Solicitacao administrativa junto a Secretaria da Fazenda Estadual.' },
        { name: 'Cartao Defis', desc: 'Autorizacao para estacionamento em vagas especiais.' },
        { name: 'Rodizio Municipal', desc: 'Solicitacao de isencao de rodizio para municipios onde se aplica.' }
      ]
    },
    {
      audience: 'PF' as const,
      title: 'Pacote Vida em Dia',
      subtitle: 'Regularizacao civil, contratos e financas',
      description: 'Organizacao financeira, contratos, imposto de renda, CPF, FGTS e calculos administrativos.',
      services: [
        { name: 'Imposto de Renda', desc: 'Declaracao anual e regularizacao de malha fina.' },
        { name: 'Regularizacao de CPF', desc: 'Resolucao de pendencias cadastrais e restricoes.' },
        { name: 'Consultoria Financeira', desc: 'Planejamento de dividas, organizacao orcamentaria e planejamento de aposentadoria privada.' },
        { name: 'Contratos e Calculos', desc: 'Elaboracao de contratos de aluguel, compra e venda e calculos trabalhistas.' },
        { name: 'Assistencia FGTS', desc: 'Assessoria para saques, aniversario, rescisao, calamidade e regularizacao cadastral.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Gestao Financeira Operacional',
      subtitle: 'BPO financeiro',
      description: 'Terceirizacao do financeiro da empresa com controle de contas a pagar, contas a receber e conciliacao bancaria.',
      services: [
        { name: 'Contas a Pagar', desc: 'Gestao completa de contas a pagar.' },
        { name: 'Contas a Receber', desc: 'Gestao completa de contas a receber.' },
        { name: 'Conciliacao Bancaria', desc: 'Conciliacao bancaria diaria ou semanal.' },
        { name: 'Agendamento', desc: 'Agendamento de pagamentos, folha e fornecedores no bankline.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Faturamento Inteligente',
      subtitle: 'Gestao fiscal e emissao',
      description: 'Agilidade na emissao de notas fiscais, boletos e envio automatico de documentos aos clientes.',
      services: [
        { name: 'Emissao de Notas Fiscais', desc: 'Emissao de notas fiscais de produtos e servicos.' },
        { name: 'Boletos Bancarios', desc: 'Geracao e envio de boletos bancarios.' },
        { name: 'Envio Automatico', desc: 'Envio automatico dos documentos fiscais para os clientes.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Recuperacao de Credito e Cobranca',
      subtitle: 'Gestao de inadimplencia',
      description: 'Cobranca preventiva, negociacao amigavel com inadimplentes e acompanhamento de protestos.',
      services: [
        { name: 'Cobranca Preventiva', desc: 'Lembretes antes do vencimento.' },
        { name: 'Cobranca Ativa', desc: 'Negociacao amigavel com inadimplentes, prazos e valores.' },
        { name: 'Gestao de Protesto', desc: 'Encaminhamento e acompanhamento de titulos em cartorio em ultima instancia.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Gestao Administrativa e Compras',
      subtitle: 'Facilities e compras',
      description: 'Cotacao de fornecedores, gestao de contratos e organizacao documental fisica e digital.',
      services: [
        { name: 'Cotacao de Fornecedores', desc: 'Mapa de cotacao com comparativo de precos e negociacao.' },
        { name: 'Gestao de Contratos', desc: 'Monitoramento de vigencia e renovacao de alugueis, seguros e softwares.' },
        { name: 'Organizacao Documental', desc: 'Arquivo digital e fisico estruturado.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Controladoria e Inteligencia de Negocios',
      subtitle: 'Estrategia de negocios',
      description: 'Relatorios gerenciais, fluxo de caixa, precificacao estrategica e analise de centro de custo.',
      services: [
        { name: 'Relatorios Gerenciais', desc: 'Apresentacao de lucro x prejuizo.' },
        { name: 'Gestao de Fluxo de Caixa', desc: 'Previsao financeira com realizado x projetado.' },
        { name: 'Precificacao Estrategica', desc: 'Analise de custos fixos e variaveis para definicao do preco de venda ideal.' },
        { name: 'Analise de Centro de Custo', desc: 'Mapeamento de onde a empresa gasta mais e onde pode economizar.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Gestao de Beneficios e Onboarding',
      subtitle: 'Suporte ao departamento pessoal',
      description: 'Gestao de beneficios, movimentacao de plano de saude e organizacao de documentos admissionais.',
      services: [
        { name: 'Gestao de Beneficios', desc: 'Compra mensal de VT, VR e VA.' },
        { name: 'Movimentacao de Plano de Saude', desc: 'Inclusoes, exclusoes, conferencia de faturas e coparticipacao.' },
        { name: 'Onboarding Administrativo', desc: 'Coleta e organizacao de documentos de admissao para envio a contabilidade.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Gestao de Comissoes de Vendas',
      subtitle: 'Inteligencia comercial',
      description: 'Apuracao de vendas, calculo de comissoes, metas, bonus e relatorios para diretoria e vendedores.',
      services: [
        { name: 'Apuracao de Vendas', desc: 'Cruzamento venda x faturamento x recebimento.' },
        { name: 'Calculo de Comissionamento', desc: 'Aplicacao de regras de bonus, metas e descontos.' },
        { name: 'Relatorios', desc: 'Extratos detalhados para a diretoria e espelhos de pagamento para vendedores.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Gestao de Reembolsos e Despesas',
      subtitle: 'RDV e cartao corporativo',
      description: 'Controle de reembolsos, despesas externas, cartao corporativo e analise por centro de custo.',
      services: [
        { name: 'Conferencia de RDV', desc: 'Validacao de notas e politicas de limites de reembolso.' },
        { name: 'Gestao de Cartao Corporativo', desc: 'Monitoramento de extratos para evitar uso pessoal indevido.' },
        { name: 'Analise por Centro de Custo', desc: 'Graficos comparativos de gastos mensais e previsoes.' }
      ]
    },
    {
      audience: 'PJ' as const,
      title: 'Compliance e Regularidade Fiscal',
      subtitle: 'Compliance fiscal',
      description: 'Monitoramento de certidoes, emissao e renovacao de CNDs e cadastro em fornecedores.',
      services: [
        { name: 'Monitoramento de CNDs', desc: 'Acompanhamento semanal de certidoes Federal, Estadual, Municipal, Trabalhista.' },
        { name: 'Emissao e Renovacao', desc: 'Acao preventiva para nao deixar certidoes vencerem.' },
        { name: 'Cadastro em Fornecedores', desc: 'Preenchimento de fichas cadastrais para abertura de credito em novos parceiros.' }
      ]
    },
  ];

  const filteredServicePackages = servicePackages.filter(pkg => pkg.audience === publicAudience);
  const loginCardVariants = {
    hidden: { opacity: 0, y: 18, scale: 0.96 },
    visible: (order: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 260,
        damping: 22,
        delay: 0.12 + order * 0.16,
      },
    }),
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,#fff7e6_0%,#f8f7f5_38%,#f2efe8_100%)]">
      {loginOnly ? (
        <main className="flex min-h-screen items-start justify-center px-4 py-5 sm:items-center sm:py-10">
          <div className="w-full max-w-5xl">
            <div className="mb-5 flex items-center justify-between gap-4 sm:mb-8">
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-black text-neutral-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600"
              >
                Voltar
              </button>
              <LogoGSA size="sm" variant="dark" className="sm:hidden" />
              <LogoGSA size="md" variant="dark" className="hidden sm:flex" />
            </div>

            <section className="overflow-hidden rounded-[1.5rem] border border-[#d8bd73]/35 bg-white shadow-[0_28px_70px_rgba(20,32,48,0.16)] sm:rounded-[2rem]">
              <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1722] via-[#142030] to-[#090d13] p-5 text-white sm:p-10">
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#a87c2b] via-[#fff4d0] to-[#c19a43]" />
                  <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[#edcf83]/10 blur-3xl" />
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#edcf83]">Acesso GSA</p>
                  <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Login</h1>
                  <p className="mt-2 max-w-sm text-sm font-medium leading-5 text-white/65">
                    Escolha seu tipo de acesso.
                  </p>
                  <div className="hidden">
                    {['Cliente', 'Prestador', 'Equipe', 'Gestão'].map(item => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                        <ShieldCheck className="h-4 w-4 text-indigo-300" />
                        <span className="font-bold">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#fbfaf7] p-4 sm:p-8">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#142030]/45">Selecione o portal</p>
                    <span className="h-px flex-1 bg-gradient-to-r from-[#d8bd73]/60 to-transparent" />
                  </div>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <motion.button
                      type="button"
                      onClick={() => {
                        setOnboardingStep('login');
                        setClientLoginStep('documento');
                        setIsClientModalOpen(true);
                      }}
                      custom={0}
                      variants={loginCardVariants}
                      whileTap={{ scale: 0.985 }}
                      className="group relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-[1.55rem] border border-[#d8bd73]/55 bg-white p-5 text-left shadow-[0_12px_30px_rgba(20,32,48,0.11)] ring-1 ring-white transition-all hover:-translate-y-0.5 hover:border-[#c19a43] hover:shadow-[0_20px_44px_rgba(20,32,48,0.16)] sm:block sm:min-h-[150px] sm:rounded-[1.65rem] sm:p-5"
                    >
                      <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#fff4d0] via-[#edcf83] to-[#a87c2b]" />
                      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#d8bd73]/70 to-transparent" />
                      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#edcf83]/18 blur-2xl transition-all group-hover:bg-[#edcf83]/26" />
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#142030] text-[#edcf83] shadow-[0_10px_22px_rgba(20,32,48,0.22)] ring-1 ring-[#2a3847] transition-all group-hover:scale-105 group-hover:bg-[#1f2d3d] sm:mb-5">
                        <Users className="h-6 w-6" />
                      </div>
                      <div className="relative min-w-0 flex-1 pr-6 sm:pr-0">
                        <h2 className="text-xl font-black leading-tight text-[#142030] sm:text-lg">Área do Cliente</h2>
                        <p className="mt-2 text-sm font-semibold leading-5 text-neutral-600 sm:text-sm">Entrar na área logada.</p>
                      </div>
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d8bd73]/60 bg-[#fff8e8] text-[#8a651f] transition-all group-hover:translate-x-1 group-hover:border-[#c19a43] group-hover:bg-[#edcf83] sm:absolute sm:bottom-5 sm:right-5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={() => {
                        setOnboardingStep('voucher');
                        setDocumento('');
                        setIsClientModalOpen(true);
                      }}
                      custom={1}
                      variants={loginCardVariants}
                      whileTap={{ scale: 0.985 }}
                      className="group relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-[1.55rem] border border-[#d8bd73]/55 bg-white p-5 text-left shadow-[0_12px_30px_rgba(20,32,48,0.11)] ring-1 ring-white transition-all hover:-translate-y-0.5 hover:border-[#c19a43] hover:shadow-[0_20px_44px_rgba(20,32,48,0.16)] sm:block sm:min-h-[150px] sm:rounded-[1.65rem] sm:p-5"
                    >
                      <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#fff4d0] via-[#edcf83] to-[#a87c2b]" />
                      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#d8bd73]/70 to-transparent" />
                      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#edcf83]/18 blur-2xl transition-all group-hover:bg-[#edcf83]/26" />
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#142030] text-[#edcf83] shadow-[0_10px_22px_rgba(20,32,48,0.22)] ring-1 ring-[#2a3847] transition-all group-hover:scale-105 group-hover:bg-[#1f2d3d] sm:mb-5">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="relative min-w-0 flex-1 pr-6 sm:pr-0">
                        <h2 className="text-xl font-black leading-tight text-[#142030] sm:text-lg">Primeiro acesso</h2>
                        <p className="mt-2 text-sm font-semibold leading-5 text-neutral-600 sm:text-sm">Validar indicação ou cadastro.</p>
                      </div>
                      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d8bd73]/60 bg-[#fff8e8] text-[#8a651f] transition-all group-hover:translate-x-1 group-hover:border-[#c19a43] group-hover:bg-[#edcf83] sm:absolute sm:bottom-5 sm:right-5">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('colaborador');
                        setAdminCode('');
                        setIsAdminModalOpen(true);
                      }}
                      className="hidden"
                    >
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-black text-neutral-950">Equipe</h2>
                      <p className="mt-1 text-sm font-medium leading-5 text-neutral-500">Colaborador ou gestão.</p>
                    </button>
                  </motion.div>

                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab('gestao');
                      setAdminCode('');
                      setIsAdminModalOpen(true);
                    }}
                    className="hidden"
                  >
                    Acesso gestão
                  </button>
                </div>
              </div>
            </section>

            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-0 right-0 z-20 flex justify-center px-4 sm:static sm:mt-5 sm:px-0">
              <button
                type="button"
                onClick={() => {
                  setAdminTab('prestador');
                  setAdminCode('');
                  setIsAdminModalOpen(true);
                }}
                className="group flex items-center gap-2 rounded-full border border-[#d8bd73]/35 bg-white/65 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#142030]/50 shadow-sm transition-all hover:border-[#c19a43] hover:bg-white hover:text-[#142030] hover:shadow-md"
              >
                <BriefcaseBusiness className="h-3.5 w-3.5 text-[#a87c2b]" />
                Prestador e Equipe
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </main>
      ) : (
        <GSAEnterpriseHome
          publicPage={publicPage}
          setPublicPage={handlePublicPageChange}
          publicAudience={publicAudience}
          setPublicAudience={setPublicAudience}
          servicePackages={servicePackages}
          publicProducts={publicProducts}
          publicServices={publicServices}
          onGuestStore={onGuestStore}
          onClientLogin={onLoginPage ?? (() => setIsClientModalOpen(true))}
          onAdminLogin={() => setIsAdminModalOpen(true)}
        />
      )}
      <div className="hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(0,0,0,0.03),transparent_70%)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />

      <header className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-10 pt-10 text-center sm:px-6 lg:px-8 lg:pb-14">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5"
        >
          <LogoGSA size="xl" variant="dark" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl tracking-widest text-[#142030] sm:text-6xl"
          style={{ fontFamily: '"Cinzel", serif', fontWeight: 700 }}
        >
          GSA HUB
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          className="mt-3 text-[13px] font-semibold tracking-[0.25em] text-[#142030]/50 uppercase"
        >
          Soluções Digitais
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7 }}
          className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-neutral-700"
        >
          Produtos, servicos, credito, suporte e assinaturas em uma experiencia simples. O cliente consulta tudo no site e entra na area logada apenas quando for comprar, contratar ou acompanhar.
        </motion.p>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 sm:px-6">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onGuestStore && onGuestStore()}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 py-4 text-sm font-medium text-white shadow-xl shadow-indigo-500/20 transition-all hover:shadow-2xl hover:shadow-indigo-500/40"
        >
          <Store className="h-5 w-5" />
          Acessar Loja
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setIsClientModalOpen(true)}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-[#1a1a1a] py-4 text-sm font-medium text-white shadow-xl shadow-black/10 transition-all hover:bg-black hover:shadow-2xl"
        >
          <LogIn className="h-5 w-5" />
          Acessar Área do Cliente
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => {
            setOnboardingStep('voucher');
            setDocumento('');
            setIsClientModalOpen(true);
          }}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-black/10 bg-white py-4 text-sm font-medium text-[#1a1a1a] shadow-sm transition-all hover:bg-[#fdfcfb] hover:shadow-md"
        >
          Meu Primeiro Acesso
        </motion.button>
      </main>

      <section id="catalogo-gsa" className="mx-auto mt-16 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="bg-neutral-950 p-8 text-white md:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c5a059]">Catalogo GSA 5.1</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
                Solucoes para pessoa fisica e empresas
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/65">
                Integramos aqui os pacotes do outro site: o visitante escolhe o perfil, conhece os servicos e segue para a loja ou para a area logada quando quiser contratar.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-2 rounded-full bg-white/10 p-1">
                <button
                  onClick={() => setPublicAudience('PF')}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition-all ${publicAudience === 'PF' ? 'bg-white text-neutral-950' : 'text-white/70 hover:text-white'}`}
                >
                  <Users className="h-4 w-4" />
                  Para voce
                </button>
                <button
                  onClick={() => setPublicAudience('PJ')}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition-all ${publicAudience === 'PJ' ? 'bg-white text-neutral-950' : 'text-white/70 hover:text-white'}`}
                >
                  <BriefcaseBusiness className="h-4 w-4" />
                  Empresas
                </button>
              </div>

              <button
                onClick={() => onGuestStore && onGuestStore()}
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#c5a059] px-5 py-3 text-sm font-bold text-neutral-950 transition-all hover:bg-[#d7b76c]"
              >
                Ver opcoes na loja
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[720px] gap-4 overflow-y-auto bg-[#fbfbf9] p-4 md:grid-cols-2 md:p-6">
              {filteredServicePackages.map((pkg) => (
                <article key={pkg.title} className="flex min-h-[260px] flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c5a059]">{pkg.subtitle}</p>
                      <h3 className="mt-2 text-xl font-black leading-tight text-neutral-950">{pkg.title}</h3>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-black text-neutral-500">{pkg.audience}</span>
                  </div>
                  <p className="text-sm leading-6 text-neutral-600">{pkg.description}</p>
                  <div className="mt-5 space-y-2">
                    {pkg.services.map((service) => {
                      const serviceName = typeof service === 'string' ? service : service.name;
                      return (
                      <div key={serviceName} className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#c5a059]" />
                        {serviceName}
                      </div>
                    )})}
                  </div>
                  <button
                    onClick={() => onGuestStore && onGuestStore()}
                    className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-sm font-bold text-neutral-950 transition-colors hover:text-[#8a6e2f]"
                  >
                    Contratar
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="produtos" className="mx-auto mt-16 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Produtos</p>
            <h2 className="mt-2 text-3xl font-bold text-neutral-950">O cliente consulta antes de comprar</h2>
          </div>
          <button onClick={() => onGuestStore && onGuestStore()} className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-black">
            Abrir vitrine
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {publicProducts.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <Icon className="h-7 w-7 text-neutral-950" />
              <h3 className="mt-5 text-lg font-bold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="servicos" className="mx-auto mt-14 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Servicos</p>
          <h2 className="mt-2 text-3xl font-bold text-neutral-950">Contratacao conectada a area do cliente</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {publicServices.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <Icon className="h-7 w-7 text-neutral-950" />
              <h3 className="mt-5 text-lg font-bold text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 bg-neutral-950 py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/40">Fluxo de compra</p>
            <h2 className="mt-2 text-3xl font-bold">Do site publico ate a finalizacao logada</h2>
            <p className="mt-4 text-sm leading-7 text-white/65">
              A vitrine fica aberta para descoberta. Quando o cliente decide comprar ou contratar, o sistema chama o login e continua o processo na area segura que ja existe.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['1', 'Cliente acessa o site e ve produtos/servicos.'],
              ['2', 'Ao comprar ou contratar, entra com CPF/CNPJ e PIN.'],
              ['3', 'Finaliza pedido, acompanha faturas e suporte no portal.'],
            ].map(([step, text]) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{step}</div>
                <p className="mt-5 text-sm leading-6 text-white/75">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-bold text-neutral-950">Pronto para conhecer a vitrine?</h2>
            <p className="mt-2 text-sm text-neutral-600">Veja as ofertas agora ou acesse sua area para continuar uma compra.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => onGuestStore && onGuestStore()} className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">
              <Store className="h-4 w-4" />
              Ver loja
            </button>
            <button
              onClick={() => {
                setOnboardingStep('voucher');
                setDocumento('');
                setIsClientModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-900"
            >
              <Users className="h-4 w-4" />
              Primeiro acesso
            </button>
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-4 border-t border-black/5 bg-[#f8f7f5] px-4 py-8">
        <button 
          onClick={() => setIsAdminModalOpen(true)}
          className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/30 uppercase transition-colors hover:text-[#1a1a1a]"
        >
          Acesso Restrito
        </button>
      </footer>
      </div>

      {/* Client Login Modal */}
      <Modal 
        isOpen={isClientModalOpen} 
        onClose={() => { setIsClientModalOpen(false); setOnboardingStep('login'); resetClientPinStates(); }} 
        title={
          onboardingStep === 'login' 
            ? (clientLoginStep === 'documento' ? 'Área do Cliente' 
              : clientLoginStep === 'pin' ? 'Digite sua Senha'
              : clientLoginStep === 'create_pin' ? 'Criar Senha de Acesso'
              : clientLoginStep === 'recovery' ? 'Recuperar Senha'
              : 'Acesso Bloqueado')
            : onboardingStep === 'voucher' ? 'Validar Indicação' 
            : onboardingStep === 'confirm' ? 'Confirmar Indicação' : 'Cadastro de Indicado'
        }
      >
        {onboardingStep === 'login' && clientLoginStep === 'documento' && (
          <form onSubmit={handleClientDocumentCheck} className="space-y-6">
            <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg">
              <button type="button" onClick={() => setTipoPessoa('pf')} className={`flex-1 py-2 text-sm rounded-md transition-all ${tipoPessoa === 'pf' ? 'bg-white shadow' : 'text-neutral-500'}`}>CPF</button>
              <button type="button" onClick={() => setTipoPessoa('pj')} className={`flex-1 py-2 text-sm rounded-md transition-all ${tipoPessoa === 'pj' ? 'bg-white shadow' : 'text-neutral-500'}`}>CNPJ</button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">{tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}</label>
              <input
                type="text"
                inputMode="numeric"
                value={documento}
                onChange={(e) => setDocumento(tipoPessoa === 'pf' ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
                onBlur={(e) => {
                  // Removida validação estrita para não bloquear CPFs de teste antigos no login
                }}
                placeholder={tipoPessoa === 'pf' ? "000.000.000-00" : "00.000.000/0000-00"}
                className="input-field text-lg"
                required
              />
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Verificando...' : 'Continuar'}
              </button>
            </div>
            <div className="pt-4 text-center"><button type="button" onClick={() => { setOnboardingStep('voucher'); setDocumento(''); }} className="text-sm text-[#c19a43] hover:underline font-semibold">Criar Conta</button></div>
          </form>
        )}

        {onboardingStep === 'login' && clientLoginStep === 'pin' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#142030]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#142030]" />
              </div>
              <p className="text-sm text-[#1a1a1a]/60 mb-1">Olá, <strong className="text-[#1a1a1a]">{clientPinInfo?.nome}</strong></p>
              <p className="text-xs text-[#1a1a1a]/40">Digite sua senha numérica de 4 dígitos</p>
            </div>
            <PinInput
              value={clientPin}
              onChange={(v) => { setClientPin(v); setClientPinError(false); }}
              error={clientPinError}
              disabled={loading}
              onEnter={handleClientPinVerify}
            />
            {clientAttemptsLeft !== null && clientAttemptsLeft <= 2 && (
              <p className="text-center text-xs text-red-500 font-medium">
                ⚠️ {clientAttemptsLeft} tentativa(s) restante(s) antes do bloqueio
              </p>
            )}
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => setClientLoginStep('recovery')}
                className="text-sm text-[#142030] hover:underline font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => { resetClientPinStates(); }}
                className="btn-secondary flex-1"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleClientPinVerify}
                disabled={loading || clientPin.length !== 4}
                className="btn-primary flex-1"
              >
                {loading ? 'Verificando...' : 'Acessar'}
              </button>
            </div>
          </div>
        )}

        {onboardingStep === 'login' && clientLoginStep === 'recovery' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#142030]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-[#142030]" />
              </div>
              <h3 className="text-lg font-bold text-[#1a1a1a] mb-1">Recuperar Senha</h3>
              <p className="text-sm text-[#1a1a1a]/60">Confirme o e-mail cadastrado para acessar a redefinição da sua senha.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">E-mail Cadastrado</label>
                <input
                  type="email"
                  value={clientRecoveryEmail}
                  onChange={(e) => setClientRecoveryEmail(e.target.value)}
                  className="input-field w-full"
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setClientLoginStep('pin')}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!clientRecoveryEmail) {
                      toast.error('Informe o e-mail.');
                      return;
                    }
                    setLoading(true);
                    try {
                      const data = await sessionService.loginRecuperacaoSenha(
                        documento.replace(/\D/g, ''),
                        clientRecoveryEmail
                      );
                      if (data.success) {
                        toast.success('Sessão de recuperação iniciada com sucesso.');
                        onLoginClient(data.id, true);
                      } else {
                        toast.error(data.error || 'Erro ao recuperar senha.');
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Erro ao processar solicitação.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !clientRecoveryEmail}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Enviando...' : 'Recuperar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {onboardingStep === 'login' && clientLoginStep === 'create_pin' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-sm text-[#1a1a1a]/60 mb-1">Olá, <strong className="text-[#1a1a1a]">{clientPinInfo?.nome}</strong></p>
              <p className="text-xs text-[#1a1a1a]/40">Este é seu primeiro acesso. Crie uma senha numérica de 4 dígitos.</p>
            </div>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">
                  Telefone cadastrado
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={clientFirstAccessPhone}
                  onChange={(event) => setClientFirstAccessPhone(maskPhone(event.target.value))}
                  placeholder="(00) 00000-0000"
                  className="input-field"
                  maxLength={15}
                  required
                />
                <p className="mt-2 text-xs text-[#1a1a1a]/45">
                  Use o mesmo telefone informado no cadastro.
                </p>
              </div>
              <PinInput
                value={clientPin}
                onChange={(v) => { setClientPin(v); setClientPinError(false); }}
                error={clientPinError}
                disabled={loading}
                label="Nova Senha"
                onEnter={handleClientCreatePin}
              />
              <PinInput
                value={clientPinConfirm}
                onChange={(v) => { setClientPinConfirm(v); setClientPinError(false); }}
                error={clientPinError}
                disabled={loading}
                autoFocus={false}
                label="Confirmar Senha"
                onEnter={handleClientCreatePin}
              />
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => { resetClientPinStates(); }}
                className="btn-secondary flex-1"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleClientCreatePin}
                disabled={loading || clientFirstAccessPhone.replace(/\D/g, '').length < 10 || clientPin.length !== 4 || clientPinConfirm.length !== 4}
                className="btn-primary flex-1"
              >
                {loading ? 'Cadastrando...' : 'Cadastrar Senha'}
              </button>
            </div>
          </div>
        )}

        {onboardingStep === 'login' && clientLoginStep === 'blocked' && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-red-600 mb-3">Acesso Bloqueado</h3>
            <p className="text-sm text-neutral-600 leading-relaxed mb-6">
              Sua conta foi bloqueada após múltiplas tentativas de acesso com senha incorreta.<br /><br />
              Para desbloquear, entre em contato com o <strong>suporte</strong> da empresa.
            </p>
            <button
              onClick={() => { resetClientPinStates(); setIsClientModalOpen(false); }}
              className="btn-secondary w-full"
            >
              Fechar
            </button>
          </div>
        )}

        {onboardingStep === 'voucher' && (
          <div className="space-y-6">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                <p className="text-lg font-medium text-[#1a1a1a]">Analisando...</p>
                <p className="text-sm text-[#1a1a1a]/60 text-center">Aguarde enquanto verificamos a liberação do seu cadastro.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg">
                  <button 
                    type="button" 
                    onClick={() => { setVoucherTab('com-indicacao'); setVoucherInput(''); }} 
                    className={`flex-1 py-2 text-sm rounded-md transition-all ${voucherTab === 'com-indicacao' ? 'bg-white shadow' : 'text-neutral-500'}`}
                  >
                    Com Indicação
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setVoucherTab('sem-indicacao'); setVoucherInput(''); }} 
                    className={`flex-1 py-2 text-sm rounded-md transition-all ${voucherTab === 'sem-indicacao' ? 'bg-white shadow' : 'text-neutral-500'}`}
                  >
                    Sem Indicação
                  </button>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleValidateVoucher();
                  }}
                  className="space-y-6"
                >
                  {voucherTab === 'com-indicacao' ? (
                    <div className="rounded-2xl bg-[#f8f7f5] p-5 ring-1 ring-black/5">
                      <p className="text-sm text-[#1a1a1a]/80 leading-relaxed">
                        Bem-vindo! Para validar sua indicação e garantir seus benefícios, informe o seu número de <strong>Celular (WhatsApp)</strong> que foi cadastrado na indicação.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {defaultCodeSettings.ativo ? (
                        <div className="rounded-2xl bg-indigo-50 p-5 ring-1 ring-indigo-100">
                          <p className="text-sm text-indigo-900 leading-relaxed mb-3">
                            Caso você não tenha um código de indicação, você pode utilizar o código padrão a seguir para ativar seu cadastro:
                          </p>
                          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-200 mb-4">
                            <span className="font-mono font-bold text-lg text-black">{defaultCodeSettings.codigo}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                const success = await copyToClipboard(defaultCodeSettings.codigo);
                                if (success) {
                                  toast.success('Código copiado!');
                                } else {
                                  toast.error('Erro ao copiar código.');
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm font-medium text-neutral-700 transition-colors"
                            >
                              <Copy className="h-4 w-4" />
                              Copiar
                            </button>
                          </div>
                          <div className="text-xs text-indigo-800 space-y-2 bg-white/50 p-3 rounded-lg border border-indigo-100">
                            <p>
                              <strong>Atenção:</strong> Ao utilizar este código padrão, seu cadastro passará por uma análise de 24 horas. Durante este período, todos os módulos do sistema ficarão bloqueados para uso até que a análise seja concluída e o cadastro aprovado.
                            </p>
                            <p>
                              Após a aprovação do cadastro, você ganhará um bônus de boas-vindas de <strong>{defaultCodeSettings.tipo === 'pontos' ? `${defaultCodeSettings.valor} pontos` : formatCurrency(Number(defaultCodeSettings.valor))}</strong>!
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-[#f8f7f5] p-5 ring-1 ring-black/5">
                          <p className="text-sm text-[#1a1a1a]/80 leading-relaxed">
                            O cadastro sem indicação direta está temporariamente indisponível. Por favor, valide o seu número de <strong>Celular (WhatsApp)</strong> que foi indicado por alguém.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">
                      {voucherTab === 'com-indicacao' ? 'Seu Celular (WhatsApp) *' : 'Código do Sistema *'}
                    </label>
                    <input
                      type="text"
                      inputMode={voucherTab === 'com-indicacao' ? 'numeric' : 'text'}
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(voucherTab === 'com-indicacao' ? maskPhone(e.target.value) : e.target.value)}
                      placeholder={voucherTab === 'com-indicacao' ? "(00) 00000-0000" : "Digite o código aqui"}
                      className="input-field text-lg"
                      disabled={loading || (voucherTab === 'sem-indicacao' && !defaultCodeSettings.ativo)}
                    />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setOnboardingStep('login')}
                      className="btn-secondary flex-1"
                      disabled={loading}
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex-1"
                      disabled={loading || (voucherTab === 'sem-indicacao' && !defaultCodeSettings.ativo)}
                    >
                      {loading ? 'Validando...' : 'Liberar Cadastro'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {onboardingStep === 'confirm' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#f8f7f5] p-6 ring-1 ring-black/5">
              <h4 className="font-medium text-[#1a1a1a] mb-4">Você foi indicado por:</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Nome</p>
                  <p className="font-medium text-[#1a1a1a]">{referralInfo.indicador?.nome}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-[#1a1a1a]/40 uppercase">Telefone</p>
                  <p className="font-medium text-[#1a1a1a]">{referralInfo.indicador?.telefone}</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-[#1a1a1a]/60">Você confirma que esta é a pessoa que te indicou?</p>
            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setOnboardingStep('voucher')}
                className="btn-secondary flex-1"
              >
                Não, Voltar
              </button>
              <button
                onClick={() => setOnboardingStep('register')}
                className="btn-primary flex-1"
              >
                Sim, Confirmar
              </button>
            </div>
          </div>
        )}

        {onboardingStep === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg">
              <button type="button" onClick={() => setTipoPessoa('pf')} className={`flex-1 py-2 text-sm rounded-md transition-all ${tipoPessoa === 'pf' ? 'bg-white shadow' : 'text-neutral-500'}`}>Pessoa Física</button>
              <button type="button" onClick={() => setTipoPessoa('pj')} className={`flex-1 py-2 text-sm rounded-md transition-all ${tipoPessoa === 'pj' ? 'bg-white shadow' : 'text-neutral-500'}`}>Pessoa Jurídica</button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">{tipoPessoa === 'pf' ? 'Seu CPF *' : 'Seu CNPJ *'}</label>
              <input 
                type="text" 
                inputMode="numeric"
                required
                value={documento}
                onChange={e => setDocumento(tipoPessoa === 'pf' ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
                onBlur={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val) {
                    if (tipoPessoa === 'pf' && !validarCPF(val)) { toast.error('CPF inválido'); setDocumento(''); }
                    if (tipoPessoa === 'pj' && !validarCNPJ(val)) { toast.error('CNPJ inválido'); setDocumento(''); }
                  }
                }}
                placeholder={tipoPessoa === 'pf' ? "000.000.000-00" : "00.000.000/0000-00"}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">{tipoPessoa === 'pf' ? 'Nome Completo *' : 'Razão Social *'}</label>
              <input 
                type="text" 
                required
                value={registrationData.nome}
                onChange={e => setRegistrationData({...registrationData, nome: e.target.value})}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">E-mail *</label>
              <input 
                type="email" 
                required
                value={registrationData.email}
                onChange={e => setRegistrationData({...registrationData, email: e.target.value})}
                onBlur={(e) => {
                  if (e.target.value && !validarEmail(e.target.value)) {
                    toast.error('E-mail inválido');
                    setRegistrationData({...registrationData, email: ''});
                  }
                }}
                placeholder="seu@email.com"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Telefone *</label>
              <input 
                type="text" 
                inputMode="numeric"
                required
                value={registrationData.telefone}
                onChange={e => setRegistrationData({...registrationData, telefone: maskPhone(e.target.value)})}
                maxLength={15}
                className="input-field"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">CEP *</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  required
                  value={registrationData.cep}
                  onChange={async e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                    setRegistrationData(prev => ({ ...prev, cep: v }));
                    
                    const rawCep = v.replace(/\D/g, '');
                    if (rawCep.length === 8) {
                      try {
                        const res = await consultarCEP(rawCep);
                        if (res) {
                          setRegistrationData(prev => ({
                            ...prev,
                            endereco: res.logradouro,
                            bairro: res.bairro,
                            cidade: res.localidade,
                            estado: res.uf
                          }));
                        }
                      } catch (err) {
                        console.error('Erro ao consultar CEP:', err);
                      }
                    }
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Número *</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  required
                  value={registrationData.numero}
                  onChange={e => setRegistrationData({...registrationData, numero: e.target.value})}
                  placeholder="Nº"
                  className="input-field"
                />
              </div>
            </div>

            {registrationData.cep.replace(/\D/g, '').length === 8 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Endereço *</label>
                  <input 
                    type="text" 
                    required
                    value={registrationData.endereco}
                    onChange={e => setRegistrationData({ ...registrationData, endereco: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Bairro *</label>
                    <input 
                      type="text" 
                      required
                      value={registrationData.bairro}
                      onChange={e => setRegistrationData({ ...registrationData, bairro: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">UF *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={2}
                      value={registrationData.estado}
                      onChange={e => setRegistrationData({ ...registrationData, estado: e.target.value.toUpperCase() })}
                      className="input-field text-center"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Cidade *</label>
                  <input 
                    type="text" 
                    required
                    value={registrationData.cidade}
                    onChange={e => setRegistrationData({ ...registrationData, cidade: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Observações</label>
              <textarea 
                rows={2}
                value={registrationData.observacoes}
                onChange={e => setRegistrationData({...registrationData, observacoes: e.target.value})}
                className="input-field resize-none"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setOnboardingStep('confirm')} className="btn-secondary flex-1">Voltar</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">Finalizar Cadastro</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Admin Login Modal */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title="Acesso Restrito"
      >
        <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => { setAdminTab('prestador'); setAdminCode(''); }}
            className={`flex-1 py-2 text-sm rounded-md font-bold transition-all ${adminTab === 'prestador' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Prestador
          </button>
          <button
            type="button"
            onClick={() => { setAdminTab('colaborador'); setAdminCode(''); }}
            className={`flex-1 py-2 text-sm rounded-md font-bold transition-all ${adminTab === 'colaborador' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Colaborador
          </button>
          <button
            type="button"
            onClick={() => { setAdminTab('gestao'); setAdminCode(''); }}
            className={`flex-1 py-2 text-sm rounded-md font-bold transition-all ${adminTab === 'gestao' ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Gestão
          </button>
        </div>

        {adminTab === 'gestao' ? (
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-black uppercase tracking-widest text-[#1a1a1a]/40">Código Master</label>
              <input
                type="password"
                inputMode="numeric"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="••••••"
                className="input-field text-center text-2xl font-mono tracking-[0.5em]"
                required
              />
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 bg-neutral-900 hover:bg-black"
              >
                {loading ? 'Entrando...' : 'Entrar Master'}
              </button>
            </div>
          </form>
        ) : adminTab === 'colaborador' ? (
          <form onSubmit={handleColaboradorLogin} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-black uppercase tracking-widest text-indigo-600/60">Credencial de Equipe</label>
              <input
                type="password"
                inputMode="numeric"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="000000"
                className="input-field text-center text-2xl font-mono tracking-[0.5em]"
                required
              />
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? 'Acessando...' : 'Entrar como Equipe'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {prestadorLoginStep === 'documento' && (
              <form onSubmit={handlePrestadorDocumentCheck} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">CPF / CNPJ</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={prestadorCode}
                    onChange={(e) => setPrestadorCode(e.target.value.length <= 14 ? maskCPF(e.target.value) : maskCNPJ(e.target.value))}
                    onBlur={(e) => {
                      // Removida validação estrita no login
                    }}
                    placeholder="000.000.000-00"
                    className="input-field text-lg"
                    required
                  />
                </div>
                <div className="flex flex-col gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                  >
                    {loading ? 'Verificando...' : 'Continuar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminModalOpen(false);
                      setIsPrestadorRegisterOpen(true);
                    }}
                    className="btn-secondary w-full"
                  >
                    Realizar pré-cadastro
                  </button>
                </div>
              </form>
            )}

            {prestadorLoginStep === 'pin' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#142030]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-[#142030]" />
                  </div>
                  <p className="text-sm text-[#1a1a1a]/60 mb-1">Olá, <strong className="text-[#1a1a1a]">{prestadorPinInfo?.nome}</strong></p>
                  <p className="text-xs text-[#1a1a1a]/40">Digite sua senha numérica de 4 dígitos</p>
                </div>
                <PinInput
                  value={prestadorPin}
                  onChange={(v) => { setPrestadorPin(v); setPrestadorPinError(false); }}
                  error={prestadorPinError}
                  disabled={loading}
                  onEnter={handlePrestadorPinVerify}
                />
                {prestadorAttemptsLeft !== null && prestadorAttemptsLeft <= 2 && (
                  <p className="text-center text-xs text-red-500 font-medium">
                    ⚠️ {prestadorAttemptsLeft} tentativa(s) restante(s) antes do bloqueio
                  </p>
                )}
                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => { resetPrestadorPinStates(); }}
                    className="btn-secondary flex-1"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handlePrestadorPinVerify}
                    disabled={loading || prestadorPin.length !== 4}
                    className="btn-primary flex-1"
                  >
                    {loading ? 'Verificando...' : 'Acessar'}
                  </button>
                </div>
              </div>
            )}

            {prestadorLoginStep === 'create_pin' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="w-8 h-8 text-emerald-600" />
                  </div>
                  <p className="text-sm text-[#1a1a1a]/60 mb-1">Olá, <strong className="text-[#1a1a1a]">{prestadorPinInfo?.nome}</strong></p>
                  <p className="text-xs text-[#1a1a1a]/40">Este é seu primeiro acesso. Crie uma senha numérica de 4 dígitos.</p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">
                      Telefone cadastrado
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={prestadorFirstAccessPhone}
                      onChange={(event) => setPrestadorFirstAccessPhone(maskPhone(event.target.value))}
                      placeholder="(00) 00000-0000"
                      className="input-field"
                      maxLength={15}
                      required
                    />
                    <p className="mt-2 text-xs text-[#1a1a1a]/45">
                      Use o mesmo telefone informado no cadastro.
                    </p>
                  </div>
                  <PinInput
                    value={prestadorPin}
                    onChange={(v) => { setPrestadorPin(v); setPrestadorPinError(false); }}
                    error={prestadorPinError}
                    disabled={loading}
                    label="Nova Senha"
                    onEnter={handlePrestadorCreatePin}
                  />
                  <PinInput
                    value={prestadorPinConfirm}
                    onChange={(v) => { setPrestadorPinConfirm(v); setPrestadorPinError(false); }}
                    error={prestadorPinError}
                    disabled={loading}
                    autoFocus={false}
                    label="Confirmar Senha"
                    onEnter={handlePrestadorCreatePin}
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => { resetPrestadorPinStates(); }}
                    className="btn-secondary flex-1"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handlePrestadorCreatePin}
                    disabled={loading || prestadorFirstAccessPhone.replace(/\D/g, '').length < 10 || prestadorPin.length !== 4 || prestadorPinConfirm.length !== 4}
                    className="btn-primary flex-1"
                  >
                    {loading ? 'Cadastrando...' : 'Cadastrar Senha'}
                  </button>
                </div>
              </div>
            )}

            {prestadorLoginStep === 'blocked' && (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-red-600 mb-3">Acesso Bloqueado</h3>
                <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                  Sua conta foi bloqueada após múltiplas tentativas de acesso com senha incorreta.<br /><br />
                  Para desbloquear, entre em contato com o <strong>suporte</strong> da empresa.
                </p>
                <button
                  onClick={() => { resetPrestadorPinStates(); setIsAdminModalOpen(false); }}
                  className="btn-secondary w-full"
                >
                  Fechar
                </button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Prestador Register Modal */}
      <Modal
        isOpen={isPrestadorRegisterOpen}
        onClose={() => setIsPrestadorRegisterOpen(false)}
        title="Pré-cadastro de Prestador"
      >
        <form onSubmit={handlePrestadorRegister} className="space-y-4">
          <div className="flex gap-2 p-1 bg-neutral-100 rounded-lg">
            <button
              type="button"
              onClick={() => setPrestadorData({ ...prestadorData, tipo_cadastro: 'cpf', documento: '' })}
              className={`flex-1 py-2 text-sm rounded-md transition-all ${prestadorData.tipo_cadastro === 'cpf' ? 'bg-white shadow' : 'text-neutral-500'}`}
            >
              CPF
            </button>
            <button
              type="button"
              onClick={() => setPrestadorData({ ...prestadorData, tipo_cadastro: 'cnpj', documento: '' })}
              className={`flex-1 py-2 text-sm rounded-md transition-all ${prestadorData.tipo_cadastro === 'cnpj' ? 'bg-white shadow' : 'text-neutral-500'}`}
            >
              CNPJ
            </button>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">
              {prestadorData.tipo_cadastro === 'cpf' ? 'Nome Completo *' : 'Razão Social *'}
            </label>
            <input
              type="text"
              required
              value={prestadorData.nome_razao}
              onChange={e => setPrestadorData({ ...prestadorData, nome_razao: e.target.value })}
              className="input-field"
            />
          </div>

          {prestadorData.tipo_cadastro === 'cnpj' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Nome do Responsável *</label>
              <input
                type="text"
                required
                value={prestadorData.nome_responsavel}
                onChange={e => setPrestadorData({ ...prestadorData, nome_responsavel: e.target.value })}
                className="input-field"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">
              {prestadorData.tipo_cadastro === 'cpf' ? 'CPF *' : 'CNPJ *'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={prestadorData.documento}
              onChange={e => setPrestadorData({
                ...prestadorData,
                documento: prestadorData.tipo_cadastro === 'cpf' ? maskCPF(e.target.value) : maskCNPJ(e.target.value)
              })}
              onBlur={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val) {
                  if (prestadorData.tipo_cadastro === 'cpf' && !validarCPF(val)) { toast.error('CPF inválido'); setPrestadorData({ ...prestadorData, documento: '' }); }
                  if (prestadorData.tipo_cadastro === 'cnpj' && !validarCNPJ(val)) { toast.error('CNPJ inválido'); setPrestadorData({ ...prestadorData, documento: '' }); }
                }
              }}
              placeholder={prestadorData.tipo_cadastro === 'cpf' ? "000.000.000-00" : "00.000.000/0000-00"}
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">E-mail *</label>
            <input
              type="email"
              required
              value={prestadorData.email}
              onChange={e => setPrestadorData({ ...prestadorData, email: e.target.value })}
              onBlur={(e) => {
                if (e.target.value && !validarEmail(e.target.value)) {
                  toast.error('E-mail inválido');
                  setPrestadorData({ ...prestadorData, email: '' });
                }
              }}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Telefone *</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={prestadorData.telefone}
                onChange={e => setPrestadorData({ ...prestadorData, telefone: maskPhone(e.target.value) })}
                maxLength={15}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">CEP *</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={prestadorData.cep}
                onChange={e => {
                  let v = e.target.value.replace(/\D/g, '');
                  if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                  setPrestadorData({ ...prestadorData, cep: v });
                }}
                maxLength={9}
                placeholder="00000-000"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Número *</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={prestadorData.numero}
                onChange={e => setPrestadorData({ ...prestadorData, numero: e.target.value })}
                placeholder="Nº"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Área de prestação de serviço *</label>
            <input
              type="text"
              required
              value={prestadorData.area_servico}
              onChange={e => setPrestadorData({ ...prestadorData, area_servico: e.target.value })}
              placeholder="Ex: Manutenção Elétrica"
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#1a1a1a]/60">Observações</label>
            <textarea
              rows={2}
              value={prestadorData.observacoes}
              onChange={e => setPrestadorData({ ...prestadorData, observacoes: e.target.value })}
              className="input-field resize-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsPrestadorRegisterOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">Enviar Cadastro</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}



