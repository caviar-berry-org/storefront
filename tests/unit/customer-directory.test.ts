import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerLookupKey,
  customerLookupKeys,
  customerSearchTerm,
} from "../../src/domain/customer-directory.ts";

test("finds phone fragments across local and international formats", () => {
  for (const phone of ["+380 (67) 123-45-67", "067 123 45 67"]) {
    const keys = customerLookupKeys({ type: "retail", phone, email: null });
    for (const search of [
      "+380 (67) 123-45-67",
      "0671234567",
      "38067",
      "123-45",
      "4567",
    ]) {
      const term = customerSearchTerm(search);
      assert.ok(term);
      assert.ok(keys.includes(customerLookupKey("all", term)), search);
      assert.ok(keys.includes(customerLookupKey("retail", term)), search);
      assert.ok(!keys.includes(customerLookupKey("corporate", term)), search);
    }
    assert.equal(keys.length, new Set(keys).size);
  }
});

test("matches normalized full email and rejects unusable contact searches", () => {
  const keys = customerLookupKeys({
    type: "corporate",
    phone: null,
    email: " Demo@EXAMPLE.com ",
  });
  const term = customerSearchTerm("DEMO@example.com");
  assert.ok(term);
  assert.ok(keys.includes(customerLookupKey("corporate", term)));
  assert.ok(keys.includes(customerLookupKey("corporate", "")));
  for (const search of [
    "123",
    "+--()",
    "Ірина",
    "demo@",
    "067x1234",
    "0123456789012345",
  ]) {
    assert.equal(customerSearchTerm(search), null, search);
  }
  assert.equal(customerSearchTerm(" "), "");
});
