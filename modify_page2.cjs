const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\\src\\pages\\RestrictedAccessHubPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Tv2 import
content = content.replace(
  /import \{\r?\n  Eye,/s,
  `import {\n  Eye,\n  Tv2,`
);

// 3. Add gsatv roleContent
content = content.replace(
  /    icon: UserCog,\r?\n  \},\r?\n\} as const;/s,
  `    icon: UserCog,\n  },\n  gsatv: {\n    eyebrow: 'Transmissão',\n    title: 'GSA TV',\n    description: 'Acesso Master à emissora, operações e controle de mídia.',\n    label: 'Código Master',\n    button: 'Entrar na GSA TV',\n    icon: Tv2,\n  },\n} as const;`
);

// 4. Update handleLogin
content = content.replace(
  /      if \(role === 'gestao'\) \{([\s\S]*?toast\.success\('Acesso à Gestão autorizado\.'\);[\s\S]*?onLoginAdmin\(\{ type: 'admin' \}\);[\s\S]*?return;\r?\n      \})/s,
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
  /                \{\(\[\r?\n                  \['colaborador', roleContent\.colaborador\],\r?\n                  \['gestao', roleContent\.gestao\],\r?\n                \] as const\)\.map/s,
  `                {([
                  ['colaborador', roleContent.colaborador],
                  ['gestao', roleContent.gestao],
                  ['gsatv', roleContent.gsatv],
                ] as const).map`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully.');
