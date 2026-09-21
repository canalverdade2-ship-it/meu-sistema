# E2E Test Infra: Audio Identity Builder

## Test Philosophy
- Opaque-box, requirement-driven. Direct verification of VPS filesystem and media assets.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Playout Simulation.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Directory Structure (/opt/gsa-tv/cache/media/1/identity/audio/{news,viral,faith,lifestyle,sfx}) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 2 | Total Audio Inventory Volume (>= 200 files) | ORIGINAL_REQUEST §ACCEPTANCE | 5 | 5 | ✓ |
| 3 | Category Distribution (~40-50 per category) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | Audio File Format & Codec (.mp3, .wav, .m4a) | ORIGINAL_REQUEST §ACCEPTANCE | 5 | 5 | ✓ |
| 5 | Acoustic & Bitstream Integrity (ffprobe & file, zero corruption) | ORIGINAL_REQUEST §ACCEPTANCE | 5 | 5 | ✓ |

## Test Architecture
- Test runners:
  - `validate-audio-inventory.sh`: Direct shell verification of directory layout and >= 200 count.
  - `verify-audio-samples.sh`: Forensic verification of 10 random samples using `ffprobe` / `file`.
  - `test_audio_identity_e2e.mjs`: Automated multi-tier test runner over SSH to Oracle VPS.
- Target Root on VPS: `/opt/gsa-tv/cache/media/1/identity/audio/`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Hard News Broadcast Bed Playback | F1, F2, F3, F4, F5 | Medium |
| 2 | Viral / Comedy Segment Sound Bed & Effects | F1, F2, F3, F4, F5 | Medium |
| 3 | Faith & Inspiration Ambient Playout | F1, F2, F3, F4, F5 | Medium |
| 4 | Lifestyle Magazine Acoustic / Jazz Bed | F1, F2, F3, F4, F5 | Medium |
| 5 | Channel Branding SFX (Whooshes, Impacts, Tickers) | F1, F2, F3, F4, F5 | Medium |

## Coverage Thresholds
- Tier 1: >= 5 tests per feature (Existence of directories, file counts, valid file extensions)
- Tier 2: >= 5 boundary/corner cases (Stub file detection < 4KB, 0-byte file rejection, non-audio file rejection, permission verification)
- Tier 3: Pairwise cross-feature interactions (category-to-format, size-to-duration, permissions-to-readability)
- Tier 4: 5 broadcast simulation scenarios
