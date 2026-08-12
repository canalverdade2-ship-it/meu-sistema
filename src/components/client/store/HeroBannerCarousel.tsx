import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { supabase } from '../../../lib/supabase';

interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle?: string;
  link?: string;
  color?: string;
  buttonText?: string;
}

const DEFAULT_BANNERS: Banner[] = [
  {
    id: '1',
    imageUrl: '/images/marketplace/produtos-assinaturas-hero.jpg',
    title: 'Ofertas Exclusivas',
    subtitle: 'Aproveite os melhores preços e condições em tecnologia',
    color: '#17345f',
    link: routes.marketplace.store.products(),
    buttonText: 'Confira agora',
  },
  {
    id: '2',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=2000&q=80',
    title: 'Soluções Corporativas GSA',
    subtitle: 'Gestão de serviços e soluções sob medida para o seu negócio',
    color: '#17345f',
    link: routes.marketplace.store.products(),
    buttonText: 'Conhecer Soluções',
  },
  {
    id: '3',
    imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67daf64f4d?auto=format&fit=crop&w=2000&q=80',
    title: 'Clube de Vantagens GSA',
    subtitle: 'Acumule pontos e aproveite benefícios exclusivos em cada compra',
    color: '#d8bd73',
    link: routes.marketplace.store.products(),
    buttonText: 'Saiba mais',
  }
];

export function HeroBannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);

  useEffect(() => {
    async function loadBanners() {
      try {
        // 1. Tentar buscar da tabela gsa_hero_banners
        const { data: heroData, error: heroError } = await supabase
          .from('gsa_hero_banners')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (!heroError && heroData && heroData.length > 0) {
          const mapped: Banner[] = heroData.map((b) => ({
            id: b.id,
            imageUrl: b.image_url,
            title: b.title,
            subtitle: b.subtitle || undefined,
            link: b.link_url || undefined,
            color: b.background_color || '#17345f',
            buttonText: b.button_text || 'Confira agora',
          }));
          setBanners(mapped);
          return;
        }

        // 2. Fallback para a tabela oficial gsa_site_campaigns
        const { data: campaignData, error: campaignError } = await supabase
          .from('gsa_site_campaigns')
          .select('*')
          .eq('status', 'active')
          .order('priority', { ascending: false });

        if (!campaignError && campaignData && campaignData.length > 0) {
          const mapped: Banner[] = campaignData.map((b) => ({
            id: b.id,
            imageUrl: b.image_desktop_url || b.image_mobile_url || '/images/marketplace/produtos-assinaturas-hero.jpg',
            title: b.title,
            subtitle: b.subtitle || b.body || undefined,
            link: b.cta_url || routes.marketplace.store.products(),
            color: '#17345f',
            buttonText: b.cta_label || 'Confira agora',
          }));
          setBanners(mapped);
          return;
        }
      } catch (err) {
        console.warn('[HeroBannerCarousel] Usando banners padrão:', err);
      }
    }

    loadBanners();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (!isHovered && banners.length > 1) {
      const timer = setInterval(() => {
        nextSlide();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [isHovered, nextSlide, banners.length]);

  if (!banners || banners.length === 0) return null;

  return (
    <div 
      className="relative w-full overflow-hidden bg-neutral-900 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ height: 'clamp(300px, 45vw, 550px)' }}
    >
      {/* Slides */}
      <div 
        className="flex h-full w-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <div 
            key={banner.id}
            className="relative h-full w-full flex-shrink-0 cursor-pointer"
            onClick={() => banner.link && navigate(banner.link)}
          >
            <div className="absolute inset-0 bg-black/40 z-10" />
            <img 
              src={banner.imageUrl} 
              alt={banner.title} 
              className={`h-full w-full object-cover transition-transform duration-10000 ease-linear ${currentSlide === index ? 'scale-105' : 'scale-100'}`}
              loading={index === 0 ? "eager" : "lazy"}
            />
            
            <div className="absolute inset-0 z-20 flex flex-col justify-center px-8 sm:px-16 lg:px-32 max-w-7xl mx-auto">
              <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white leading-tight drop-shadow-lg max-w-3xl transform transition-all duration-700 delay-100 translate-y-0 opacity-100">
                {banner.title}
              </h2>
              {banner.subtitle && (
                <p className="mt-4 text-lg sm:text-2xl text-white/90 font-medium drop-shadow-md max-w-2xl transform transition-all duration-700 delay-200 translate-y-0 opacity-100">
                  {banner.subtitle}
                </p>
              )}
              {banner.link && (
                <div className="mt-8 transform transition-all duration-700 delay-300 translate-y-0 opacity-100">
                  <button 
                    className="px-8 py-3.5 bg-[#d8bd73] hover:bg-[#c4a961] text-white font-bold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
                  >
                    {banner.buttonText || 'Confira agora'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm opacity-0 transition-all duration-300 hover:bg-white/40 group-hover:opacity-100"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm opacity-0 transition-all duration-300 hover:bg-white/40 group-hover:opacity-100"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                currentSlide === index ? 'w-8 bg-[#d8bd73]' : 'w-2.5 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Ir para o slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default HeroBannerCarousel;

