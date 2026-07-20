import fs from 'fs';
const file = 'src/components/client/ClientGSAStore.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Subcomponent: Product Details Modal\nfunction ProductDetailsModal\(\{\s*isOpen,\s*onClose,\s*item,\s*tipo,\s*onAdd\s*\}\:\s*any\)\s*\{[\s\S]*?\n\}\n/g;

const replaceStr = `// Subcomponent: Product Details Modal
function ProductDetailsModal({ isOpen, onClose, item, tipo, onAdd }: any) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const allImages = useMemo(() => mapColumnsToGallery(item), [item]);

  useEffect(() => {
    setActiveImageIdx(0);
  }, [item]);

  if (!isOpen || !item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Item" size="wide">
      <div className="flex flex-col md:flex-row gap-6 lg:gap-8 p-0 md:p-2">
        {/* Image Section */}
        <div className="w-full md:w-1/2">
          <div className="space-y-4">
            {/* Main Carousel Container */}
            <div className="relative group aspect-square md:aspect-auto md:h-[400px] xl:h-[450px] bg-neutral-50 rounded-3xl overflow-hidden border border-neutral-100 flex items-center justify-center">
              {allImages.length > 0 ? (
                <div 
                  className="flex w-full h-full transition-transform duration-500 ease-out"
                  style={{ transform: \`translateX(-\${activeImageIdx * 100}%)\` }}
                >
                  {allImages.map((url, idx) => (
                    <div key={idx} className="w-full h-full flex-shrink-0 flex items-center justify-center bg-neutral-50 p-4">
                       <img src={url} alt={item.nome} className="max-w-full max-h-full object-contain animate-in fade-in zoom-in-95 duration-300" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {tipo === 'produto' ? <Package className="w-32 h-32 text-neutral-200" /> : 
                   tipo === 'servico' ? <Scissors className="w-32 h-32 text-neutral-200" /> : 
                   <Calendar className="w-32 h-32 text-neutral-200" />
                  }
                </div>
              )}

              {/* Navigation Arrows */}
              {allImages.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImageIdx(prev => (prev > 0 ? prev - 1 : allImages.length - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setActiveImageIdx(prev => (prev < allImages.length - 1 ? prev + 1 : 0))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  
                  {/* Indicators */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {allImages.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={\`h-1.5 rounded-full transition-all duration-300 \${activeImageIdx === idx ? 'w-6 bg-indigo-600' : 'w-1.5 bg-neutral-300'}\`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {allImages.map((url, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={\`relative w-20 h-20 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-white flex items-center justify-center \${activeImageIdx === idx ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-transparent opacity-60 hover:opacity-100'}\`}
                  >
                    <img src={url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="w-full md:w-1/2 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-md shadow-sm">
                {tipo}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-neutral-500 border border-neutral-200 px-3 py-1.5 rounded-md bg-white shadow-sm">
                REF: {tipo === 'produto' ? item.codigo_produto : tipo === 'servico' ? item.codigo_servico : item.codigo_assinatura}
              </span>
              {item.categoria && (
                <span className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 uppercase tracking-widest px-3 py-1.5 rounded-md">
                  {item.categoria}
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl xl:text-4xl font-black text-neutral-950 leading-tight mb-2 tracking-tight">{item.nome}</h2>
            
            <div className="mb-4 xl:mb-6">
              {item.ocultar_valor ? (
                <div className="inline-flex items-center justify-center bg-neutral-100 px-4 py-2 rounded-xl mt-2">
                  <span className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Preço Sob Consulta</span>
                </div>
              ) : (
                <div className="flex flex-col mt-2">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Por apenas</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl md:text-4xl xl:text-5xl font-black text-indigo-600 tracking-tighter">{formatCurrency(item.valor)}</span>
                    {tipo === 'assinatura' && <span className="text-base md:text-lg text-neutral-400 font-bold">/ mês</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-white to-neutral-50 rounded-2xl p-4 md:p-5 border border-neutral-200/60 shadow-sm mb-4 xl:mb-6 overflow-y-auto max-h-[120px] md:max-h-[150px] xl:max-h-[220px] custom-scrollbar relative group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-[11px] md:text-xs font-black text-neutral-900 uppercase tracking-[0.2em]">Descrição Detalhada</h3>
              </div>
              <div className="text-neutral-600 leading-relaxed whitespace-pre-wrap text-xs md:text-sm font-medium">
                {item.descricao || 'Nenhuma descrição detalhada disponível para este item.'}
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-auto">
            {tipo === 'produto' && item.controle_estoque && (
              <div className={\`flex items-center gap-2 text-xs md:text-sm font-bold \${item.estoque_disponivel > 0 ? 'text-emerald-600' : 'text-red-600'}\`}>
                <div className={\`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full \${item.estoque_disponivel > 0 ? 'bg-emerald-500' : 'bg-red-500'}\`}></div>
                {item.estoque_disponivel > 0 ? \`Disponibilidade imediata: \${item.estoque_disponivel} un\` : 'Produto temporariamente esgotado'}
              </div>
            )}

            <button 
              disabled={tipo === 'produto' && item.controle_estoque && item.estoque_disponivel <= 0}
              onClick={onAdd}
              className="w-full bg-[#1a1a1a] text-white py-3.5 md:py-4 xl:py-5 rounded-2xl font-black text-sm md:text-base hover:bg-indigo-600 shadow-xl hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5 group-hover:animate-bounce" />
              Adicionar ao Carrinho
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
`;

if (content.match(regex)) {
    content = content.replace(regex, replaceStr);
    fs.writeFileSync(file, content);
    console.log('Replaced correctly');
} else {
    console.log('Could not find modal with regex');
}
