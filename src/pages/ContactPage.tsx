import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MapPin } from "lucide-react";
import SupportLayout, { supportLink } from "../support/SupportLayout";

const channels = [
  { name: "Follow us on Instagram", href: "https://www.instagram.com/kopisrecords/", detail: "Say hello, see what’s new, or send us a message." },
  { name: "Follow our Telegram channel", href: "https://t.me/kopisrecords", detail: "Unlock exclusive discounts, first access to new releases, and more!" },
  { name: "Carousell", href: "https://carousell.app.link/x9L3b0YYW2b", detail: "Find us on Carousell. You can see pictures of the records we have available here." },
];

export default function ContactPage() {
  return (
    <SupportLayout title="Contact us" intro="A question about a pressing, an order, or a record you can’t stop thinking about? Just get in touch! We’ll get back to you as soon as we can.">
      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-8">
        <section aria-labelledby="email-title"  className="rounded-lg border border-[#cbb79c33] bg-[#211b16] p-6 sm:p-9">
          <Mail size={26} strokeWidth={1.5} aria-hidden="true" className="mb-6 text-[#cbb79c]" />
          <h2 id="email-title" className="mb-4 font-marcellus text-3xl">Drop us an email</h2>
          <a href="mailto:kopisrecords@gmail.com" className={`${supportLink} inline-flex min-h-11 max-w-full items-center break-all text-base sm:text-xl`}>kopisrecords@gmail.com</a>
          <p className="mt-5 text-sm leading-7 text-[#c0b4a3]">For an existing order, include your order reference and tell us what you need help with. For a record enquiry, include the artist, album and a product link if you have one.</p>
          <div className="mt-7 border-t border-white/10 pt-6">
            <h3 className="mb-2 font-marcellus text-xl">Drop us a message on Telegram</h3>
            <p className="mb-4 text-sm leading-7 text-[#c0b4a3]">We reply fastest over here.</p>
            <a
              href="https://t.me/kopirecords"
              target="_blank"
              rel="noopener noreferrer"
              className={`${supportLink} inline-flex min-h-11 items-center gap-2`}
            >
              t.me/kopirecords
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>
        <section aria-labelledby="collection-title" className="rounded-lg border border-white/10 p-6 sm:p-9">
          <MapPin size={26} strokeWidth={1.5} aria-hidden="true" className="mb-6 text-[#cbb79c]" />
          <h2 id="collection-title" className="mb-4 font-marcellus text-3xl">Picking up your records?</h2>
          <p className="mb-3 text-base">Rocks Cafe</p>
          <address className="text-sm not-italic leading-7 text-[#c0b4a3]">98 Arab Street, Level 2<br />Back Alley Entrance<br />Singapore 199794</address>
          <address className="text-sm not-italic leading-7 text-[#c0b4a3] mt-2">Opens 2:30pm - 11pm (Tuesdays to Sundays)</address>
          <p className="mt-5 text-sm leading-7 text-[#c0b4a3]">Please wait for your ready-for-collection email and confirm arrangements with us before heading down. Have your collection / bag number ready when you arrive.</p>
          <a href="https://www.google.com/maps/search/?api=1&query=Rocks+Cafe+98+Arab+Street+Singapore+199794" target="_blank" rel="noopener noreferrer" className={`${supportLink} mt-4 inline-flex min-h-11 items-center gap-2`}>Open in Maps <ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
        </section>
      </div>
      <section aria-labelledby="elsewhere-title" className="mt-12 sm:mt-16">
        <h2 id="elsewhere-title" className="mb-6 font-marcellus text-2xl sm:text-3xl">Find us around</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {channels.map((channel) => (
            <a key={channel.name} href={channel.href} target="_blank" rel="noopener noreferrer" className="group rounded-lg border border-white/10 bg-[#211b16] p-6 transition-colors hover:border-[#cbb79c66] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbb79c]">
              <h3 className="mb-3 flex items-center justify-between gap-3 font-marcellus text-xl">{channel.name}<ArrowUpRight size={18} aria-hidden="true" className="text-[#cbb79c]" /></h3>
              <p className="text-sm leading-6 text-[#c0b4a3]">{channel.detail}</p>
              <span className="sr-only">Opens in a new tab</span>
            </a>
          ))}
        </div>
      </section>
      <p className="mt-10 text-sm leading-7 text-[#c0b4a3]">Need a quick answer? <Link to="/faq" className={supportLink}>Have a look at our FAQ.</Link></p>
    </SupportLayout>
  );
}
