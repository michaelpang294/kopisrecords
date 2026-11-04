export type LocalGig = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD, Singapore date. Listings hide after this day.
  time: string; // e.g. "Doors 7pm · Music 8pm"
  venue: string;
  description: string;
  artists?: string[];
  ticketUrl?: string;
  ticketLabel?: string; // e.g. "Tickets & details" or "Free entry · details"
  poster?: string; // Optional path in public, e.g. /gigs/my-show.jpg
  posterAlt?: string;
};

// Add confirmed gigs here. No sample events are shown to customers.
// Example structure (replace every detail with the real event information):

export const localGigs: LocalGig[] = [
  {
    id: "1",
    title: "Last Train or Supper",
    date: "2026-11-28",
    time: "Doors 7pm",
    venue: "Sunroom Studios",
    artists: ["Bellied Star", "Nkei", "Carpet Golf", "CURB", "Hidemen"],
    description: "By Alter Start",
    ticketUrl: "https://go.forms.app/form/6ad21f266317d910250c18a9",
    ticketLabel: "Tickets & details",
    poster: "https://instagram.fsin13-1.fna.fbcdn.net/v/t51.82787-15/863779325_18100776071536576_6146654934416007263_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=NDAxNDc2OTYzNDI4ODc3NjQyNQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTA4OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=LvDv7Uy-anUQ7kNvwGKemfX&_nc_oc=AdpzW-Q-0U6GKVYnYUqvAhIUkc2DCadPlxTVKG0WRUGUfKvxyS0PeXg7N3J9fcbg1bs&_nc_zt=23&_nc_ht=instagram.fsin13-1.fna&_nc_gid=spKSx1eXLc6eV2H2YqcfUg&_nc_ss=7b6a8&oh=00_AQQXhcMDK5RmcvNvONlz4QecUckD5HMiSFauHw2ZP5E37A&oe=6AF0B16D",
    posterAlt: "Poster for Last Train or Supper",
  },
  {
    id: "2",
    title: "Inkblot Page 'Guide These Eyes' Album Launch",
    date: "2026-11-27",
    time: "Doors 7:30pm",
    venue: "Ask the bands",
    artists: ["Inkblot Page", "Myeline"],
    description: "By Infinite Feedback",
    ticketUrl: "https://tally.so/r/1AZ8AL",
    ticketLabel: "Tickets & details",
    poster: "https://instagram.fsin12-1.fna.fbcdn.net/v/t51.82787-15/869932298_18098893889424500_774960167178405341_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=NDAxNjM5NDUxNjY4Mzg2OTA0OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=S9J13EJID0IQ7kNvwEWrKdD&_nc_oc=AdoYq01RkpODnDj0hWLOQO29TpWgRrEZDNCdQfUk10iFIYmCYoxoytDnYx6oEi-8dWo&_nc_zt=23&_nc_ht=instagram.fsin12-1.fna&_nc_gid=JQyC4Xgt-f6s8HFAvst0vw&_nc_ss=7b6a8&oh=00_AQQ59OhBtqccrJNSy6MO54HQjBVjkDeuxQLD3A5BuPwJxQ&oe=6AF0B4BF",
    posterAlt: "Poster for Inkblot Page Guide These Eyes Album Launch",
  },
  {
    id: "3",
    title: "Dont Shave My Bush",
    date: "2026-11-15",
    time: "Doors 6pm",
    venue: "Wire Entertainment",
    artists: ["Roxie", "Vert90", "Inkblot Page", "Pines", "Muff"],
    description: "By LoudMouth. 100% of profits will be donated.",
    ticketUrl: "https://docs.google.com/forms/d/e/1FAIpQLSd_vBAfNhX2IijN6RGcR3sL7aKjAejReEXRQa5sDwIaQmS5Lw/viewform",
    ticketLabel: "Tickets & details",
    poster: "https://instagram.fsin12-1.fna.fbcdn.net/v/t51.82787-15/866502086_17995284111063463_7261053474941352022_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=NDAxNTY5MzY0NTMxNDUyOTMzNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTMyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=TupzKzxBdDoQ7kNvwG6NS7G&_nc_oc=AdoWr4oILL3xK5Ljh7BfXf2faeWF2BSZp1WlceMZ8Udrvc_QsKeqadCNV17_wMuslpk&_nc_zt=23&_nc_ht=instagram.fsin12-1.fna&_nc_gid=fmPOGdY6cXr9-zPw9xW5YA&_nc_ss=7b6a8&oh=00_AQS2BtaD4WerWzcb7gDt4Wg4qpSHN0C6xK1Q9CYbiiP5wA&oe=6AF0BD14",
    posterAlt: "Poster for Dont Shave My Bush",
  },
  {
    id: "4",
    title: "Line Drive's 'Blink of an Eye' Album Launch",
    date: "2026-11-20",
    time: "Doors 6:30pm",
    venue: "Ask the bands",
    artists: ["Fickle", "Pathetic Ordinary", "Elsewhere", "Line Drive", "Step Aside", "Secret Set"],
    description: "",
    ticketUrl: "https://docs.google.com/forms/d/e/1FAIpQLScyAhTa288d12ZlTXmi4qk39rdtEVARBt6qlzbSB_DfkI4XAg/viewform",
    ticketLabel: "Tickets & details",
    poster: "https://instagram.fsin12-1.fna.fbcdn.net/v/t51.82787-15/856871392_18255955861308247_1955760217331220579_n.heic?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=NDAxMTMwMzAzODc4NTk4MjE1NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wz8dTN_nKYsQ7kNvwGFTuZs&_nc_oc=Adp0ByiZa28N3RBjQbQ5Iah_ItBMEWeJsclEc3VGRT10uOb4_cwA0clROMn4VXKQh3Y&_nc_zt=23&_nc_ht=instagram.fsin12-1.fna&_nc_gid=LrF-SiaoCTY8Fb5ZgLI23Q&_nc_ss=7b6a8&oh=00_AQTVYKFbNmxYU3DY67qGzGAE9sp9byR68vXmUEafsxD5Eg&oe=6AF09828",
    posterAlt: "Poster for Line Drive's Blink of an Eye Album Launch",
  },
];



function singaporeDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function validGigDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function upcomingGigs(gigs: LocalGig[], now = new Date()): LocalGig[] {
  const today = singaporeDay(now);
  return gigs.filter((gig) => validGigDate(gig.date) && gig.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function gigDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
}
