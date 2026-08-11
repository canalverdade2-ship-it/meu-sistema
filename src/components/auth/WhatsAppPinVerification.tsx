import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, RefreshCw, ArrowRight, MessageCircle, AlertCircle, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { whatsappNotificationService } from '../../lib/whatsappNotificationService';
import { toast } from 'react-hot-toast';

interface WhatsAppPinVerificationProps {
  initialPhone: string;
  onVerified: (verifiedPhone: string) => void;
  onCancel?: () => void;
}

export function WhatsAppPinVerification({ initialPhone, onVerified, onCancel }: WhatsAppPinVerificationProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [step, setStep] = useState<'confirm_phone' | 'enter_pin'>('confirm_phone');
  
  const [pin, setPin] = useState(['', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: any;
    if (step === 'enter_pin' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    let formatted = raw;
    if (raw.length <= 11) {
      formatted = raw.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5}|\d{4})(\d)/, '$1-$2');
    }
    setPhone(formatted.substring(0, 15));
  };

  const handleRequestPin = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Informe um número de WhatsApp válido.');
      return;
    }

    setLoading(true);
    try {
      // 1. Solicita o PIN via RPC
      const { data: plainPin, error } = await supabase.rpc('gsa_solicitar_pin_whatsapp', {
        p_telefone: cleanPhone
      });

      if (error) throw error;
      if (!plainPin) throw new Error('Não foi possível gerar o código.');

      // 2. Dispara o WhatsApp
      const mensagem = `Olá! Seu código de verificação do GSA é: *${plainPin}*\n\nEste código é válido por 1 minuto. Não compartilhe com ninguém.`;
      
      const enviou = await whatsappNotificationService.enviarWhatsAppDireto(cleanPhone, mensagem);
      
      if (!enviou) {
        toast.error('Houve uma falha ao tentar enviar a mensagem para o WhatsApp informado.');
      } else {
        toast.success('Código enviado para o seu WhatsApp!');
        setStep('enter_pin');
        setTimeLeft(60);
        setPin(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      console.error('Erro ao solicitar PIN:', err);
      toast.error(err.message || 'Erro interno ao solicitar o código.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-advance
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit se todos preenchidos
    if (index === 3 && value && newPin.every(d => d !== '')) {
      handleVerifyPin(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyPin = async (fullPin: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    setLoading(true);
    try {
      const { data: isValid, error } = await supabase.rpc('gsa_validar_pin_whatsapp', {
        p_telefone: cleanPhone,
        p_pin: fullPin
      });

      if (error) throw error;
      
      if (isValid) {
        toast.success('WhatsApp verificado com sucesso!');
        onVerified(cleanPhone);
      } else {
        toast.error('Código inválido ou expirado.');
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      console.error('Erro ao validar PIN:', err);
      toast.error('Erro ao verificar o código.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'confirm_phone') {
    return (
      <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
        <div className="mb-6 rounded-full bg-green-500/10 p-4 text-green-500">
          <MessageCircle className="h-10 w-10" />
        </div>
        <h3 className="mb-2 text-2xl font-black text-[#0d1724]">Confirme seu WhatsApp</h3>
        <p className="mb-6 max-w-md text-[#283342]">
          Para concluir o cadastro de forma segura, enviaremos um código de verificação para o seu WhatsApp.
        </p>

        <div className="w-full max-w-sm space-y-4">
          <div className="relative text-left">
            <label className="mb-1 block text-sm font-bold text-[#0d1724]">
              Número do WhatsApp
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                disabled={!isEditingPhone}
                placeholder="(00) 00000-0000"
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[#0d1724] outline-none focus:border-green-500 disabled:bg-neutral-50 disabled:opacity-70"
              />
              {!isEditingPhone ? (
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="rounded-xl bg-neutral-100 p-3 text-neutral-600 transition-colors hover:bg-neutral-200"
                  title="Alterar número"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="rounded-xl bg-green-500 p-3 text-white transition-colors hover:bg-green-600"
                  title="Salvar"
                >
                  <ShieldCheck className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRequestPin}
            disabled={loading || phone.replace(/\D/g, '').length < 10}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 font-bold text-white shadow-lg shadow-green-600/20 transition-all hover:-translate-y-0.5 hover:bg-green-500 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
            {loading ? 'Enviando...' : 'Enviar Código'}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="mt-4 text-sm font-bold text-neutral-500 underline hover:text-neutral-700"
            >
              Cancelar e voltar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center animate-in slide-in-from-right duration-300">
      <div className="mb-6 rounded-full bg-blue-500/10 p-4 text-blue-500">
        <ShieldCheck className="h-10 w-10" />
      </div>
      <h3 className="mb-2 text-2xl font-black text-[#0d1724]">Código de Verificação</h3>
      <p className="mb-6 max-w-md text-[#283342]">
        Digite o código de 4 dígitos que acabamos de enviar para o seu WhatsApp: <strong>{phone}</strong>
      </p>

      <div className="w-full max-w-xs space-y-6">
        <div className="flex justify-center gap-3">
          {pin.map((d, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handlePinChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              disabled={loading}
              className="h-16 w-14 rounded-2xl border-2 border-neutral-200 bg-white text-center text-2xl font-black text-[#0d1724] outline-none transition-colors focus:border-blue-500 disabled:opacity-50"
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm">
          {timeLeft > 0 ? (
            <span className="font-bold text-neutral-500">
              Código expira em 00:{timeLeft.toString().padStart(2, '0')}
            </span>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="flex items-center gap-1 font-bold text-red-500">
                <AlertCircle className="h-4 w-4" /> Código expirado
              </span>
              <button
                type="button"
                onClick={handleRequestPin}
                disabled={loading}
                className="flex items-center gap-2 font-bold text-blue-600 hover:text-blue-700"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Reenviar PIN
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleVerifyPin(pin.join(''))}
          disabled={loading || pin.some(d => d === '')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-500 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Verificar'}
        </button>
        
        <button
          type="button"
          onClick={() => setStep('confirm_phone')}
          disabled={loading}
          className="text-sm font-bold text-neutral-500 underline hover:text-neutral-700"
        >
          Alterar número
        </button>
      </div>
    </div>
  );
}
