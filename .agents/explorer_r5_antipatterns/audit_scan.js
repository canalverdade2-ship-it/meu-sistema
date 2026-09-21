const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.agents' && file !== 'dist') {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.cjs')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('src');

console.log('Total audited files:', files.length);

// 1. Direct .channel() analysis
console.log('\n========================================');
console.log('1. DIRECT .channel() INVOCATIONS');
console.log('========================================');
const directChannels = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('.channel(')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('.channel(')) {
        directChannels.push({ file: f, line: idx + 1, text: line.trim() });
        console.log(`${f}:${idx + 1} -> ${line.trim()}`);
      }
    });
  }
});

// 2. setInterval analysis (Masked polling)
console.log('\n========================================');
console.log('2. SETINTERVAL (MASKED POLLING) ANALYSIS');
console.log('========================================');
const setIntervals = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('setInterval(') || content.includes('setInterval (')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('setInterval(') || line.includes('setInterval (')) {
        setIntervals.push({ file: f, line: idx + 1, text: line.trim() });
        console.log(`${f}:${idx + 1} -> ${line.trim()}`);
      }
    });
  }
});

// 3. useRealtimeTable (Deprecated hook)
console.log('\n========================================');
console.log('3. USES OF DEPRECATED useRealtimeTable');
console.log('========================================');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('useRealtimeTable(')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('useRealtimeTable(')) {
        console.log(`${f}:${idx + 1} -> ${line.trim()}`);
      }
    });
  }
});

// 4. Check unstable channel names (Date.now(), Math.random(), etc.)
console.log('\n========================================');
console.log('4. UNSTABLE CHANNEL NAMES');
console.log('========================================');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('.channel(') && (line.includes('Date.now()') || line.includes('Math.random()'))) {
      console.log(`Unstable .channel: ${f}:${idx + 1} -> ${line.trim()}`);
    }
    if (line.includes('channelName') && (line.includes('Date.now()') || line.includes('Math.random()'))) {
      console.log(`Unstable channelName config: ${f}:${idx + 1} -> ${line.trim()}`);
    }
  });
});
