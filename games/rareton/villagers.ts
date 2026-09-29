/**
 * Village characters. They wear the public canonical artwork of these
 * Generations token numbers; their names and chatter are invented for Rareton.
 */
import type { FlowerId } from "./gifts";

export type VillagerGift = { flower?: FlowerId; bouquet?: FlowerId[]; letter?: number };
export type Villager = Readonly<{
  tokenId: bigint;
  name: string;
  home: { x: number; y: number };
  lines: readonly string[];
  /** Given once, the first time the player chats. */
  gift?: VillagerGift;
  giftNote?: string;
}>;

export const VILLAGERS: readonly Villager[] = [
  {
    tokenId: 21n, name: "Bramble", home: { x: 470, y: 600 },
    lines: [
      "Morning! The ovens have been humming since dawn.",
      "Pop into the bakery for a honey bun. First one's free. So is the second.",
      "If you're sending buns by post, wrap them while they're warm.",
    ],
  },
  {
    tokenId: 77n, name: "Postmaster Quill", home: { x: 860, y: 370 },
    lines: [
      "Welcome to the Rareton post office! Give me any Friend's number and I'll address it.",
      "Bring flowers from the east meadow and I'll tie up to three into a bouquet.",
      "Between you and me, it's all practice post for now. No coins, no chain, no fees. Just kindness.",
    ],
  },
  {
    tokenId: 3n, name: "Sparkle", home: { x: 1600, y: 380 },
    lines: [
      "Shh… the sunflowers are listening.",
      "Pick whatever's blooming. It all grows back in a little while.",
      "I left a little something in your mailbox. Don't tell anyone!",
    ],
    gift: { bouquet: ["sunflower", "daisy"] }, giftNote: "Sparkle left a bouquet in your mailbox.",
  },
  {
    tokenId: 150n, name: "Old Moss", home: { x: 690, y: 1090 },
    lines: [
      "The pond remembers everyone who ever skipped a stone.",
      "Bluebells like the shade. Poppies like to show off.",
      "Here, take this poppy. It was looking at you.",
    ],
    gift: { flower: "poppy" }, giftNote: "Old Moss gave you a poppy.",
  },
  {
    tokenId: 88n, name: "Fern", home: { x: -600, y: 1050 },
    lines: [
      "Oh! A visitor. Not many find their way through the Whispering Woods.",
      "When the lamps come on in the village, the starbells open in the stone circle. Only then.",
      "Take this pressed starbell. It still remembers the moonlight.",
    ],
    gift: { flower: "starbell" }, giftNote: "Fern gave you a pressed starbell.",
  },
];
