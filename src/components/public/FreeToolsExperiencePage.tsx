import { FreeToolsPage } from './FreeToolsPage';

interface FreeToolsExperiencePageProps {
  onBack: () => void;
  onServices: () => void;
}

export function FreeToolsExperiencePage(props: FreeToolsExperiencePageProps) {
  return <FreeToolsPage {...props} />;
}
