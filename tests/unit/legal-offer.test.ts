import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("both public offers preserve all 15 sections and expose personal data at section 12", () => {
  for (const locale of ["ua", "en"]) {
    const doc = JSON.parse(
      readFileSync(`src/content/legal/${locale}/offer.json`, "utf8"),
    );
    assert.equal(doc.sections.length, 16);
    const privacy = doc.sections.filter(
      (s: { id?: string }) => s.id === "privacy",
    );
    assert.equal(privacy.length, 1);
    assert.match(privacy[0].title, /^12\. /);
    for (let n = 1; n <= 15; n++)
      assert.ok(doc.sections[n].title.startsWith(`${n}. `));
    const text = doc.sections
      .flatMap((s: { paragraphs: string[] }) => s.paragraphs)
      .join(" ");
    assert.match(text, /12\.10\./);
    assert.match(text, /2805800227/);
    assert.match(text, /sale@caviar.net.ua/);
    assert.ok(!/Page \d+/.test(text));
  }
});
