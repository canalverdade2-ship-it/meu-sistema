import React, { useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plane,
  Plus,
  Route,
  Send,
  UserRound,
  Users,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { toast } from 'react-hot-toast';

interface TravelQuoteRequestPageProps {
  clientId?: string;
  onBack: () => void;
  onRequireAuth?: () => void;
}

type TravelerField = 'adultos' | 'criancas' | 'bebes';

const fieldClassName =
  'h-12 w-full rounded-xl border border-[#0c2340]/15 bg-[#fbfbfa] px-4 text-sm font-medium text-[#172033] outline-none transition focus:border-[#168ac1] focus:bg-white focus:ring-4 focus:ring-[#38bdf8]/10';
const iconFieldClassName = `${fieldClassName} pl-11`;
const labelClassName =
  'mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#5f6875]';

const accommodationLabels: Record<string, string> = {
  economico: 'Econômico',
  '4_estrelas': 'Conforto',
  '5_estrelas': 'Luxo',
  resort_all_inclusive: 'All inclusive',
  indiferente: 'Melhor oportunidade',
};

function formatTravelDate(value: string) {
  if (!value) return 'A definir';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`));
}

interface PassengerStepperProps {
  label: string;
  detail: string;
  value: number;
  minimum: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

function PassengerStepper({
  label,
  detail,
  value,
  minimum,
  onDecrease,
  onIncrease,
}: PassengerStepperProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-[#0c2340]/10 bg-[#fbfbfa] p-3 sm:block sm:p-4">
      <div className="min-w-0 sm:mb-3">
        <p className="truncate text-xs font-bold text-[#172033] sm:text-sm">{label}</p>
        <p className="truncate text-[10px] text-neutral-500 sm:text-xs">{detail}</p>
      </div>
      <div className="flex w-28 shrink-0 items-center justify-between gap-2 sm:w-auto">
        <button
          type="button"
          onClick={onDecrease}
          disabled={value <= minimum}
          aria-label={`Diminuir ${label.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0c2340]/10 bg-white text-[#0c2340] transition hover:border-[#168ac1] hover:text-[#168ac1] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-6 text-center text-base font-black text-[#0c2340]">{value}</span>
        <button
          type="button"
          onClick={onIncrease}
          aria-label={`Aumentar ${label.toLowerCase()}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c2340] text-white transition hover:bg-[#168ac1]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TravelQuoteRequestPage({ clientId, onBack, onRequireAuth }: TravelQuoteRequestPageProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    origem: '',
    destino: '',
    data_ida: '',
    data_volta: '',
    flexibilidade: '3_dias',
    adultos: 2,
    criancas: 0,
    bebes: 0,
    preferencia_hospedagem: '4_estrelas',
    observacoes: '',
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const changeTravelerCount = (field: TravelerField, delta: number, minimum: number) => {
    setFormData((previous) => ({
      ...previous,
      [field]: Math.max(minimum, Number(previous[field]) + delta),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!clientId && onRequireAuth) {
      toast('Faça login para enviar o orçamento', { icon: '🔒' });
      onRequireAuth();
      return;
    }

    setLoading(true);
    try {
      const protocolo = `VIAGEM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { error } = await supabase.from('viagens_orcamentos').insert({
        cliente_id: clientId,
        protocolo,
        ...formData,
      });

      if (error) throw error;

      toast.success('Orçamento solicitado com sucesso!');
      navigate(routes.marketplace.travelPackages.root());
    } catch (error) {
      console.error('Erro ao solicitar orçamento:', error);
      toast.error('Erro ao enviar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const totalTravelers =
    Number(formData.adultos) + Number(formData.criancas) + Number(formData.bebes);

  return (
    <div className="min-h-screen bg-[#f5f3ee] pb-24 font-sans text-[#172033]">
      <nav className="sticky top-0 z-50 shrink-0 border-b border-black/[0.06] bg-[#f5f3ee]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white hover:text-[#0c2340]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="mx-3 h-6 w-px bg-black/10" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0c2340] shadow-sm">
              <Plane className="h-5 w-5 text-[#38bdf8]" />
            </div>
            <span className="text-base font-black tracking-tight text-[#0c2340]">Monte sua viagem</span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="max-w-3xl border-b border-[#0c2340]/10 pb-7 sm:pb-9">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-[#168ac1]">
            Roteiro personalizado
          </p>
          <h1
            className="max-w-2xl text-3xl font-bold leading-[1.08] text-[#0c2340] sm:text-5xl"
            style={{ fontFamily: '"Cinzel", serif' }}
          >
            Conte como quer viajar.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
            Destino, datas e viajantes. Nossa equipe cuida das melhores opções.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-hidden rounded-[24px] border border-[#0c2340]/10 bg-white shadow-[0_18px_50px_rgba(12,35,64,0.08)] sm:rounded-[28px]">
            <div className="grid grid-cols-3 border-b border-[#0c2340]/10 bg-[#f8fafb]">
              {[
                { number: '01', label: 'Rota' },
                { number: '02', label: 'Viajantes' },
                { number: '03', label: 'Contato' },
              ].map((step) => (
                <div key={step.number} className="flex items-center justify-center gap-2 border-r border-[#0c2340]/10 px-2 py-3 last:border-r-0">
                  <span className="text-[10px] font-black text-[#168ac1]">{step.number}</span>
                  <span className="text-[11px] font-bold text-[#0c2340] sm:text-xs">{step.label}</span>
                </div>
              ))}
            </div>

            <section className="border-b border-[#0c2340]/10 p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f6fb] text-[#0f789d]">
                  <Route className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-[#0c2340]">Rota e datas</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="travel-origin" className={labelClassName}>Origem</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#168ac1]" />
                    <input
                      id="travel-origin"
                      type="text"
                      name="origem"
                      value={formData.origem}
                      onChange={handleChange}
                      placeholder="Cidade de partida"
                      required
                      className={iconFieldClassName}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="travel-destination" className={labelClassName}>Destino</label>
                  <div className="relative">
                    <Plane className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#168ac1]" />
                    <input
                      id="travel-destination"
                      type="text"
                      name="destino"
                      value={formData.destino}
                      onChange={handleChange}
                      placeholder="Para onde deseja ir?"
                      required
                      className={iconFieldClassName}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="travel-departure" className={labelClassName}>Ida</label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#168ac1]" />
                    <input
                      id="travel-departure"
                      type="date"
                      name="data_ida"
                      value={formData.data_ida}
                      onChange={handleChange}
                      required
                      className={iconFieldClassName}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="travel-return" className={labelClassName}>Volta</label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#168ac1]" />
                    <input
                      id="travel-return"
                      type="date"
                      name="data_volta"
                      value={formData.data_volta}
                      onChange={handleChange}
                      required
                      className={iconFieldClassName}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="travel-flexibility" className={labelClassName}>Flexibilidade</label>
                  <select
                    id="travel-flexibility"
                    name="flexibilidade"
                    value={formData.flexibilidade}
                    onChange={handleChange}
                    className={fieldClassName}
                  >
                    <option value="exata">Datas exatas</option>
                    <option value="3_dias">± 3 dias</option>
                    <option value="mes_inteiro">Mês inteiro</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="border-b border-[#0c2340]/10 p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf0ff] text-[#4655d8]">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-[#0c2340]">Viajantes</h2>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <PassengerStepper
                  label="Adultos"
                  detail="12+ anos"
                  value={Number(formData.adultos)}
                  minimum={1}
                  onDecrease={() => changeTravelerCount('adultos', -1, 1)}
                  onIncrease={() => changeTravelerCount('adultos', 1, 1)}
                />
                <PassengerStepper
                  label="Crianças"
                  detail="2 a 11"
                  value={Number(formData.criancas)}
                  minimum={0}
                  onDecrease={() => changeTravelerCount('criancas', -1, 0)}
                  onIncrease={() => changeTravelerCount('criancas', 1, 0)}
                />
                <PassengerStepper
                  label="Bebês"
                  detail="0 a 23m"
                  value={Number(formData.bebes)}
                  minimum={0}
                  onDecrease={() => changeTravelerCount('bebes', -1, 0)}
                  onIncrease={() => changeTravelerCount('bebes', 1, 0)}
                />
              </div>
            </section>

            <section className="border-b border-[#0c2340]/10 p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3edff] text-[#7c3aed]">
                  <BedDouble className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-[#0c2340]">Preferências</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="travel-accommodation" className={labelClassName}>Hospedagem</label>
                  <select
                    id="travel-accommodation"
                    name="preferencia_hospedagem"
                    value={formData.preferencia_hospedagem}
                    onChange={handleChange}
                    className={fieldClassName}
                  >
                    <option value="economico">Econômico / 3 estrelas</option>
                    <option value="4_estrelas">Conforto / 4 estrelas</option>
                    <option value="5_estrelas">Luxo / 5 estrelas</option>
                    <option value="resort_all_inclusive">Resort all inclusive</option>
                    <option value="indiferente">Melhor oportunidade</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="travel-notes" className={labelClassName}>Pedido especial</label>
                  <textarea
                    id="travel-notes"
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleChange}
                    placeholder="Lua de mel, acessibilidade..."
                    rows={3}
                    className="min-h-[48px] w-full resize-y rounded-xl border border-[#0c2340]/15 bg-[#fbfbfa] px-4 py-3 text-sm font-medium text-[#172033] outline-none transition focus:border-[#168ac1] focus:bg-white focus:ring-4 focus:ring-[#38bdf8]/10"
                  />
                </div>
              </div>
            </section>

            {!clientId && (
              <section className="border-b border-[#0c2340]/10 p-5 sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf8f4] text-[#128765]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#0c2340]">Seus dados</h2>
                    <p className="text-xs text-neutral-500">Para retornarmos sobre esta solicitação.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="travel-name" className={labelClassName}>Nome completo</label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#128765]" />
                      <input
                        id="travel-name"
                        type="text"
                        name="nome"
                        value={formData.nome}
                        onChange={handleChange}
                        autoComplete="name"
                        required
                        className={iconFieldClassName}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="travel-email" className={labelClassName}>E-mail</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#128765]" />
                      <input
                        id="travel-email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                        className={iconFieldClassName}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="travel-phone" className={labelClassName}>Telefone</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#128765]" />
                      <input
                        id="travel-phone"
                        type="tel"
                        name="telefone"
                        value={formData.telefone}
                        onChange={handleChange}
                        autoComplete="tel"
                        placeholder="(00) 00000-0000"
                        required
                        className={iconFieldClassName}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="bg-[#f8fafb] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-7">
              <p className="mb-4 text-xs leading-5 text-neutral-500 sm:mb-0 sm:max-w-[15rem]">
                {clientId ? 'Retorno em até 48 horas úteis.' : 'Você entrará na sua conta antes do envio.'}
              </p>
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#0c2340] px-6 text-sm font-black text-white shadow-[0_10px_24px_rgba(12,35,64,0.2)] transition hover:bg-[#168ac1] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Solicitar orçamento
                  </>
                )}
              </button>
            </div>
          </div>

          <aside className="hidden rounded-[24px] bg-[#0c2340] p-6 text-white shadow-[0_18px_50px_rgba(12,35,64,0.16)] lg:sticky lg:top-24 lg:block">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#76d3f5]">Resumo da viagem</p>
            <div className="mt-6 border-b border-white/15 pb-5">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#76d3f5]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{formData.origem || 'Origem'}</p>
                  <p className="my-1 text-xs text-white/45">para</p>
                  <p className="truncate text-sm font-bold">{formData.destino || 'Destino'}</p>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-white/10 text-sm">
              <div className="flex items-center justify-between gap-3 py-4">
                <dt className="text-white/55">Datas</dt>
                <dd className="text-right font-bold">{formatTravelDate(formData.data_ida)} · {formatTravelDate(formData.data_volta)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-4">
                <dt className="text-white/55">Viajantes</dt>
                <dd className="font-bold">{totalTravelers}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-4">
                <dt className="text-white/55">Hospedagem</dt>
                <dd className="text-right font-bold">{accommodationLabels[formData.preferencia_hospedagem]}</dd>
              </div>
            </dl>
          </aside>
        </form>
      </main>
    </div>
  );
}
