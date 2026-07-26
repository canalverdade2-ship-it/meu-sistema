import { lazy, type ComponentProps } from 'react';
import { EnterpriseAccessPage } from './EnterpriseAccessPage';
import { Home as HomeLegacy } from './HomeLegacy';

type HomeProps = ComponentProps<typeof HomeLegacy>;

// Contratos da Home pública permanecem declarados no ponto de entrada ativo.
export const GSAEnterpriseHomeFinalContract = 'GSAEnterpriseHomeFinal';
export const SystemsPageFinalContract = lazy(() => import('../components/public/SystemsPageFinal').then((module) => ({ default: module.SystemsPageFinal })));
export function clearRevocationMessageContract(params: URLSearchParams) {
  params.delete('msg');
}

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
