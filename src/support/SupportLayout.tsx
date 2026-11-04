import { useEffect } from "react";
import type { ReactNode } from "react";
import Footer from "../footer";
import { typography as type } from "../styles/typography";

export const supportLink = "text-[#cbb79c] underline underline-offset-4 hover:text-[#efe8dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbb79c]";

export default function SupportLayout({ title, intro, children }: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Kopi’s Records`;
    return () => { document.title = previous; };
  }, [title]);
  return (
    <>
      <main id="main-content" className="min-h-[70svh] bg-[#15120f] px-[18px] py-10 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6 sm:py-16 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-[1100px]">
          <header className="mb-10 border-b border-[#cbb79c33] pb-8 sm:mb-12 sm:pb-10">
            <p className={`${type.eyebrow} mb-4 text-[#cbb79c]`}>We are here to help</p>
            <h1 className={`${type.pageTitle} mb-6`}>{title}</h1>
            <p className={`${type.body} max-w-[660px] text-[#c0b4a3]`}>{intro}</p>
          </header>
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
