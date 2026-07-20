require('dotenv').config();

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Credenciais públicas do Supabase ausentes.');

  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
  });
  if (!response.ok) throw new Error(`Auth settings HTTP ${response.status}`);
  const settings = await response.json();
  console.log(JSON.stringify({
    disableSignup: settings.disable_signup,
    anonymousUsersEnabled: settings.external?.anonymous_users_enabled,
    emailEnabled: settings.external?.email,
    phoneEnabled: settings.external?.phone,
    mailerAutoconfirm: settings.mailer_autoconfirm,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
