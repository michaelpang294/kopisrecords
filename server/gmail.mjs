import nodemailer from "nodemailer";
export const shopEmail = "kopisrecords@gmail.com";
export function createGmailSender(env = process.env) {
  const password = (env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  const transport = password
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: shopEmail, pass: password },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      })
    : null;
  return {
    ready: Boolean(transport),
    async send(message) {
      if (!transport)
        throw Object.assign(new Error("Gmail is not configured."), {
          code: "GMAIL_NOT_CONFIGURED",
        });
      const result = await transport.sendMail(message);
      const recipient =
        typeof message.to === "string" ? message.to : message.to.address;
      if (
        !result.accepted?.some(
          (address) =>
            String(address).toLowerCase() === recipient.toLowerCase(),
        )
      ) {
        throw Object.assign(new Error("Recipient was not accepted."), {
          code: "RECIPIENT_REJECTED",
        });
      }
    },
  };
}
