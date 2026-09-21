const fs=require('fs');
const file=process.argv[2];
let s=fs.readFileSync(file,'utf8');
const must=(cond,msg)=>{if(!cond)throw new Error(msg)};
// imports
s=s.replace(/import \{ Search,[^\n]+ \} from 'lucide-react';/, "import { Search, MonitorPlay, Wallet, Users, Settings, Briefcase, Box, Plane, HeartPulse, ShieldAlert, BarChart3, Bot, Megaphone, Terminal, AlertCircle, Landmark, Truck, MessageSquare, Share2, Crown, ShieldCheck, Receipt, Store, Handshake, BellRing, Tags, Tv2 } from 'lucide-react';");
// expand actions idempotently
if(!s.includes("id: 'op_store'")) s=s.replace(/(\{ id: 'op_anuncios'[^\n]+\n)/, `$1  { id: 'op_store', title: 'GSA Store', subtitle: 'Comercial', icon: Store, keywords: ['loja', 'store', 'produtos', 'servicos', 'catalogo'], module: 'loja' },\n  { id: 'op_classificados', title: 'Classificados GSA', subtitle: 'Comercial', icon: Tags, keywords: ['classificados', 'anuncios', 'marketplace'], module: 'classificados' },\n`);
if(!s.includes("id: 'fin_fiscal'")) s=s.replace(/(\{ id: 'fin_cobranca'[^\n]+\n)/, `$1  { id: 'fin_fiscal', title: 'Fiscal e Notas', subtitle: 'Financeiro', icon: Receipt, keywords: ['fiscal', 'nota fiscal', 'nf', 'documentos fiscais'], module: 'fiscal' },\n`);
if(!s.includes("id: 'rel_parceiros'")) s=s.replace(/(  \{ id: 'rel_afiliados'[^\n]+\n)/, `  { id: 'rel_parceiros', title: 'Parceiros', subtitle: 'Relacionamento', icon: Handshake, keywords: ['parceiros', 'rede', 'beneficios'], module: 'parceiros' },\n$1  { id: 'rel_fidelidade', title: 'Fidelidade', subtitle: 'Relacionamento', icon: Crown, keywords: ['fidelidade', 'pontos', 'vouchers', 'premios'], module: 'fidelidade' },\n  { id: 'rel_comunicacao', title: 'Avisos e Campanhas', subtitle: 'Relacionamento', icon: BellRing, keywords: ['avisos', 'campanhas', 'comunicacao'], module: 'avisos-campanhas' },\n`);
if(!s.includes("id: 'sys_gsatv'")) s=s.replace(/(  \{ id: 'sys_monitor'[^\n]+\n)/, `$1  { id: 'sys_gsatv', title: 'GSA TV', subtitle: 'Gestão', icon: Tv2, keywords: ['gsa tv', 'tv', 'programacao', 'midia'], module: 'gsa-tv' },\n`);
// prop
if(!s.includes('canAccess?:')) s=s.replace(/(  onNavigate: \(module: string, tab\?: string, itemId\?: string\) => void;\n)/, `$1  canAccess?: (module: string, tab?: string) => boolean;\n`);
s=s.replace('export function AdminCommandPalette({ isOpen, onClose, onNavigate }: Props) {', 'export function AdminCommandPalette({ isOpen, onClose, onNavigate, canAccess }: Props) {');
if(!s.includes('const [selectedIndex')) s=s.replace("  const [query, setQuery] = useState('');", "  const [query, setQuery] = useState('');\n  const [selectedIndex, setSelectedIndex] = useState(0);");
s=s.replace(/setQuery\(''\);\n(\s+)setTimeout/, "setQuery('');\n      setSelectedIndex(0);\n$1setTimeout");
// remove old shortcut effect
s=s.replace(/\n  useEffect\(\(\) => \{\n    const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\n  \}, \[isOpen, onClose\]\);\n/, '\n');
// filtered block
const filteredRe=/  const filteredActions = GLOBAL_ACTIONS\.filter\(action => \{[\s\S]*?\n  \}\)\.slice\(0, 7\);/;
must(filteredRe.test(s),'filtered block not found');
s=s.replace(filteredRe, `  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\n  const filteredActions = GLOBAL_ACTIONS.filter((action) => {\n    if (canAccess && !canAccess(action.module, action.tab)) return false;\n    const searchStr = \`${'${action.title} ${action.subtitle} ${action.keywords.join(\' \')}'}\`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\n    return searchStr.includes(normalizedQuery);\n  }).slice(0, 9);\n\n  useEffect(() => {\n    setSelectedIndex(0);\n  }, [query, isOpen]);`);
// keyboard after execute
const execRe=/  const handleExecute = \(action: ActionItem\) => \{[\s\S]*?\n  \};/;
const exec=s.match(execRe)?.[0]; must(exec,'execute block missing');
if(!s.includes('ArrowDown')) s=s.replace(exec, exec+`\n\n  useEffect(() => {\n    if (!isOpen) return;\n    const handleKeyDown = (event: KeyboardEvent) => {\n      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }\n      if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex((index) => Math.min(index + 1, Math.max(0, filteredActions.length - 1))); return; }\n      if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex((index) => Math.max(0, index - 1)); return; }\n      if (event.key === 'Enter' && filteredActions[selectedIndex]) { event.preventDefault(); handleExecute(filteredActions[selectedIndex]); }\n    };\n    window.addEventListener('keydown', handleKeyDown);\n    return () => window.removeEventListener('keydown', handleKeyDown);\n  }, [filteredActions, isOpen, onClose, selectedIndex]);`);
s=s.replace('placeholder="Busque clientes, módulos ou comandos..."','placeholder="Busque módulos, áreas ou comandos..."');
// selected styling
s=s.replace(/onClick=\{\(\) => handleExecute\(action\)\}\n\s+className="group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-indigo-500\/20"/, `onClick={() => handleExecute(action)}\n                        onMouseEnter={() => setSelectedIndex(i)}\n                        className={\`group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition \${i === selectedIndex ? 'bg-indigo-500/20' : 'hover:bg-white/5'}\`}`);
s=s.replace(/className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white\/5 text-white\/50 transition group-hover:bg-indigo-500 group-hover:text-white shadow-sm"/, "className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition shadow-sm ${i === selectedIndex ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/50 group-hover:bg-indigo-500 group-hover:text-white'}`}");
fs.writeFileSync(file,s,'utf8');
console.log('patched palette',s.length, 'actions', (s.match(/ id: '/g)||[]).length);
