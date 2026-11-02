import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import Footer from "../footer";

const inputClass =
  "mt-3 block w-full rounded-md border border-white/15 bg-[#15120f] px-4 py-3.5 text-base text-white placeholder:text-[#c0b4a3]/60 transition-colors hover:border-[#cbb79c]/40 focus:border-[#cbb79c] focus:outline-none focus:ring-2 focus:ring-[#cbb79c]/20";

export default function RequestRecordPage() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [record, setRecord] = useState("");
  const [notes, setNotes] = useState("");
  const [draftOpened, setDraftOpened] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `Record request: ${record.trim()}`;
    const body = [
      "Hi Kopi’s Records!",
      "",
      "I’m looking for a record:",
      "",
      `Name: ${name.trim()}`,
      `Phone / Telegram: ${contact.trim()}`,
      `Artist / Record: ${record.trim()}`,
      `Extra details: ${notes.trim() || "None"}`,
    ].join("\n");

    window.location.href =
      `mailto:kopisrecords@gmail.com` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    setDraftOpened(true);
  }

  return (
    <div className="min-h-screen bg-[#15120f] font-[Arial,sans-serif] leading-relaxed text-[#efe8dc]">
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-white/10">
          {/* Soft background glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-40 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-[#cbb79c]/[0.06] blur-[100px]"
          />

          <div className="mx-auto grid max-w-[1320px] gap-12 px-[18px] py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:px-10 lg:py-24">
            {/* INTRODUCTION */}
            <div className="lg:pt-5">
              <Link
                to="/shop"
                className="inline-flex min-h-11 items-center gap-3 text-sm text-[#c0b4a3] transition-colors hover:text-[#efe8dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4"
              >
                <span aria-hidden="true">←</span>
                Back to the crates
              </Link>

              <p className="mb-5 mt-9 text-[10px] uppercase tracking-[0.22em] text-[#cbb79c] sm:text-[11px]">
                The search is part of the story
              </p>

              <h1 className="m-0 font-[Marcellus,Georgia,serif] text-[clamp(44px,5.5vw,76px)] font-normal leading-[1.08] tracking-[-0.025em]">
                On your wishlist.
                <br />
                <span className="text-[#cbb79c]">
                  On our radar.
                </span>
              </h1>

              <p className="mb-0 mt-7 max-w-[440px] text-[15px] leading-7 text-[#c0b4a3]">
                The one you missed. The album you keep coming back to.
                The record you can’t seem to find anywhere.
              </p>

              <p className="mb-0 mt-4 max-w-[440px] text-[15px] leading-7 text-[#c0b4a3]">
                Tell us what you’re looking for. We’ll see what we can dig up.
              </p>

              {/* RECORD SLEEVE */}
              <div
                aria-hidden="true"
                className="relative mx-auto mb-6 mt-14 hidden h-[270px] w-[330px] max-w-full sm:block lg:ml-2 lg:mr-0"
              >
                {/* Vinyl disc */}
                <div
                  className="absolute right-0 top-3 flex h-[238px] w-[238px] items-center justify-center rounded-full border border-white/10 shadow-2xl"
                  style={{
                    background:
                      "repeating-radial-gradient(circle, #11100e 0px, #11100e 3px, #24201b 4px, #11100e 5px)",
                  }}
                >
                  <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#cbb79c]">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#15120f]" />
                  </div>
                </div>

                {/* Paper sleeve */}
                <div className="absolute left-0 top-0 flex h-[250px] w-[250px] -rotate-6 flex-col justify-between border border-[#efe8dc]/15 bg-[#28231d] p-6 shadow-xl">
                  <div className="flex justify-between text-[9px] uppercase tracking-[0.18em] text-[#cbb79c]">
                    <span>Kopi’s Records</span>
                    <span>33⅓ RPM</span>
                  </div>

                  <div>
                    <p className="m-0 font-[Marcellus,Georgia,serif] text-[42px] leading-[1.05]">
                      Worth
                      <br />
                      the dig.
                    </p>
                    <div className="mt-5 h-px w-10 bg-[#cbb79c]" />
                  </div>

                  <p className="m-0 text-[9px] uppercase tracking-[0.2em] text-[#c0b4a3]">
                    Your next favourite awaits
                  </p>
                </div>
              </div>
            </div>

            {/* REQUEST FORM */}
            <div className="self-start rounded-lg border border-white/10 bg-[#211b16] p-6 sm:p-9 lg:p-10">
              <div className="mb-8 flex items-start justify-between gap-4 border-b border-white/10 pb-7">
                <div>
                  <p className="mb-2 mt-0 text-[10px] uppercase tracking-[0.2em] text-[#cbb79c]">
                    From your wishlist
                  </p>
                  <h2 className="m-0 font-[Marcellus,Georgia,serif] text-3xl font-normal">
                    Request a record
                  </h2>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="request-name"
                    className="block text-sm text-[#efe8dc]"
                  >
                    Your name
                    <span className="ml-2 text-xs text-[#c0b4a3]">
                      Required
                    </span>
                  </label>
                  <input
                    id="request-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={100}
                    placeholder="How can we address you?"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="request-contact"
                    className="block text-sm text-[#efe8dc]"
                  >
                    Phone number or Telegram
                    <span className="ml-2 text-xs text-[#c0b4a3]">
                      Required
                    </span>
                  </label>
                  <input
                    id="request-contact"
                    name="contact"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="+65 9123 4567 or @yourusername"
                    aria-describedby="contact-hint"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    className={inputClass}
                  />
                  <p
                    id="contact-hint"
                    className="mb-0 mt-2 text-xs leading-5 text-[#c0b4a3]"
                  >
                    So we can get in touch about your request.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="request-record"
                    className="block text-sm text-[#efe8dc]"
                  >
                    Which record are you looking for?
                    <span className="ml-2 text-xs text-[#c0b4a3]">
                      Required
                    </span>
                  </label>
                  <input
                    id="request-record"
                    name="record"
                    type="text"
                    required
                    maxLength={200}
                    placeholder="e.g. Slowdive - Souvlaki"
                    value={record}
                    onChange={(event) => setRecord(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="request-notes"
                    className="block text-sm text-[#efe8dc]"
                  >
                    Anything else?
                    <span className="ml-2 text-xs text-[#c0b4a3]">
                      Optional
                    </span>
                  </label>
                  <textarea
                    id="request-notes"
                    name="notes"
                    rows={4}
                    maxLength={1500}
                    placeholder="A particular pressing, colour variant, budget, or another detail we should know…"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={`${inputClass} resize-y text-[#efe8dc]`}
                  />
                </div>

                <div className="border-t border-white/10 pt-6">
                  <p className="mb-5 mt-0 text-xs leading-6 text-[#c0b4a3]">
                    Requests aren’t orders or reservations. Availability
                    and pricing will need to be confirmed.
                  </p>

                  <button
                    type="submit"
                    className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-4 rounded-md border-0 bg-[#cbb79c] px-5 py-3.5 text-sm font-medium text-[#15120f] transition-colors hover:bg-[#dfcdb3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4 motion-reduce:transition-none"
                  >
                    Create request email
                    <span aria-hidden="true" className="text-lg">
                      ↗
                    </span>
                  </button>

                  <p className="mb-0 mt-3 text-center text-xs leading-5 text-[#c0b4a3]">
                    Opens your email app. Send the draft to complete
                    your request.
                  </p>
                </div>

                {draftOpened && (
                  <div
                    role="status"
                    className="rounded-md border border-[#cbb79c]/30 bg-[#15120f] p-4 text-sm leading-6 text-[#efe8dc]"
                  >
                    Your email draft was requested. If it didn’t open,
                    email{" "}
                    <a
                      href="mailto:kopisrecords@gmail.com"
                      className="break-all text-[#cbb79c] underline underline-offset-4"
                    >
                      kopisrecords@gmail.com
                    </a>{" "}
                    with the details above. Your request is only sent
                    when you send the email.
                  </div>
                )}
              </form>
            </div>
          </div>
        </section>

        <section
          aria-label="About record requests"
          className="mx-auto grid max-w-[1320px] gap-8 px-[18px] py-10 sm:grid-cols-3 sm:px-6 lg:gap-16 lg:px-10 lg:py-14"
        >
          {[
            {
              number: "01",
              title: "Tell us the title.",
              description:
                "Artist, album, and any pressing details. A little detail helps the search.",
            },
            {
              number: "02",
              title: "We’ll have a dig.",
              description:
                "We’ll check whether we can source it and get back to you with what we find.",
            },
            {
              number: "03",
              title: "You decide.",
              description:
                "If we find a copy, you can review the price and details before committing.",
            },
          ].map((step) => (
            <div key={step.number}>
              <p className="mb-3 mt-0 text-[11px] tracking-[0.15em] text-[#cbb79c]">
                {step.number}
              </p>
              <h2 className="mb-2 mt-0 font-[Marcellus,Georgia,serif] text-xl font-normal">
                {step.title}
              </h2>
              <p className="m-0 max-w-[330px] text-sm leading-6 text-[#c0b4a3]">
                {step.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}