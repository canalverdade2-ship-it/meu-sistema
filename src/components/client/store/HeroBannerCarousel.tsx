import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';

interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle?: string;
  link?: string;
  color?: string;
}

export function HeroBannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Mocks por enquanto, depois será via banco
  const banners: Banner[] = [
    {
      id: '1',
      imageUrl: '/images/marketplace/produtos-assinaturas-hero.jpg',
      title: 'Ofertas Exclusivas',
      subtitle: 'Aproveite os melhores preços em tecnologia',
      color: '#17345f',
      link: routes.marketplace.store.products(),
    },
    {
      id: '2',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=2000&q=80',
      title: 'Semana do Consumidor',
      subtitle: 'Até 50% de desconto e pontos em dobro',
      color: '#d8bd73',
      link: routes.marketplace.store.products(),
    },
    {
      id: '3',
      imageUrl: 'https://images.unsplash.com/photo-1572584642822-8f6a4597d22b?auto=format&fit=crop&w=2000&q=80',
      title: 'Novidades da Estação',
      subtitle: 'Confira os lançamentos que acabaram de chegar',
      color: '#e8a838',
      link: routes.marketplace.store.products(),
    }
  ];

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (!isHovered) {
      const timer = setInterval(() => {
        nextSlide();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [isHovered, nextSlide]);

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
                    Confira agora
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
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

      {/* Indicators */}
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
    </div>
  );
}

export default HeroBannerCarousel;
