import { parseIndiaFilings, parseIndianDate } from "../src/lib/sources/manual/indiafilings";

const sample = `CONSTRUCTIVE CONCEPTS LLP
LLPIN : AAV-5939
|
ROC: RoC-Delhi
Active
Last Updated On : 19-07-2023
LLPIN	AAV-5939
LLP Name	CONSTRUCTIVE CONCEPTS LLP
Number of Partners	2
Number of Designated Partners	2
ROC Code	RoC-Delhi
Date of Incorporation	25-01-2021
Registered Address	B 84, JAWAHAR PARK KAHNPUR, SF, NA NEW DELHI New Delhi Delhi 110062
Email ID	constructiveconcept21@gmail.com
Total Obligation of Contribution	2,00,000
Main division of business activity to be carried out in India	45
Description of main division	Construction
Date of last financial year end for Statement of Accounts and Solvency	2022-03-31
Date of last financial year end for Annual Return filed	31-03-2023
LLP Status	Active
Directors / Signatory Details
DIN / PAN	Name	Begin Date
09042543	SANJAY ARORA	25-01-2021
09042544	BINOD KUMAR SINGH	25-01-2021`;

const parsed = parseIndiaFilings(sample);
console.log(JSON.stringify(parsed, null, 2));
console.log("observedAt parsed:", parseIndianDate(parsed.observedAtRaw));
console.log("lastAnnualReturn parsed:", parseIndianDate(parsed.lastAnnualReturnFyEnd));
