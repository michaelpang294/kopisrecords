import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, Music2 } from "lucide-react";
import Footer from "../footer";
import { typography as type } from "../styles/typography";
import { localGigs, upcomingGigs, gigDateLabel, type LocalGig } from "../gigs/events";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbb79c]";

function GigCard({ gig }: { gig: LocalGig }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="overflow-hidden rounded-lg border border-white/10 bg-[#211b16] md:grid md:grid-cols-[220px_1fr]">
      {gig.poster && !failed ? (
        <img src={gig.poster} alt={gig.posterAlt || `Poster for ${gig.title}`} loading="lazy" onError={() => setFailed(true)} className="max-h-[440px] w-full bg-[#181410] object-contain md:h-full md:max-h-none" />
      ) : (
        <div className="flex min-h-40 flex-col justify-between gap-6 border-b border-white/10 bg-[#30261d] p-6 md:border-b-0 md:border-r" aria-hidden="true">
          <Music2 size={30} strokeWidth={1} className="text-[#cbb79c]" />
          <p className="font-marcellus text-2xl leading-snug">See you<br />at the front.</p>
        </div>
      )}
      <div className="p-6 sm:p-8">
        <p className={`${type.eyebrow} mb-4 text-[#cbb79c]`}><time dateTime={gig.date}>{gigDateLabel(gig.date)}</time></p>
        <h2 className="mb-3 font-marcellus text-2xl leading-snug sm:text-3xl">{gig.title}</h2>
        {gig.artists?.length ? <p className="mb-4 text-sm leading-6 text-[#efe8dc]">{gig.artists.join(" · ")}</p> : null}
        <p className="mb-2 flex items-start gap-2 text-sm leading-6 text-[#c0b4a3]"><MapPin size={16} aria-hidden="true" className="mt-1 shrink-0" />{gig.venue}</p>
        <p className="mb-5 flex items-start gap-2 text-sm leading-6 text-[#c0b4a3]"><CalendarDays size={16} aria-hidden="true" className="mt-1 shrink-0" />{gig.time}</p>
        <p className="mb-5 whitespace-pre-line text-sm leading-7 text-[#c0b4a3]">{gig.description}</p>
        {gig.ticketUrl && <a href={gig.ticketUrl} target="_blank" rel="noopener noreferrer" className={`${focus} inline-flex min-h-11 items-center gap-2 border-b border-[#cbb79c66] text-sm text-[#cbb79c] hover:text-[#efe8dc]`}>{gig.ticketLabel || "Tickets & details"}<ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
    </article>
  );
}

export default function LocalGigsPage() {
  const [now, setNow] = useState(() => new Date());
  const gigs = upcomingGigs(localGigs, now);
  useEffect(() => {
    const previous = document.title;
    document.title = "Local Gigs | Kopi’s Records";
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { document.title = previous; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  return (
    <>
      <main id="main-content" className="min-h-[70svh] bg-[#15120f] px-[18px] py-10 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6 sm:py-16 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-[1100px]">
          <header className="mb-10 border-b border-[#cbb79c33] pb-8 sm:mb-12 sm:pb-10">
            <p className={`${type.eyebrow} mb-4 text-[#cbb79c]`}>Off the turntable, into the crowd</p>
            <h1 className={`${type.pageTitle} mb-6`}>Local gigs.</h1>
            <p className={`${type.body} max-w-[680px] text-[#c0b4a3]`}>A little space for live music in Singapore. Shows we’re excited about, familiar names and bands you might be hearing for the first time. Come out, catch a set and support the scene.</p>
          </header>
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_280px] lg:gap-10">
            <section aria-labelledby="upcoming-title" className="min-w-0">
              <h2 id="upcoming-title" className="mb-6 font-marcellus text-2xl sm:text-3xl">Coming up</h2>
              {gigs.length ? <div className="space-y-6">{gigs.map((gig) => <GigCard key={gig.id} gig={gig} />)}</div> : (
                <div className="rounded-lg border border-white/10 bg-[#211b16] px-6 py-10 sm:p-10">
                  <Music2 size={32} strokeWidth={1.2} aria-hidden="true" className="mb-6 text-[#cbb79c]" />
                  <h3 className="mb-3 font-marcellus text-2xl">More shows to share soon.</h3>
                  <p className="max-w-[480px] text-sm leading-7 text-[#c0b4a3]">No upcoming gigs listed just yet. Got a show we should know about? Send it our way — we’d love to hear about it.</p>
                </div>
              )}
              {gigs.length > 0 && <p className="mt-5 text-xs leading-6 text-[#c0b4a3]">Please check the organiser’s social media page or website for the latest timings, ticket availability and entry requirements before heading down.</p>}
            </section>
            <aside className="rounded-lg border border-[#cbb79c33] p-6 lg:sticky lg:top-28">
              <h2 className="mb-4 font-marcellus text-2xl">Putting on a show?</h2>
              <p className="mb-5 text-sm leading-7 text-[#c0b4a3]">Send us the lineup, date, venue, poster and ticket or event link. Let’s us help spread the word.</p>
              <a href="/contact" className={`${focus} inline-flex min-h-11 items-center gap-2 border-b border-[#cbb79c66] text-sm text-[#cbb79c] hover:text-[#efe8dc]`}>Tell us about your gig <ArrowUpRight size={17} aria-hidden="true" /></a>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
