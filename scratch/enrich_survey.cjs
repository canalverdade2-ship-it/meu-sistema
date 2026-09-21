const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'admin_survey_catalog.json'), 'utf-8'));

function extractComponentDetails(item) {
  const fullPath = path.join(rootDir, item.relPathFromRoot);
  const content = fs.readFileSync(fullPath, 'utf-8');

  // Extract titles / headings
  let title = '';
  const titleMatch = content.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i) ||
                     content.match(/title=["']([^"']+)["']/i) ||
                     content.match(/headerTitle={<[^>]*>([^<]+)<\//i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  // Extract key handlers / user actions
  const handlers = [];
  const handlerRegex = /const\s+(handle[A-Za-z0-9_]+|on[A-Za-z0-9_]+)\s*=/g;
  let hm;
  while ((hm = handlerRegex.exec(content)) !== null) {
    if (!['handleChange', 'handleBlur', 'handleSubmit', 'handleClick'].includes(hm[1])) {
      handlers.push(hm[1]);
    }
  }

  // Extract state variables
  const states = [];
  const stateRegex = /const\s+\[([a-zA-Z0-9_]+),\s*set[a-zA-Z0-9_]+\]\s*=\s*useState/g;
  let sm;
  while ((sm = stateRegex.exec(content)) !== null) {
    states.push(sm[1]);
  }

  // Extract main input fields / form elements
  const inputLabels = [];
  const labelRegex = /<label[^>]*>([^<]+)<\/label>/gi;
  let lm;
  while ((lm = labelRegex.exec(content)) !== null) {
    const l = lm[1].replace(/[*:]/g, '').trim();
    if (l && l.length < 35 && !inputLabels.includes(l)) {
      inputLabels.push(l);
    }
  }

  return {
    title,
    handlers: Array.from(new Set(handlers)).slice(0, 8),
    states: Array.from(new Set(states)).slice(0, 8),
    inputLabels: inputLabels.slice(0, 10)
  };
}

let enriched = catalog.map(item => {
  const details = extractComponentDetails(item);
  return {
    ...item,
    ...details
  };
});

fs.writeFileSync(path.join(__dirname, 'admin_survey_enriched.json'), JSON.stringify(enriched, null, 2));
console.log('Enriched all', enriched.length, 'components with titles, handlers, states, and form fields.');
