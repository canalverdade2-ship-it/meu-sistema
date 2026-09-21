import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const raw = JSON.parse(fs.readFileSync(path.join(root, '.agents', 'explorer_diag_db_1', 'query_audit_raw.json'), 'utf8'));

console.log(`Total queries found: ${raw.totalQueries}`);
console.log(`Total raw issues: ${raw.issues.length}`);

// Group issues by file category
const superDomainIssues = raw.issues.filter(i => i.file.includes('super-domains'));
const adminIssues = raw.issues.filter(i => i.file.includes('components/admin') && !i.file.includes('super-domains'));
const otherIssues = raw.issues.filter(i => !i.file.includes('components/admin'));

console.log(`\n--- SUPER DOMAIN ISSUES (${superDomainIssues.length}) ---`);
for (const issue of superDomainIssues) {
  console.log(`[${issue.type}] ${issue.file}:${issue.line} -> ${issue.detail}`);
}

console.log(`\n--- OTHER ADMIN ISSUES (${adminIssues.length}) ---`);
const groupedAdmin = {};
for (const issue of adminIssues) {
  groupedAdmin[issue.file] = (groupedAdmin[issue.file] || 0) + 1;
}
console.log(groupedAdmin);

console.log(`\n--- ALL SUPER DOMAIN QUERIES COUNT: ${raw.superDomainQueries.length} ---`);
