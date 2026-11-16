/**
 * Single source for the public contact details shown on the storefront and in mail.
 *
 * These are deliberately NOT environment variables: they are public, identical in every
 * environment, and used by tests — a typed module is reviewed in the diff and cannot drift
 * between Vercel projects the way a copied env var can. Only the mail *identity*
 * (MAIL_FROM / SMTP_USER / MAIL_REPLY_TO) lives in the environment, because it differs
 * between the DEV mailbox and the production one.
 *
 * The legal offer in `src/content/legal/` keeps its own literal contacts on purpose:
 * that text is client-approved and a legal document must state concrete details.
 */
export const contacts = {
  email: "sale@caviar.net.ua",
  phones: [
    { tel: "+380981944248", display: "+38 098 194 4248" },
    { tel: "+380677772638", display: "+38 067 777 2638" },
  ],
  social: {
    instagram: "https://www.instagram.com/caviar.berry/",
    facebook: "https://www.facebook.com/ukrainian.caviar.berry/",
  },
} as const;

export const primaryPhone = contacts.phones[0];
