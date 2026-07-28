const fs = require('fs');
const path = require('path');

const dirPath = path.join(process.cwd(), 'supabase/migrations');
const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.sql')).sort();
let output = '';

for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const parts = content.split(/CREATE (?:OR REPLACE )?FUNCTION /gi);
    for (let i = 1; i < parts.length; i++) {
        let block = 'CREATE OR REPLACE FUNCTION ' + parts[i];
        
        let endIdx = block.indexOf(';');
        if (endIdx === -1) endIdx = block.indexOf(' ;');
        if (endIdx === -1) {
            const endMatch = block.match(/END\s*[\$\w]+;/i);
            if (endMatch) endIdx = endMatch.index + endMatch[0].length;
        } else {
            endIdx += 3;
        }
        
        let funcText = endIdx !== -1 ? block.substring(0, endIdx) : block.substring(0, 1000);
        
        if (/EXCEPTION\s+WHEN\s+OTHERS/i.test(funcText)) {
            const nameMatch = funcText.match(/FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
            const funcName = nameMatch ? nameMatch[1] : 'unknown';
            output += '-- File: ' + file + '\n-- Function: ' + funcName + '\n' + funcText + '\n\n';
        }
    }
}
fs.writeFileSync('scratch_functions.sql', output, 'utf-8');
