const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\\src\\pages\\RestrictedAccessHubPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Tv2 import
content = content.replace(
  /import \{\n  Eye,\n  EyeOff,\n  KeyRound,\n  Loader2,\n  ShieldCheck,\n  UserCog,\n  UsersRound,\n\} from 'lucide-react';/s,
  `import {\n  Eye,\n  EyeOff,\n  KeyRound,\n  Loader2,\n  ShieldCheck,\n  UserCog,\n  UsersRound,\n  Tv2,\n} from 'lucide-react';`
);

// 2. Add gsatv role
content = content.replace(
  /export type RestrictedAccessRole = 'colaborador' \| 'gestao';/,
  `export type RestrictedAccessRole = 'colaborador' | 'gestao' | 'gsatv';`
);

// 3. Add gsatv roleContent
content = content.replace(
  /  gestao: \{\n    eyebrow: 'Administração',\n    title: 'Gestão GSA',\n    description: 'Acesso Master ao ambiente de gestão, supervisão e administração do ecossistema.',\n    label: 'Código Master',\n    button: 'Entrar na gestão',\n    icon: UserCog,\n  \},\n\} as const;/s,
  `  gestao: {\n    eyebrow: 'Administração',\n    title: 'Gestão GSA',\n    description: 'Acesso Master ao ambiente de gestão, supervisão e administração do ecossistema.',\n    label: 'Código Master',\n    button: 'Entrar na gestão',\n    icon: UserCog,\n  },\n  gsatv: {\n    eyebrow: 'Transmissão',\n    title: 'GSA TV',\n    description: 'Acesso Master à emissora, operações e controle de mídia.',\n    label: 'Código Master',\n    button: 'Entrar na GSA TV',\n    icon: Tv2,\n  },\n} as const;`
);

// 4. Update handleLogin
content = content.replace(
  /      if \(role === 'gestao'\) \{\n        const data = await sessionService\.loginAdmin\(code\.trim\(\)\);\n        if \(\!data\?\.valid\) throw new Error\('Código Master inválido\.'\);\n        await logService\.logAction\(\{\n          ator_tipo: 'admin',\n          acao: 'LOGIN',\n          detalhes: 'Acesso Master pela página exclusiva da Área Restrita',\n        \}\);\n        toast\.success\('Acesso à Gestão autorizado\.'\);\n        onLoginAdmin\(\{ type: 'admin' \}\);\n        return;\n      \}/s,
  `      if (role === 'gestao' || role === 'gsatv') {
        const data = await sessionService.loginAdmin(code.trim());
        if (!data?.valid) throw new Error('Código Master inválido.');
        await logService.logAction({
          ator_tipo: 'admin',
          acao: 'LOGIN',
          detalhes: role === 'gsatv' ? 'Acesso Master à GSA TV pela Área Restrita' : 'Acesso Master pela página exclusiva da Área Restrita',
        });
        toast.success(role === 'gsatv' ? 'Acesso à GSA TV autorizado.' : 'Acesso à Gestão autorizado.');
        if (role === 'gsatv') {
          const params = new URLSearchParams(window.location.search);
          if (!params.get('returnTo')) {
            window.history.replaceState({}, '', \`\${window.location.pathname}?returnTo=\${encodeURIComponent('/admin/gsa-tv')}\`);
          }
        }
        onLoginAdmin({ type: 'admin' });
        return;
      }`
);

// 5. Update map
content = content.replace(
  /                \{\(\[\n                  \['colaborador', roleContent\.colaborador\],\n                  \['gestao', roleContent\.gestao\],\n                \] as const\)\.map\(\(\[roleId, content\]\) => \{/s,
  `                {([
                  ['colaborador', roleContent.colaborador],
                  ['gestao', roleContent.gestao],
                  ['gsatv', roleContent.gsatv],
                ] as const).map(([roleId, content]) => {`
);

// 6. Update CSS for grid layout to accommodate 3 columns on large screens if desired
content = content.replace(
  /className="grid border-l border-t border-\[\#cfc6b7\] sm:grid-cols-2 lg:grid-cols-1"/,
  `className="grid border-l border-t border-[#cfc6b7] sm:grid-cols-3 lg:grid-cols-1"`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully.');
