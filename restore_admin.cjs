const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminPanel.tsx', 'utf8');

const regex = /    return \(\) => clearInterval\(t\);[\s\S]*?const fetchModulos = async \(\) => \{/;

const replacement = `    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden md:flex h-9 px-3.5 items-center justify-center gap-2 rounded-xl bg-white shadow-sm ring-1 ring-black/5 text-sm font-bold text-neutral-700 tabular-nums">
      <Clock className="h-4 w-4 text-neutral-400" />
      {time.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

export function AdminPanel({ onLogout, adminType, colaboradorId, colaboradorModulos }: AdminPanelProps) {
  const { pendencies, notifications, unreadNotifications, markAsRead, markAllAsRead, deleteAllNotifications } = useAdminNotifications();
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [activeItemId, setActiveItemId] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [newCodeModal, setNewCodeModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [moduleKey, setModuleKey] = useState(0);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sincroniza scroll ao topo sempre que muda de módulo, aba ou item
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeModule, activeTab, activeItemId]);

  const [colaboradorNome, setColaboradorNome] = useState<string | null>(null);
  const [internalModulos, setInternalModulos] = useState<string[]>(colaboradorModulos || []);

  useEffect(() => {
    const fetchColaboradorNome = async () => {
      if (adminType === 'colaborador' && colaboradorId) {
        const { data } = await supabase.from('colaboradores').select('nome').eq('id', colaboradorId).single();
        if (data?.nome) {
          setColaboradorNome(data.nome);
          localStorage.setItem('colaboradorNome', data.nome);
        }
      }
    };
    fetchColaboradorNome();
  }, [adminType, colaboradorId]);

  // Sincronização em tempo real dos módulos do colaborador
  useEffect(() => {
    if (adminType !== 'colaborador' || !colaboradorId) return;

    const fetchModulos = async () => {`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/pages/AdminPanel.tsx', content);
    console.log('Fixed successfully with regex');
} else {
    console.log('Broken part not found with regex.');
}
