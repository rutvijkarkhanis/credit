import { z } from "zod";

export const ENTITY_TYPES = [
  "proprietorship",
  "partnership",
  "llp",
  "private_limited",
  "public_limited",
  "huf",
  "trust",
  "society",
  "unknown",
] as const;

// Loose format checks only — these confirm shape, not real registration. The
// sources verify existence; the form should not reject a valid-but-unusual id.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const intakeSchema = z.object({
  legalName: z.string().trim().min(2, "Legal name is required"),
  tradeName: optionalTrimmed,
  entityType: z.enum(ENTITY_TYPES).default("unknown"),
  gstin: optionalTrimmed.refine(
    (v) => v === undefined || GSTIN_RE.test(v),
    "GSTIN must be 15 characters in the standard format",
  ),
  pan: optionalTrimmed.refine(
    (v) => v === undefined || PAN_RE.test(v),
    "PAN must be 10 characters in the standard format",
  ),
  state: optionalTrimmed,
});

export type IntakeInput = z.infer<typeof intakeSchema>;
