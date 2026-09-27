# Rareton

A cosy pixel village for Rare Friends, built with **FriendSDK v0.1.2**.
Walk your Friend around Rareton, chat with villagers, pick flowers, and post
16 × 16 pixel-art gifts to any other Rare Friend by number.

**All RF, seed packets, stamps and gifts are simulated.** Nothing is minted or
sent on-chain, and there are no transactions, signatures or real fees. The wallet is only used by the SDK runtime
to confirm you own a hardwired Generations Friend (generation ≥ 1) on
Robinhood mainnet (chain 4663).

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Walk | WASD or arrow keys | Tap / click where to go |
| Interact | E near something | Tap a building, flower or villager (your Friend walks over) |
| Menus | Satchel and ⚙ Settings buttons | Same |

Settings has a sound toggle (off by default) and a reduce-motion option (it also
follows the system setting). Input pauses whenever the runtime pauses the game or a menu is open.

## Village rules

- **Flowers** (daisy, tulip, bluebell, poppy, sunflower) grow in the east meadow,
  by the pond and near cottages. Picking one puts it in your satchel. It regrows after 25 seconds.
- **Bramble's Bakery** gives you a free honey bun (you can carry up to 3).
- **The wishing well** gives you a daisy the first time you make a wish.
- **Villagers** (Bramble, Postmaster Quill, Sparkle, Old Moss) chat. Old Moss gives
  you a poppy and Sparkle leaves a bouquet in your mailbox.
- **Seed stall and community garden** (south end of the meadow): buy a seed packet,
  plant it in the garden plot and it blooms into one garden-only flower (odds below).
  Keep garden flowers for bouquets or sell them back at the stall. The plot shows the
  garden flowers you're holding.
- **Post office**: choose a bouquet (1–3 flowers), a letter (6 messages) or a honey
  bun. Type any Friend number, preview their sprite and your gift art, then
  **Stamp & send**. Every gift needs a 0.1 RF stamp. Garden flowers in a bouquet
  carry their RF value to the recipient. The gift is listed under *Sent gifts*.
- **Mailbox** holds gifts from villagers (also simulated story items).
- Nothing persists. Reloading starts a fresh visit. The SDK sandbox has no storage.

## Gift art

Every gift is a 16 × 16 one-bit bitmap, the same format as Friend walking
sprites, packed into a single uint256 **gift code** (bit 0 = top-left pixel).
Bouquets are composed from the chosen flower heads. Letters carry a seal picked
by the message and a tiny stamp derived from the recipient's number, so each
letter is unique to its recipient.

## Economy (simulated RF)

The SDK runtime's preview ledger starts each Friend with **20 RF** (simulated).
Seed packets use the SDK's chance-game client (`buy`, `play`, `settle`, `redeem`),
so every purchase, planting and sale goes through the runtime's in-frame confirmation.

| Rule | Exact value |
| --- | --- |
| Seed packet price | 1 RF (`1000000000000000000` base units) |
| Clover | 40% / 4,000 bps · 0.25 RF |
| Rose | 25% / 2,500 bps · 0.75 RF |
| Lily | 20% / 2,000 bps · 1 RF |
| Orchid | 10% / 1,000 bps · 1.5 RF |
| Golden sunflower | 4.5% / 450 bps · 4 RF |
| Moonflower | 0.5% / 50 bps · 20 RF |
| Expected value | 0.9175 RF of flowers per packet |
| Consumable | One packet grows exactly one flower; no rerolls |
| Backing | Each purchased or pending packet reserves the 20 RF maximum prize; kept flowers reserve their fixed value |
| Redemption | Sell a garden flower at the stall for its fixed value, no expiry |
| Postage stamp | 0.1 RF per gift: 0.05 RF burned, 0.05 RF to the village post fund |

Garden flowers put in a bouquet are set aside locally and travel with the gift. They
stay backed in the ledger, which models a future version where the recipient
receives the RF-backed flower. Stamps are a local simulation on top of the SDK
ledger (the bridge has no burn API), so the runtime's *Friend wallet* panel does not
include stamp spending. The in-game balance does. Meadow flowers, honey buns and
letters are free and have no RF value.

**Future on-chain version (for review with the Rare Friends team):** a stamp contract
would burn half of each stamp in RF and route half to a post fund. Gifts would mint
as small NFTs holding their 16 × 16 bitmap and from/to Friend IDs, delivered to the
recipient Friend's canonical wallet together with any RF-backed garden flowers.

## Artwork

The player's sprite and gift recipients are read live from the public Rare Friends
artwork registry via the SDK sprite reader. Villager sprites (Friends #21, #77, #3
and #150) are baked into `villager-art.ts` by `scripts/bake-villagers.mjs` from the
same public registry. Their names and dialogue are invented for Rareton.
