const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const clientDir = path.resolve('src/components/client');
const projectRoot = path.resolve('.');

console.log('================================================================');
console.log('CHALLENGER 1: COMPREHENSIVE TS AST & SEMANTIC CLIENT PANEL AUDIT');
console.log('================================================================');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const clientFiles = getAllFiles(clientDir);
console.log(`Discovered ${clientFiles.length} client files (.ts, .tsx)`);

const issues = {
  syntaxDiagnostics: [],
  unresolvedImports: [],
  missingNamedExports: [],
  corruptedStrings: [],
  trueMojibake: [],
  hookViolations: [],
  suspiciousSupabaseQueries: []
};

// True mojibake: UTF-8 two-byte sequences decoded as Windows-1252 / ISO-8859-1
// e.g. Ã£ (ã), Ã© (é), Ã§ (ç), Ã³ (ó), Ãª (ê), Ã¡ (á), Ã­ (í), Ãº (ú), Ãµ (õ), etc.
// Note: We specifically match two-byte mojibake pairs, not legitimate single characters like Ã.
const trueMojibakeRegex = /(?:Ã[\x80-\xbf]|â[\x80-\xbf]{2})/g;

// Known Portuguese valid words containing uppercase A with tilde: NÃO, SÃO, TRANSAÇÃO, QUITAÇÃO, etc.
// The true mojibake pattern matches Ã followed by a byte between 0x80 and 0xBF (represented in JS string as \u0080-\u00bf or common chars).
// In JS utf-8 text, double-decoded sequences look like:
// Ã¡ (\u00C3\u00A1), Ã© (\u00C3\u00A9), Ã­ (\u00C3\u00AD), Ã³ (\u00C3\u00B3), Ãº (\u00C3\u00BA),
// Ã£ (\u00C3\u00A3), Ãµ (\u00C3\u00B5), Ã¢ (\u00C3\u00A2), Ãª (\u00C3\u00AA), Ã´ (\u00C3\u00B4),
// Ã§ (\u00C3\u00A7), Ã€ (\u00C3\u0080), Ã‰ (\u00C3\u0089), Ã“ (\u00C3\u0093), Ãš (\u00C3\u009A),
// Ãƒ (\u00C3\u0083), Ã• (\u00C3\u0095), Ã‚ (\u00C3\u0082), ÃŠ (\u00C3\u008A), Ã” (\u00C3\u0094), Ã‡ (\u00C3\u0087)
const doubleDecodedRegex = /(\u00C3[\u0080-\u00BF]|\u00E2\u0080[\u0098-\u009D]|\u00C2[\u00A0-\u00BF])/g;

for (const filePath of clientFiles) {
  const relPath = path.relative(projectRoot, filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // 1. Check for Unicode replacement character \uFFFD
  if (fileContent.includes('\uFFFD')) {
    const lines = fileContent.split('\n');
    lines.forEach((l, idx) => {
      if (l.includes('\uFFFD')) {
        issues.corruptedStrings.push({
          file: relPath,
          line: idx + 1,
          type: 'REPLACEMENT_CHAR_UFFFD',
          content: l.trim()
        });
      }
    });
  }

  // 2. Check for True Mojibake (double-encoded UTF-8)
  const mojibakeMatches = fileContent.match(doubleDecodedRegex);
  if (mojibakeMatches) {
    const lines = fileContent.split('\n');
    lines.forEach((l, idx) => {
      const m = l.match(doubleDecodedRegex);
      if (m) {
        issues.trueMojibake.push({
          file: relPath,
          line: idx + 1,
          matched: m,
          content: l.trim().substring(0, 120)
        });
      }
    });
  }

  // 3. TypeScript AST Syntactic Diagnostics
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  // Check AST parse diagnostics
  const diagnostics = sourceFile.parseDiagnostics || [];
  if (diagnostics.length > 0) {
    for (const diag of diagnostics) {
      const pos = sourceFile.getLineAndCharacterOfPosition(diag.start || 0);
      issues.syntaxDiagnostics.push({
        file: relPath,
        line: pos.line + 1,
        character: pos.character + 1,
        code: diag.code,
        message: typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText
      });
    }
  }

  // 4. AST Traversal for imports, hooks, queries
  function visit(node) {
    // A. Imports check
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith('.')) {
        // Resolve relative import
        const targetBase = path.resolve(path.dirname(filePath), spec);
        const candidates = [
          targetBase,
          targetBase + '.ts',
          targetBase + '.tsx',
          targetBase + '.js',
          targetBase + '.jsx',
          path.join(targetBase, 'index.ts'),
          path.join(targetBase, 'index.tsx'),
          path.join(targetBase, 'index.js')
        ];
        const resolvedPath = candidates.find(c => fs.existsSync(c) && !fs.statSync(c).isDirectory());
        if (!resolvedPath) {
          issues.unresolvedImports.push({
            file: relPath,
            importSpecifier: spec,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
          });
        } else if (node.importClause && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          // Check that named exports exist in resolved file
          const targetContent = fs.readFileSync(resolvedPath, 'utf8');
          const targetSource = ts.createSourceFile(
            resolvedPath,
            targetContent,
            ts.ScriptTarget.Latest,
            false,
            resolvedPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
          );
          const exportedNames = new Set();
          function findExports(targetNode) {
            if (ts.isExportDeclaration(targetNode) && targetNode.exportClause && ts.isNamedExports(targetNode.exportClause)) {
              for (const elem of targetNode.exportClause.elements) {
                exportedNames.add(elem.name.text);
              }
            }
            if (targetNode.modifiers && targetNode.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
              if (ts.isVariableStatement(targetNode)) {
                for (const decl of targetNode.declarationList.declarations) {
                  if (ts.isIdentifier(decl.name)) exportedNames.add(decl.name.text);
                }
              } else if (ts.isFunctionDeclaration(targetNode) && targetNode.name) {
                exportedNames.add(targetNode.name.text);
              } else if (ts.isClassDeclaration(targetNode) && targetNode.name) {
                exportedNames.add(targetNode.name.text);
              } else if (ts.isInterfaceDeclaration(targetNode) && targetNode.name) {
                exportedNames.add(targetNode.name.text);
              } else if (ts.isTypeAliasDeclaration(targetNode) && targetNode.name) {
                exportedNames.add(targetNode.name.text);
              } else if (ts.isEnumDeclaration(targetNode) && targetNode.name) {
                exportedNames.add(targetNode.name.text);
              }
            }
            ts.forEachChild(targetNode, findExports);
          }
          findExports(targetSource);

          for (const element of node.importClause.namedBindings.elements) {
            const importedName = element.propertyName ? element.propertyName.text : element.name.text;
            // If the target file exports * from another module, skip strict check
            const hasWildcardExport = targetContent.includes('export * from');
            if (!hasWildcardExport && exportedNames.size > 0 && !exportedNames.has(importedName)) {
              issues.missingNamedExports.push({
                file: relPath,
                line: sourceFile.getLineAndCharacterOfPosition(element.getStart()).line + 1,
                importedName,
                targetFile: path.relative(projectRoot, resolvedPath)
              });
            }
          }
        }
      }
    }

    // B. Hook Rules: Check if hooks are called inside if-statements, loops, or nested functions
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      let hookName = null;
      if (ts.isIdentifier(expr) && /^use[A-Z]/.test(expr.text)) {
        hookName = expr.text;
      }
      if (hookName) {
        // Inspect ancestors to see if inside conditional or loop
        let current = node.parent;
        let insideViolation = null;
        while (current && current !== sourceFile) {
          if (ts.isIfStatement(current)) {
            // check if hook is in condition or then/else branch
            if (current.thenStatement.pos <= node.pos && current.thenStatement.end >= node.end) {
              insideViolation = 'if-statement branch';
              break;
            }
            if (current.elseStatement && current.elseStatement.pos <= node.pos && current.elseStatement.end >= node.end) {
              insideViolation = 'else-statement branch';
              break;
            }
          }
          if (ts.isIterationStatement(current, false)) {
            insideViolation = 'loop statement';
            break;
          }
          current = current.parent;
        }
        if (insideViolation) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          issues.hookViolations.push({
            file: relPath,
            line: pos.line + 1,
            hook: hookName,
            violationType: insideViolation
          });
        }
      }

      // C. Supabase query checks: .from('...').eq('...')
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'from') {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          const tableName = node.arguments[0].text;
          if (!tableName || tableName.trim() === '') {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            issues.suspiciousSupabaseQueries.push({
              file: relPath,
              line: pos.line + 1,
              issue: 'Empty table name in .from()'
            });
          }
        }
      }
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'eq') {
        if (node.arguments.length >= 2) {
          const arg0 = node.arguments[0];
          const arg1 = node.arguments[1];
          if (ts.isStringLiteral(arg0) && arg0.text.trim() === '') {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            issues.suspiciousSupabaseQueries.push({
              file: relPath,
              line: pos.line + 1,
              issue: 'Empty column name in .eq()'
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

console.log('\n--- RESULTS SUMMARY ---');
console.log(`1. Syntax Diagnostics (AST parse errors): ${issues.syntaxDiagnostics.length}`);
if (issues.syntaxDiagnostics.length > 0) {
  console.dir(issues.syntaxDiagnostics, { depth: 4 });
}

console.log(`2. Replacement Characters (\\uFFFD): ${issues.corruptedStrings.length}`);
if (issues.corruptedStrings.length > 0) {
  console.dir(issues.corruptedStrings, { depth: 4 });
}

console.log(`3. True Mojibake Sequences: ${issues.trueMojibake.length}`);
if (issues.trueMojibake.length > 0) {
  console.dir(issues.trueMojibake.slice(0, 10), { depth: 4 });
}

console.log(`4. Unresolved Relative Imports: ${issues.unresolvedImports.length}`);
if (issues.unresolvedImports.length > 0) {
  console.dir(issues.unresolvedImports, { depth: 4 });
}

console.log(`5. Missing Named Exports: ${issues.missingNamedExports.length}`);
if (issues.missingNamedExports.length > 0) {
  console.dir(issues.missingNamedExports, { depth: 4 });
}

console.log(`6. React Hook Violations (inside if/loops): ${issues.hookViolations.length}`);
if (issues.hookViolations.length > 0) {
  console.dir(issues.hookViolations, { depth: 4 });
}

console.log(`7. Suspicious Supabase Queries: ${issues.suspiciousSupabaseQueries.length}`);
if (issues.suspiciousSupabaseQueries.length > 0) {
  console.dir(issues.suspiciousSupabaseQueries, { depth: 4 });
}

const totalDefects = 
  issues.syntaxDiagnostics.length +
  issues.corruptedStrings.length +
  issues.trueMojibake.length +
  issues.unresolvedImports.length +
  issues.missingNamedExports.length +
  issues.hookViolations.length +
  issues.suspiciousSupabaseQueries.length;

console.log(`\nTOTAL DEFECTS FOUND: ${totalDefects}`);
if (totalDefects > 0) {
  console.log('>>> VERDICT: DEFECTS DETECTED <<<');
  process.exit(1);
} else {
  console.log('>>> VERDICT: ALL CLIENT COMPONENTS PASS AST & SEMANTIC CHECKS <<<');
  process.exit(0);
}
