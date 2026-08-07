import { useState, useEffect } from 'react';
import { infraService, CloudflareZone, CloudflareDnsRecord } from '../../../lib/infraService';
import { Globe, Shield, Zap, RefreshCw, AlertTriangle, Trash2, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function CloudflareManager() {
  const [zone, setZone] = useState<CloudflareZone | null>(null);
  const [dnsRecords, setDnsRecords] = useState<CloudflareDnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingDevMode, setTogglingDevMode] = useState(false);
  const [togglingAttackMode, setTogglingAttackMode] = useState(false);
  const [purgingCache, setPurgingCache] = useState(false);

  const fetchCloudflareData = async () => {
    setLoading(true);
    try {
      const [zoneRes, dnsRes] = await Promise.all([
        infraService.getCloudflareZone(),
        infraService.getCloudflareDns()
      ]);
      setZone(zoneRes.result);
      setDnsRecords(dnsRes.result || []);
    } catch (e: any) {
      toast.error('Erro ao buscar dados do Cloudflare: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCloudflareData();
  }, []);

  const handleDevMode = async (enable: boolean) => {
    setTogglingDevMode(true);
    try {
      await infraService.setDevelopmentMode(enable);
      toast.success(enable ? 'Modo Desenvolvedor ativado' : 'Modo Desenvolvedor desativado');
      void fetchCloudflareData();
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally {
      setTogglingDevMode(false);
    }
  };

  const handleUnderAttackMode = async (enable: boolean) => {
    setTogglingAttackMode(true);
    try {
      await infraService.setUnderAttackMode(enable);
      toast.success(enable ? 'Under Attack Mode ATIVADO!' : 'Under Attack Mode desativado');
      void fetchCloudflareData();
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally {
      setTogglingAttackMode(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!confirm('Deseja limpar todo o cache (Purge Everything)? O tráfego do servidor pode aumentar abruptamente.')) return;
    setPurgingCache(true);
    try {
      await infraService.purgeCloudflareCache();
      toast.success('Cache limpo com sucesso!');
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally {
      setPurgingCache(false);
    }
  };

  if (loading && !zone) {
    return <div className="flex p-10 justify-center"><RefreshCw className="animate-spin text-neutral-400" /></div>;
  }

  if (!zone) return <div className="p-5 text-red-500">Falha ao carregar dados do Cloudflare. Verifique as credenciais da Edge Function.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Globe className="w-5 h-5"/></span>
              <span className="text-xl font-black text-neutral-900">{zone.name}</span>
            </div>
            <h4 className="text-xs uppercase font-bold text-neutral-400">Status da Zona</h4>
            <div className="mt-2 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${zone.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              <span className="text-sm font-bold uppercase">{zone.status}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Zap className="w-5 h-5"/></span>
              <span className={`text-sm font-black px-2 py-1 rounded ${zone.development_mode > 0 ? 'bg-orange-100 text-orange-700' : 'bg-neutral-100 text-neutral-700'}`}>
                {zone.development_mode > 0 ? 'ON' : 'OFF'}
              </span>
            </div>
            <h4 className="text-xs uppercase font-bold text-neutral-400">Development Mode</h4>
            <p className="text-[10px] text-neutral-500 mt-1">Ignora o cache para desenvolvimento (Expira em 3h).</p>
          </div>
          <button 
            disabled={togglingDevMode}
            onClick={() => void handleDevMode(zone.development_mode === 0)}
            className="mt-4 w-full py-2 text-xs font-bold rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            {togglingDevMode ? 'Alternando...' : (zone.development_mode > 0 ? 'Desativar Dev Mode' : 'Ativar Dev Mode')}
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="p-2 bg-red-50 text-red-600 rounded-lg"><Shield className="w-5 h-5"/></span>
            </div>
            <h4 className="text-xs uppercase font-bold text-neutral-400">Under Attack Mode</h4>
            <p className="text-[10px] text-neutral-500 mt-1">Ative caso o site esteja sob ataque DDoS intenso.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button 
              disabled={togglingAttackMode}
              onClick={() => void handleUnderAttackMode(true)}
              className="flex-1 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200"
            >
              Ativar
            </button>
            <button 
              disabled={togglingAttackMode}
              onClick={() => void handleUnderAttackMode(false)}
              className="flex-1 py-2 text-xs font-bold rounded-lg bg-neutral-50 text-neutral-600 hover:bg-neutral-100 transition-colors border border-neutral-200"
            >
              Desativar
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button 
          disabled={purgingCache}
          onClick={() => void handlePurgeCache()}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${purgingCache ? 'animate-spin' : ''}`} />
          Purge Everything (Limpar Cache Global)
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
          <h3 className="font-bold">Gerenciamento de DNS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-xs text-neutral-500 font-bold uppercase">
              <tr>
                <th className="px-5 py-3 border-b">Tipo</th>
                <th className="px-5 py-3 border-b">Nome</th>
                <th className="px-5 py-3 border-b">Conteúdo</th>
                <th className="px-5 py-3 border-b">Status Proxied</th>
                <th className="px-5 py-3 border-b text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dnsRecords.map(record => (
                <tr key={record.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3 font-mono font-bold text-neutral-700">{record.type}</td>
                  <td className="px-5 py-3 font-bold">{record.name}</td>
                  <td className="px-5 py-3 text-neutral-600 truncate max-w-[200px]" title={record.content}>{record.content}</td>
                  <td className="px-5 py-3">
                    {record.proxied ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">
                        <Globe className="w-3 h-3" /> Proxied
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                        DNS Only
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-1 text-neutral-400 hover:text-indigo-600"><Edit className="w-4 h-4"/></button>
                      <button className="p-1 text-neutral-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dnsRecords.length === 0 && <div className="p-5 text-center text-neutral-500">Nenhum registro DNS encontrado.</div>}
        </div>
      </div>
    </div>
  );
}
