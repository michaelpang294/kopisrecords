import type { Product } from "./product";

export type LocalFeatureTrack = { title: string; src: string };
export type LocalFeatureConfig = {
  productId: number | null;
  album?: Pick<Product, "title" | "artist" | "genre" | "medium" | "price" | "cover_image">;
  description: string | string[];
  tracks: LocalFeatureTrack[];
};

// Optionally set an exact productId to select a particular pressing.
// Otherwise match album + artist + format; multiple matches need an exact ID.
// Edit the description and track titles here. Audio files live in public/audio/.
export const localFeature: LocalFeatureConfig = {
  productId: null,
  album: {
    title: "Rule of Cool",
    artist: "Pigeon Dogfight",
    genre: "Indie Rock",
    medium: "CD",
    price: 15,
    cover_image: "/images/local-feature/rule-of-cool.jpg",
  },
  description: [
    "Saw them at their gig three times already and they are pretty consistently awesome if I must say. They are a five-piece indie rock band that blends the conventions of old and new, pairing restless garage rock energy with tight, catchy melodies.",
    "Pigeon Dogfight brings together four tracks for a short introduction to a local band worth getting to know. If bands like The Strokes, early Arctic Monkeys and The Libertines is your kind of tea, give the tracks below a try because discovering local music starts with listening.",
    "We’ve got the CD at $15 if you’d like to take a copy home and support the band (all proceeds go directly to them).",
    "Favourite track: Rule of Cool",
  ],
  tracks: [
    { title: "Exit Sign", src: "/audio/local-feature/01-exit-sign.mp3" },
    { title: "Spike", src: "/audio/local-feature/02-spike.mp3" },
    { title: "Rule of Cool", src: "/audio/local-feature/03-rule-of-cool.mp3" },
    { title: "Endless", src: "/audio/local-feature/04-endless.mp3" },
  ],
};

export function findLocalFeatureProduct(products: Product[], feature: LocalFeatureConfig): Product | undefined {
  if (feature.productId !== null) return products.find((product) => Number(product.id) === feature.productId);
  const album = feature.album;
  if (!album) return undefined;
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const matches = products.filter((product) =>
    normalize(product.title) === normalize(album.title) &&
    normalize(product.artist) === normalize(album.artist) &&
    normalize(product.medium) === normalize(album.medium),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
