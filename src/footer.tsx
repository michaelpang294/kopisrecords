import { Link } from "react-router-dom";
import { informationCategories } from "./scripts/picksOfTheWeek";

const linkClass =
  "inline-flex min-h-11 items-center py-2 text-sm text-[#c0b4a3] transition-colors hover:text-[#efe8dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4 motion-reduce:transition-none";

const headingClass =
  "mb-4 font-[Marcellus,Georgia,serif] text-xl font-normal text-[#efe8dc]";

const socials = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/kopisrecords/",
  },
  {
    name: "Telegram",
    href: "https://t.me/kopisrecords",
  },
  {
    name: "Carousell",
    href: "https://carousell.app.link/x9L3b0YYW2b",
  },
];

export default function Footer() {
  const information = informationCategories.filter(
    (item) => item.name.trim().toLowerCase() !== "admin",
  );

  return (
    <footer className="border-t border-white/10 bg-[#1b1612] px-[18px] pb-6 pt-12 font-[Arial,sans-serif] leading-relaxed text-[#efe8dc] sm:px-6 lg:px-10 lg:pt-16">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12">
          {/* BRAND */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              to="/"
              aria-label="Kopi’s Records home"
              className="inline-block font-[Marcellus,Georgia,serif] text-[30px] leading-tight text-[#efe8dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4"
            >
              Kopi’s Records
            </Link>

            <p className="mb-0 mt-4 max-w-[290px] text-sm text-[#c0b4a3]">
              An independent record shop in Singapore. Records we love,
              ready for your next rotation.
            </p>

            <a
              href="mailto:kopisrecords@gmail.com"
              className={`${linkClass} mt-3 break-all`}
            >
              kopisrecords@gmail.com
            </a>

            <p className="mb-0 mt-5 text-[10px] uppercase tracking-[0.18em] text-[#cbb79c]">
              Always listening. Always digging.
            </p>
          </div>

          {/* SHOP */}
          <nav aria-labelledby="footer-shop-title">
            <h2 id="footer-shop-title" className={headingClass}>
              Explore the crates
            </h2>

            <ul className="m-0 list-none p-0">
              <li>
                <Link to="/shop" className={linkClass}>
                  Shop all records
                </Link>
              </li>

              <li>
                <Link to="/shop?sort=newest" className={linkClass}>
                  New arrivals
                </Link>
              </li>

              <li>
                <a
                  href="mailto:kopisrecords@gmail.com?subject=Record%20request"
                  className={linkClass}
                >
                  Request a record
                </a>
              </li>
            </ul>
          </nav>

          {/* INFORMATION */}
          <nav aria-labelledby="footer-information-title">
            <h2 id="footer-information-title" className={headingClass}>
              Here to help
            </h2>

            <ul className="m-0 list-none p-0">
              {information.map((item) => (
                <li key={item.name}>
                  <Link
                    to={`/${item.link.replace(/^\/+/, "")}`}
                    className={linkClass}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}

              <li>
                <a
                  href="mailto:kopisrecords@gmail.com"
                  className={linkClass}
                >
                  Contact us
                </a>
              </li>
            </ul>
          </nav>

          {/* SOCIALS */}
          <nav
            aria-labelledby="footer-social-title"
            className="col-span-2 border-t border-white/10 pt-7 lg:col-span-1 lg:border-0 lg:pt-0"
          >
            <h2 id="footer-social-title" className={headingClass}>
              Stay in rotation
            </h2>

            <p className="mb-3 mt-0 max-w-[270px] text-sm text-[#c0b4a3]">
              Fresh arrivals, shop updates, and what’s on our turntable.
            </p>

            <ul className="m-0 flex list-none flex-wrap gap-x-6 p-0 lg:block">
              {socials.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.name} (opens in a new tab)`}
                    className={`${linkClass} gap-2`}
                  >
                    {social.name}
                    <span aria-hidden="true" className="text-[#cbb79c]">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* BOTTOM BAR */}
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-[#c0b4a3] sm:flex-row sm:items-center sm:justify-between lg:mt-14">
          <p className="m-0">
            © {new Date().getFullYear()} Kopi’s Records
          </p>

          <p className="m-0">
            Built and run with love.
          </p>
        </div>
      </div>
    </footer>
  );
}