import { Trophy, ShieldCheck, Crown, Gem, Sparkles, Star, LucideIcon } from 'lucide-react';
import { VIPLevel } from '../constants';

export interface VIPStyleConfig {
  bg: string;
  text: string;
  accent: string;
  glow: string;
  border: string;
  icon: LucideIcon;
  badgeBg: string;
  badgeText: string;
}

export function getVIPLevelStyle(visualStyle?: string): VIPStyleConfig {
  switch (visualStyle) {
    case 'copper':
      return {
        bg: 'bg-gradient-to-br from-[#804a00] via-[#cd7f32] to-[#804a00]',
        text: 'text-white',
        accent: 'bg-white/20 hover:bg-white/30',
        glow: 'bg-orange-500/30',
        border: 'border-orange-500/30 ring-orange-400/30',
        icon: Trophy,
        badgeBg: 'bg-amber-900/20',
        badgeText: 'text-amber-700'
      };
    case 'silver':
      return {
        bg: 'bg-gradient-to-br from-[#a0a0a0] via-[#e0e0e0] to-[#b0b0b0]',
        text: 'text-neutral-900',
        accent: 'bg-white/40 hover:bg-white/60',
        glow: 'bg-white/50',
        border: 'border-white/50 ring-white/50',
        icon: ShieldCheck,
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-700'
      };
    case 'gold-black':
      return {
        bg: 'bg-gradient-to-br from-[#000000] via-[#1a1a1a] to-[#000000]',
        text: 'text-[#ffd700]',
        accent: 'bg-[#ffd700]/10 hover:bg-[#ffd700]/20',
        glow: 'bg-[#ffd700]/10',
        border: 'border-[#ffd700]/30 ring-[#ffd700]/30',
        icon: Crown,
        badgeBg: 'bg-amber-500/10',
        badgeText: 'text-amber-600'
      };
    case 'diamond':
      return {
        bg: 'bg-gradient-to-br from-[#004e92] via-[#000428] to-[#004e92]',
        text: 'text-[#b9f2ff]',
        accent: 'bg-[#b9f2ff]/10 hover:bg-[#b9f2ff]/20',
        glow: 'bg-[#b9f2ff]/30',
        border: 'border-[#b9f2ff]/40 ring-[#b9f2ff]/40',
        icon: Gem,
        badgeBg: 'bg-sky-500/10',
        badgeText: 'text-sky-600'
      };
    case 'black-luxury':
      return {
        bg: 'bg-gradient-to-br from-[#000000] via-[#111111] to-[#000000]',
        text: 'text-white',
        accent: 'bg-white/10 hover:bg-white/20',
        glow: 'bg-white/10',
        border: 'border-white/20 ring-white/20',
        icon: Sparkles,
        badgeBg: 'bg-neutral-900',
        badgeText: 'text-white'
      };
    default: // clean / basico
      return {
        bg: 'bg-white',
        text: 'text-neutral-900',
        accent: 'bg-neutral-100 hover:bg-neutral-200',
        glow: 'bg-indigo-500/5',
        border: 'border-neutral-200 ring-neutral-300',
        icon: Star,
        badgeBg: 'bg-neutral-100',
        badgeText: 'text-neutral-700'
      };
  }
}
