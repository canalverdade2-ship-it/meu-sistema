import fs from 'fs';
import path from 'path';
import { runPsql } from './query_vps.mjs';

const migrationsDir = path.resolve('supabase/migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

console.log(`Found ${migrationFiles.length} migration files.`);

// Load functions and tables from DB
const vpsFuncs = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_functions.json', 'utf8'));
const vpsTables = JSON.parse(fs.readFileSync('.agents/teamwork_preview_explorer_db_1/vps_tables.json', 'utf8'));

const funcSet = new Set(vpsFuncs.map(f => f.name.toLowerCase()));
const tableSet = new Set(vpsTables.map(t => t.table_name.toLowerCase()));

const tableColMap = new Map();
for (const col of vpsTables) {
  const tbl = col.table_name.toLowerCase();
  if (!tableColMap.has(tbl)) tableColMap.set(tbl, new Set());
  tableColMap.get(tbl).add(col.column_name.toLowerCase());
}

const migrationStatus = [];

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  
  // Extract created tables
  const createTableMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)];
  const createdTables = createTableMatches.map(m => m[1].toLowerCase());

  // Extract created functions
  const createFuncMatches = [...content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)];
  const createdFuncs = createFuncMatches.map(m => m[1].toLowerCase());

  // Extract alter table add column
  const addColMatches = [...content.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi)];
  const addedCols = addColMatches.map(m => ({ table: m[1].toLowerCase(), column: m[2].toLowerCase() }));

  const missingFromThisMigration = {
    file,
    missingTables: createdTables.filter(t => !tableSet.has(t)),
    missingFuncs: createdFuncs.filter(f => !funcSet.has(f)),
    missingCols: addedCols.filter(ac => !tableColMap.has(ac.table) || !tableColMap.get(ac.table).has(ac.column))
  };

  if (
    missingFromThisMigration.missingTables.length > 0 ||
    missingFromThisMigration.missingFuncs.length > 0 ||
    missingFromThisMigration.missingCols.length > 0
  ) {
    migrationStatus.push(missingFromThisMigration);
  }
}

fs.writeFileSync(
  '.agents/teamwork_preview_explorer_db_1/missing_from_migrations.json',
  JSON.stringify(migrationStatus, null, 2),
  'utf8'
);

console.log(`Found ${migrationStatus.length} migrations with objects missing on VPS DB:`);
console.log(JSON.stringify(migrationStatus, null, 2));
