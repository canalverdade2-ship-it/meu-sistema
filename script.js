import fs from 'fs';
import path from 'path';

const dirPath = path.join(process.cwd(), 'supabase/migrations');
const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.sql')).sort();
let output = '';

for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const parts = content.split(/CREATE (?:OR REPLACE )?FUNCTION /i);
    for (let i = 1; i < parts.length; i++) {
        let block = 'CREATE OR REPLACE FUNCTION ' + parts[i];
        
        let endIdx = block.indexOf('$$;');
        if (endIdx === -1) endIdx = block.indexOf('$$ ;');
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
            
            // replace the EXCEPTION block based on instructions
            let fixedText = funcText.replace(/EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+(.*?)(?=\bEND\b|\bEXCEPTION\b|\bWHEN\b|$)/is, (match, p1) => {
                let lowerP1 = p1.toLowerCase();
                if (lowerP1.includes('v_failed :=') || lowerP1.includes('array_append(v_failed')) {
                     return "EXCEPTION WHEN OTHERS THEN\n            " + p1.trim() + "\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
                }
                if (lowerP1.includes('insert into auditoria') || lowerP1.includes('insert into gsa_auditoria') || lowerP1.includes('insert into system_logs') || lowerP1.includes('v_headers :=')) {
                     return "EXCEPTION WHEN OTHERS THEN\n            RAISE WARNING 'Falha em operação opcional (" + funcName + "): %', SQLERRM;\n            " + p1.trim() + "\n        ";
                }
                if (p1.trim().match(/v_\w+\s*:=\s*(null|NULL);/i) || p1.trim().match(/v_\w+\s*:=\s*\{\}::jsonb;/i) || p1.trim().match(/RETURN\s+NULL;/i) || p1.trim() === 'NULL;' || p1.trim() === 'v_valor:=NULL;') {
                     return "EXCEPTION WHEN OTHERS THEN\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
                }
                // Default fallback
                return "EXCEPTION WHEN OTHERS THEN\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
            });
            output += `-- File: ${file}\n-- Function: ${funcName}\n${fixedText}\n\n`;
        }
    }
}
fs.writeFileSync('supabase/migrations/20260728040000_fix_exception_handlers.sql', output, 'utf-8');
console.log('Done!');
