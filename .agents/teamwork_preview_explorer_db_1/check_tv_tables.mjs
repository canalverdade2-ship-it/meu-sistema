import { runRemotePsqlJson } from './audit_helpers.mjs';

const tables = runRemotePsqlJson(`
  SELECT tablename 
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename LIKE '%tv%';
`);
console.log('Tables matching tv:', tables);

const views = runRemotePsqlJson(`
  SELECT viewname 
  FROM pg_views 
  WHERE schemaname = 'public' AND viewname LIKE '%tv%';
`);
console.log('Views matching tv:', views);
