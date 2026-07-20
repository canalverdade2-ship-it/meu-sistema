import fs from 'fs';
const file = 'src/components/client/ClientGSAStore.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        {/* Info Section */}
        <div className="w-full md:w-1/2 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg">
              {tipo}
            </span>
            <span className="text-xs font-mono font-bold text-neutral-400 border border-neutral-100 px-2 py-1 rounded-lg bg-neutral-50/50">
              {tipo === 'produto' ? item.codigo_produto : tipo === 'servico' ? item.codigo_servico : item.codigo_assinatura}
            </span>
            {item.categoria && (
              <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{item.categoria}</span>
            )}
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-neutral-900 leading-tight mb-4">{item.nome}</h2>
          
          <div className="mb-6 md:mb-8">
            {item.ocultar_valor ? (
              <span className="text-xl font-bold text-neutral-400 uppercase tracking-wider">Preço Sob Consulta</span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-indigo-600">{formatCurrency(item.valor)}</span>
                {tipo === 'assinatura' && <span className="text-neutral-400 font-bold">/ mês</span>}
              </div>
            )}
          </div>

          <div className="bg-neutral-50 rounded-2xl p-4 md:p-6 border border-neutral-100 mb-6 md:mb-8 flex-1 overflow-y-auto max-h-[200px] md:max-h-none custom-scrollbar">
            <h3 className="text-sm font-black text-neutral-900 uppercase tracking-widest mb-3">Descrição Detalhada</h3>
            <div className="text-neutral-600 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
              {item.descricao || 'Nenhuma descrição detalhada disponível para este item.'}
            </div>
          </div>`;

const replaceStr = `        {/* Info Section */}
        <div className="w-full md:w-1/2 flex flex-col pt-2 md:pt-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
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

          <h2 className="text-3xl md:text-4xl font-black text-neutral-950 leading-tight mb-2 tracking-tight">{item.nome}</h2>
          
          <div className="mb-6 md:mb-8">
            {item.ocultar_valor ? (
              <div className="inline-flex items-center justify-center bg-neutral-100 px-4 py-2 rounded-xl mt-3">
                <span className="text-sm md:text-base font-bold text-neutral-500 uppercase tracking-widest">Preço Sob Consulta</span>
              </div>
            ) : (
              <div className="flex flex-col mt-2">
                <span className="text-[10px] sm:text-xs font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Por apenas</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-black text-indigo-600 tracking-tighter">{formatCurrency(item.valor)}</span>
                  {tipo === 'assinatura' && <span className="text-lg md:text-xl text-neutral-400 font-bold">/ mês</span>}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-white to-neutral-50 rounded-2xl p-5 md:p-6 border border-neutral-200/60 shadow-sm mb-6 md:mb-8 flex-1 overflow-y-auto max-h-[250px] md:max-h-none custom-scrollbar relative group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-2xl opacity-70 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xs md:text-sm font-black text-neutral-900 uppercase tracking-[0.2em]">Descrição Detalhada</h3>
            </div>
            <div className="text-neutral-600 leading-relaxed whitespace-pre-wrap text-sm md:text-[15px] font-medium">
              {item.descricao || 'Nenhuma descrição detalhada disponível para este item.'}
            </div>
          </div>`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync(file, content);
console.log('Replaced successfully');
