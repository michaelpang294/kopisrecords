export type InvoiceLine = {
  key: string;
  title: string;
  artist: string;
  unitPrice: string;
  quantity: number;
  medium: string;
  variant: string;
  cover_image: string;
};
export type InvoiceDraft = {
  items: InvoiceLine[];
  fulfilment: "collection" | "delivery";
  deliveryFee: string;
  expiryDays: number;
  customerName: string;
  email: string;
  notes: string;
  internalNotes: string;
  platform: string;
  externalReference: string;
};
export type Invoice = {
  id: string;
  reference: string;
  draft: InvoiceDraft;
  status: "draft" | "sent" | "void";
  version: number;
  totals: { subtotal: number; delivery: number; total: number; count: number };
  createdAt: string;
  issuedAt: string | null;
  expiresAt: string | null;
  emailStatus: string;
  emailAttempts: number;
  emailError: string | null;
  emailSentAt: string | null;
  orderStatus: string | null;
};
export const invoiceDate = (value: string) => new Date(value).toLocaleString("en-SG", {
  timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short",
}) + " SGT";
export const invoiceOrderLabel: Record<string, string> = {
  awaiting_payment_confirmation: "Awaiting payment", payment_reported: "Payment reported",
  paid: "Paid", ready_for_collection: "Ready for collection", dispatched: "Dispatched",
  completed: "Completed", expired: "Expired", cancelled: "Cancelled",
};
