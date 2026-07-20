import type { ElementType, Key, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface MarketplaceSubmoduleCardProps {
  key?: Key;
  icon: ElementType;
  title: string;
  description: string;
  actionLabel: string;
  image: string;
  imageAlt: string;
  categoryLabel: string;
  onClick: () => void;
  accentColor?: string;
  badge?: ReactNode;
  index?: number;
}

export function MarketplaceSubmoduleCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  image,
  imageAlt,
  categoryLabel,
  onClick,
  accentColor = '#0c2340',
  badge,
  index = 0,
}: MarketplaceSubmoduleCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group grid min-h-[176px] w-full min-w-0 grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg border border-neutral-200 bg-white text-left shadow-[0_8px_24px_rgba(12,35,64,0.06)] transition-all duration-300 hover:border-[#0c2340]/25 hover:shadow-[0_16px_36px_rgba(12,35,64,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c2340] focus-visible:ring-offset-2 md:block md:min-h-[350px]"
    >
      <div className="relative min-h-full overflow-hidden bg-neutral-100 md:h-44 md:min-h-0 lg:h-48">
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 hidden rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0c2340] shadow-sm md:inline-flex">
          {categoryLabel}
        </span>
        {badge && <span className="absolute right-3 top-3">{badge}</span>}
      </div>

      <div className="flex min-w-0 flex-col justify-between p-4 md:min-h-[174px] md:p-5 lg:min-h-[190px] lg:p-6">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ color: accentColor, backgroundColor: `${accentColor}12` }}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 md:hidden">
                {categoryLabel}
              </span>
            </div>
            {badge && <span className="shrink-0 md:hidden">{badge}</span>}
          </div>

          <h3 className="break-words text-base font-black leading-tight text-[#0c2340] sm:text-lg lg:text-xl">{title}</h3>
          <p className="mt-2 break-words text-xs font-medium leading-5 text-neutral-500 md:text-sm">
            {description}
          </p>
        </div>

        <div className="mt-3 flex w-full items-center justify-between gap-2 border-t border-neutral-100 pt-3 md:mt-5 md:pt-4">
          <span className="min-w-0 break-words pr-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#0c2340] md:text-[11px]">
            {actionLabel}
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0c2340] text-white transition-colors group-hover:bg-[#134e78] md:h-8 md:w-8">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
