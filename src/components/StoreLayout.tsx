import type { ReactNode } from "react";
import StoreHeader from "./StoreHeader";
import { typography as type } from "../styles/typography";

/** Mount once inside BrowserRouter, around App, so every route shares a header. */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${type.body} min-h-screen bg-[#15120f] text-[#efe8dc]`}>
      <StoreHeader />
      <div id="store-content" tabIndex={-1} className="outline-none">
        {children}
      </div>
    </div>
  );
}
