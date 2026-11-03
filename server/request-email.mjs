import { createGmailSender, shopEmail } from "./gmail.mjs";
export { shopEmail } from "./gmail.mjs";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export function requestEmail(request) {
  const text = [
    `Hi ${request.name},`,
    "",
    `We’ve received your request for ${request.record}. Thanks for letting us know what’s on your wishlist!`,
    "",
    "We’ll have a dig and get back to you if we can source a copy. This is a request, not an order or reservation; availability and pricing still need to be confirmed.",
    "",
    `Record: ${request.record}`,
    ...(request.notes ? [`Extra details: ${request.notes}`] : []),
    ...(request.contact ? [`Phone / Telegram: ${request.contact}`] : []),
    "",
    "Have anything to add? Just reply to this email.",
    "",
    "With love,",
    "Kopi’s Records",
  ].join("\n");
  return {
    from: { name: "Kopi’s Records", address: shopEmail },
    to: { name: request.name, address: request.email },
    // Keep a shop copy without exposing another customer's address.
    bcc: shopEmail,
    replyTo: shopEmail,
    subject: `We’ve got your record request: ${request.record}`,
    messageId: `<record-request-${request.requestId}@kopisrecords.shop>`,
    text,
    html: `<div style="background:#15120f;padding:32px 16px;color:#efe8dc;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto;background:#211b16;border:1px solid #493b2e;border-radius:8px;padding:28px"><p style="color:#cbb79c;font-size:12px;letter-spacing:2px">KOPI’S RECORDS</p><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:normal;line-height:1.2">Your wishlist is on our radar.</h1><p>Hi ${escape(request.name)},</p><p style="line-height:1.7">We’ve received your request for <strong>${escape(request.record)}</strong>. Thanks for letting us know what’s on your wishlist!</p><p style="color:#c0b4a3;line-height:1.7">We’ll have a dig and get back to you if we can source a copy. This is a request, not an order or reservation; availability and pricing still need to be confirmed.</p>${request.notes ? `<p style="white-space:pre-wrap;line-height:1.7"><strong>Extra details</strong><br>${escape(request.notes)}</p>` : ""}${request.contact ? `<p>Phone / Telegram: ${escape(request.contact)}</p>` : ""}<p style="line-height:1.7">Have anything to add? Just reply to this email.</p><p style="color:#cbb79c;line-height:1.7">With love,<br>Kopi’s Records</p></div></div>`,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export function createRequestMailer(env = process.env) {
  const sender = createGmailSender(env);
  return {
    ready: sender.ready,
    async send(request) {
      await sender.send(requestEmail(request));
    },
  };
}
