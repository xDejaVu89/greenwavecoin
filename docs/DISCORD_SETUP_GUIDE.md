# GreenWaveCoin Discord Server Setup Guide

**Purpose:** Complete setup guide for the official GreenWaveCoin Discord server — channel structure, roles, welcome message, rules, bot recommendations, and community management playbook.

---

## 1. Server Creation

1. Open Discord and click the **+** button in the left sidebar to create a new server.
2. Select **"Create My Own"** → **"For a club or community"**.
3. Name the server: **GreenWaveCoin**
4. Upload the GWC logo as the server icon (use the logo from the Trust Wallet PR assets).
5. Set the server region to automatic.

---

## 2. Server Roles

Create the following roles in order (top = highest priority). Set role colors as specified.

| Role | Color | Who Gets It | Description |
|---|---|---|---|
| **🛡️ Admin** | `#00D4AA` (teal) | Founding team | Full server management |
| **⚡ Moderator** | `#3B82F6` (blue) | Trusted community members | Can delete messages, timeout users |
| **🌟 Top Worker** | `#F59E0B` (amber) | Top 10 leaderboard workers | Earned via network contribution |
| **💎 Early Supporter** | `#8B5CF6` (purple) | Waitlist signups before launch | Granted manually at launch |
| **🔬 Researcher** | `#94A3B8` (slate) | AI/ML researchers | Self-assigned via reaction role |
| **💻 Developer** | `#64748B` (gray) | Developers/contributors | Self-assigned via reaction role |
| **👥 Member** | `#FFFFFF` (white) | All verified members | Default role after verification |
| **🆕 Unverified** | No color | New joiners | Before completing verification |

**How to create a role:** Server Settings → Roles → Create Role → set name, color, and permissions.

---

## 3. Channel Structure

Create the following categories and channels. Channels marked 🔒 are read-only for regular members.

### 📢 ANNOUNCEMENTS
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#announcements` | Text | Read-only (Admin posts only) | Official network updates, releases, milestones |
| `#network-status` | Text | Read-only (Bot posts only) | Automated coordinator status updates |
| `#new-releases` | Text | Read-only (Admin posts only) | Worker version releases, changelogs |

### 👋 START HERE
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#welcome` | Text | Read-only | Welcome message + server guide |
| `#rules` | Text | Read-only | Community rules |
| `#roles` | Text | Read-only | Reaction roles for self-assignment |
| `#faq` | Text | Read-only | Frequently asked questions |

### 💬 COMMUNITY
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#general` | Text | All members | General discussion |
| `#introductions` | Text | All members | New member introductions |
| `#off-topic` | Text | All members | Non-GWC conversation |

### ⛏️ WORKERS
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#worker-setup` | Text | All members | Installation help, setup questions |
| `#worker-support` | Text | All members | Bug reports, troubleshooting |
| `#earnings-showcase` | Text | All members | Share your GWC earnings screenshots |
| `#leaderboard` | Text | Read-only (Bot posts) | Weekly leaderboard updates |

### 🪙 TOKEN & TRADING
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#gwc-token` | Text | All members | Token discussion, price talk |
| `#trading` | Text | All members | DEX trading, liquidity discussion |
| `#wallet-help` | Text | All members | Wallet setup, claiming rewards |

### 🔬 RESEARCH & DEV
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#ai-research` | Text | All members | Neural Architecture Search discussion |
| `#development` | Text | All members | Coordinator/worker development |
| `#github-feed` | Text | Read-only (Bot posts) | Automated GitHub commit/PR notifications |

### 📈 GROWTH
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#partnerships` | Text | All members | Partnership proposals, ecosystem discussion |
| `#marketing` | Text | All members | Marketing ideas, content creation |
| `#exchange-listings` | Text | All members | CoinGecko, CMC, DEX listing updates |

### 🔒 STAFF
| Channel | Type | Permissions | Purpose |
|---|---|---|---|
| `#mod-log` | Text | Admin + Mod only | Moderation actions log |
| `#staff-chat` | Text | Admin + Mod only | Internal team discussion |

---

## 4. Welcome Message

Post this in `#welcome` (pin the message):

---

> **Welcome to the official GreenWaveCoin Discord! 🌊**
>
> GreenWaveCoin (GWC) is a decentralized AI research network on Polygon Mainnet. Your idle PC contributes to Neural Architecture Search — and you earn GWC tokens for every task completed.
>
> **Get started in 3 steps:**
>
> **1️⃣ Read the rules** → #rules
> **2️⃣ Grab your roles** → #roles (choose Worker, Researcher, or Developer)
> **3️⃣ Download the worker** → https://greenwavecoin.com
>
> **Useful links:**
> 🌐 Website: https://greenwavecoin.com
> 📂 GitHub: https://github.com/xDejaVu89/greenwavecoin
> 🔗 Token: 0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9 (Polygon)
> 📊 Coordinator: https://api.greenwavecoin.com
>
> Questions? Head to #worker-setup or #general. The team is active and responsive.
>
> **Let's build the future of AI together. ⚡**

---

## 5. Rules Message

Post this in `#rules` (pin the message):

---

> **GreenWaveCoin Community Rules**
>
> **1. Be respectful.** Treat all members with respect. No harassment, hate speech, discrimination, or personal attacks.
>
> **2. No spam or self-promotion.** Do not post unsolicited advertisements, referral links, or promotional content without moderator approval.
>
> **3. No price manipulation.** Do not post coordinated pump/dump content, fake news about GWC price, or misleading information about the token.
>
> **4. No scams or impersonation.** Never impersonate team members, moderators, or other projects. The team will never DM you first asking for funds or private keys.
>
> **5. Keep channels on-topic.** Use the appropriate channel for your message. Worker questions go in #worker-setup, token discussion in #gwc-token, etc.
>
> **6. English in main channels.** Use English in all main channels so the community can participate. Language-specific channels may be added as the community grows.
>
> **7. No NSFW content.** This is a professional community. Keep all content appropriate.
>
> **8. No financial advice.** GWC discussions are for informational purposes only. Nothing in this server constitutes financial advice.
>
> **Violations will result in warnings, timeouts, or permanent bans depending on severity.**
> *Last updated: June 2026*

---

## 6. FAQ Message

Post this in `#faq` (pin the message):

---

> **Frequently Asked Questions**
>
> **Q: What is GreenWaveCoin?**
> A: GreenWaveCoin (GWC) is a DePIN network on Polygon Mainnet that pays people to contribute CPU compute to Neural Architecture Search (AI research). Download the worker, run it on your PC, and earn GWC tokens.
>
> **Q: Do I need a GPU?**
> A: No. GWC runs entirely on consumer CPUs. Any modern PC with Windows will work.
>
> **Q: How do I earn GWC?**
> A: Download the worker from greenwavecoin.com, enter your Polygon wallet address, and start it. You earn GWC proportional to the number of tasks you complete and your accuracy score.
>
> **Q: When can I claim my GWC rewards?**
> A: Rewards are distributed in epochs. At the end of each epoch, you can claim your GWC via the website using a Merkle proof. The RewardEscrowV2 contract holds 4,985,000 GWC for worker rewards.
>
> **Q: Is GWC on any exchanges?**
> A: GWC is currently traded via direct wallet transfers. A QuickSwap liquidity pool is planned for Q3 2026, followed by CoinGecko and CoinMarketCap listings.
>
> **Q: Where is the token contract?**
> A: GWC Token: `0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9` on Polygon Mainnet. Verified on Polygonscan.
>
> **Q: Is the code open-source?**
> A: Yes. The coordinator, worker, and smart contracts are all open-source at github.com/xDejaVu89/greenwavecoin.
>
> **Q: I found a bug. Where do I report it?**
> A: Post in #worker-support or open a GitHub issue at github.com/xDejaVu89/greenwavecoin/issues.

---

## 7. Recommended Bots

Install the following bots to automate server management and engagement:

### MEE6 (Moderation + Leveling)
- **Purpose:** Auto-moderation, welcome messages, leveling system
- **Setup:** mee6.xyz → Add to server → Enable Auto-Moderator (anti-spam, anti-links in #general), Welcome Messages (send to #welcome), Leveling (reward active members with role unlocks)
- **Key config:** Set "Top Worker" role to unlock at level 20

### Carl-bot (Reaction Roles)
- **Purpose:** Self-assignable roles via emoji reactions
- **Setup:** carl.gg → Add to server → Reaction Roles → Create panel in #roles
- **Roles to add:**
  - ⛏️ = Worker role
  - 🔬 = Researcher role
  - 💻 = Developer role
  - 📢 = Announcements ping role

### GitHub Bot (GitHub Feed)
- **Purpose:** Post GitHub commits, PRs, and releases to #github-feed
- **Setup:** In Discord, go to #github-feed → Edit Channel → Integrations → Webhooks → Create Webhook. Then in GitHub repo settings → Webhooks → Add webhook with the Discord webhook URL (append `/github` to the URL).
- **Events to subscribe:** Push, Pull Request, Release, Issues

### Collab.Land (Token Gating — Optional)
- **Purpose:** Verify GWC token holders and assign roles based on holdings
- **Setup:** collab.land → Connect Discord → Add rule: Polygon chain, GWC contract `0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9`, minimum 100 GWC → assign "Top Worker" or custom holder role
- **Use case:** Create exclusive channels for verified GWC holders

---

## 8. Server Settings

Configure the following in Server Settings:

**Overview:**
- Server name: GreenWaveCoin
- Server description: "Decentralized AI Research Network on Polygon. Earn GWC by contributing CPU compute to Neural Architecture Search."

**Moderation:**
- Verification Level: **Medium** (must have verified email for 5 minutes)
- Explicit Content Filter: **Scan messages from all members**
- Default Notifications: **Only @mentions** (prevents notification spam)

**Community Features:**
- Enable Community Server (required for announcement channels)
- Set `#rules` as the Rules channel
- Set `#announcements` as the Updates channel

**Integrations:**
- Enable Webhooks for GitHub feed

---

## 9. Launch Checklist

Before announcing the Discord server publicly, complete the following:

- [ ] All channels created with correct permissions
- [ ] All roles created with correct colors and permissions
- [ ] Welcome message posted and pinned in #welcome
- [ ] Rules posted and pinned in #rules
- [ ] FAQ posted and pinned in #faq
- [ ] MEE6 installed and configured (auto-mod + welcome DM)
- [ ] Carl-bot installed with reaction roles in #roles
- [ ] GitHub webhook connected to #github-feed
- [ ] Server icon set to GWC logo
- [ ] Server description set
- [ ] Verification level set to Medium
- [ ] Test all channels with a test account
- [ ] Add Discord invite link to greenwavecoin.com website

---

## 10. Community Growth Playbook

Once the server is live, use the following tactics to grow the community:

**Week 1 — Seed the Community:**
Post the Discord invite link in the following places:
- greenwavecoin.com (add Discord button to nav bar)
- GitHub README.md
- Twitter/X bio and pinned tweet
- Polygon ecosystem Discord servers (#projects or #showcase channels)
- DePIN-focused communities (DePIN Alliance, Helium Discord, io.net Discord)

**Week 2–4 — Engagement:**
- Post daily in #general with network stats (workers online, tasks completed)
- Run a "First 100 Members" campaign — first 100 members get the "Early Supporter" role
- Post weekly leaderboard updates in #leaderboard
- Ask members to post their worker screenshots in #earnings-showcase

**Ongoing:**
- Respond to every message in #worker-support within 24 hours
- Post every new GitHub release in #new-releases
- Run monthly AMAs (Ask Me Anything) in a voice channel
- Reward top contributors with the "Top Worker" role based on leaderboard position

---

*Guide prepared June 2026. For questions, contact s4dejavu@gmail.com.*
