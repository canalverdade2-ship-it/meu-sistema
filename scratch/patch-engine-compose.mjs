import fs from 'node:fs';
const target = process.argv[2];
let source = fs.readFileSync(target, 'utf8');
if (!source.includes('    logging:\n')) {
  const marker = '    healthcheck:\n';
  if (!source.includes(marker)) throw new Error('healthcheck não localizado');
  source = source.replace(marker, `    logging:\n      driver: json-file\n      options:\n        max-size: 10m\n        max-file: "5"\n${marker}`);
  fs.writeFileSync(target, source, 'utf8');
}
