import React, { useState, useRef, useEffect } from 'react';
import { Filter, Search, X, Calendar, ArrowUpDown, ChevronDown } from 'lucide-react';

interface FilterOption {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface GlobalFilterProps {
  onSearch: (value: string) => void;
  onFilterChange: (filters: Record<string, any>) => void;
  onClear: () => void;
  options: FilterOption[];
  currentFilters: Record<string, any>;
  searchValue: string;
}

export function GlobalFilter({ 
  onSearch, 
  onFilterChange, 
  onClear, 
  options, 
  currentFilters,
  searchValue 
}: GlobalFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const [maxHeight, setMaxHeight] = useState('75vh');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect space and adjust position
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const margin = 20; // Respiro das bordas
      const availableBelow = window.innerHeight - rect.bottom - margin;
      const availableAbove = rect.top - margin;
      
      // Escolhe a direção com mais espaço
      if (availableBelow < 300 && availableAbove > availableBelow) {
        setDropdownPosition('top');
        setMaxHeight(`${Math.min(availableAbove, 600)}px`);
      } else {
        setDropdownPosition('bottom');
        setMaxHeight(`${Math.min(availableBelow, 600)}px`);
      }
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters = searchValue.length > 0 || Object.values(currentFilters).some(v => v !== '' && v !== null);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg border ${
          isOpen || hasActiveFilters
            ? 'bg-[#1a1a1a] text-white border-transparent'
            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
        }`}
      >
        <Filter className={`h-4 w-4 ${isOpen || hasActiveFilters ? 'text-indigo-400' : 'text-neutral-400'}`} />
        Filtros
        {hasActiveFilters && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white">
            !
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          ref={menuRef}
          className={`absolute left-0 ${dropdownPosition === 'bottom' ? 'mt-3 top-full' : 'mb-3 bottom-full'} w-80 z-50 animate-in fade-in zoom-in-95 duration-200`}
        >
          <div 
            className="bg-white rounded-[2rem] shadow-2xl ring-1 ring-black/5 border border-neutral-100 flex flex-col"
            style={{ maxHeight }}
          >
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">Opções de Filtro</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 transition-colors text-neutral-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Internal Search Overlaying existing external search */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchValue}
                  onChange={(e) => onSearch(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-neutral-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
              </div>

              <div className="h-px bg-neutral-100 my-2"></div>

              {/* Dynamic Options */}
              {options.map((opt) => (
                <div key={opt.id} className="space-y-2">
                  <label htmlFor={`filter-${opt.id}`} className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">{opt.label}</label>
                  {opt.type === 'select' ? (
                    <div className="relative">
                      <select
                        id={`filter-${opt.id}`}
                        value={currentFilters[opt.id] || ''}
                        onChange={(e) => onFilterChange({ ...currentFilters, [opt.id]: e.target.value })}
                        className="w-full appearance-none bg-neutral-50 border border-neutral-200 rounded-xl py-3 px-4 text-xs font-bold text-neutral-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none pr-10"
                      >
                        <option value="">{opt.placeholder || 'Todos'}</option>
                        {opt.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                    </div>
                  ) : opt.type === 'date' ? (
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <input
                        id={`filter-${opt.id}`}
                        type="date"
                        value={currentFilters[opt.id] || ''}
                        onChange={(e) => onFilterChange({ ...currentFilters, [opt.id]: e.target.value })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-neutral-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-3 pt-6 border-t border-neutral-50">
              <button
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                Limpar
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
              >
                Aplicar
              </button>
            </div>
            </div>
          </div>
          {/* Connector Arrow */}
          <div className={`absolute left-8 w-3 h-3 bg-white rotate-45 rounded-sm border-l border-t border-neutral-100 ${
            dropdownPosition === 'bottom' ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-r border-b'
          }`}></div>
        </div>
      )}
    </div>
  );
}
