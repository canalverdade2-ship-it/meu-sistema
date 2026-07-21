import { useEffect, useRef, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ServedAdvertisement } from '../../types/advertising';

interface AdvertisingSlotProps {
  placementCode: string;
  variant?: 'inline' | 'sticky';
  className?: string;
}

function randomId() {
  return crypto.randomUUID();
}

function getPersistentId(key: string, storage: Storage) {
  let value = storage.getItem(key);
  if (!value) {
    value = randomId();
    storage.setItem(key, value);
  }
  return value;
}

function deviceType() {
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

export function AdvertisingSlot({ placementCode, variant = 'inline', className = '' }: AdvertisingSlotProps) {
  const [ad, setAd] = useState<ServedAdvertisement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewRecorded = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const viewerId = getPersistentId('_gsa_ad_viewer', window.localStorage);
        const sessionId = getPersistentId('_gsa_ad_session', window.sessionStorage);
        const { data, error } = await supabase.functions.invoke<{ success: boolean; event_token?: string; ad?: Omit<ServedAdvertisement, 'event_token'> | null }>('gsa-ad-delivery', {
          body: {
            action: 'serve',
            placement_code: placementCode,
            viewer_id: viewerId,
            session_id: sessionId,
            route: window.location.pathname,
            device: deviceType(),
          },
        });
        if (error) throw error;
        if (active && data?.ad && data.event_token) setAd({ ...data.ad, event_token: data.event_token });
      } catch (error) {
        console.warn(`Falha ao carregar posição publicitária ${placementCode}:`, error);
      }
    };
    void load();
    return () => { active = false; };
  }, [placementCode]);

  const record = async (eventType: 'viewable' | 'click' | 'video_start' | 'video_complete') => {
    if (!ad?.event_token) return;
    try {
      await supabase.functions.invoke('gsa-ad-delivery', {
        body: { action: 'event', event_token: ad.event_token, event_type: eventType },
      });
    } catch (error) {
      console.warn(`Falha ao registrar evento ${eventType}:`, error);
    }
  };

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !ad || viewRecorded.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        viewRecorded.current = true;
        void record('viewable');
        observer.disconnect();
      }
    }, { threshold: [0.5] });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ad]);

  if (!ad || dismissed) return null;

  const content = (
    <>
      {ad.kind === 'image' && ad.asset_url && <img src={ad.asset_url} alt={ad.alt_text || ad.headline || ad.name} className={variant === 'sticky' ? 'h-14 w-24 shrink-0 rounded-lg object-cover sm:h-16 sm:w-32' : 'max-h-72 w-full rounded-2xl object-cover'} loading="lazy" />}
      {ad.kind === 'video' && ad.asset_url && <video src={ad.asset_url} muted playsInline controls className={variant === 'sticky' ? 'h-14 w-24 shrink-0 rounded-lg object-cover sm:h-16 sm:w-32' : 'max-h-80 w-full rounded-2xl bg-black'} onPlay={() => void record('video_start')} onEnded={() => void record('video_complete')} />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-600"><Megaphone className="h-3 w-3" /> Patrocinado</p>
        <h3 className={`${variant === 'sticky' ? 'mt-1 truncate text-sm sm:text-base' : 'mt-2 text-xl'} font-black text-neutral-950`}>{ad.headline || ad.name}</h3>
        {(ad.body || ad.advertiser_name) && <p className={`${variant === 'sticky' ? 'line-clamp-1 text-xs' : 'mt-2 text-sm'} text-neutral-500`}>{ad.body || ad.advertiser_name}</p>}
      </div>
    </>
  );

  if (variant === 'sticky') {
    return <div ref={rootRef} className={`fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl ${className}`}><div className="flex items-center gap-3">{ad.target_url ? <a href={ad.target_url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => void record('click')} className="flex min-w-0 flex-1 items-center gap-3">{content}</a> : <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>}<button type="button" onClick={() => setDismissed(true)} aria-label="Fechar anúncio" className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X className="h-4 w-4" /></button></div></div>;
  }

  return <div ref={rootRef} className={`rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>{ad.target_url ? <a href={ad.target_url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => void record('click')} className="block">{content}</a> : content}</div>;
}
