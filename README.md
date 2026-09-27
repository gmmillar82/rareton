# Rareton

A cosy pixel village for Rare Friends. Walk your Friend around Rareton, chat
with villagers, pick flowers and post 16 × 16 pixel-art gifts to any other Rare
Friend by number. Built with [FriendSDK](https://github.com/spokesz/friendsdk) v0.1.2
for the [Rare Friends Vibeathon](https://github.com/spokesz/rarefriends-vibeathon).

**Play:** https://gmmillar82.github.io/rareton/

**On a phone:** open it inside MetaMask's in-app browser, using
[this link](https://metamask.app.link/dapp/gmmillar82.github.io/rareton/) or the
MetaMask app's Browser tab. Regular mobile browsers have no wallet, so they show
"No browser wallet found".

Requires a browser wallet on **Robinhood mainnet (chain 4663)** holding a hardwired
Rare Friends Generations NFT (generation ≥ 1). Connecting the wallet and the
read-only ownership check are the only wallet interactions. **All gifts are
simulated.** Nothing is minted or sent, and there are no transactions, signatures or fees.

## Run locally

Requires Node.js 22+.

```sh
npm ci
npm run dev        # http://localhost:4173
npm run build      # static output in games/rareton/.friendsdk/
npm run check      # FriendSDK game validation
```

The FriendSDK v0.1.2 release archive is included (`rarefriends-friendsdk-0.1.2.tgz`)
so `npm ci` works offline from the SDK repo.

Automated checks (mock wallet, headless Chromium):

```sh
npx playwright install --with-deps chromium
npx friendsdk test games/rareton --screenshot artifacts/game.png
node scripts/smoke.mjs 960   # walk to the post office and send a simulated letter
node scripts/smoke.mjs 360   # same, phone width
```

Game rules, controls and gift format are in [games/rareton/README.md](games/rareton/README.md).

## License

Code: Apache-2.0. Rare Friends artwork used under the FriendSDK [NOTICE](https://github.com/spokesz/friendsdk/blob/main/NOTICE.md).
