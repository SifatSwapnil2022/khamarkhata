import type { Role } from "@/db/schema";

/**
 * Permission matrix. The server checks these on every action; the UI only uses them to hide controls.
 * Keep docs/ARCHITECTURE.md in sync when this changes.
 */
export const PERMISSIONS = [
  "farm.view",
  "farm.update",
  "farm.delete",
  "team.view",
  "team.invite",
  "team.manage",
  "animal.view",
  "animal.write",
  "animal.delete",
  "milk.record",
  "milk.sales",
  "health.record",
  "breeding.observe",
  "breeding.record",
  "weight.record",
  "finance.view",
  "finance.record",
  "listing.manage",
  "reports.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  owner: ALL,
  manager: new Set(PERMISSIONS.filter((p) => p !== "farm.delete" && p !== "team.manage")),
  worker: new Set<Permission>([
    "farm.view",
    "animal.view",
    "milk.record",
    "weight.record",
    "breeding.observe",
  ]),
  vet: new Set<Permission>([
    "farm.view",
    "animal.view",
    "health.record",
    "breeding.record",
    "reports.view",
  ]),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/**
 * Which roles an actor may invite, assign or remove.
 * Ownership transfer is a separate, deliberate flow (not in phase 1), so "owner" is never assignable.
 */
export function assignableRoles(actor: Role): Role[] {
  switch (actor) {
    case "owner":
      return ["manager", "worker", "vet"];
    case "manager":
      return ["worker", "vet"];
    default:
      return [];
  }
}

export function canAssign(actor: Role, target: Role): boolean {
  return assignableRoles(actor).includes(target);
}

export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((p) => MATRIX[role].has(p));
}
