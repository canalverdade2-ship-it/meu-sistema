import { FreeToolsExperiencePage } from './FreeToolsExperiencePage';

interface FreeToolsDistinctPalettePageProps {
  onBack: () => void;
  onServices: () => void;
}

const FREE_TOOLS_DISTINCT_PALETTE = `
  .gsa-free-tools-experience [class*="text-[#d8bd73]"],
  .gsa-free-tools-experience [class*="text-[#efd991]"],
  .gsa-free-tools-experience [class*="text-[#94762f]"],
  .gsa-free-tools-experience [class*="text-[#9b7c33]"],
  .gsa-free-tools-experience [class*="text-[#816626]"],
  .gsa-free-tools-experience [class*="text-[#7b642c]"],
  .gsa-free-tools-experience [class*="text-[#b69747]"],
  .gsa-free-tools-experience [class*="text-[#806729]"] {
    color: #496b5d !important;
  }

  .gsa-free-tools-experience [class~="bg-[#d8bd73]"],
  .gsa-free-tools-experience [class~="bg-[#efd991]"] {
    background-color: #9fb5a1 !important;
    color: #10231b !important;
  }

  .gsa-free-tools-experience [class*="bg-[#d8bd73]/"],
  .gsa-free-tools-experience [class*="bg-[#efd991]/"] {
    background-color: rgba(111, 141, 119, 0.14) !important;
  }

  .gsa-free-tools-experience [class*="border-[#d8bd73]"],
  .gsa-free-tools-experience [class*="border-[#efd991]"],
  .gsa-free-tools-experience [class*="border-[#b69747]"] {
    border-color: rgba(73, 107, 93, 0.46) !important;
  }

  .gsa-free-tools-experience [class*="ring-[#d8bd73]"],
  .gsa-free-tools-experience [class*="ring-[#b69747]"] {
    --tw-ring-color: #5d7c68 !important;
  }

  .gsa-free-tools-experience [class*="focus:border-[#b69747]"]:focus {
    border-color: #5d7c68 !important;
  }

  .gsa-free-tools-experience [class*="focus:ring-[#d8bd73]"]:focus,
  .gsa-free-tools-experience [class*="focus:ring-[#b69747]"]:focus {
    --tw-ring-color: rgba(93, 124, 104, 0.28) !important;
  }

  .gsa-free-tools-experience [class*="hover:bg-[#efd991]"]:hover,
  .gsa-free-tools-experience [class*="hover:bg-[#d8bd73]"]:hover {
    background-color: #b6c8b7 !important;
  }

  .gsa-free-tools-experience [class*="hover:text-[#efd991]"]:hover,
  .gsa-free-tools-experience [class*="hover:text-[#d8bd73]"]:hover {
    color: #73917c !important;
  }

  .gsa-free-tools-experience input[type="checkbox"] {
    accent-color: #5d7c68 !important;
  }

  .gsa-free-tools-experience main > section:first-child::before {
    background: linear-gradient(90deg, #36564d 0%, #8ca18d 38%, rgba(140, 161, 141, 0) 84%) !important;
  }

  .gsa-free-tools-experience main > section:first-child span[class*="rounded-full"] {
    border-color: rgba(73, 107, 93, 0.3) !important;
    background: rgba(238, 243, 237, 0.88) !important;
    color: #36564d !important;
  }

  .gsa-free-tools-experience main > section[id^="calculadora-"] aside [class*="text-[#efd991]"],
  .gsa-free-tools-experience main > section[id^="calculadora-"] aside [class*="text-[#d8bd73]"] {
    color: #b9d0bd !important;
  }

  .gsa-free-tools-experience main > section:last-child > div > div:first-child {
    border-color: rgba(119, 151, 126, 0.35) !important;
    background: linear-gradient(135deg, #193029 0%, #10221d 100%) !important;
  }

  .gsa-free-tools-experience main > section:last-child button {
    background-color: #a8bca9 !important;
    color: #13251d !important;
  }

  .gsa-free-tools-experience main > section:last-child button:hover {
    background-color: #bdd0be !important;
  }
`;

export function FreeToolsDistinctPalettePage(props: FreeToolsDistinctPalettePageProps) {
  return (
    <>
      <FreeToolsExperiencePage {...props} />
      <style>{FREE_TOOLS_DISTINCT_PALETTE}</style>
    </>
  );
}
