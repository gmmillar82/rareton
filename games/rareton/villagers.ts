/**
 * Village characters. They wear the public canonical artwork of these
 * Generations token numbers; their names and chatter are invented for Rareton.
 */
import type { FlowerId } from "./gifts";

export type VillagerGift = { flower?: FlowerId; bouquet?: FlowerId[]; letter?: number };
/** Where each villager goes at night; knock on the door to talk. */
export type House = "bakery" | "post" | "cottageB" | "cottageC" | "hut";
export type Villager = Readonly<{
  tokenId: bigint;
  name: string;
  home: { x: number; y: number };
  house: House;
  lines: readonly string[];
  /** Spoken through the door at night. */
  night: readonly string[];
  /** Given once, the first time the player chats. */
  gift?: VillagerGift;
  giftNote?: string;
}>;

export const VILLAGERS: readonly Villager[] = [
  {
    tokenId: 21n, name: "Bramble", home: { x: 470, y: 600 }, house: "bakery",
    night: [
      "Who's there? Oh, it's you! I'm proving tomorrow's dough.",
      "Night-time is for dough. The yeast works while we sleep.",
      "Mind how you go. The lamps only reach so far.",
    ],
    lines: [
      "Morning! The ovens have been humming since dawn.",
      "Pop into the bakery for a honey bun. First one's free. So is the second.",
      "If you're sending buns by post, wrap them while they're warm.",
    ],
  },
  {
    tokenId: 77n, name: "Postmaster Quill", home: { x: 860, y: 370 }, house: "post",
    night: [
      "Still up! Letters don't sort themselves, you know.",
      "Night post is the best post. Everyone's thinking of someone.",
      "Leave it on the counter, I'll stamp it by lamplight.",
    ],
    lines: [
      "Welcome to the Rareton post office! Give me any Friend's number and I'll address it.",
      "Bring flowers from the east meadow and I'll tie up to three into a bouquet.",
      "Between you and me, it's all practice post for now. No coins, no chain, no fees. Just kindness.",
    ],
  },
  {
    tokenId: 3n, name: "Sparkle", home: { x: 1600, y: 380 }, house: "cottageB",
    night: [
      "Shh… come back when the sunflowers wake up.",
      "I'm counting fireflies from my window. Forty-two so far!",
      "Have you seen the starbells in the woods? Fern says they hum.",
    ],
    lines: [
      "Shh… the sunflowers are listening.",
      "Pick whatever's blooming. It all grows back in a little while.",
      "I left a little something in your mailbox. Don't tell anyone!",
    ],
    gift: { bouquet: ["sunflower", "daisy"] }, giftNote: "Sparkle left a bouquet in your mailbox.",
  },
  {
    tokenId: 150n, name: "Old Moss", home: { x: 690, y: 1090 }, house: "cottageC",
    night: [
      "Evening, friend. Is that the pond calling? No, just you.",
      "The ducks tuck their heads under their wings at night. Wise creatures.",
      "Mind the puddles on your way home.",
    ],
    lines: [
      "The pond remembers everyone who ever skipped a stone.",
      "Bluebells like the shade. Poppies like to show off.",
      "Here, take this poppy. It was looking at you.",
    ],
    gift: { flower: "poppy" }, giftNote: "Old Moss gave you a poppy.",
  },
  {
    tokenId: 88n, name: "Fern", home: { x: -600, y: 1050 }, house: "hut",
    night: [
      "Visitors, at this hour? Go on, the starbells are open. They like company.",
      "Put your ear to the standing stones tonight. They hum.",
      "Goodnight, wanderer. Keep to the path.",
    ],
    lines: [
      "Oh! A visitor. Not many find their way through the Whispering Woods.",
      "When the lamps come on in the village, the starbells open in the stone circle. Only then.",
      "Take this pressed starbell. It still remembers the moonlight.",
    ],
    gift: { flower: "starbell" }, giftNote: "Fern gave you a pressed starbell.",
  },
];
