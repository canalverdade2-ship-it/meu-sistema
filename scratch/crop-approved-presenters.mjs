import fs from 'node:fs';
import path from 'node:path';
import sharp from 'file:///C:/Users/Adriano%20Farias/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.cjs';

const root = path.resolve('assets/gsa-tv/casting');
const out = path.resolve('scratch/qc-v2/presenters');
fs.mkdirSync(out, {recursive:true});

const boards = [
  {file:'casting-board-01-news-business-tech-2026-09-04.png', cols:4, rows:2, items:[
    ['gsa-mercado','Eduardo Salles'],['gsa-tempo','Clara Venturi'],['gsa-cidadania','Patrícia Silva'],['gsa-business','Ricardo Brandão'],
    ['gsa-tech','Caio Nex'],['gsa-motor','Bruna Ventura'],['gsa-agro','Daniel Campos'],['gsa-mundo','Olívia Valverde']]},
  {file:'casting-board-02-lifestyle-faith-sports-2026-09-04.png', cols:4, rows:2, items:[
    ['gsa-destinos','Marina Horizonte'],['gsa-bem-viver','Lucas Sereno'],['gsa-sabor','Chef Lorena Prado'],['gsa-em-fe','Pastor Samuel Veredas'],
    ['gsa-hora-da-palavra','Elisa Monteiro'],['gsa-ta-na-rede','Nina Conecta'],['gsa-esportes','André Linhares'],['gsa-misterios','Aurora Alencar']]},
  {file:'casting-board-03-entertainment-narrators-2026-09-04.png', cols:3, rows:2, items:[
    ['gsa-music','Mauro Beat'],['gsa-cinema','Thea Lumière'],['gsa-sessao-pipoca','Beto Pipoca'],
    ['gsa-planeta-terra','Gaia Monteverde'],['gsa-historias-da-biblia','Salomão Oliveira'],['gsa-desenhos','Luna Alegria']]}
];

const manifest=[];
for (const board of boards) {
  const input=path.join(root,board.file);
  const meta=await sharp(input).metadata();
  const cw=Math.floor(meta.width/board.cols), ch=Math.floor(meta.height/board.rows);
  for (let i=0;i<board.items.length;i++) {
    const [program,presenter]=board.items[i];
    const col=i%board.cols,row=Math.floor(i/board.cols);
    const left=col*cw+(col?2:0), top=row*ch+(row?2:0);
    const width=cw-(col?2:0)-(col===board.cols-1?meta.width-board.cols*cw:2);
    const height=ch-(row?2:0)-(row===board.rows-1?meta.height-board.rows*ch:2);
    const target=path.join(out,`${program}.png`);
    await sharp(input).extract({left,top,width,height}).resize(720,810,{fit:'cover',position:'attention'}).png().toFile(target);
    manifest.push({program,presenter,file:path.basename(target),source:board.file,row:row+1,column:col+1});
  }
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
