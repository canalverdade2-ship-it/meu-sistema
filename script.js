import fs from 'fs';
import path from 'path';

const dirPath = path.join(process.cwd(), 'supabase/migrations');
const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.sql')).sort();
let output = '';
let occurrences = 0;

for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Some functions might have multiple BEGIN/EXCEPTION blocks.
    // Instead of replacing blindly, let's extract them correctly.
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
        
        let funcText = endIdx !== -1 ? block.substring(0, endIdx) : block.substring(0, block.length);
        
        let modified = false;
        
        // Find all EXCEPTION WHEN OTHERS THEN blocks
        let regex = /EXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+(.*?)(?=\bEND\b|\bEXCEPTION\b|\bWHEN\b|$)/gis;
        let fixedText = funcText.replace(regex, (match, p1) => {
            occurrences++;
            modified = true;
            let lowerP1 = p1.toLowerCase();
            let nameMatch = funcText.match(/FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
            let funcName = nameMatch ? nameMatch[1] : 'unknown';
            
            // Case 1: Optional operation (Auditoria / logs / headers) -> WARNING and keep original
            if (lowerP1.includes('insert into auditoria') || lowerP1.includes('insert into gsa_auditoria') || lowerP1.includes('insert into system_logs') || lowerP1.includes('v_headers :=')) {
                 return "EXCEPTION WHEN OTHERS THEN\n            RAISE WARNING 'Falha em operação opcional (" + funcName + "): %', SQLERRM;\n            " + p1.trim() + "\n        ";
            }
            // Case 2: Batch logging -> Keep original and RAISE EXCEPTION
            if (lowerP1.includes('v_failed :=') || lowerP1.includes('array_append(v_failed')) {
                 return "EXCEPTION WHEN OTHERS THEN\n            " + p1.trim() + "\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
            }
            // Case 3: Returning NULL or default -> Replace with RAISE EXCEPTION
            if (p1.trim().match(/v_\w+\s*:=\s*(null|NULL);/i) || p1.trim().match(/RETURN\s+NULL;/i) || p1.trim() === 'NULL;' || p1.trim() === 'v_valor:=NULL;' || p1.trim() === 'v_actor := NULL;') {
                 return "EXCEPTION WHEN OTHERS THEN\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
            }
            
            // Case 4: Special parse fallback in fn_processar_upgrade_nivel_automatico
            if (funcName === 'fn_processar_upgrade_nivel_automatico') {
                return "EXCEPTION WHEN OTHERS THEN\n            " + p1.trim() + "\n        ";
            }
            
            // For any other case, we will add RAISE EXCEPTION after original log (if any) or replace if silent
            if (lowerP1.includes('raise ') || lowerP1.includes('log')) {
                return "EXCEPTION WHEN OTHERS THEN\n            " + p1.trim() + "\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
            }
            
            return "EXCEPTION WHEN OTHERS THEN\n            RAISE EXCEPTION 'Erro em " + funcName + ": %', SQLERRM;\n        ";
        });
        
        if (modified) {
            output += `-- File: ${file}\n-- Function: ${funcText.match(/FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/i)[1]}\n${fixedText}\n\n`;
        }
    }
}
fs.writeFileSync('supabase/migrations/20260728040000_fix_exception_handlers.sql', output, 'utf-8');
console.log('Occurrences: ' + occurrences);
