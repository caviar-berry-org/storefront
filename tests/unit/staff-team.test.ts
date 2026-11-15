import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  canManageTeam,
  isStaffRole,
  managesCatalog,
  sortStaff,
  staffEmail,
  staffRoles,
  staffTeamPath,
  type StaffMember,
  type StaffRole,
} from "../../src/domain/staff-team.ts";
import { serverModule } from "../helpers/server-module.ts";

test("an invited address is normalised and anything unusable is rejected", () => {
  assert.equal(staffEmail("  Person@Example.COM "), "person@example.com");
  for (const value of [
    "",
    "person",
    "person@example",
    "person@@example.com",
    "person..name@example.com",
    ".person@example.com",
    "person@example..com",
    "person name@example.com",
    `${"a".repeat(250)}@example.com`,
    42,
    null,
  ])
    assert.equal(staffEmail(value), null, String(value));
});

test("only a superadmin manages the team, and roles order by authority", () => {
  assert.ok(canManageTeam("superadmin"));
  for (const role of ["admin", "manager"] as const)
    assert.ok(!canManageTeam(role));
  assert.ok(staffRoles.every(isStaffRole));
  assert.ok(!isStaffRole("owner"));
  const members: StaffMember[] = [
    { email: "b@example.com", role: "manager" },
    { email: "a@example.com", role: "superadmin" },
    { email: "c@example.com", role: "admin" },
  ];
  assert.deepEqual(
    sortStaff(members).map((member) => member.email),
    ["a@example.com", "c@example.com", "b@example.com"],
  );
  // A development invite can never reach the production team.
  assert.notEqual(staffTeamPath("development"), staffTeamPath("production"));
  assert.throws(() => staffTeamPath(undefined));
});

function teamModule(
  documents: Record<string, { role?: string }>,
  failing = false,
) {
  const docs = Object.entries(documents).map(([id, data]) => ({
    id,
    get: (field: string) => (data as Record<string, unknown>)[field],
  }));
  const deleted: string[] = [];
  const written: { id: string; data: Record<string, unknown> }[] = [];
  const team = serverModule<
    typeof import("../../src/lib/server/staff-team.ts")
  >("src/lib/server/staff-team.ts", {
    "next/cache": {
      unstable_cache: (fn: () => unknown) => fn,
      updateTag: () => {},
    },
    react: { cache: (fn: () => unknown) => fn },
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => ({
        collection: () => ({
          select: () => ({
            get: async () => {
              if (failing) throw new Error("offline");
              return { docs };
            },
          }),
          doc: (id: string) => ({
            get: async () => ({ exists: id in documents }),
            create: async (data: Record<string, unknown>) =>
              written.push({ id, data }),
            update: async (data: Record<string, unknown>) =>
              written.push({ id, data }),
            delete: async () => deleted.push(id),
          }),
        }),
      }),
    },
  });
  return { team, deleted, written };
}

test("access comes from the env superadmins plus the invited list", async () => {
  process.env.APP_ENV = "development";
  process.env.ADMIN_ALLOWED_EMAILS = " Owner@Example.com , broken , ";
  const { team: module } = teamModule({
    "manager@example.com": { role: "manager" },
    "stranger@example.com": { role: "not-a-role" },
  });
  assert.deepEqual(module.permanentStaff(), ["owner@example.com"]);
  // An env address is always a superadmin, whatever the database says.
  assert.equal(await module.staffRoleFor("OWNER@example.com"), "superadmin");
  assert.equal(await module.staffRoleFor("manager@example.com"), "manager");
  // An unreadable role falls back to the least authority, never to none.
  assert.equal(await module.staffRoleFor("stranger@example.com"), "manager");
  // Anyone not listed has no access at all.
  for (const value of ["other@example.com", "not-an-email", "", undefined])
    assert.equal(await module.staffRoleFor(value), null, String(value));
});

test("an unreachable team list keeps the env superadmins and locks out the rest", async () => {
  process.env.APP_ENV = "development";
  process.env.ADMIN_ALLOWED_EMAILS = "owner@example.com";
  const { team: module } = teamModule(
    { "manager@example.com": { role: "manager" } },
    true,
  );
  assert.equal(await module.staffRoleFor("owner@example.com"), "superadmin");
  assert.equal(await module.staffRoleFor("manager@example.com"), null);
});

test("a manager is offered no catalogue section the page would refuse", () => {
  // The sidebar and the server gate must agree. They read one predicate, so the
  // regression this guards is someone adding a closed section to the navigation
  // without marking it — the menu would offer a link that only renders a refusal.
  assert.equal(managesCatalog("superadmin"), true);
  assert.equal(managesCatalog("admin"), true);
  assert.equal(managesCatalog("manager"), false);

  // Loaded through the helper: the module imports via the "@/" alias, which
  // bare `node --test` does not resolve.
  const { getAdminSection, navigationFor } = serverModule<
    typeof import("../../src/components/staff/navigation.ts")
  >("src/components/staff/navigation.ts", {});
  const slugs = (role: StaffRole) =>
    navigationFor(role).flatMap(({ sections }) =>
      sections.map(({ slug }) => slug),
    );
  const manager = slugs("manager");
  for (const closed of ["products", "promotions"]) {
    assert.ok(
      slugs("admin").includes(closed),
      `${closed} should stay in an admin's menu`,
    );
    assert.ok(
      !manager.includes(closed),
      `${closed} must not appear in a manager's menu`,
    );
  }
  // Everything the help page promises a manager keeps.
  for (const open of [
    "",
    "orders",
    "inquiries",
    "customers",
    "content",
    "seo",
    "settings",
  ])
    assert.ok(
      manager.includes(open),
      `${open} must stay available to a manager`,
    );
  // No group is rendered with a label and nothing under it.
  for (const group of navigationFor("manager"))
    assert.ok(group.sections.length, `empty navigation group: ${group.label}`);
  // Route resolution still knows a closed section; the page owns the refusal.
  assert.ok(getAdminSection(["products", "caviar"]));
  assert.ok(getAdminSection(["promotions"]));
});
