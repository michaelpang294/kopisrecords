import { shopCategories } from "./scripts/picksOfTheWeek";
import { informationCategories } from "./scripts/picksOfTheWeek";
import { useNavigate } from "react-router-dom";

export default function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="bg-[#1f1a17] text-white px-6 md:px-10 py-14 border-t border-white/10 bg-gradient-to-t from-black/30 to-transparent">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12">

        {/* BRAND */}
        <div className="space-y-4">
          <p className="text-2xl font-semibold tracking-wide">
            Kopi's Records
          </p>
          <p className="text-sm text-gray-400">
            kopisrecords@gmail.com
          </p>
        </div>

        {/* CATEGORIES */}
        <div className="space-y-4">
          <p className="text-lg font-medium tracking-wide">
            Shop Categories
          </p>
          <ul className="space-y-2 text-sm text-gray-400">
            {shopCategories.map((item) => (
              <li
                key={item.name}
                className="cursor-pointer hover:text-white hover:translate-x-1 transition-all duration-200"
              >
                {item.name}
              </li>
            ))}
          </ul>
        </div>

        {/* INFORMATION */}
        <div className="space-y-4">
          <p className="text-lg font-medium tracking-wide">
            Information
          </p>
          <ul className="space-y-2 text-sm text-gray-400">
            {informationCategories.map((item) => (
              <li
                key={item.name}
                className="cursor-pointer hover:text-white hover:translate-x-1 transition-all duration-200"
                onClick={() => navigate(`/${item.link}`)}
              >
                {item.name}
              </li>
            ))}
          </ul>
        </div>

        {/* SOCIALS */}
        <div className="space-y-4">
          <p className="text-lg font-medium tracking-wide">
            Follow Us
          </p>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="hover:text-white hover:translate-x-1 transition-all duration-200">
              <a
                href="https://www.instagram.com/kopisrecords/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </li>

            <li className="hover:text-white hover:translate-x-1 transition-all duration-200">
              <a
                href="https://t.me/kopisrecords"
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
            </li>

            <li className="hover:text-white hover:translate-x-1 transition-all duration-200">
              <a
                href="https://carousell.app.link/x9L3b0YYW2b"
                target="_blank"
                rel="noopener noreferrer"
              >
                Carousell
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
        <p>© {new Date().getFullYear()} Kopi's Records</p>
        <p>Built, ran, and continuing with love.</p>
      </div>
    </footer>
  );
}