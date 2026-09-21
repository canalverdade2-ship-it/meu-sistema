const ts = require('typescript');
const path = require('path');
const fs = require('fs');

const configPath = path.resolve(__dirname, '../../tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedCommandLine = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

const program = ts.createProgram({
  rootNames: parsedCommandLine.fileNames,
  options: {
    ...parsedCommandLine.options,
    noEmit: true
  }
});

const diagnostics = ts.getPreEmitDiagnostics(program);

const resultsByFile = {};

diagnostics.forEach(diag => {
  if (diag.file) {
    const relFile = path.relative(path.resolve(__dirname, '../..'), diag.file.fileName).replace(/\\/g, '/');
    if (!resultsByFile[relFile]) resultsByFile[relFile] = [];
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    resultsByFile[relFile].push({
      line: line + 1,
      char: character + 1,
      code: diag.code,
      message
    });
  }
});

fs.writeFileSync(
  path.join(__dirname, 'ts_diagnostics.json'),
  JSON.stringify(resultsByFile, null, 2)
);

console.log(`Total files with TS diagnostics: ${Object.keys(resultsByFile).length}`);
for (const [file, diags] of Object.entries(resultsByFile)) {
  console.log(`\n${file} (${diags.length} errors):`);
  diags.slice(0, 5).forEach(d => console.log(`  Line ${d.line}:${d.char} [TS${d.code}]: ${d.message}`));
}
