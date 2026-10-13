import { describe, expect, it } from "vitest";
import { assignableRoles, can, canAssign } from "@/lib/rbac";

describe("permission matrix", () => {
  it("owner can do everything", () => {
    expect(can("owner", "farm.delete")).toBe(true);
    expect(can("owner", "team.manage")).toBe(true);
  });

  it("manager can run the farm but not delete it or manage roles", () => {
    expect(can("manager", "animal.write")).toBe(true);
    expect(can("manager", "finance.view")).toBe(true);
    expect(can("manager", "team.invite")).toBe(true);
    expect(can("manager", "farm.delete")).toBe(false);
    expect(can("manager", "team.manage")).toBe(false);
  });

  it("worker only does daily entry", () => {
    expect(can("worker", "milk.record")).toBe(true);
    expect(can("worker", "weight.record")).toBe(true);
    expect(can("worker", "breeding.observe")).toBe(true);
    expect(can("worker", "finance.view")).toBe(false);
    expect(can("worker", "animal.write")).toBe(false);
    expect(can("worker", "team.view")).toBe(false);
  });

  it("vet records health and pregnancy checks only", () => {
    expect(can("vet", "health.record")).toBe(true);
    expect(can("vet", "breeding.record")).toBe(true);
    expect(can("vet", "milk.record")).toBe(false);
    expect(can("vet", "finance.view")).toBe(false);
  });
});

describe("role assignment", () => {
  it("nobody can assign owner", () => {
    for (const r of ["owner", "manager", "worker", "vet"] as const) expect(canAssign(r, "owner")).toBe(false);
  });
  it("manager can only assign worker and vet", () => {
    expect(assignableRoles("manager")).toEqual(["worker", "vet"]);
    expect(canAssign("manager", "manager")).toBe(false);
  });
  it("workers and vets cannot assign anyone", () => {
    expect(assignableRoles("worker")).toEqual([]);
    expect(assignableRoles("vet")).toEqual([]);
  });
});
