import { SystemsPageFinal } from './SystemsPageFinal';

interface DistinctSystemsBrandPageProps {
  onBack: () => void;
  onLogin: () => void;
}

const DISTINCT_PAGE_PALETTES = `
  /* Sites e Sistemas — azul petróleo + turquesa técnico */
  body.gsa-public-systems {
    background: #06191c;
  }

  body.gsa-public-systems header {
    border-bottom-color: rgba(83, 215, 204, 0.16) !important;
    background: rgba(5, 22, 25, 0.96) !important;
  }

  body.gsa-public-systems header [class*="text-[#d8bd73]"],
  body.gsa-public-systems header [class*="text-[#d7b96e]"] {
    color: #58d8ce !important;
  }

  body.gsa-public-systems header [class*="border-[#d8bd73]"] {
    border-color: rgba(88, 216, 206, 0.48) !important;
  }

  body.gsa-public-systems header [class*="bg-[#d8bd73]/"] {
    background-color: rgba(88, 216, 206, 0.13) !important;
  }

  body.gsa-public-systems header [class*="ring-[#d8bd73]"] {
    --tw-ring-color: #58d8ce !important;
  }

  body.gsa-public-systems main > section:first-of-type {
    border-bottom-color: #b8d7d3 !important;
    background:
      radial-gradient(circle at 91% 14%, rgba(77, 201, 191, 0.17), transparent 25rem),
      linear-gradient(135deg, #f1fbfa 0%, #e2f2f0 52%, #d3e8e6 100%) !important;
    color: #0a2b2f !important;
  }

  body.gsa-public-systems main > section:first-of-type::before {
    background: linear-gradient(90deg, #0b6268 0%, #55d7cd 38%, rgba(85, 215, 205, 0) 84%) !important;
  }

  body.gsa-public-systems main > section:first-of-type::after {
    border-color: rgba(11, 98, 104, 0.14) !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child {
    border-left-color: #39b9b1 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:first-child {
    color: #0b6268 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:first-child::before {
    background: #188c90 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child h1 {
    color: #082a2e !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:nth-of-type(2) {
    color: #48666a !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:first-child {
    border-color: #0d666c !important;
    background: linear-gradient(180deg, #11747a 0%, #0b5d63 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 14px 30px rgba(7, 74, 79, 0.2) !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:first-child:hover {
    background: linear-gradient(180deg, #16858b 0%, #0d696f 100%) !important;
    box-shadow: 0 18px 36px rgba(7, 74, 79, 0.25) !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:nth-child(2) {
    border-color: #79a8a6 !important;
    background: rgba(255, 255, 255, 0.62) !important;
    color: #0a3438 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:nth-child(2):hover {
    border-color: #0b6268 !important;
    color: #0b6268 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul {
    border-color: #bfd7d4 !important;
    background: rgba(255, 255, 255, 0.56) !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul li {
    color: #4c686b !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul li + li {
    border-color: #c8ddda !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > aside {
    border-color: rgba(88, 216, 206, 0.34) !important;
    background: linear-gradient(180deg, #0d373c 0%, #061f23 100%) !important;
    box-shadow: inset 0 3px 0 #58d8ce, 0 32px 70px rgba(5, 36, 40, 0.24) !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > aside::after {
    border-color: rgba(88, 216, 206, 0.17) !important;
  }

  body.gsa-public-systems [class*="text-[#d7b96e]"],
  body.gsa-public-systems [class*="text-[#e3c982]"],
  body.gsa-public-systems [class*="text-[#e3cb8d]"],
  body.gsa-public-systems [class*="text-[#d8bd73]"],
  body.gsa-public-systems [class*="text-[#efd991]"] {
    color: #58d8ce !important;
  }

  body.gsa-public-systems [class~="bg-[#d7b96e]"],
  body.gsa-public-systems [class~="bg-[#d8bd73]"] {
    background-color: #58d8ce !important;
  }

  body.gsa-public-systems [class*="bg-[#d7b96e]/"],
  body.gsa-public-systems [class*="bg-[#d8bd73]/"] {
    background-color: rgba(88, 216, 206, 0.13) !important;
  }

  body.gsa-public-systems [class*="border-[#d7b96e]"],
  body.gsa-public-systems [class*="border-[#d8bd73]"] {
    border-color: rgba(88, 216, 206, 0.48) !important;
  }

  body.gsa-public-systems [class*="ring-[#d7b96e]"],
  body.gsa-public-systems [class*="ring-[#d8bd73]"] {
    --tw-ring-color: #58d8ce !important;
  }

  body.gsa-public-systems [class*="hover:text-[#e3cb8d]"]:hover,
  body.gsa-public-systems [class*="hover:text-[#d7b96e]"]:hover,
  body.gsa-public-systems [class*="hover:text-[#d8bd73]"]:hover {
    color: #9aeee7 !important;
  }

  body.gsa-public-systems [class*="hover:border-[#d7b96e]"]:hover,
  body.gsa-public-systems [class*="hover:border-[#d8bd73]"]:hover {
    border-color: #58d8ce !important;
  }

  /* Construção de Marca — vinho + cobre */
  body.gsa-public-brand {
    background: #f3e5ea;
  }

  body.gsa-public-brand header {
    border-bottom-color: rgba(205, 111, 76, 0.18) !important;
    background: rgba(42, 8, 20, 0.96) !important;
  }

  body.gsa-public-brand header [class*="text-[#d8bd73]"],
  body.gsa-public-brand header [class*="text-[#d7b96e]"] {
    color: #d67a56 !important;
  }

  body.gsa-public-brand header [class*="border-[#d8bd73]"] {
    border-color: rgba(214, 122, 86, 0.5) !important;
  }

  body.gsa-public-brand header [class*="bg-[#d8bd73]/"] {
    background-color: rgba(214, 122, 86, 0.14) !important;
  }

  body.gsa-public-brand header [class*="ring-[#d8bd73]"] {
    --tw-ring-color: #d67a56 !important;
  }

  body.gsa-public-brand > div,
  body.gsa-public-brand [class~="bg-[#efe8dc]"] {
    background-color: #f3e5ea !important;
  }

  body.gsa-public-brand main > section:first-of-type,
  body.gsa-public-brand [class~="bg-[#f4efe6]"] {
    border-bottom-color: #d9b8c3 !important;
    background:
      radial-gradient(circle at 88% 15%, rgba(198, 94, 67, 0.13), transparent 25rem),
      linear-gradient(135deg, #fff7f9 0%, #f8edf1 52%, #eddce3 100%) !important;
  }

  body.gsa-public-brand [class*="text-[#211a14]"] {
    color: #35101d !important;
  }

  body.gsa-public-brand [class*="text-[#62594f]"] {
    color: #755963 !important;
  }

  body.gsa-public-brand [class*="text-[#8e6e3d]"],
  body.gsa-public-brand [class*="text-[#7b5d31]"],
  body.gsa-public-brand [class*="text-[#c8a96c]"],
  body.gsa-public-brand [class*="text-[#d8bd73]"],
  body.gsa-public-brand [class*="text-[#efd991]"] {
    color: #c96747 !important;
  }

  body.gsa-public-brand [class~="bg-[#211a14]"] {
    background-color: #481426 !important;
  }

  body.gsa-public-brand [class~="bg-[#35291f]"] {
    background-color: #611c32 !important;
  }

  body.gsa-public-brand [class~="bg-[#d8bd73]"] {
    background-color: #d67a56 !important;
  }

  body.gsa-public-brand [class*="bg-[#d8bd73]/"] {
    background-color: rgba(214, 122, 86, 0.14) !important;
  }

  body.gsa-public-brand [class*="border-[#d8cfc0]"],
  body.gsa-public-brand [class*="border-[#b9aa95]"] {
    border-color: #d9b8c3 !important;
  }

  body.gsa-public-brand [class*="border-[#8e6e3d]"],
  body.gsa-public-brand [class*="border-[#d8bd73]"] {
    border-color: rgba(201, 103, 71, 0.55) !important;
  }

  body.gsa-public-brand [class*="ring-[#8e6e3d]"],
  body.gsa-public-brand [class*="ring-[#d8bd73]"] {
    --tw-ring-color: #c96747 !important;
  }

  body.gsa-public-brand [class*="bg-[#211a14]"] {
    background-color: #481426 !important;
  }

  body.gsa-public-brand [class*="hover:bg-[#35291f]"]:hover {
    background-color: #611c32 !important;
  }

  body.gsa-public-brand [class*="hover:border-[#211a14]"]:hover {
    border-color: #481426 !important;
  }

  body.gsa-public-brand [class*="hover:text-[#d8bd73]"]:hover,
  body.gsa-public-brand [class*="hover:text-[#c8a96c]"]:hover {
    color: #e59a7e !important;
  }

  body.gsa-public-brand main input:focus,
  body.gsa-public-brand main select:focus,
  body.gsa-public-brand main textarea:focus {
    border-color: #c96747 !important;
    box-shadow: 0 0 0 4px rgba(201, 103, 71, 0.12) !important;
  }
`;

export function DistinctSystemsBrandPage(props: DistinctSystemsBrandPageProps) {
  return (
    <>
      <SystemsPageFinal {...props} />
      <style>{DISTINCT_PAGE_PALETTES}</style>
    </>
  );
}
