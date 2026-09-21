import fs from 'node:fs';

const target = process.argv[2];
let source = fs.readFileSync(target, 'utf8');
source = source.replace(
  'function appendLoopedFiller(program, totalDuration, fillerDuration) {',
  'function appendLoopedFiller(program, totalDuration, fillerDuration, title = "Continuidade GSA TV") {',
);
const fillerTitle = `        "Continuidade GSA TV",
      ),`;
if (source.includes(fillerTitle)) {
  source = source.replace(fillerTitle, `        title,
      ),`);
}
const oldBlock = `      program.push(
        playlistEntry(
          item.source,
          item.duration,
          item.clipIn,
          item.ad,
          item.title,
        ),
      );`;
const newBlock = `      if (item.source === SCHEDULE_FILLER_FILE) {
        appendLoopedFiller(
          program,
          item.duration,
          fillerDuration,
          item.title || "Continuidade GSA TV",
        );
      } else {
        program.push(
          playlistEntry(
            item.source,
            item.duration,
            item.clipIn,
            item.ad,
            item.title,
          ),
        );
      }`;
if (!source.includes(newBlock)) {
  if (!source.includes(oldBlock)) throw new Error('Bloco do compilador não localizado.');
  source = source.replace(oldBlock, newBlock);
}
fs.writeFileSync(target, source, { encoding: 'utf8', mode: 0o644 });
