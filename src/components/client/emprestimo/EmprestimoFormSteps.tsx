import React, { useState, useEffect, ChangeEvent } from 'react';
import { Upload, CheckCircle, Trash2, HelpCircle, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { validarCPF, mascararCPF, mascararRG, mascararTelefone, mascararCEP } from '../../../utils/cpfValidator';
import { consultarCEP } from '../../../utils/viaCep';
import { maskCurrency, handleCurrencyInputChange } from '../../../lib/utils';

interface DadosPessoais {
  nome_completo: string;
  data_nascimento: string;
  rg: string;
  cpf: string;
  telefone: string;
  cep: string;
  numero_casa: string;
  endereco_rua: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  email: string;
}

interface DadosEmprestimo {
  valor_desejado: string;
  parcelas_desejadas: number;
}

interface DocFiles {
  cnh: File | null;
  comprovante_endereco: File | null;
  holerite: File | null;
  foto_perfil: File | null;
}

// Tooltip helper
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <HelpCircle className="h-3.5 w-3.5 text-neutral-400 cursor-help inline" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={() => setShow(!show)} />
      {show && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-neutral-900 text-white text-[10px] rounded-lg shadow-lg z-50 leading-relaxed">{text}</span>}
    </span>
  );
}

// Input wrapper
function Field({ label, tooltip, children, required, onEditClick }: { label: string; tooltip?: string; children: React.ReactNode; required?: boolean; onEditClick?: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-neutral-700 uppercase tracking-widest pl-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          {tooltip && <Tooltip text={tooltip} />}
        </label>
        {onEditClick && (
          <button 
            onClick={onEditClick}
            className="flex items-center gap-1 text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors uppercase"
            title="Solicitar alteração deste dado"
          >
            <Edit2 className="h-3 w-3" /> Alterar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none";
const readonlyClass = "w-full bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold text-neutral-500 cursor-not-allowed outline-none";

// ==================== STEP 1: Dados Pessoais ====================
export function StepDadosPessoais({ dados, setDados, onRequestEditField }: { dados: DadosPessoais; setDados: (d: DadosPessoais) => void, onRequestEditField?: (fieldLabel: string, currentValue: string) => void }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cpfValid, setCpfValid] = useState<boolean | null>(null);

  const handleCEPChange = async (value: string) => {
    try {
      const masked = mascararCEP(value);
      setDados({ ...dados, cep: masked });
      const clean = masked.replace(/\D/g, '');
      if (clean.length === 8) {
        setCepLoading(true);
        const result = await consultarCEP(clean);
        setCepLoading(false);
        if (result) {
          setDados({ ...dados, cep: masked, endereco_rua: result.logradouro, endereco_bairro: result.bairro, endereco_cidade: result.localidade, endereco_uf: result.uf });
          toast.success('Endereço encontrado!');
        } else {
          toast.error('CEP não encontrado.');
        }
      }
    } catch (e) {
      setCepLoading(false);
      toast.error('Erro ao buscar o CEP.');
    }
  };

  const handleCPFChange = (value: string) => {
    const masked = mascararCPF(value);
    setDados({ ...dados, cpf: masked });
    const clean = masked.replace(/\D/g, '');
    if (clean.length === 11) setCpfValid(validarCPF(clean));
    else setCpfValid(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Dados Pessoais</h3>
        <p className="text-xs text-neutral-500 font-medium tracking-wide">Preencha seus dados para a análise de crédito</p>
      </div>
      <div className="space-y-4 bg-white p-5 rounded-2xl ring-1 ring-neutral-200">
        <Field label="Nome Completo" required onEditClick={() => onRequestEditField?.('Nome Completo', dados.nome_completo)}>
          <input type="text" value={dados.nome_completo} readOnly className={readonlyClass} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Data de Nascimento" required>
            <input type="date" value={dados.data_nascimento} onChange={e => setDados({ ...dados, data_nascimento: e.target.value })} className={inputClass} />
          </Field>
          <Field label="RG" required>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={dados.rg} onChange={e => setDados({ ...dados, rg: mascararRG(e.target.value) })} placeholder="000000000" className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CPF" required tooltip="Informe seu CPF válido com 11 dígitos" onEditClick={() => onRequestEditField?.('CPF', dados.cpf)}>
            <div className="relative">
              <input type="text" value={dados.cpf} readOnly className={readonlyClass} />
              {cpfValid !== null && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold">{cpfValid ? '✅' : '❌'}</span>}
            </div>
          </Field>
          <Field label="Telefone" required onEditClick={() => onRequestEditField?.('Telefone', dados.telefone)}>
            <input type="text" value={dados.telefone} readOnly className={readonlyClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CEP" required tooltip="Digite o CEP para preencher o endereço automaticamente" onEditClick={() => onRequestEditField?.('CEP', dados.cep)}>
            <div className="relative">
              <input type="text" value={dados.cep} readOnly className={readonlyClass} />
            </div>
          </Field>
          <Field label="Nº Casa" required onEditClick={() => onRequestEditField?.('Número da Casa', dados.numero_casa)}>
            <input type="text" value={dados.numero_casa} readOnly className={readonlyClass} />
          </Field>
        </div>
        {dados.endereco_rua && (
          <div className="bg-indigo-50 rounded-xl p-3 ring-1 ring-indigo-100 animate-in fade-in flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Endereço</p>
              <p className="text-xs font-medium text-indigo-900">{dados.endereco_rua}, {dados.endereco_bairro} — {dados.endereco_cidade}/{dados.endereco_uf}</p>
            </div>
            <button onClick={() => onRequestEditField?.('Endereço', `${dados.endereco_rua}, ${dados.endereco_bairro} - ${dados.endereco_cidade}/${dados.endereco_uf}`)} className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase flex items-center gap-1">
              <Edit2 className="h-3 w-3" /> Alterar
            </button>
          </div>
        )}
        <Field label="E-mail" required onEditClick={() => onRequestEditField?.('E-mail', dados.email)}>
          <input type="email" value={dados.email} readOnly className={readonlyClass} />
        </Field>
      </div>
    </div>
  );
}

// ==================== STEP 2: Valor e Condições ====================
export function StepValorCondicoes({ dados, setDados }: { dados: DadosEmprestimo; setDados: (d: DadosEmprestimo) => void }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Valor e Condições</h3>
        <p className="text-xs text-neutral-500 font-medium">Informe o valor desejado e as condições do empréstimo</p>
      </div>
      <div className="space-y-5 bg-white p-5 rounded-2xl ring-1 ring-neutral-200">
        <Field label="Valor Total Desejado (R$)" required tooltip="Valor que você deseja receber como empréstimo">
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-black text-sm group-focus-within:text-indigo-500 transition-colors">R$</span>
            <input 
              type="text" 
              inputMode="decimal"
              value={maskCurrency(dados.valor_desejado)} 
              onChange={e => handleCurrencyInputChange(e.target.value, (val) => setDados({ ...dados, valor_desejado: val.toString() }))}
              placeholder="0,00" 
              className={`${inputClass} text-2xl font-black text-right pr-6 pl-12 h-16`} 
            />
          </div>
        </Field>
        <Field label="Quantidade de Parcelas Desejadas" required tooltip="Quantas parcelas você gostaria de pagar">
          <div className="relative group">
            <input 
              type="number" 
              inputMode="numeric"
              min={1} 
              max={120} 
              value={dados.parcelas_desejadas || ''} 
              onChange={e => setDados({ ...dados, parcelas_desejadas: parseInt(e.target.value) || 0 })} 
              placeholder="12" 
              className={`${inputClass} font-black text-lg`} 
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400 uppercase tracking-widest">Parcelas</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

// ==================== STEP 3: Documentos ====================
export function StepDocumentos({ docs, setDocs }: { docs: DocFiles; setDocs: (d: DocFiles) => void }) {
  const docTypes: { key: keyof DocFiles; label: string; desc: string }[] = [
    { key: 'cnh', label: 'CNH', desc: 'Carteira Nacional de Habilitação' },
    { key: 'comprovante_endereco', label: 'Comprovante de Endereço', desc: 'Conta de luz, água ou gás recente' },
    { key: 'holerite', label: 'Holerite / Comprovante de Renda', desc: 'Último contracheque ou declaração de renda' },
    { key: 'foto_perfil', label: 'Foto de Perfil', desc: 'Selfie segurando um documento' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Documentos Obrigatórios</h3>
        <p className="text-xs text-neutral-500 font-medium">Envie os documentos para análise de crédito</p>
      </div>
      <div className="space-y-3">
        {docTypes.map(dt => (
          <label key={dt.key} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 cursor-pointer hover:ring-indigo-500 transition-all group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center ${docs[dt.key] ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                {docs[dt.key] ? <CheckCircle className="h-5 w-5" /> : <Upload className="h-5 w-5 group-hover:text-indigo-500" />}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-neutral-900 truncate">{dt.label}</p>
                <p className="text-[10px] text-neutral-400 truncate">{docs[dt.key] ? docs[dt.key]!.name : dt.desc}</p>
              </div>
            </div>
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0];
              if (f) setDocs({ ...docs, [dt.key]: f });
            }} />
            {docs[dt.key] ? (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-black uppercase">Pronto</span>
            ) : (
              <span className="text-[10px] bg-red-50 text-red-500 px-2 py-1 rounded-lg font-black uppercase">Pendente</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

// ==================== STEP 4: Confirmação ====================
export function StepConfirmacao({ pessoais, emprestimo, docs }: { pessoais: DadosPessoais; emprestimo: DadosEmprestimo; docs: DocFiles }) {
  const docsCount = [docs.cnh, docs.comprovante_endereco, docs.holerite, docs.foto_perfil].filter(Boolean).length;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Confirmar Solicitação</h3>
        <p className="text-xs text-neutral-500 font-medium">Revise os dados antes de enviar</p>
      </div>
      <div className="bg-white rounded-2xl p-6 ring-1 ring-neutral-200 space-y-4">
        <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Nome</p><p className="text-sm font-bold text-neutral-800">{pessoais.nome_completo}</p></div>
        <div className="grid grid-cols-2 gap-4">
          <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">CPF</p><p className="text-sm font-bold text-neutral-800">{pessoais.cpf}</p></div>
          <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">RG</p><p className="text-sm font-bold text-neutral-800">{pessoais.rg}</p></div>
        </div>
        <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Endereço</p><p className="text-xs text-neutral-700">{pessoais.endereco_rua}, {pessoais.numero_casa} — {pessoais.endereco_bairro}, {pessoais.endereco_cidade}/{pessoais.endereco_uf}</p></div>
        <div className="border-t border-neutral-100 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Valor</p><p className="text-lg font-black text-indigo-600">R$ {maskCurrency(emprestimo.valor_desejado)}</p></div>
            <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Parcelas</p><p className="text-sm font-bold">{emprestimo.parcelas_desejadas}x</p></div>
            <div><p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Documentos</p><p className="text-sm font-bold">{docsCount}/4</p></div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 flex gap-3">
        <span className="text-lg">📋</span>
        <div>
          <p className="text-xs font-bold text-amber-900">Sua proposta entrará em análise interna</p>
          <p className="text-[10px] text-amber-700 mt-1">Prazo de retorno: <strong>05 dias úteis</strong></p>
        </div>
      </div>
    </div>
  );
}

export type { DadosPessoais, DadosEmprestimo, DocFiles };
