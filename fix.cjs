const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const missingBlock = `import { validarCPF, validarCNPJ, validarEmail } from '../utils/cpfValidator';
import { Modal } from '../components/ui/Modal';
import { logService } from '../lib/logService';
import { sessionService } from '../lib/sessionService';
import { LogoGSA } from '../components/ui/LogoGSA';
import { PinInput } from '../components/ui/PinInput';
import { consultarCEP } from '../utils/viaCep';
import { GSAEnterpriseHome } from '../components/public/GSAEnterpriseHome';

interface HomeProps {
  onLoginClient: (id: string) => void;
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
`;

const lines = c.split('\n');
// the missing block should go after line 6
// Let's first check if we already inserted it
if (c.indexOf('export function Home') === -1) {
  lines.splice(6, 0, missingBlock);
  fs.writeFileSync('src/pages/Home.tsx', lines.join('\n'));
  console.log('Fixed Home.tsx');
} else {
  console.log('Home.tsx seems to already have export function Home');
}
