/**
 * Bank details for the sole proprietor's account. The transfer letter reads them
 * from here; the offer's section 15 carries the same values in its own wording.
 *
 * One source, like `contacts.ts` — these digits end up in a customer's banking
 * app, so they must never be retyped into a template. Final values confirmed by
 * the client on 14.11.2026; the IBAN is checked (29 characters, valid checksum,
 * MFO 322001, which matches the bank named below).
 */
export const paymentDetails = {
  recipient: "ФОП Юрковська Ольга Анатоліївна",
  iban: "UA473220010000026008380109479",
  taxCode: "2805800227",
  bank: "Акціонерне товариство «УНІВЕРСАЛ БАНК»",
  bankMfo: "322001",
  bankCode: "21133352",
} as const;
