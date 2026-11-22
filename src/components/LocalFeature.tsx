import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play, Disc3 } from "lucide-react";
import type { Product } from "../scripts/product";
import type { LocalFeatureConfig } from "../scripts/localFeature";
import { isPreorder } from "../scripts/preorder";
import { typography as type } from "../styles/typography";
import "./LocalFeature.css";

export default function LocalFeature({ product, feature }: {
  product?: Product;
  feature: LocalFeatureConfig;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [coverFailed, setCoverFailed] = useState(false);
  const track = feature.tracks[active];
  useEffect(() => {
    const player = audio.current;
    return () => player?.pause();
  }, []);

  async function toggleTrack(index: number) {
    const player = audio.current;
    if (!player) return;
    setError("");
    if (index !== active) {
      player.pause();
      player.src = feature.tracks[index].src;
      setActive(index);
    } else if (!player.paused) {
      player.pause();
      return;
    }
    try {
      await player.play();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError("This track couldn’t play. Please try again or choose another track.");
      }
    }
  }

  const details = product || feature.album;
  if (!details) return null;
  const available = !product || Number(product.stock) > 0;
  const productLink = product ? `/shop/product/${product.id}` : `/shop?q=${encodeURIComponent(details.title)}&format=${encodeURIComponent(details.medium.toLowerCase())}&stock=all`;
  const price = Number(details.price).toLocaleString("en-SG", {
    minimumFractionDigits: Number.isInteger(Number(details.price)) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const paragraphs = Array.isArray(feature.description)
    ? feature.description
    : feature.description ? [feature.description] : [];
  return (
    <section id="local-feature" aria-labelledby="local-feature-heading" className="border-y border-[#ffffff18] bg-[#211b16]">
      <div className="mx-auto w-[calc(100%-80px)] max-w-[1320px] py-[72px] max-[1000px]:w-[calc(100%-48px)] max-[1000px]:py-14 max-[640px]:w-[calc(100%-36px)] max-[640px]:py-8 min-[1800px]:max-w-[1440px]">
        <p className={`${type.eyebrow} mt-0 mb-2.5 text-[#cbb79c]`}>
          WE’VE GOT LIMITED COPIES IN STOCK
        </p>
        <h2
          id="local-feature-heading"
          className={`${type.sectionTitle} mt-0 mb-[30px] max-[640px]:mb-6`}
        >
          Local Features
        </h2>
        <div className="local-feature-layout">
          <div className="local-feature-title min-w-0">
            <h3 className={`${type.sectionTitle} mt-0 mb-3 [overflow-wrap:anywhere] max-[640px]:!text-[25px] max-[640px]:!leading-tight max-[640px]:mb-1.5`}>{details.title}</h3>
            <p className={`${type.body} m-0 text-[#cbb79c] max-[640px]:!text-[13px] max-[640px]:!leading-5`}>{details.artist}{details.genre ? ` (${details.genre})` : ""}</p>
          </div>
          <div className="local-feature-cover min-w-0">
            {!coverFailed && details.cover_image ? (
              <img src={details.cover_image} alt={`${details.artist} — ${details.title} cover`} loading="lazy" onError={() => setCoverFailed(true)} className="block aspect-square w-full object-contain bg-[#15120f]" />
            ) : (
              <div role="img" aria-label="Album cover unavailable" className="grid aspect-square place-items-center bg-[#15120f] text-[#cbb79c]"><Disc3 size={72} /></div>
            )}
          </div>
          {track && <div className="local-feature-tracks min-w-0">
              <ol aria-label="Album tracks" className="m-0 list-none p-0">
                {feature.tracks.map((item, index) => (
                  <li key={`${index}-${item.src}`} className="border-b border-[#ffffff18]">
                    <button type="button" onClick={() => void toggleTrack(index)} aria-label={`${active === index && playing ? "Pause" : "Play"} ${item.title}`} aria-pressed={active === index && playing} className={`${type.small} flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-2 py-3 max-[640px]:py-2 max-[640px]:!text-[13px] text-left hover:bg-[#ffffff08] ${active === index ? "text-[#efe8dc]" : "text-[#c0b4a3]"}`}>
                      <span className="w-5 shrink-0 text-[#cbb79c]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.title}</span>
                      {active === index && playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ol>
              <audio ref={audio} hidden preload="none" src={feature.tracks[0].src} aria-label="Local Feature audio player" className="w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError("This track is unavailable. Please try another track."); }} />
              {error && <p role="status" className={`${type.small} text-[#f1b6a5]`}>{error}</p>}
          </div>}
          <div className="local-feature-description min-w-0 space-y-4 max-[640px]:space-y-3">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className={`${type.body} mb-4 whitespace-pre-line text-[#c0b4a3] max-[640px]:!text-[13px] max-[640px]:!leading-[1.7]`}>{paragraph}</p>
            ))}
          </div>
          <div className="local-feature-buy min-w-0">
            <Link to={productLink} className={`${type.ui} inline-flex min-h-12 items-center justify-center gap-4 rounded-[3px] bg-[#cbb79c] px-6 py-[13px] !text-[#15120f] hover:bg-[#dfcdb3] max-[640px]:min-h-11 max-[640px]:px-4 max-[640px]:py-2 max-[640px]:!text-[13px]`}>
              {available ? `${product && isPreorder(product) ? "Preorder" : "Get"} their ${details.medium} now at $${price}!` : "View their release · Sold out"}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
