import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../footer";
import { picks } from "../scripts/picksOfTheWeek";
import type { Product } from "../scripts/picksOfTheWeek";
import hero from "../assets/backgrounds/front-slide-bg.png";
import community from "../assets/backgrounds/community.gif";
import { typography as type } from "../styles/typography";

const money = (value: number) =>
  Number.isFinite(value) ? `$${value.toFixed(2)}` : "Price unavailable";

function RecordCard({ product, note }: { product: Product; note?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="min-w-0">
      <Link className="group block h-full" to={`/shop/product/${product.id}`}>
        <div className="relative mb-4 aspect-square overflow-hidden bg-[#28231d] max-[640px]:mb-3">
          {!failed && product.cover_image ? (
            <img
              className="block h-full w-full object-cover transition-transform duration-[250ms] group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
              src={product.cover_image}
              alt={`${product.artist} — ${product.title} cover`}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="grid h-full place-items-center text-[70px] text-[#cbb79c]" aria-label="Cover unavailable">
              ♪
            </div>
          )}
          {Number(product.stock) <= 0 && (
            <span className={`${type.meta} absolute bottom-3 left-3 bg-[#15120fe6] px-2.5 py-1`}>Sold out</span>
          )}
        </div>
        <p className={`${type.small} mt-0 mb-1 text-[#c0b4a3]`}>{product.artist}</p>
        <h3 className={`${type.itemTitle} mt-0 mb-[9px]`}>{product.title}</h3>
        <p className={`${type.meta} mt-0 mb-3 text-[#c0b4a3] [overflow-wrap:anywhere]`}>
          {[product.medium, product.variant].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-1">
          <strong className={type.ui}>{money(Number(product.price))}</strong>
          <span className={`${type.meta} text-[#c0b4a3]`}>{Number(product.stock) > 0 ? "In stock" : "Sold out"}</span>
        </div>
        {note && <p className={`${type.small} my-3.5 text-[#c0b4a3]`}>{note}</p>}
        <span className={`${type.ui} mt-4 flex justify-between border-t border-[#ffffff18] pt-3`}>
          View record <span aria-hidden="true">↗</span>
        </span>
      </Link>
    </article>
  );
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch("http://localhost:3001/api/stock", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Stock unavailable");
        return response.json();
      })
      .then((data: Product[]) => {
        if (!Array.isArray(data)) throw new Error("Invalid stock");
        setProducts(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const vinyl = products.filter(
    (p) => !/\b(cd|cassette|dvd)\b/i.test(p.medium || ""),
  );
  const unique = vinyl.filter(
    (p, i, all) =>
      all.findIndex(
        (other) =>
          `${other.artist}|${other.title}`.toLowerCase() ===
          `${p.artist}|${p.title}`.toLowerCase(),
      ) === i,
  );
  // The supplied API has no arrival timestamp: newest numeric IDs are used here.
  const arrivals = [...unique]
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, 4);
  const curated = picks.flatMap((rec) => {
    const product = unique.find(
      (p) =>
        p.title.toLowerCase() === rec.title.toLowerCase() &&
        p.artist.toLowerCase() === rec.artist.toLowerCase(),
    );
    return product ? [{ product, note: rec.description }] : [];
  });
  const genres = [
    ...new Set(
      vinyl.flatMap((p) =>
        (p.genre || "")
          .split(/[,;|]/)
          .map((g) => g.trim())
          .filter(Boolean),
      ),
    ),
  ].slice(0, 8);
  return (
    <>
      <div className={`${type.body} bg-[#15120f] text-[#efe8dc] [&_*]:box-border [&_a]:no-underline [&_a]:text-inherit [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-[#cbb79c] [&_a:focus-visible]:outline-offset-[5px] [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-[#cbb79c] [&_button:focus-visible]:outline-offset-[5px]`}>
        
        <main id="main-content">
          <section
            className="flex min-h-[calc(100vh-81px)] supports-[height:100svh]:min-h-[calc(100svh-81px)] items-center bg-cover bg-center bg-no-repeat max-[640px]:min-h-[calc(100vh-57px)] max-[640px]:supports-[height:100svh]:min-h-[calc(100svh-57px)] max-[640px]:bg-[position:40%_center]"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(13,11,8,.82), rgba(13,11,8,.38)), url(${hero})`,
            }}
          >
            <div className="mx-auto w-[calc(100%-80px)] max-w-[1320px] max-[1000px]:w-[calc(100%-48px)] max-[640px]:w-[calc(100%-36px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px] py-[70px] max-[640px]:py-14">
              <p className={`${type.eyebrow} mt-0 mb-[18px] text-[#cbb79c]`}>Kopi’s Records · Singapore</p>
              <h1 className={`${type.pageTitle} mt-0 mb-[26px] max-w-[900px]`}>
                Handpicked records
                <br />
                with love.
              </h1>
              <p className={`${type.body} mt-0 mb-[30px] max-w-[510px] text-[#e0d7cb] max-[640px]:max-w-[340px]`}>
                From alternative rock to hip-hop, familiar favourites to your
                next discovery. Come have a dig.
              </p>
              <div className="flex flex-wrap items-center gap-7 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3.5">
                <Link className={`${type.ui} inline-flex min-h-12 cursor-pointer items-center justify-center gap-7 rounded-[3px] border-0 bg-[#cbb79c] px-6 py-[13px] !text-[#15120f] hover:bg-[#dfcdb3]`} to="/shop">
                  Shop the records <span aria-hidden="true">↗</span>
                </Link>
                <a
                  className={`${type.ui} inline-block border-b border-[#cbb79c66] py-2 hover:!text-[#cbb79c]`}
                  href="#new-arrivals"
                  onClick={(event) => {
                    if (
                      event.button !== 0 || event.ctrlKey || event.metaKey ||
                      event.shiftKey || event.altKey
                    ) return;

                    const section = document.getElementById("new-arrivals");
                    if (!section) return;

                    event.preventDefault();
                    section.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "instant"
                        : "smooth",
                      block: "start",
                    });
                  }}
                >
                  Explore new arrivals ↓
                </a>
              </div>
              <p className={`${type.meta} mt-7 mb-3 text-[#c0b4a3] max-[640px]:mt-6`}>Always listening. Always digging.</p>
            </div>
          </section>
          <section
            className="scroll-mt-[100px] py-[72px] max-[1000px]:py-14 max-[640px]:py-[42px] mx-auto w-[calc(100%-80px)] max-w-[1320px] max-[1000px]:w-[calc(100%-48px)] max-[640px]:w-[calc(100%-36px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px]"
            id="new-arrivals"
            aria-labelledby="arrivals-title"
          >
            <div className="mb-[30px] flex items-end justify-between gap-6 [&_p:first-child]:mb-2.5 max-[640px]:mb-6 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3">
              <div>
                <p className={`${type.eyebrow} mt-0 mb-[18px] text-[#cbb79c]`}>Fresh in the crates</p>
                <h2 className={`${type.sectionTitle} m-0`} id="arrivals-title">New arrivals</h2>
              </div>
              <Link className={`${type.ui} inline-block border-b border-[#cbb79c66] py-2 hover:!text-[#cbb79c]`} to="/shop?sort=newest">
                View all records ↗
              </Link>
            </div>
            {loading ? (
              <p role="status" className={`${type.body} py-10 text-[#c0b4a3] [&_button]:mt-5`}>
                Getting the crates ready…
              </p>
            ) : error ? (
              <div className={`${type.body} py-10 text-[#c0b4a3] [&_button]:mt-5`} role="status">
                <p className={`${type.body} mt-0 mb-[18px] max-w-[490px] text-[#c0b4a3]`}>We couldn’t load the records right now.</p>
                <button
                  className={`${type.ui} inline-flex min-h-12 cursor-pointer items-center justify-center gap-7 rounded-[3px] border-0 bg-[#cbb79c] px-6 py-[13px] !text-[#15120f] hover:bg-[#dfcdb3]`}
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  Try again
                </button>
              </div>
            ) : arrivals.length ? (
              <div className="grid grid-cols-4 gap-7 max-[1000px]:grid-cols-2 max-[1000px]:gap-5 max-[640px]:gap-x-3.5 max-[640px]:gap-y-7">
                {arrivals.map((product) => (
                  <RecordCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p className={`${type.body} py-10 text-[#c0b4a3] [&_button]:mt-5`}>
                The crates are being restocked. Check back soon.
              </p>
            )}
          </section>
          {!loading && !error && curated.length > 0 && (
            <section className="border-y border-[#ffffff0c] bg-[#211b16]" aria-labelledby="picks-title">
              <div className="mx-auto w-[calc(100%-80px)] max-w-[1320px] max-[1000px]:w-[calc(100%-48px)] max-[640px]:w-[calc(100%-36px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px] scroll-mt-[100px] py-[72px] max-[1000px]:py-14 max-[640px]:py-[42px]">
                <div className="mb-[30px] flex items-end justify-between gap-6 [&_p:first-child]:mb-2.5 max-[640px]:mb-6 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3">
                  <div>
                    <p className={`${type.eyebrow} mt-0 mb-[18px] text-[#cbb79c]`}>From our turntable to yours</p>
                    <h2 className={`${type.sectionTitle} m-0`} id="picks-title">Kopi’s picks</h2>
                    <p className={`${type.body} mt-3.5 mb-3.5 max-w-[480px] text-[#c0b4a3]`}>
                      A few records that we just had to share. 
                    </p>
                  </div>
                  <Link to="/shop" className={`${type.ui} inline-block border-b border-[#cbb79c66] py-2 hover:!text-[#cbb79c]`}>
                    See more recommendations ↗
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-7 max-[1000px]:grid-cols-2 max-[1000px]:gap-5 max-[640px]:gap-x-3.5 max-[640px]:gap-y-7 min-[1001px]:grid-cols-3">
                  {curated.map(({ product, note }) => (
                    <RecordCard
                      key={product.id}
                      product={product}
                      note={note}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
          {genres.length > 0 && (
            <section
              className="scroll-mt-[100px] py-[72px] max-[1000px]:py-14 max-[640px]:py-[42px] mx-auto w-[calc(100%-80px)] max-w-[1320px] max-[1000px]:w-[calc(100%-48px)] max-[640px]:w-[calc(100%-36px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px]"
              aria-labelledby="genres-title"
            >
              <div className="mb-[30px] flex items-end justify-between gap-6 [&_p:first-child]:mb-2.5 max-[640px]:mb-6 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-3">
                <div>
                  <p className={`${type.eyebrow} mt-0 mb-[18px] text-[#cbb79c]`}>Follow your ears</p>
                  <h2 className={`${type.sectionTitle} m-0`} id="genres-title">What’s your rotation?</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-10 max-[640px]:grid-cols-1">
                {genres.map((genre, i) => (
                  <Link
                    className={`${type.itemTitle} flex items-center gap-5 border-b border-[#ffffff20] py-[22px] hover:!text-[#cbb79c] [&>span:last-child]:ml-auto max-[640px]:py-[18px]`}
                    key={genre}
                    to={`/shop?genre=${encodeURIComponent(genre)}`}
                  >
                    <span className={`${type.meta} text-[#c0b4a3]`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{genre}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section
            className="grid grid-cols-2 items-center gap-20 border-t border-[#ffffff18] max-[1000px]:gap-9 max-[640px]:grid-cols-1 max-[640px]:gap-7 mx-auto w-[calc(100%-80px)] max-w-[1320px] max-[1000px]:w-[calc(100%-48px)] max-[640px]:w-[calc(100%-36px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px] scroll-mt-[100px] py-[72px] max-[1000px]:py-14 max-[640px]:py-[42px]"
            aria-labelledby="about-title"
          >
            <img
              className="w-full aspect-[4/3] object-cover"
              src={community}
              alt="Record collectors sharing their finds"
              loading="lazy"
            />
            <div>
              <p className={`${type.eyebrow} mt-0 mb-[18px] text-[#cbb79c]`}>The people behind the crates</p>
              <h2 className={`${type.sectionTitle} mt-0 mb-6`} id="about-title">
                Music we love.
                <br />
                Records to share.
              </h2>
              <p className={`${type.body} mt-0 mb-[18px] max-w-[490px] text-[#c0b4a3]`}>
                Our shop started with a little poor self-control and a lot of
                love for music. Collecting records brought us into a community
                we wanted to be part of.
              </p>
              <p className={`${type.body} mt-0 mb-[18px] max-w-[490px] text-[#c0b4a3]`}>
                Kopi’s is our way of passing that feeling on. We stock records
                we love, share what’s on our turntable, and hope you find a new
                favourite along the way.
              </p>
              <Link className={`${type.ui} inline-block border-b border-[#cbb79c66] py-2 hover:!text-[#cbb79c]`} to="/shop">
                Have a dig through our records ↗
              </Link>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}
