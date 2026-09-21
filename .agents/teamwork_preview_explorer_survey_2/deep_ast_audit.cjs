const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const srcDir = path.resolve(__dirname, '../../src');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'tests') {
        files = files.concat(getAllFiles(full, exts));
      }
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const files = getAllFiles(srcDir);

const findings = {
  hookViolations: [],
  unmemoizedContextValues: [],
  unmemoizedHeavyFilters: [],
  realtimeMissingFilters: [],
  realtimeChannelThrashing: [],
  indexAsKey: [],
  staleClosures: [],
  largeComponents: [],
  suspiciousIntervals: [],
};

const hookNames = new Set([
  'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', 'useContext',
  'useReducer', 'useLayoutEffect', 'useImperativeHandle', 'useId',
  'useRealtime', 'useRealtimeSubscription', 'useRealtimeTable',
  'useAdminNotifications', 'useClientNotifications', 'useProviderNotifications',
  'useConfirm', 'useDialogAccessibility', 'usePixDiscount', 'useSEO',
  'useVipLevels', 'useWhatsAppDocument', 'useWhatsAppHealth', 'useAutoFitTabs',
  'useAutoLogout', 'usePublicPageMetadata', 'usePublicRegistrationSettings'
]);

function isHookName(name) {
  return hookNames.has(name) || (name.startsWith('use') && name.length > 3 && name[3] === name[3].toUpperCase());
}

for (const file of files) {
  const relPath = path.relative(srcDir, file).replace(/\\/g, '/');
  const sourceText = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const lineCount = sourceText.split(/\r?\n/).length;
  if (lineCount > 600) {
    findings.largeComponents.push({
      file: relPath,
      lines: lineCount,
    });
  }

  function getLine(pos) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visit(node, context) {
    // 1. Check Context Provider value prop
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName.endsWith('.Provider')) {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === 'value') {
            if (attr.initializer && ts.isJsxExpression(attr.initializer)) {
              const expr = attr.initializer.expression;
              if (expr && ts.isObjectLiteralExpression(expr)) {
                findings.unmemoizedContextValues.push({
                  file: relPath,
                  line: getLine(node.getStart(sourceFile)),
                  provider: tagName,
                  details: 'Provider value is an inline object literal without useMemo, causing all consumers to re-render on every provider parent render.'
                });
              }
            }
          }
        }
      }

      // Check key={index} in JSX
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === 'key') {
          if (attr.initializer && ts.isJsxExpression(attr.initializer)) {
            const exprText = attr.initializer.expression ? attr.initializer.expression.getText(sourceFile) : '';
            if (exprText === 'index' || exprText === 'i' || exprText === 'idx' || exprText.includes('index') || exprText.includes('idx')) {
              findings.indexAsKey.push({
                file: relPath,
                line: getLine(node.getStart(sourceFile)),
                element: tagName,
                keyExpr: exprText
              });
            }
          }
        }
      }
    }

    // 2. Check call expressions for hooks
    if (ts.isCallExpression(node)) {
      const callName = node.expression.getText(sourceFile);

      if (isHookName(callName)) {
        // Check if inside loop or if statement
        let parent = node.parent;
        let insideConditionOrLoop = false;
        let conditionType = '';

        while (parent && !ts.isFunctionDeclaration(parent) && !ts.isFunctionExpression(parent) && !ts.isArrowFunction(parent) && !ts.isSourceFile(parent)) {
          if (ts.isIfStatement(parent)) {
            insideConditionOrLoop = true;
            conditionType = 'if statement';
            break;
          }
          if (ts.isForStatement(parent) || ts.isForInStatement(parent) || ts.isForOfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent)) {
            insideConditionOrLoop = true;
            conditionType = 'loop';
            break;
          }
          if (ts.isConditionalExpression(parent)) {
            insideConditionOrLoop = true;
            conditionType = 'ternary operator';
            break;
          }
          parent = parent.parent;
        }

        if (insideConditionOrLoop) {
          findings.hookViolations.push({
            file: relPath,
            line: getLine(node.getStart(sourceFile)),
            hook: callName,
            violation: `Hook called inside ${conditionType}. Violates Rules of Hooks.`
          });
        }

        // Check useRealtime / useRealtimeSubscription usages
        if (callName === 'useRealtimeSubscription' || callName === 'useRealtime') {
          const args = node.arguments;
          if (args.length > 1) {
            const secondArg = args[1];
            if (secondArg && ts.isArrayLiteralExpression(secondArg)) {
              const depsText = secondArg.getText(sourceFile);
              findings.realtimeChannelThrashing.push({
                file: relPath,
                line: getLine(node.getStart(sourceFile)),
                hook: callName,
                deps: depsText,
                details: 'Second argument (deps) passed to useRealtimeSubscription overrides internal memoization and causes channel teardown/resubscription.'
              });
            }
          }
        }
      }

      // Check setInterval without clearInterval
      if (callName === 'setInterval') {
        const line = getLine(node.getStart(sourceFile));
        findings.suspiciousIntervals.push({
          file: relPath,
          line,
          text: node.getText(sourceFile).slice(0, 100)
        });
      }
    }

    ts.forEachChild(node, (child) => visit(child, context));
  }

  visit(sourceFile, {});
}

fs.writeFileSync(
  path.join(__dirname, 'ast_audit_result.json'),
  JSON.stringify(findings, null, 2)
);

console.log('AST Audit Completed:');
console.log('- Hook Violations (conditional/loop):', findings.hookViolations.length);
console.log('- Unmemoized Context Values:', findings.unmemoizedContextValues.length);
console.log('- Realtime Channel Thrashing (deps override):', findings.realtimeChannelThrashing.length);
console.log('- Index as Key occurrences:', findings.indexAsKey.length);
console.log('- Large Components (>600 lines):', findings.largeComponents.length);
console.log('- Suspicious Intervals:', findings.suspiciousIntervals.length);
