export type BlogSection = {
  id: string;
  title?: string;
  paragraphs: string[];
  gallery?: string[];
  image?: string;
  galleryAlt?: string;
  imageAlt?: string;
};
export type BlogPost = {
  slug: string;
  title: string;
  author: string;
  category: string;
  imageFolder?: string;
  coverAlt?: string;
  excerpt: string;
  sections: BlogSection[];
};

export const posts: BlogPost[] = [
  // Edit the Side A article text here. Photo filenames are documented in
  // src/assets/blog/side-a-2026/README.md.
  {
    slug: "side-a-singapore-record-show-2026",
    title: "Singapore Side A Record Show 2026",
    author: "Michael",
    category: "Out of the shop",
    imageFolder: "side-a-2026",
    coverAlt: "Kopi’s Records at Side A: Singapore Record Show 2026",
    excerpt:
      "What a day that was! A day of digging, familiar faces, new friends, and talking way too much about records. A big thank you to everyone who came by our booth at Side A.",
    sections: [
      {
        id: "what-a-day",
        paragraphs: [
          "What a day that was! Side A: Singapore Record Show.",
          "Huge thank you to everyone who battled through the crowd to visit, have a chit chat, and pick up some records from us! So many of you were so kind, awesome, and so damn passionate about music. Y’all were so lovely!",
        ],
        image: "booth-1",
        imageAlt: "The Kopi’s Records booth at Side A 2026",
      },
      {
        id: "what-side-a-means",
        title: "What Side A means to us",
        paragraphs: [
          "Sometimes it feels like the record culture in Singapore is struggling to keep its spaces.",
          "There are still people who deeply care about music and physical media, but we need places to come together, dig through records and share that excitement to keep this culture alive.",
          "Being in a room full of people who get as excited about an album just as I do means a lot. Seeing familiar faces, making new friends, and hearing someone talk about a record they love.. Anybody could and would want to do that all day.",
          "Just brilliance. 37 record shops, 37 booths, few thousand passionate music lovers. All in one place. It’s a beautiful event, just like my haul before the event even started.",
        ],
      },
      {
        id: "new-faces",
        title: "New faces and friends",
        paragraphs: [
          "Also really happy to meet so many new faces and youths getting into our beautiful hobby of collecting vinyl. We hope you found something you’re excited to bring home and spin.",
          "Getting to hear about your favourite albums and your stories is a huge part of why we love doing this.",
        ],
        gallery: ["crowd-1", "records-1", "friends-1"],
        galleryAlt: "People and records at Side A 2026",
      },
      {
        id: "thank-you",
        title: "To the familiar faces",
        paragraphs: [
          "To the familiar faces who keep coming back to support us, it always makes our day seeing y’all again. Thank you for keeping this little record shop up and still going.",
        ],
      },
      {
        id: "thank-yous-organisers",
        title: "My biggest thank yous",
        paragraphs: [
          "Biggest thank yous to boss, captain and the amazing Azri and team from Mosta Records for organising this event and having us for the second time.",
          "This is what's clearly the best vinyl record show in Singapore and we are so happy to be a part of it.",
          "Till the next one!"
        ],
      },
    ],
  },
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
  "../assets/blog/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}",
  { eager: true, query: "?url", import: "default" },
);
export function blogImage(name: string, folder = "welcome"): string | undefined {
  return Object.entries(photos).find(
    ([file]) =>
      file.split("/").at(-2) === folder &&
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
