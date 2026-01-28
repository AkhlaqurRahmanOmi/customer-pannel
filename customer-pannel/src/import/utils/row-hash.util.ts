import crypto from "crypto";


export type Hashable =
  | string
  | number
  | boolean
  | bigint
  | Date
  | null
  | undefined;

function normalize(v: Hashable): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  return String(v);
}


export function hashFields(fields: Hashable[], algo: "sha256" | "sha1" = "sha256"): string {
  const stable = fields.map(normalize).join("\u001F"); // Unit Separator
  return crypto.createHash(algo).update(stable, "utf8").digest("hex");
}


export function hashObjectStable(
  obj: Record<string, Hashable>,
  algo: "sha256" | "sha1" = "sha256",
): string {
  const keys = Object.keys(obj).sort();
  const stable = keys.map((k) => `${k}=${normalize(obj[k])}`).join("\u001E"); // Record Separator
  return crypto.createHash(algo).update(stable, "utf8").digest("hex");
}


export type CustomerHashInput = {
  customerId: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  city?: string | null;
  country?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  email?: string | null;
  subscriptionDate?: Date | null;
  website?: string | null;
  aboutCustomer?: string | null;
};

export function hashCustomerRow(row: CustomerHashInput): string {
  return hashFields([
    row.customerId,
    row.firstName,
    row.lastName,
    row.company,
    row.city,
    row.country,
    row.phone1,
    row.phone2,
    row.email,
    row.subscriptionDate ?? null,
    row.website,
    row.aboutCustomer,
  ]);
}
