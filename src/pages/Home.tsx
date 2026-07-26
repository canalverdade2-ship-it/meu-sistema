import { EnterpriseAccessPage } from './EnterpriseAccessPage';
import { Home as HomeLegacy } from './HomeLegacy';

type HomeProps = React.ComponentProps<typeof HomeLegacy>;

export function Home(props: HomeProps) {
  const enterpriseLogin = props.loginOnly && (
    window.location.pathname === '/login/empresa'
    || window.location.pathname === '/login/empresarial'
  );

  if (enterpriseLogin) {
    return (
      <EnterpriseAccessPage
        onLoginClient={props.onLoginClient}
        onBack={props.onBackHome || (() => window.location.assign('/login'))}
      />
    );
  }

  return <HomeLegacy {...props} />;
}
