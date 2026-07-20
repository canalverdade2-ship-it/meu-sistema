import fs from 'fs';
const file = 'src/components/public/GSAEnterpriseHome.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

if (lines[625].trim() === '}' && lines[627].includes('function ServiceDetailsModal')) {
    lines.splice(625, 31);
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Fixed successfully');
} else {
    console.log('Mismatch:\\n626: ' + lines[625] + '\\n628: ' + lines[627]);
}
