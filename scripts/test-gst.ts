import { parseGst } from "../src/lib/sources/manual/gst";

const active = `GSTIN/UIN of the Taxpayer	06AAQFC2286A1ZM
Legal Name of Business	CONSTRUCTIVE CONCEPTS LLP
Trade Name	CONSTRUCTIVE CONCEPTS
Effective Date of registration	01/07/2021
Constitution of Business	Limited Liability Partnership
GSTIN / UIN Status	Active
Taxpayer Type	Regular
Nature Of Business Activities	Works Contract, Supplier of Services
Return Type	Financial Year	Tax Period	Date of Filing	Status
GSTR-3B	2024-2025	March	18/04/2025	Filed
GSTR-1	2024-2025	March	11/04/2025	Filed
GSTR-3B	2024-2025	February	20/03/2025	Filed`;

const cancelled = `GSTIN/UIN of the Taxpayer	29XXXXX1234X1Z0
Legal Name of Business	SOME LAPSED TRADERS
GSTIN / UIN Status	Cancelled
Effective Date of registration	01/07/2019
Effective Date of cancellation	31/12/2023
Constitution of Business	Proprietorship
GSTR-3B	2023-2024	August	22/09/2023	Filed`;

console.log("=== ACTIVE ==="); console.log(JSON.stringify(parseGst(active), null, 1));
console.log("=== CANCELLED ==="); console.log(JSON.stringify(parseGst(cancelled), null, 1));
