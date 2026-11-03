export type BlogSection = {
  id: string;
  title?: string;
  paragraphs: string[];
  gallery?: string[];
  image?: string;
};
export type BlogPost = {
  slug: string;
  title: string;
  author: string;
  category: string;
  excerpt: string;
  sections: BlogSection[];
};

export const posts: BlogPost[] = [
  {
    slug: "welcome-to-kopis-records",
    title: "Welcome to Kopi’s Records!",
    author: "Michael",
    category: "Shop diary",
    excerpt:
      "Hi! I’m Michael, and I run the store on my own. A little space for the shits and giggles while running the shop, records I have been spinning, and my takes on music.",
    sections: [
      {
        id: "hello",
        paragraphs: [
          "Hi! I’m Michael, and I run the store on my own. You may have met me at one of the booths that we have from time to time, the usual Bugis MRT for meetups or Rocks Cafe, or to the handful of you - even over a coffee to talk about the stuff we love. You can tell that I love doing this.",
          "Blogging has always been a way for me to express my feelings so I thought I’d make a little space for that here. Somewhere to talk about the shits and giggles while running the shop, records I have been spinning, my takes on music. If you’ve ever had a conversation with me that went on way longer than a carousell deal should, you probably know what to expect here.",
        ],
      },
      {
        id: "why-kopis-records",
        title: "Why the name “Kopi’s Records”?",
        paragraphs: [
          "The store is actually named after my 1 year old cat, Kopi. Some of you might know him as the one who ran away three times in two weeks when I first got him. Yes, that Kopi. He doesn’t help with packing your orders or reply to your queries, and yet he gets his name on everything. A seriously lucky guy for someone who sleeps and eats all day.",
          "It’s funny because some of my customers actually think my name is Kopi. It has gone to a point where some mistakenly address me in person and I actually instinctively look up. Happens alot at the hawker centres too.. I don’t know why.",
          "Here are some pictures of Kopi. He is the cutest tabby ever and we all love him very much.",
        ],
        gallery: ["kopi-1", "kopi-2", "kopi-3"],
      },
      {
        id: "behind-the-scenes",
        title: "What goes on behind the scenes?",
        paragraphs: [
          "Picking what to bring in is the fun part. The difficult part is looking at all my stock and realising these records are supposed to be for sale. Shag. I usually bring in titles that I love. My favourite record right now is Arcade Fire’s Funeral. You can learn about the rest in the stock that I have now and my future blog posts.",
          "Each record new or used is taken good care of until handed over to you and before my 1 hour yap about why I love the record you are buying. It is a fun hobby. Not so fun for the one lifting boxes here and there to and fro Rocks Cafe (we sell our vinyl there), and especially not for the one whose not keeping the record.",
          "In between all that is the tough part.. Updating stock, tracking incoming orders, ordering your requests and making sure you aren’t promised the same record to two people. Sorry to those who have been affected.. But I am trying my best and hope all of you have a pleasant experience dealing with us :)",
        ],
        image: "behind-the-scenes",
      },
      {
        id: "vinyl-or-vinyls",
        title: "Vinyl or vinyls?",
        paragraphs: [
          "While we’re here, let’s settle something. The plural of vinyl is… vinyl. One record, ten records. Some vinyl, a lot of vinyl. My vinyl collection. My financially concerning vinyl collection. I’d rather warp ten of my records than hear that (vinyl) ssss sound again. Please :)",
        ],
      },
    ],
  },
];

// Optional local photos: the pages build before the files have been added.
const photos = import.meta.glob<string>(
  "../assets/blog/welcome/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
  { eager: true, query: "?url", import: "default" },
);
export function blogImage(name: string): string | undefined {
  return Object.entries(photos).find(
    ([file]) =>
      file
        .split("/")
        .pop()
        ?.replace(/\.[^.]+$/, "")
        .toLowerCase() === name.toLowerCase(),
  )?.[1];
}
export function readingMinutes(post: BlogPost) {
  return Math.max(
    1,
    Math.ceil(
      post.sections
        .flatMap((section) => section.paragraphs)
        .join(" ")
        .split(/\s+/).length / 200,
    ),
  );
}
