import { FreeToolsDistinctPalettePage } from './FreeToolsDistinctPalettePage';

interface FinalFreeToolsPalettePageProps {
  onBack: () => void;
  onServices: () => void;
}

const FINAL_FREE_TOOLS_PALETTE = `
  body.gsa-public-free-tools footer {
    border-top-color: rgba(168, 188, 169, 0.16) !important;
    background: #0f241c !important;
  }

  body.gsa-public-free-tools footer [class*="hover:text-[#d8bd73]"]:hover {
    color: #a8bca9 !important;
  }

  body.gsa-public-free-tools footer h2 {
    color: rgba(211, 224, 213, 0.55) !important;
  }

  body.gsa-public-free-tools footer p,
  body.gsa-public-free-tools footer nav,
  body.gsa-public-free-tools footer a,
  body.gsa-public-free-tools footer button {
    color: rgba(235, 242, 235, 0.72);
  }
`;

export function FinalFreeToolsPalettePage(props: FinalFreeToolsPalettePageProps) {
  return (
    <>
      <FreeToolsDistinctPalettePage {...props} />
      <style>{FINAL_FREE_TOOLS_PALETTE}</style>
    </>
  );
}
