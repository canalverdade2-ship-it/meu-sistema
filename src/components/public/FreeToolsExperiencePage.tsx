import { FreeToolsPage } from './FreeToolsPage';

interface FreeToolsExperiencePageProps {
  onBack: () => void;
  onServices: () => void;
}

const FREE_TOOLS_EXPERIENCE_STYLES = `
  .gsa-free-tools-experience {
    overflow-x: clip;
    background: #eef0eb;
  }

  .gsa-free-tools-experience > main {
    background: #eef0eb !important;
    color: #17202a;
  }

  .gsa-free-tools-experience > main > section:first-child {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    border-bottom: 1px solid #ccd2c9;
    background:
      radial-gradient(circle at 90% 12%, rgba(108, 135, 111, 0.16), transparent 24rem),
      linear-gradient(135deg, #fbfaf6 0%, #f0f1eb 52%, #e4e8df 100%) !important;
    color: #17202a !important;
  }

  .gsa-free-tools-experience > main > section:first-child::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    z-index: -1;
    height: 3px;
    background: linear-gradient(90deg, #36564d 0%, #8ca18d 38%, rgba(140, 161, 141, 0) 84%);
  }

  .gsa-free-tools-experience > main > section:first-child::after {
    content: '';
    position: absolute;
    right: -11rem;
    bottom: -17rem;
    z-index: -1;
    width: 36rem;
    height: 36rem;
    border: 1px solid rgba(54, 86, 77, 0.13);
    border-radius: 999px;
  }

  .gsa-free-tools-experience > main > section:first-child > div.absolute {
    display: none !important;
  }

  .gsa-free-tools-experience > main > section:first-child button {
    min-height: 44px;
    border: 1px solid #c9d0c7;
    border-radius: 0.65rem;
    background: rgba(255, 255, 255, 0.65);
    padding: 0.65rem 0.9rem;
    color: #52605d !important;
  }

  .gsa-free-tools-experience > main > section:first-child button:hover {
    border-color: #607b70;
    background: #ffffff;
    color: #17202a !important;
  }

  .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:first-child {
    border-left: 3px solid #6d8877;
    padding-left: 1.6rem;
  }

  .gsa-free-tools-experience > main > section:first-child span[class*="rounded-full"] {
    border-color: rgba(54, 86, 77, 0.28) !important;
    background: rgba(255, 255, 255, 0.68) !important;
    color: #36564d !important;
  }

  .gsa-free-tools-experience > main > section:first-child h1 {
    max-width: 13ch;
    color: #111820 !important;
    font-size: clamp(2.65rem, 6vw, 4.75rem) !important;
    line-height: 1.02 !important;
    letter-spacing: -0.045em !important;
    text-wrap: balance;
  }

  .gsa-free-tools-experience > main > section:first-child h1 span {
    color: #496b5d !important;
    font-style: normal !important;
    font-weight: 800 !important;
  }

  .gsa-free-tools-experience > main > section:first-child h1 + p {
    color: #5d6866 !important;
  }

  .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child {
    overflow: hidden;
    border: 1px solid #cbd2c9 !important;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.58);
    padding: 0 !important;
    box-shadow: 0 16px 36px rgba(36, 50, 44, 0.07);
  }

  .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child > div {
    min-height: 5.5rem;
    padding: 1.15rem;
  }

  .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child > div + div {
    border-left: 1px solid #d7dcd5;
  }

  .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child strong {
    color: #36564d !important;
  }

  .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child span {
    color: #68736f !important;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) {
    background: #eef0eb;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) h2 {
    color: #111820;
    letter-spacing: -0.035em;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) > div > div:first-child > p:first-child {
    color: #496b5d !important;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > button,
  .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > article {
    position: relative;
    overflow: hidden;
    min-height: 21rem;
    border-color: #cfd5cc !important;
    border-radius: 1rem !important;
    background: #fafaf7 !important;
    box-shadow: 0 12px 34px rgba(27, 39, 34, 0.055) !important;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > button::before,
  .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > article::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 3px;
    background: linear-gradient(90deg, #36564d, #9aac9b, transparent);
  }

  .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > button:hover {
    border-color: #6d8877 !important;
    background: #ffffff !important;
    box-shadow: 0 22px 48px rgba(27, 39, 34, 0.11) !important;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) [class*="bg-[#f1e7c8]"] {
    border: 1px solid #cbd4cc;
    background: #e5ebe5 !important;
    color: #36564d !important;
  }

  .gsa-free-tools-experience > main > section:nth-child(2) [class*="bg-emerald-50"] {
    border: 1px solid #c4d9ca;
    background: #edf5ef !important;
    color: #356145 !important;
  }

  .gsa-free-tools-experience > main > section[id^="calculadora-"] {
    border-top-color: #cfd5cc !important;
    background: #f8f8f4 !important;
  }

  .gsa-free-tools-experience > main > section[id^="calculadora-"] > div > div:last-child {
    border-color: #cfd5cc !important;
    border-radius: 1rem !important;
    background: #f5f5f0 !important;
    box-shadow: 0 24px 62px rgba(27, 39, 34, 0.09) !important;
  }

  .gsa-free-tools-experience > main > section[id^="calculadora-"] aside {
    background: linear-gradient(180deg, #193029 0%, #10221d 100%) !important;
  }

  .gsa-free-tools-experience > main > section[id^="calculadora-"] input,
  .gsa-free-tools-experience > main > section[id^="calculadora-"] select,
  .gsa-free-tools-experience > main > section[id^="calculadora-"] label[class*="border"] {
    border-color: #d1d7cf !important;
  }

  .gsa-free-tools-experience > main > section[id^="calculadora-"] input:focus,
  .gsa-free-tools-experience > main > section[id^="calculadora-"] select:focus {
    border-color: #607b70 !important;
    box-shadow: 0 0 0 4px rgba(96, 123, 112, 0.12) !important;
  }

  .gsa-free-tools-experience > main > section[class*="border-y"] {
    border-color: #cfd5cc !important;
    background: #fafaf7 !important;
  }

  .gsa-free-tools-experience > main > section[class*="border-y"] svg {
    color: #496b5d !important;
  }

  .gsa-free-tools-experience > main > section:last-child > div > div:first-child {
    overflow: hidden;
    border: 1px solid rgba(216, 189, 115, 0.28);
    border-radius: 1rem !important;
    background: linear-gradient(135deg, #193029 0%, #10221d 100%) !important;
    box-shadow: 0 24px 55px rgba(20, 41, 34, 0.18) !important;
  }

  .gsa-free-tools-experience button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  @media (max-width: 767px) {
    .gsa-free-tools-experience > main > section:first-child > div.relative {
      padding-top: 3rem !important;
      padding-bottom: 3rem !important;
    }

    .gsa-free-tools-experience > main > section:first-child > div.relative > div {
      gap: 2.5rem !important;
    }

    .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:first-child {
      border-left-width: 2px;
      padding-left: 1rem;
    }

    .gsa-free-tools-experience > main > section:first-child h1 {
      max-width: 12ch;
      font-size: clamp(2.35rem, 10.2vw, 3rem) !important;
    }

    .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child {
      grid-template-columns: 1fr !important;
    }

    .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child > div {
      min-height: auto;
      padding: 0.9rem 1rem;
    }

    .gsa-free-tools-experience > main > section:first-child > div.relative > div > div:last-child > div + div {
      border-left: 0;
      border-top: 1px solid #d7dcd5;
    }

    .gsa-free-tools-experience > main > section:nth-child(2) {
      padding-top: 3.5rem !important;
      padding-bottom: 3.5rem !important;
    }

    .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > button,
    .gsa-free-tools-experience > main > section:nth-child(2) > div > div:nth-child(2) > article {
      min-height: auto;
      padding: 1.25rem !important;
    }

    .gsa-free-tools-experience > main > section:nth-child(2) h2 {
      font-size: clamp(2rem, 8.5vw, 2.6rem) !important;
      line-height: 1.08 !important;
    }

    .gsa-free-tools-experience > main > section[id^="calculadora-"] {
      padding-top: 3.5rem !important;
      padding-bottom: 3.5rem !important;
    }

    .gsa-free-tools-experience > main > section[id^="calculadora-"] h2 {
      font-size: clamp(1.85rem, 8vw, 2.35rem) !important;
      line-height: 1.08 !important;
    }

    .gsa-free-tools-experience > main > section[id^="calculadora-"] form,
    .gsa-free-tools-experience > main > section[id^="calculadora-"] aside {
      padding: 1.1rem !important;
    }

    .gsa-free-tools-experience > main > section:last-child > div > div:first-child {
      padding: 1.5rem !important;
    }

    .gsa-free-tools-experience > main > section:last-child button {
      width: 100%;
      min-height: 48px;
      justify-content: center;
    }
  }
`;

export function FreeToolsExperiencePage(props: FreeToolsExperiencePageProps) {
  return (
    <div className="gsa-free-tools-experience">
      <style>{FREE_TOOLS_EXPERIENCE_STYLES}</style>
      <FreeToolsPage {...props} />
    </div>
  );
}
