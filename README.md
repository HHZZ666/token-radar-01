# Token Radar — pre-token protocols ranked by implied value

[![Token Radar](https://make.fun/badge/token-radar-01.svg)](https://make.fun/c/token-radar-01)
[![Rank](https://make.fun/badge/token-radar-01/HHZZ666/token-radar-01/rank.svg)](https://make.fun/c/token-radar-01)
[![Reward](https://make.fun/badge/token-radar-01/HHZZ666/token-radar-01/reward.svg)](https://make.fun/c/token-radar-01)

Token Radar reads a sealed DefiLlama protocol snapshot, finds the protocols that record no token, ranks them by an implied launch value, and renders the result as an offline dashboard with a board, a per-protocol detail view, a filter, and a farm plan for every row. This entry scores a 178-row board with the radar-2 model.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

The program writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. It needs Node.js 22.18 or later and nothing else.

## Model

Radar-2 scores every row with one function of the snapshot figures, no protocol name special-cased:

- TVL (`tvl_usd`), scaled by a category base table (Dexs 0.35, Lending 0.32, Yield 0.30, CDP 0.30, Derivatives 0.28, Risk Curators 0.28, Onchain Capital Allocator 0.28, RWA 0.22, default 0.25)
- Seven-day TVL growth (`change_7d`), clamped to -50…100 and weighted 0.8
- Age with no token (`listed_at` to the snapshot date, unknown age 365 days), as a maturity multiplier from 0.7 to 1.2
- Chain breadth, from the number of chains, as a multiplier from 1.0 to 1.12

Implied value is a model estimate, not a price. Protocols that record no token are described as recording no token, never as having none. Live-token protocols are shown separately with their market caps, never mixed into the ranked board.
