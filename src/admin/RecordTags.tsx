import { recordTags, readRecordTags } from "./recordTagOptions";

export default function RecordTags({
  value,
  onChange,
  newListing = false,
}: {
  value: unknown;
  onChange: (tags: string[]) => void;
  newListing?: boolean;
}) {
  const selected = readRecordTags(value);
  return (
    <fieldset className="rounded-lg border border-white/10 bg-[#211b16]/80 p-4">
      <legend className="px-2 font-marcellus text-lg text-[#efe8dc]">
        Record tags
      </legend>
      <div className="flex flex-wrap gap-2">
        {recordTags.map((tag) => (
          <label
            key={tag.value}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 py-2 font-[Arial,sans-serif] text-xs ${selected.includes(tag.value) ? "border-[#cbb79c]/60 bg-[#cbb79c]/10 text-[#efe8dc]" : "border-white/15 text-[#c0b4a3]"}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(tag.value)}
              disabled={newListing && tag.value === "new_arrival"}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, tag.value]
                    : selected.filter((value) => value !== tag.value),
                )
              }
              className="accent-[#cbb79c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cbb79c]"
            />
            {tag.label}
          </label>
        ))}
      </div>
      <p className="mt-3 font-[Arial,sans-serif] text-xs leading-relaxed text-[#c0b4a3]">
        {newListing
          ? "New listings are automatically tagged New arrival. You can remove it later when editing the record."
          : "Select any tags that apply, or clear them all. These appear on the cover and affect shop sorting."}
      </p>
    </fieldset>
  );
}
