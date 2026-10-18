// Retired style variations: keep readable for saved tickets and customized designs.
// Never seed these into the template collection.
const originals = require("./ticketLayouts");
const editions = {
  engraved: [
    "Engraved",
    "#b98745",
    "#201c19",
    "Serif lettering, fine double rules and an engraved seal.",
    "AN INVITATION TO SOMETHING SPECIAL",
  ],
  blueprint: [
    "Blueprint",
    "#93c5fd",
    "#152d4d",
    "Technical grid, monospaced lettering and squared labels.",
    "IDEAS BECOME EXPERIENCES",
  ],
  confetti: [
    "Confetti",
    "#b13a71",
    "#fff4ed",
    "Scattered dots, playful rounded labels and a celebration border.",
    "COME FOR THE MOMENT. STAY FOR THE MEMORIES.",
  ],
  neon: [
    "Neon",
    "#94f7cb",
    "#111f25",
    "Luminous outlines, condensed capitals and an electric scan panel.",
    "THE NIGHT BELONGS TO YOU",
  ],
  linen: [
    "Linen",
    "#52684c",
    "#f3efe2",
    "Woven paper, italic serif lettering and a soft inset frame.",
    "SLOW DOWN. TAKE IT ALL IN.",
  ],
  deco: [
    "Art deco",
    "#dcb879",
    "#272439",
    "Architectural linework, symmetrical titles and stepped borders.",
    "A NIGHT ABOVE THE ORDINARY",
  ],
  mono: [
    "Monochrome",
    "#303030",
    "#fcfcf8",
    "Bold uppercase type, black rules and outlined admission labels.",
    "ONE PLACE. ONE UNMISSABLE EXPERIENCE.",
  ],
  sunset: [
    "Sunset",
    "#a44332",
    "#fff1dc",
    "Warm sunbursts, rounded corners and an expressive title underline.",
    "GATHER UNDER A DIFFERENT SKY",
  ],
};
const collections = {
  classic: ["engraved", "blueprint", "confetti", "neon"],
  minimal: ["linen", "deco", "mono", "sunset"],
  badge: ["engraved", "blueprint", "confetti", "neon"],
  aurora: ["linen", "deco", "mono", "sunset"],
  boarding: ["engraved", "blueprint", "confetti", "neon"],
  cinema: ["linen", "deco", "mono", "sunset"],
  festival: ["engraved", "blueprint", "confetti", "neon"],
  editorial: ["linen", "deco", "mono", "sunset"],
  invitation: ["engraved", "blueprint", "confetti", "neon"],
  receipt: ["linen", "deco", "mono", "sunset"],
  sports: ["engraved", "blueprint", "confetti", "neon"],
  concert: ["linen", "deco", "mono", "sunset"],
  exhibition: ["engraved", "blueprint", "confetti", "neon"],
  voucher: ["linen", "deco", "mono", "sunset"],
  luxe: ["engraved", "blueprint", "confetti", "neon"],
  polaroid: ["linen", "deco", "mono", "sunset"],
  passport: ["engraved", "blueprint", "confetti", "neon"],
  brutalist: ["linen", "deco", "mono", "sunset"],
  split: ["engraved", "blueprint", "confetti", "neon"],
  vertical: ["linen", "deco", "mono", "sunset"],
};
const additions = originals
  .filter((base) => collections[base.id])
  .flatMap((base) =>
    collections[base.id].map((edition) => {
      const [label, accent, background, description, heading] =
        editions[edition];
      const id = `${base.id}--${edition}`;
      return {
        id,
        name: `${base.name} · ${label}`,
        category: base.category,
        description: `${description} ${base.description}`,
        config: { layout: id, accent, background, heading },
      };
    }),
  );
module.exports = additions;
