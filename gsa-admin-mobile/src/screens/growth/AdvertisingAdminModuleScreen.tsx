import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../../../supabase';

export interface AdRequest {
  id: string;
  protocol: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  desired_start_date?: string;
  desired_end_date?: string;
  intended_budget?: number;
  status: 'draft' | 'submitted' | 'under_review' | 'proposal_sent' | 'accepted' | 'rejected' | 'cancelled' | string;
  created_at: string;
}

export interface AdCampaign {
  id: string;
  name: string;
  advertiser_name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled' | string;
  starts_at?: string;
  ends_at?: string;
  total_budget?: number;
  impression_count?: number;
  click_count?: number;
}

export interface AdProposal {
  id: string;
  request_id: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'negotiating' | 'accepted' | 'rejected' | string;
  created_at: string;
}

export interface AdPlacement {
  id: string;
  name: string;
  code: string;
  channel: string;
  capacity: number;
  base_price_cents: number;
  is_active: boolean;
}

export const AdvertisingAdminModuleScreen: React.FC = () => {
  const [tab, setTab] = useState<'requests' | 'campaigns' | 'proposals' | 'placements'>('requests');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [requests, setRequests] = useState<AdRequest[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [proposals, setProposals] = useState<AdProposal[]>([]);
  const [placements, setPlacements] = useState<AdPlacement[]>([]);

  // Proposal Modal
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AdRequest | null>(null);
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalDays, setProposalDays] = useState('30');
  const [proposalTerms, setProposalTerms] = useState(
    'A publicação depende da confirmação do pagamento e da aprovação do criativo.'
  );
  const [savingProposal, setSavingProposal] = useState(false);

  // Placement Modal
  const [isPlacementModalOpen, setIsPlacementModalOpen] = useState(false);
  const [newPlacement, setNewPlacement] = useState({
    name: '',
    code: '',
    channel: 'portal',
    capacity: '1',
    base_price: '500',
  });
  const [savingPlacement, setSavingPlacement] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Try RPC overview first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('gsa_admin_advertising_overview');

      if (!rpcErr && rpcData) {
        setRequests(rpcData.requests || []);
        setCampaigns(rpcData.campaigns || []);
        setProposals(rpcData.proposals || []);
        setPlacements(rpcData.placements || []);
      } else {
        // Fallback: direct table queries
        const [
          { data: reqData },
          { data: campData },
          { data: propData },
          { data: plcData },
        ] = await Promise.all([
          supabase.from('gsa_ad_requests').select('*').order('created_at', { ascending: false }),
          supabase.from('gsa_ad_campaigns').select('*').order('created_at', { ascending: false }),
          supabase.from('gsa_ad_proposals').select('*').order('created_at', { ascending: false }),
          supabase.from('gsa_ad_placements').select('*').order('name', { ascending: true }),
        ]);

        if (reqData) setRequests(reqData);
        if (campData) setCampaigns(campData);
        if (propData) setProposals(propData);
        if (plcData) setPlacements(plcData);
      }
    } catch (e: any) {
      console.warn('AdvertisingAdminModule load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // KPIs
  const totalRequests = requests.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const pendingProposals = proposals.filter((p) => ['sent', 'negotiating'].includes(p.status)).length;
  const totalRevenue = campaigns
    .filter((c) => c.status === 'active' || c.status === 'completed')
    .reduce((sum, c) => sum + Number(c.total_budget || 0), 0);

  // Update Request Status
  const handleUpdateRequestStatus = async (req: AdRequest, newStatus: string) => {
    try {
      // Try RPC first
      const { error: rpcErr } = await supabase.rpc('gsa_admin_update_ad_request_status', {
        p_request_id: req.id,
        p_status: newStatus,
      });

      if (rpcErr) {
        const { error: tblErr } = await supabase
          .from('gsa_ad_requests')
          .update({ status: newStatus })
          .eq('id', req.id);
        if (tblErr) throw tblErr;
      }

      Alert.alert('Sucesso', `Solicitação alterada para: ${newStatus}`);
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao atualizar status.');
    }
  };

  // Open Proposal modal
  const handleOpenProposal = (req: AdRequest) => {
    setSelectedRequest(req);
    setProposalAmount(req.intended_budget ? String(req.intended_budget) : '1500');
    setProposalDays('30');
    setIsProposalModalOpen(true);
  };

  // Save Proposal
  const handleSaveProposal = async () => {
    if (!selectedRequest) return;
    const amountNum = Number(proposalAmount.replace(',', '.'));
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido para a proposta.');
      return;
    }

    setSavingProposal(true);
    try {
      const { error: rpcErr } = await supabase.rpc('gsa_admin_create_ad_proposal', {
        p_request_id: selectedRequest.id,
        p_amount: amountNum,
        p_terms: proposalTerms,
      });

      if (rpcErr) {
        // Direct insert fallback
        const { error: tblErr } = await supabase.from('gsa_ad_proposals').insert([
          {
            request_id: selectedRequest.id,
            total_amount: amountNum,
            status: 'sent',
            terms: proposalTerms,
            created_at: new Date().toISOString(),
          },
        ]);
        if (tblErr) throw tblErr;

        // update request status
        await supabase
          .from('gsa_ad_requests')
          .update({ status: 'proposal_sent' })
          .eq('id', selectedRequest.id);
      }

      Alert.alert('Sucesso', 'Proposta comercial enviada ao anunciante!');
      setIsProposalModalOpen(false);
      setSelectedRequest(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao criar proposta.');
    } finally {
      setSavingProposal(false);
    }
  };

  // Toggle Campaign status (Pause / Resume)
  const handleToggleCampaign = async (campaign: AdCampaign) => {
    const nextStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      const { error: rpcErr } = await supabase.rpc('gsa_admin_set_ad_campaign_status', {
        p_campaign_id: campaign.id,
        p_status: nextStatus,
      });

      if (rpcErr) {
        const { error: tblErr } = await supabase
          .from('gsa_ad_campaigns')
          .update({ status: nextStatus })
          .eq('id', campaign.id);
        if (tblErr) throw tblErr;
      }

      Alert.alert('Sucesso', `Campanha ${nextStatus === 'active' ? 'ativada' : 'pausada'}.`);
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao alterar status da campanha.');
    }
  };

  // Save New Placement
  const handleSavePlacement = async () => {
    if (!newPlacement.name.trim() || !newPlacement.code.trim()) {
      Alert.alert('Atenção', 'Informe nome e código do espaço.');
      return;
    }

    setSavingPlacement(true);
    try {
      const priceCents = Math.round(Number(newPlacement.base_price.replace(',', '.')) * 100) || 50000;
      const { error } = await supabase.from('gsa_ad_placements').insert([
        {
          name: newPlacement.name.trim(),
          code: newPlacement.code.trim().toUpperCase(),
          channel: newPlacement.channel,
          capacity: parseInt(newPlacement.capacity, 10) || 1,
          base_price_cents: priceCents,
          is_active: true,
        },
      ]);

      if (error) throw error;

      Alert.alert('Sucesso', 'Espaço publicitário cadastrado!');
      setIsPlacementModalOpen(false);
      setNewPlacement({ name: '', code: '', channel: 'portal', capacity: '1', base_price: '500' });
      loadData();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao cadastrar espaço.');
    } finally {
      setSavingPlacement(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    let bg = '#f1f5f9';
    let text = '#475569';
    if (status === 'active' || status === 'accepted' || status === 'sent') {
      bg = '#ecfdf5';
      text = '#059669';
    } else if (status === 'under_review' || status === 'negotiating' || status === 'submitted') {
      bg = '#eff6ff';
      text = '#2563eb';
    } else if (status === 'paused' || status === 'draft') {
      bg = '#fffbeb';
      text = '#d97706';
    } else if (status === 'rejected' || status === 'cancelled') {
      bg = '#fef2f2';
      text = '#dc2626';
    }
    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]}>{status.toUpperCase()}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>MÍDIA & ANÚNCIOS</Text>
            <Text style={styles.headerTitle}>Campanhas Publicitárias</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tab === 'placements' && (
              <TouchableOpacity
                style={styles.newButton}
                onPress={() => setIsPlacementModalOpen(true)}
              >
                <Text style={styles.newButtonText}>+ Espaço</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Text style={styles.refreshButtonText}>{refreshing ? '...' : '↻'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIs Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricsContainer}
        >
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Solicitações</Text>
            <Text style={styles.metricValue}>{totalRequests}</Text>
            <Text style={styles.metricSub}>recebidas</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Campanhas Ativas</Text>
            <Text style={[styles.metricValue, { color: '#059669' }]}>{activeCampaigns}</Text>
            <Text style={styles.metricSub}>no ar agora</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Propostas</Text>
            <Text style={[styles.metricValue, { color: '#2563eb' }]}>{pendingProposals}</Text>
            <Text style={styles.metricSub}>em negociação</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Receita Estimada</Text>
            <Text style={[styles.metricValue, { color: '#0f172a' }]}>
              R$ {totalRevenue.toFixed(2)}
            </Text>
            <Text style={styles.metricSub}>confirmada</Text>
          </View>
        </ScrollView>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'requests' && styles.tabItemActive]}
            onPress={() => setTab('requests')}
          >
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
              Solicitações ({requests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'campaigns' && styles.tabItemActive]}
            onPress={() => setTab('campaigns')}
          >
            <Text style={[styles.tabText, tab === 'campaigns' && styles.tabTextActive]}>
              Campanhas ({campaigns.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'proposals' && styles.tabItemActive]}
            onPress={() => setTab('proposals')}
          >
            <Text style={[styles.tabText, tab === 'proposals' && styles.tabTextActive]}>
              Propostas ({proposals.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, tab === 'placements' && styles.tabItemActive]}
            onPress={() => setTab('placements')}
          >
            <Text style={[styles.tabText, tab === 'placements' && styles.tabTextActive]}>
              Espaços ({placements.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.filterSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por empresa, protocolo ou anunciante..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Carregando módulo de publicidade...</Text>
          </View>
        ) : tab === 'requests' ? (
          <FlatList
            data={requests.filter((r) =>
              !search ||
              r.company_name?.toLowerCase().includes(search.toLowerCase()) ||
              r.protocol?.toLowerCase().includes(search.toLowerCase())
            )}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.company_name || 'Anunciante'}</Text>
                    <Text style={styles.cardSubtitle}>
                      Protocolo: {item.protocol} • Contato: {item.contact_name}
                    </Text>
                  </View>
                  {renderStatusBadge(item.status)}
                </View>

                <View style={styles.divider} />

                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardColLabel}>Orçamento Pretendido:</Text>
                    <Text style={[styles.cardColValue, { fontWeight: '900', color: '#059669' }]}>
                      R$ {Number(item.intended_budget || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.cardColRight}>
                    <Text style={styles.cardColLabel}>Período:</Text>
                    <Text style={styles.cardColValue}>
                      {item.desired_start_date ? new Date(item.desired_start_date).toLocaleDateString('pt-BR') : '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  {item.status === 'submitted' && (
                    <TouchableOpacity
                      style={styles.actionButtonOutline}
                      onPress={() => handleUpdateRequestStatus(item, 'under_review')}
                    >
                      <Text style={styles.actionButtonOutlineText}>Iniciar Análise</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'accepted' && item.status !== 'rejected' && (
                    <TouchableOpacity
                      style={styles.actionButtonPrimary}
                      onPress={() => handleOpenProposal(item)}
                    >
                      <Text style={styles.actionButtonPrimaryText}>Enviar Proposta</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhuma solicitação encontrada</Text>
              </View>
            }
          />
        ) : tab === 'campaigns' ? (
          <FlatList
            data={campaigns.filter((c) =>
              !search ||
              c.name?.toLowerCase().includes(search.toLowerCase()) ||
              c.advertiser_name?.toLowerCase().includes(search.toLowerCase())
            )}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle}>Anunciante: {item.advertiser_name || 'GSA'}</Text>
                  </View>
                  {renderStatusBadge(item.status)}
                </View>

                <View style={styles.divider} />

                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardColLabel}>Impressões / Cliques:</Text>
                    <Text style={styles.cardColValue}>
                      {item.impression_count || 0} visualizações • {item.click_count || 0} cliques
                    </Text>
                  </View>
                  <View style={styles.cardColRight}>
                    <Text style={styles.cardColLabel}>Orçamento Total:</Text>
                    <Text style={[styles.cardColValue, { fontWeight: '900', color: '#0f172a' }]}>
                      R$ {Number(item.total_budget || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButtonOutline,
                      item.status === 'active' && { borderColor: '#f59e0b' },
                    ]}
                    onPress={() => handleToggleCampaign(item)}
                  >
                    <Text
                      style={[
                        styles.actionButtonOutlineText,
                        item.status === 'active' && { color: '#d97706' },
                      ]}
                    >
                      {item.status === 'active' ? '⏸ Pausar Campanha' : '▶ Ativar Campanha'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhuma campanha cadastrada</Text>
              </View>
            }
          />
        ) : tab === 'proposals' ? (
          <FlatList
            data={proposals}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Proposta #{item.id.slice(0, 8)}</Text>
                    <Text style={styles.cardSubtitle}>
                      Emitida em:{' '}
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '—'}
                    </Text>
                  </View>
                  {renderStatusBadge(item.status)}
                </View>
                <View style={styles.divider} />
                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardColLabel}>Valor Proposto:</Text>
                    <Text style={[styles.cardColValue, { fontWeight: '900', color: '#059669', fontSize: 16 }]}>
                      R$ {Number(item.total_amount || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhuma proposta encontrada</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={placements}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle}>
                      Código: {item.code} • Canal: {item.channel.toUpperCase()}
                    </Text>
                  </View>
                  {renderStatusBadge(item.is_active ? 'ativo' : 'inativo')}
                </View>
                <View style={styles.divider} />
                <View style={styles.cardRow}>
                  <View style={styles.cardCol}>
                    <Text style={styles.cardColLabel}>Capacidade Máxima:</Text>
                    <Text style={styles.cardColValue}>{item.capacity} anúncio(s)</Text>
                  </View>
                  <View style={styles.cardColRight}>
                    <Text style={styles.cardColLabel}>Preço Base / Mês:</Text>
                    <Text style={[styles.cardColValue, { fontWeight: '900', color: '#0f172a' }]}>
                      R$ {(Number(item.base_price_cents || 0) / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhum espaço cadastrado</Text>
              </View>
            }
          />
        )}

        {/* Modal: Enviar Proposta */}
        <Modal visible={isProposalModalOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Elaborar Proposta Comercial</Text>
              {selectedRequest && (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>{selectedRequest.company_name}</Text>
                  <Text style={styles.summarySub}>
                    Protocolo: {selectedRequest.protocol} • Contato: {selectedRequest.contact_name}
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Valor Total da Proposta (R$) *</Text>
              <TextInput
                style={styles.formInput}
                value={proposalAmount}
                onChangeText={setProposalAmount}
                keyboardType="numeric"
                placeholder="Ex: 2500.00"
              />

              <Text style={styles.inputLabel}>Duração da Campanha (Dias)</Text>
              <TextInput
                style={styles.formInput}
                value={proposalDays}
                onChangeText={setProposalDays}
                keyboardType="numeric"
                placeholder="30"
              />

              <Text style={styles.inputLabel}>Termos e Condições</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                value={proposalTerms}
                onChangeText={setProposalTerms}
                multiline
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setIsProposalModalOpen(false)}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonSave}
                  onPress={handleSaveProposal}
                  disabled={savingProposal}
                >
                  <Text style={styles.modalButtonSaveText}>
                    {savingProposal ? 'Enviando...' : 'Emitir Proposta'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Novo Espaço Publicitário */}
        <Modal visible={isPlacementModalOpen} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Novo Espaço Publicitário</Text>
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={styles.inputLabel}>Nome do Espaço *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newPlacement.name}
                  onChangeText={(t) => setNewPlacement({ ...newPlacement, name: t })}
                  placeholder="Ex: Banner Topo Portal"
                />

                <Text style={styles.inputLabel}>Código Identificador *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newPlacement.code}
                  onChangeText={(t) => setNewPlacement({ ...newPlacement, code: t })}
                  placeholder="Ex: PORTAL_TOP_BANNER"
                  autoCapitalize="characters"
                />

                <Text style={styles.inputLabel}>Canal</Text>
                <View style={styles.chipRowModal}>
                  {['website', 'portal', 'mobile_app', 'newsletter'].map((ch) => (
                    <TouchableOpacity
                      key={ch}
                      style={[styles.chipModal, newPlacement.channel === ch && styles.chipModalActive]}
                      onPress={() => setNewPlacement({ ...newPlacement, channel: ch })}
                    >
                      <Text
                        style={[
                          styles.chipModalText,
                          newPlacement.channel === ch && styles.chipModalTextActive,
                        ]}
                      >
                        {ch.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Preço Base Mensal (R$)</Text>
                <TextInput
                  style={styles.formInput}
                  value={newPlacement.base_price}
                  onChangeText={(t) => setNewPlacement({ ...newPlacement, base_price: t })}
                  keyboardType="numeric"
                  placeholder="500.00"
                />
              </ScrollView>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => setIsPlacementModalOpen(false)}
                >
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonSave}
                  onPress={handleSavePlacement}
                  disabled={savingPlacement}
                >
                  <Text style={styles.modalButtonSaveText}>
                    {savingPlacement ? 'Salvando...' : 'Cadastrar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  newButton: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#334155',
  },
  metricsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  metricCard: {
    width: 140,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  metricSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    paddingVertical: 10,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#059669',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#059669',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardCol: {
    flex: 1,
  },
  cardColRight: {
    alignItems: 'flex-end',
  },
  cardColLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  cardColValue: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  actionButtonOutline: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  actionButtonPrimary: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  summarySub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  chipRowModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  chipModal: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  chipModalActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  chipModalText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  chipModalTextActive: {
    color: '#059669',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalButtonCancel: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  modalButtonSave: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default AdvertisingAdminModuleScreen;
