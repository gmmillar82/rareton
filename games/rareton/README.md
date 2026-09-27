# Rareton

A cosy pixel village for Rare Friends, built with **FriendSDK v0.1.2**.
Walk your Friend around Rareton, chat with villagers, pick flowers, and post
16 × 16 pixel-art gifts to any other Rare Friend by number.

**All gifts are simulated.** Nothing is minted or sent on-chain, and there are
no transactions, signatures or fees. The wallet is only used by the SDK runtime
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
- **Post office**: choose a bouquet (1–3 flowers), a letter (6 messages) or a honey
  bun. Type any Friend number, preview their sprite and your gift art, then
  **Mint & send (simulated)**. The gift's items leave your satchel and the gift
  is listed under *Sent gifts*.
- **Mailbox** holds gifts from villagers (also simulated story items).
- Nothing persists. Reloading starts a fresh visit. The SDK sandbox has no storage.

## Gift art

Every gift is a 16 × 16 one-bit bitmap, the same format as Friend walking
sprites, packed into a single uint256 **gift code** (bit 0 = top-left pixel).
Bouquets are composed from the chosen flower heads. Letters carry a seal picked
by the message and a tiny stamp derived from the recipient's number, so each
letter is unique to its recipient.

## Economy

Rareton has no RF costs, rewards or redemption. The runtime currently requires a
chance-game definition, so `game.json` holds an **unused reference
definition** (1 RF price and one 100% outcome) that the game never calls.

## Artwork

The player's sprite and gift recipients are read live from the public Rare Friends
artwork registry via the SDK sprite reader. Villager sprites (Friends #21, #77, #3
and #150) are baked into `villager-art.ts` by `scripts/bake-villagers.mjs` from the
same public registry. Their names and dialogue are invented for Rareton.
