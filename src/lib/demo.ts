/** The seeded demo farm is named "… (demo)". Anything shown from it is labelled as sample data. */
export const isDemoFarm = (name: string | null | undefined) => Boolean(name && /\(demo\)\s*$/i.test(name));

/** The seeded demo farm's team (owner, manager, worker, vet…). Many visitors sign in as these at once. */
export const DEMO_PHONES = ["+8801700000001", "+8801700000002", "+8801700000003", "+8801700000004", "+8801700000005"];
