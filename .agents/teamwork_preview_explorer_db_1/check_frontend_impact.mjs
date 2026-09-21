import fs from 'fs';

const frontendCatalog = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/frontend_catalog.json', 'utf8'));
const missingFromMigrations = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/missing_from_migrations.json', 'utf8'));

const impactReport = {
  missingTablesReferencedInFrontend: [],
  missingFuncsReferencedInFrontend: [],
  missingColsReferencedInFrontend: []
};

for (const m of missingFromMigrations) {
  for (const t of m.missingTables) {
    if (frontendCatalog.tablesReferenced[t]) {
      impactReport.missingTablesReferencedInFrontend.push({
        table: t,
        migrationFile: m.file,
        frontendFiles: frontendCatalog.tablesReferenced[t].files
      });
    }
  }
  for (const f of m.missingFuncs) {
    if (frontendCatalog.supabaseRpcs[f] || frontendCatalog.adminRpcs[f]) {
      impactReport.missingFuncsReferencedInFrontend.push({
        function: f,
        migrationFile: m.file,
        frontendSupabaseFiles: frontendCatalog.supabaseRpcs[f] || [],
        frontendAdminFiles: frontendCatalog.adminRpcs[f] || []
      });
    }
  }
  for (const c of m.missingCols) {
    // Check if table is referenced
    if (frontendCatalog.tablesReferenced[c.table]) {
      impactReport.missingColsReferencedInFrontend.push({
        table: c.table,
        column: c.column,
        migrationFile: m.file,
        frontendFiles: frontendCatalog.tablesReferenced[c.table].files
      });
    }
  }
}

fs.writeFileSync(
  '.agents/teamwork_preview_explorer_db_1/frontend_impact_of_missing.json',
  JSON.stringify(impactReport, null, 2),
  'utf8'
);

console.log(JSON.stringify(impactReport, null, 2));
