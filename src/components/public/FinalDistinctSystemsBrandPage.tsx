import { DistinctSystemsBrandPage } from './DistinctSystemsBrandPage';

interface FinalDistinctSystemsBrandPageProps {
  onBack: () => void;
  onLogin: () => void;
}

const FINAL_DISTINCT_PALETTES = `
  body.gsa-public-systems footer {
    border-top-color: rgba(88, 216, 206, 0.14) !important;
    background: #031416 !important;
  }

  body.gsa-public-systems footer [class*="hover:text-cyan"]:hover,
  body.gsa-public-systems footer [class*="hover:text-[#d8bd73]"]:hover {
    color: #58d8ce !important;
  }

  body.gsa-public-brand [class~="bg-[#cdb790]"] {
    background-color: #d79a85 !important;
  }

  body.gsa-public-brand [class~="bg-[#bda477]"] {
    background-color: #c77a61 !important;
  }

  body.gsa-public-brand [class~="bg-[#c3ab80]"] {
    background-color: #cf8b74 !important;
  }

  body.gsa-public-brand [class~="bg-[#8f6749]"] {
    background-color: #a95047 !important;
  }

  body.gsa-public-brand [class~="bg-[#e8dece]"] {
    background-color: #ead5dc !important;
  }

  body.gsa-public-brand [class~="bg-[#fbf8f2]"] {
    background-color: #fff8fa !important;
  }

  body.gsa-public-brand [class~="bg-[#efe8dc]"] {
    background-color: #f3e5ea !important;
  }

  body.gsa-public-brand [class~="bg-[#30251d]"] {
    background-color: #5b1830 !important;
  }

  body.gsa-public-brand [class~="bg-[#17120e]"] {
    background-color: #2a0814 !important;
  }

  body.gsa-public-brand [class~="bg-[#d5ccbf]"] {
    background-color: #d8bcc5 !important;
  }

  body.gsa-public-brand [class~="bg-[#e5dfd6]"] {
    background-color: #eadde2 !important;
  }

  body.gsa-public-brand [class*="text-[#d6bb80]"],
  body.gsa-public-brand [class*="text-[#d8bb7a]"],
  body.gsa-public-brand [class*="text-[#e0c78e]"] {
    color: #e69a7c !important;
  }

  body.gsa-public-brand [class*="text-[#5d4422]"],
  body.gsa-public-brand [class*="text-[#715a38]"],
  body.gsa-public-brand [class*="text-[#675d52]"],
  body.gsa-public-brand [class*="text-[#766854]"],
  body.gsa-public-brand [class*="text-[#8b765d]"],
  body.gsa-public-brand [class*="text-[#9c8c78]"] {
    color: #795362 !important;
  }

  body.gsa-public-brand [class*="border-[#bba98f]"],
  body.gsa-public-brand [class*="border-[#a9916b]"],
  body.gsa-public-brand [class*="border-[#bfb3a2]"],
  body.gsa-public-brand [class*="border-[#c8b89e]"],
  body.gsa-public-brand [class*="border-[#bcae9b]"],
  body.gsa-public-brand [class*="border-[#d7cec1]"],
  body.gsa-public-brand [class*="border-[#ddd3c5]"],
  body.gsa-public-brand [class*="border-[#715a38]"] {
    border-color: #d7b3bf !important;
  }

  body.gsa-public-brand footer {
    border-top-color: rgba(214, 122, 86, 0.16) !important;
    background: #2a0814 !important;
  }

  body.gsa-public-brand footer [class*="hover:text-[#d6bb80]"]:hover,
  body.gsa-public-brand footer [class*="hover:text-[#d8bd73]"]:hover {
    color: #e69a7c !important;
  }

  body.gsa-public-brand [class*="hover:bg-[#c8a96c]"]:hover {
    background-color: #d67a56 !important;
  }

  body.gsa-public-brand [class*="hover:bg-[#c3ab80]"]:hover {
    background-color: #d58f76 !important;
  }

  body.gsa-public-brand [class*="hover:border-[#8e6e3d]"]:hover {
    border-color: #c96747 !important;
  }
`;

export function FinalDistinctSystemsBrandPage(props: FinalDistinctSystemsBrandPageProps) {
  return (
    <>
      <DistinctSystemsBrandPage {...props} />
      <style>{FINAL_DISTINCT_PALETTES}</style>
    </>
  );
}
