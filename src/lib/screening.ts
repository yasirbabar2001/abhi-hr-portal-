import type { Application, CandidateProfile, Db, JobPosting, ScreeningResult } from "./types";
import { qualificationRank } from "./lookup";

/**
 * Transparent, rule-based CV screening. Every point is explained in the
 * breakdown so recruiters (and candidates, on request) can see why a score was given.
 * Weights: qualification 25, experience 25, keywords 35, location 15.
 */
export function screen(d: Db, app: Application, cand: CandidateProfile, posting: JobPosting): ScreeningResult {
  const breakdown: ScreeningResult["breakdown"] = [];
  const c = posting.criteria;

  const knockoutPassed = posting.knockoutQuestions.every((q) => app.knockoutAnswers[q.id] === q.requiredAnswer);

  const need = qualificationRank(d, c.minQualificationId);
  const have = qualificationRank(d, cand.qualificationId);
  const qPts = need === 0 ? 25 : have >= need ? 25 : have === need - 1 ? 12 : 0;
  breakdown.push({
    label: "Qualification",
    points: qPts,
    max: 25,
    note: need === 0 ? "No minimum set" : have >= need ? "Meets the minimum" : "Below the minimum",
  });

  const minExp = c.minExperienceYears;
  const exp = cand.totalExperienceYears;
  const ePts = minExp <= 0 ? 25 : exp >= minExp ? 25 : Math.round((exp / minExp) * 20);
  breakdown.push({ label: "Experience", points: ePts, max: 25, note: `${exp} yrs vs ${minExp} required` });

  const haystack = [cand.skills.join(" "), cand.cvText ?? "", cand.currentTitle, app.coverNote ?? ""].join(" ").toLowerCase();
  const matchedKeywords = c.keywords.filter((k) => haystack.includes(k.toLowerCase()));
  const kPts = c.keywords.length === 0 ? 35 : Math.round((matchedKeywords.length / c.keywords.length) * 35);
  breakdown.push({
    label: "Skills & keywords",
    points: kPts,
    max: 35,
    note: c.keywords.length ? `${matchedKeywords.length} of ${c.keywords.length} matched` : "No keywords set",
  });

  const cities = c.preferredCities.map((x) => x.toLowerCase());
  const lPts = cities.length === 0 || cities.includes(cand.city.toLowerCase()) ? 15 : 5;
  breakdown.push({
    label: "Location",
    points: lPts,
    max: 15,
    note: cities.length === 0 ? "Any location" : lPts === 15 ? `Based in ${cand.city}` : `Based in ${cand.city} (relocation)`,
  });

  const score = breakdown.reduce((s, b) => s + b.points, 0);
  return { score, knockoutPassed, breakdown, matchedKeywords, at: new Date().toISOString() };
}

export function scoreBand(score: number): { label: string; tone: "ok" | "warn" | "bad" } {
  if (score >= 75) return { label: "Strong match", tone: "ok" };
  if (score >= 50) return { label: "Possible match", tone: "warn" };
  return { label: "Weak match", tone: "bad" };
}
