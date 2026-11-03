import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { typography as type } from "../styles/typography";
import zine1 from "../assets/products/zine1.jpg";
import zine2 from "../assets/products/zine2.JPG";
import zine3 from "../assets/products/zine3.JPG";
import zine4 from "../assets/products/zine4.JPG";
import zine5 from "../assets/products/zine5.JPG";
import zine6 from "../assets/products/zine6.JPG";
import zine7 from "../assets/products/zine7.JPG";
import zine8 from "../assets/products/zine8.JPG";
import zine9 from "../assets/products/zine9.JPG";

const slides = [zine1, zine2, zine3, zine4, zine5, zine6, zine7, zine8, zine9];
const control =
  "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-[#cbb79c55] bg-[#15120fd9] text-[#efe8dc] transition-colors hover:bg-[#49392b]";

export default function ZineShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const playing = !paused && !hovered && !focused && visible && !reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      media.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => setIndex((i) => (i + 1) % slides.length),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [index, playing]);

  const move = (direction: number) =>
    setIndex((i) => (i + direction + slides.length) % slides.length);

  return (
    <section
      aria-labelledby="zine-title"
      className="mx-auto grid w-[calc(100%-80px)] max-w-[1320px] grid-cols-[.85fr_1.15fr] items-center gap-16 py-[72px] max-[1000px]:w-[calc(100%-48px)] max-[1000px]:gap-9 max-[1000px]:py-14 max-[640px]:w-[calc(100%-36px)] max-[640px]:grid-cols-1 max-[640px]:gap-7 max-[640px]:py-[42px] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px]"
    >
      <div>
        <p className={`${type.eyebrow} mt-0 mb-[18px] text-[#cbb79c]`}>
          Your Top 100 Albums: <br></br>A community project to discover the albums that shape Singapore's music scene
        </p>
        <h2 id="zine-title" className={`${type.sectionTitle} mt-0 mb-6`}>
          A zine by Kopi's Records
        </h2>
        <p className={`${type.body} mt-0 mb-5 max-w-[460px] text-[#c0b4a3]`}>
          A hundred albums. A hundred stories.
        </p>
        <p className={`${type.body} mt-0 mb-7 max-w-[460px] text-[#c0b4a3]`}>
          Your favourite records brought together in a zine that's made for
          a good read, discovering something new, and finding a little of
          yourself in someone else’s listening.
        </p>
        <p className={`${type.body} mt-0 mb-7 max-w-[460px] text-[#c0b4a3]`}>
          Only <strong>$4 each</strong>. Sold at our cost price.
        </p>
        <a
          href="https://www.instagram.com/p/Dc8BMV8kbr3/?utm_source=ig_web_copy_link&obrf=MzRlODBiNWFlZA==&srtk=MzRlODBiNWFlZA=="
          target="_blank"
          className={`${type.ui} inline-flex min-h-11 items-center gap-5 border-b border-[#cbb79c66] py-2 hover:!text-[#cbb79c]`}
        >
          Find out more <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div
        className="mx-auto w-full max-w-[480px] max-[640px]:max-w-[320px] min-[641px]:mr-0"
        role="region"
        aria-roledescription="carousel"
        aria-label="Your Top 100 Albums zine photos"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
        }}
      >
        <div className="relative aspect-square overflow-hidden rounded-[4px] border border-[#cbb79c33] bg-[#211b16]">
          {slides.map((src, i) => (
            <div
              key={src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
              aria-hidden={i !== index}
              className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <img
                src={src}
                alt={`Your Top 100 Albums zine — photograph ${i + 1}`}
                width={1400}
                height={1400}
                loading="lazy"
                decoding="async"
                className="block h-full w-full object-contain"
              />
            </div>
          ))}
          <button
            type="button"
            className={`${control} absolute top-1/2 left-3 -translate-y-1/2 max-[640px]:left-2`}
            aria-label="Previous zine photo"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${control} absolute top-1/2 right-3 -translate-y-1/2 max-[640px]:right-2`}
            aria-label="Next zine photo"
            onClick={() => move(1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <span
            aria-hidden="true"
            className={`${type.meta} absolute bottom-3 right-3 rounded-full bg-[#15120fd9] px-3 py-1.5 text-[#efe8dc]`}
          >
            {String(index + 1).padStart(2, "0")} / 09
          </span>
        </div>
        <div className="mt-3 flex min-w-0 items-center justify-center gap-1">
          <div
            role="group"
            aria-label="Choose a zine photo"
            className="flex min-w-0 items-center justify-center"
          >
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show zine photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className="grid h-11 w-6 cursor-pointer place-items-center border-0 bg-transparent p-0 min-[400px]:w-8"
              >
                <span
                  className={`block h-2 w-2 rounded-full transition-colors ${i === index ? "bg-[#cbb79c]" : "bg-[#cbb79c44] hover:bg-[#cbb79c99]"}`}
                />
              </button>
            ))}
          </div>
          {!reducedMotion && (
            <button
              type="button"
              className={`${control} ml-1 !h-9 !w-9`}
              aria-label={
                paused ? "Play zine slideshow" : "Pause zine slideshow"
              }
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? (
                <Play size={14} aria-hidden="true" />
              ) : (
                <Pause size={14} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
