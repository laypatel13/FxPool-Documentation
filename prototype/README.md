# FxPool — Prototype

Interactive demo of the pooled-forward-contract mechanism from the FxPool research proposal
(GIFT IFIH FinTech Ideation Hackathon 2026).

## Try it
1. Enter an invoice amount + days to settlement
2. Click "Lock this rate & join the pool" — watch it join two seeded exporters
3. Click "Simulate settlement" — see proportional INR payout per exporter

## What's real vs. simulated
- **Real:** forward-rate calc (interest rate differential formula), pool aggregation logic,
  proportional settlement math
- **Simulated:** market rates (fixed sample values, not live), exporter pool (seeded, not a
  live order book), OCR invoice intake (not built)
- **Not touched:** no backend, no fund custody — matches FxPool's actual role as a matching/
  instruction layer, not a money mover

## Stack
Single static `index.html` — zero build step. Deployed to Vercel as a static site.

## Next steps (if taken past prototype)
- Live rate feed from an IFSC banking unit partner
- Real invoice OCR
- Persistent pool/order-book backend