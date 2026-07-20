const fs = require('fs');
let c = fs.readFileSync('src/pages/ClientPortal.tsx', 'utf8');

// 1. Add sessionService import
if (!c.includes("import { sessionService }")) {
  c = c.replace(
    "import { logService } from '../lib/logService';",
    "import { logService } from '../lib/logService';\nimport { sessionService } from '../lib/sessionService';"
  );
}

// 2. Add ForceChangePin component at the very end
const forceChangePinComponent = `

// --- COMPONENTE DE BLOQUEIO E TROCA OBRIGATÓRIA DE PIN ---
function ForceChangePin({ onPinChanged }: { onPinChanged: () => void }) {
  const [newPin, setNewPin] = React.useState('');
  const [newPinConfirm, setNewPinConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || newPinConfirm.length !== 4) {
      toast.error('O PIN deve conter 4 dígitos.');
      return;
    }
    if (newPin !== newPinConfirm) {
      toast.error('Os PINs não coincidem.');
      return;
    }
    
    setLoading(true);
    try {
      await sessionService.updateClientPin(newPin);
      toast.success('Senha atualizada com sucesso!');
      onPinChanged();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black/40 backdrop-blur-sm fixed inset-0 z-[9999]">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-black text-center text-neutral-900 mb-2">Redefinir Senha</h2>
        <p className="text-center text-sm text-neutral-500 mb-6">
          Você acessou via recuperação. Para liberar o sistema, crie um novo PIN numérico de 4 dígitos.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-neutral-400">Novo PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\\D/g, ''))}
              className="w-full rounded-2xl border-transparent bg-neutral-100 px-4 py-3.5 text-center text-2xl tracking-[1em] font-bold text-neutral-900 transition-all placeholder:text-neutral-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              placeholder="****"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-neutral-400">Confirmar Novo PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={newPinConfirm}
              onChange={e => setNewPinConfirm(e.target.value.replace(/\\D/g, ''))}
              className="w-full rounded-2xl border-transparent bg-neutral-100 px-4 py-3.5 text-center text-2xl tracking-[1em] font-bold text-neutral-900 transition-all placeholder:text-neutral-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              placeholder="****"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 rounded-2xl bg-[#1a1a1a] py-4 text-sm font-bold text-white transition-all hover:bg-black disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
`;

if (!c.includes('function ForceChangePin(')) {
  c += forceChangePinComponent;
}

// 3. Add state and logic inside ClientPortal
if (!c.includes('const [mustChangePin, setMustChangePin]')) {
  c = c.replace(
    'const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);',
    `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n  const [mustChangePin, setMustChangePin] = useState(false);\n\n  useEffect(() => {\n    const s = sessionService.getCurrentSession();\n    if (s?.precisa_trocar_senha) {\n      setMustChangePin(true);\n    }\n  }, []);`
  );
}

// 4. Return ForceChangePin component BEFORE DashboardLayout if mustChangePin is true
if (!c.includes('if (mustChangePin) {')) {
  c = c.replace(
    'return (\n    <DashboardLayout',
    `if (mustChangePin) {
    return <ForceChangePin onPinChanged={() => setMustChangePin(false)} />;
  }

  return (
    <DashboardLayout`
  );
}

fs.writeFileSync('src/pages/ClientPortal.tsx', c);
console.log('ClientPortal.tsx updated successfully');
