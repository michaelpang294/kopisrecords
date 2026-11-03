import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { recoveryPath, recoveryUrl } from "./orderRecovery";
export default function OrderLink({ token }: { token: string }) {
  const input = useRef<HTMLInputElement>(null),
    [notice, setNotice] = useState("");
  if (!token) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(recoveryUrl(token));
      setNotice("Order link copied. Keep it private.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice("Select and copy this link. Keep it private.");
    }
  }
  return (
    <div className="mt-5 rounded-lg border border-[#cbb79c]/25 bg-[#15120f]/60 p-4">
      <p className="text-sm text-[#efe8dc]">Keep your order link</p>
      <p className="mt-2 text-xs leading-relaxed text-[#c0b4a3]">
        Copy this link before closing the tab. You’ll need it to return to your
        order. Anyone with this link can view the order summary.
      </p>
      <label className="mt-3 block text-xs text-[#c0b4a3]">
        Private order link
        <input
          ref={input}
          readOnly
          value={recoveryUrl(token)}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 block min-h-11 w-full min-w-0 rounded-md border border-white/15 bg-[#15120f] p-3 text-base text-[#efe8dc]"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={copy}
          className="min-h-11 text-sm text-[#cbb79c] underline underline-offset-4"
        >
          Copy order link
        </button>
        <Link
          to={recoveryPath(token)}
          className="inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline underline-offset-4"
        >
          View order ↗
        </Link>
      </div>
      <p role="status" className="mt-2 text-xs text-[#c0b4a3] empty:hidden">
        {notice}
      </p>
    </div>
  );
}
