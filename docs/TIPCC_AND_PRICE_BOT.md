# Tip.cc & Discord Price Bot Setup

## Status
Both require a live QuickSwap liquidity pool before they will work.
Once the pool is live, follow the steps below.

---

## 1. Tip.cc — GWC Tipping in Discord

Tip.cc supports custom ERC-20 tokens on Polygon. Once GWC has a liquidity pool, submit a token request.

### Steps
1. Go to **https://tip.cc/token-request**
2. Fill in:
   - **Token Name:** GreenWaveCoin
   - **Ticker:** GWC
   - **Network:** Polygon (MATIC)
   - **Contract Address:** `0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9`
   - **DEX Pool URL:** *(QuickSwap pool URL — add after pool creation)*
   - **CoinGecko / CMC URL:** *(add after listing)*
3. Submit and wait for approval (usually 1–3 days after listing on CoinGecko/CMC)

### Once Approved
- Invite Tip.cc to the server: https://tip.cc/invite
- Members can tip each other with: `$tip @user 10 GWC`
- Members deposit/withdraw at: https://tip.cc

---

## 2. Discord Price Bot (Saitama / Crypto Price Bot)

A price bot shows the live GWC price in the Discord server sidebar as a bot nickname.

### Recommended: Saitama Bot
1. Go to **https://saitama.app**
2. Click **"Add to Discord"** → select GreenWave server
3. In Discord, type: `/add GWC`
4. The bot will show `GWC: $0.0XXX` in the member list sidebar

### Alternative: Crypto Price Bot
1. Invite: https://discord.com/oauth2/authorize?client_id=706935674800177193&scope=bot&permissions=8
2. In `#🤖-bot` channel type: `!add GWC polygon 0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9`

### Note
Both bots pull price data from CoinGecko or DEX aggregators. The price will only show correctly after:
- QuickSwap pool is live with liquidity
- CoinGecko listing is approved (or the bot supports direct DEX price feeds)

---

## Checklist
- [ ] QuickSwap GWC/USDC or GWC/MATIC pool created
- [ ] Pool URL noted for tip.cc and CMC/CoinGecko forms
- [ ] CoinGecko listing approved
- [ ] Tip.cc token request submitted
- [ ] Price bot added to Discord server
