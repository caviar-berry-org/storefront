import type { CatalogKind } from "../domain/managed-catalog.ts";

export const catalogRoot = "catalog/main";

export const catalogCollections = {
  "gift-sets": {
    records: `${catalogRoot}/giftSets`,
    published: `${catalogRoot}/publishedGiftSets`,
  },
  caviar: {
    records: `${catalogRoot}/caviar`,
    published: `${catalogRoot}/publishedCaviar`,
  },
} satisfies Record<CatalogKind, { records: string; published: string }>;

export const catalogSupport = {
  inventory: `${catalogRoot}/inventory`,
  packReferences: `${catalogRoot}/packReferences`,
  historicalReferences: `${catalogRoot}/historicalReferences`,
  settings: `${catalogRoot}/settings`,
  slugs: `${catalogRoot}/slugs`,
  audit: `${catalogRoot}/audit`,
};

export function catalogRecordArchived(record: {
  published: boolean;
  everPublished: boolean;
}) {
  return !record.published && record.everPublished;
}
