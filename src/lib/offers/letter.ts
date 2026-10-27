import type { AppointmentLetter, Db, Offer } from "../types";
import { candidateOf, masterName } from "../lookup";
import { fmtDate, pkr } from "../format";

/** Original wording for the appointment letter. Paragraphs separated by blank lines. */
export function buildAppointmentLetter(d: Db, offer: Offer, ref: string, issuedAt: string): string {
  const { cand } = candidateOf(d, offer.applicationId);
  const name = cand?.name ?? "Candidate";
  const designation = masterName(d, offer.designationId);
  const grade = masterName(d, offer.gradeId);
  const dept = masterName(d, offer.departmentId);
  const branch = masterName(d, offer.branchId);
  const empType = masterName(d, offer.employmentTypeId, "Permanent");
  const s = d.settings;
  const salary = [`Basic salary: ${pkr(offer.basicSalary)} per month`, ...offer.allowances.map((a) => `${a.name}: ${pkr(a.amount)} per month`), `Gross monthly salary: ${pkr(offer.grossMonthly)}`]
    .map((l) => `• ${l}`)
    .join("\n");
  return [
    `Ref: ${ref}\nDate: ${fmtDate(issuedAt)}`,
    `${name}\n${cand?.city ? cand.city + "\n" : ""}${cand?.email ?? ""}`,
    `Subject: Letter of appointment — ${designation}`,
    `Dear ${name},`,
    `With reference to your acceptance of our offer ${offer.code}, we are pleased to appoint you as ${designation} (${grade}) in the ${dept} department, posted at ${branch}, on a ${empType.toLowerCase()} basis. Your appointment takes effect from ${fmtDate(offer.joiningDate)}, the date on which you are expected to report for duty.`,
    `1. Remuneration\nYour monthly remuneration will be as follows, subject to deduction of income tax and other statutory contributions:\n${salary}`,
    `2. Benefits\nYou will be entitled to the following benefits in line with the Bank's policies as amended from time to time:\n${offer.benefits.map((b) => `• ${b}`).join("\n")}`,
    `3. Probation\nYou will be on probation for ${offer.probationMonths} months. On satisfactory completion, your services will be confirmed in writing. During probation, either party may end this appointment by giving 14 days' notice or salary in lieu.`,
    `4. Notice period\nAfter confirmation, either party may end this appointment by giving one month's written notice or one month's gross salary in lieu of notice.`,
    `5. Confidentiality\nYou shall keep confidential all information about the Bank, its customers, systems and business that comes to your knowledge during your employment, both during and after your service. Customer information shall be used only for legitimate banking purposes.`,
    `6. Code of conduct\nYou shall abide by the Bank's code of conduct, policies and procedures, and by the laws and regulations that apply to microfinance banks in Pakistan, including those on anti-money laundering and the fair treatment of customers. You shall not take up any other employment or business without the Bank's prior written approval.`,
    `7. Pre-employment conditions\nThis appointment is subject to your medical fitness, satisfactory verification of your documents and references, and the accuracy of the information you have provided. Any misstatement may lead to termination without notice.`,
    `8. Documents to bring on your first day\n• Original CNIC and one copy\n• Original educational certificates and transcripts\n• Experience and release letters from previous employers\n• Two passport-size photographs\n• Bank account details for salary transfer`,
    `Please sign the acknowledgement on the portal to confirm that you accept these terms. We look forward to welcoming you to ${s.companyName}.`,
    `Yours sincerely,\n\nHead of Human Resources\n${s.companyName}`,
  ].join("\n\n");
}

export function letterBody(d: Db, letter: AppointmentLetter): string {
  if (letter.body) return letter.body;
  const offer = d.offers.find((o) => o.id === letter.offerId);
  return offer ? buildAppointmentLetter(d, offer, letter.ref, letter.issuedAt) : "";
}

export function nextLetterRef(d: Db): string {
  const year = new Date().getFullYear();
  const key = `AL-${year}`;
  const used = d.letters.filter((l) => l.ref.includes(`/${year}/`)).length;
  const n = Math.max(d.counters[key] ?? 0, used) + 1;
  d.counters[key] = n;
  return `ABHI/HR/AL/${year}/${String(n).padStart(4, "0")}`;
}
