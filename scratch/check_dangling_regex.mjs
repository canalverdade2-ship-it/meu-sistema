import fs from 'fs';
import path from 'path';

const file = 'src/components/client/ClientAffiliatePanel.tsx';
const content = fs.readFileSync(file, 'utf8');
const regex = /<\w+[^>]*\s+=\s*(?:>|\s)/g;

let match;
while ((match = regex.exec(content)) !== null) {
  console.log('Match at index:', match.index);
  console.log('Matched text snippet:');
  console.log(content.substring(Math.max(0, match.index - 20), Math.min(content.length, match.index + match[0].length + 20)));
  console.log('---');
  if (match.index > 5000) break; // just check first few
}
