import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase credentials not found in .env file');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

export async function setupTestUsers() {
  // Logic to create [TESTE] Admin, Colaborador, Client, Prestador
  // In a real scenario, this might need the service_role key to bypass RLS,
  // but for the sake of the E2E flow, we will create users via UI or API.
  console.log('Setup test users placeholder');
}

export async function teardownTestData() {
  console.log('Tearing down test data with [TESTE] prefix...');
  // Logic to delete all rows with name/title starting with [TESTE]
  // This needs to be carefully mapped depending on tables
}
