import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building2, CheckCircle2,
  PackageCheck, ShieldCheck, Truck, LockKeyhole
} from 'lucide-react';
import { LogoGSA } from '../../components/ui/LogoGSA';

interface FornecedorLandingPageProps {
  onAccessLogin: () => void;
  onBackToSite: () => void;
}

export function FornecedorLandingPage({ onAccessLogin, onBackToSite }: FornecedorLandingPageProps) {
  return (
    <div className="min-h-screen bg-[#060e0a] text-white flex flex-col justify-between selection:bg-emerald-500 selection:text-neutral-950">
      {/* ─── NAVBAR ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-emerald-950/60 bg-[#060e0a]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToSite}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar ao site</span>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <LogoGSA size="sm" variant="light" />
          </div>

          <button
            onClick={onAccessLogin}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-900/30"
          >
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>LOGIN FORNECEDOR</span>
          </button>
        </div>
      </header>

      {/* ─── MAIN HERO ──────────────────────────────── */}
      <main className="relative flex-1 flex flex-col justify-center overflow-hidden py-12 sm:py-20">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 bottom-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[140px]" />

        <div className="relative mx-auto max-w-4xl px-5 w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Logo Marca no Hero */}
            <div className="mb-6">
              <LogoGSA size="xl" variant="light" />
            </div>

            {/* Eyebrow */}
            <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-emerald-400">
              GSA PRODUTOS
            </p>

            {/* Main Title */}
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.05]">
              Portal exclusivo para<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
                fornecedores
              </span>
            </h1>

            {/* Description */}
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
              Receba pedidos de compra, informe produtos entregues, envie notas fiscais e acompanhe a liberação dos pagamentos.
            </p>

            {/* 4 Feature Pills Grid */}
            <div className="mt-10 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-900/50 bg-[#0d1f16]/90 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/40 hover:bg-[#11271c]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-neutral-100">Produtos aprovados pela GSA</span>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-900/50 bg-[#0d1f16]/90 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/40 hover:bg-[#11271c]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Truck className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-neutral-100">Pedidos e entregas rastreados</span>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-900/50 bg-[#0d1f16]/90 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/40 hover:bg-[#11271c]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-neutral-100">Notas fiscais em ambiente seguro</span>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-900/50 bg-[#0d1f16]/90 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/40 hover:bg-[#11271c]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-sm font-bold text-neutral-100">Estoque liberado após conferência</span>
              </div>
            </div>


          </motion.div>
        </div>
      </main>

      {/* ─── FOOTER ─────────────────────────────────── */}
      <footer className="border-t border-emerald-950/60 bg-[#040907] py-8 text-xs font-semibold text-neutral-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-500" />
            <span className="text-neutral-400">GSA HUB · Portal de Fornecedores</span>
          </div>
          <p>© {new Date().getFullYear()} Grupo GSA. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
