/**
 * Shared Tailwind type styles for Kopi's Records.
 * Keep complete class names here so Tailwind can detect them.
 * Heading levels describe the document structure; use these styles by role.
 */
export const typography = {
  pageTitle:
    "font-[family-name:Marcellus,Georgia,serif] text-[clamp(2.75rem,5.7vw,5rem)] font-normal leading-[1.12] tracking-[-0.02em]",
  sectionTitle:
    "font-[family-name:Marcellus,Georgia,serif] text-[clamp(2rem,3.5vw,3rem)] font-normal leading-[1.2] tracking-[-0.015em]",
  itemTitle:
    "font-[family-name:Marcellus,Georgia,serif] text-lg font-normal leading-[1.35] min-[641px]:text-xl",
  brand:
    "font-[family-name:Marcellus,Georgia,serif] text-[25px] font-normal leading-[1.12] tracking-normal min-[641px]:text-[30px]",
  body: "font-[family-name:Arial,sans-serif] text-base font-normal leading-7 tracking-normal",
  small:
    "font-[family-name:Arial,sans-serif] text-sm font-normal leading-6 tracking-normal",
  meta: "font-[family-name:Arial,sans-serif] text-xs font-normal leading-5 tracking-normal",
  eyebrow:
    "font-[family-name:Arial,sans-serif] text-xs font-medium uppercase leading-5 tracking-[0.16em]",
  ui: "font-[family-name:Arial,sans-serif] text-sm font-medium leading-6 tracking-normal",
} as const;
