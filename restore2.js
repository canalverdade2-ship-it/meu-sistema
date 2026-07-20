import fs from 'fs';
const file = 'src/components/public/GSAEnterpriseHome.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const missing = `          <section className="bg-neutral-950 py-14 text-white">
            <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d6b25e]">Projeto digital</p>
                <h2 className="mt-2 text-3xl font-black">Quer divulgar ou contratar um sistema?</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                  Nossa equipe está pronta para entender a sua necessidade e construir a solução digital ideal para o seu negócio.
                </p>
              </div>
              <button onClick={() => setIsSystemsBudgetOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d6b25e] px-5 py-4 text-sm font-black text-neutral-950">
                Solicitar orçamento
                <ArrowRight className="h-4 w-4" />`.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '</section>' && lines[i+1].trim() === '' && lines[i+2].trim() === '</button>') {
        lines.splice(i+1, 1, ...missing);
        fs.writeFileSync(file, lines.join('\n'));
        console.log('Restored successfully');
        break;
    }
}
