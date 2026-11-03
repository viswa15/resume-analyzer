import type { Resume } from "./resume-api";

// Drives the two content-aware dossier layouts ("flow" and "masonry"): a
// rough, deliberately simple measure of how much each resume section
// actually has to show, so the layout can react to it instead of forcing
// every resume into the same fixed shape.

export type SectionRichness = "empty" | "sparse" | "moderate" | "rich";

export type SectionProfile = {
  key: "work" | "education" | "projects" | "certifications" | "contact" | "skills" | "improvement" | "upskills";
  label: string;
  itemCount: number;
  charCount: number;
  richness: SectionRichness;
};

export type ResumeContentProfile = {
  // Main-column sections (work experience, education, projects, certifications).
  sections: SectionProfile[];
  // Sidebar-style panels (contact, skills, improvement areas, upskill suggestions).
  panels: SectionProfile[];
};

function charsOf(value: string | null | undefined): number {
  return (value || "").trim().length;
}

function richnessFor(itemCount: number, charCount: number): SectionRichness {
  if (itemCount === 0 && charCount === 0) return "empty";
  // A rough blend of "how many things" and "how much was written about them"
  // - a section with few items but long descriptions can still read as rich,
  // and vice versa.
  const weight = itemCount * 40 + charCount;
  if (weight >= 400) return "rich";
  if (weight >= 120) return "moderate";
  return "sparse";
}

export function getResumeContentProfile(resume: Resume): ResumeContentProfile {
  const workChars = resume.work_experience.reduce((sum, experience) => sum + experience.description.join(" ").length, 0);
  const eduChars = resume.education.length * 40;
  const projectsChars = resume.projects.reduce((sum, project) => sum + charsOf(project.description) + project.technologies.join(",").length, 0);
  const certificationsChars = resume.certifications.join(",").length;
  const skillsCount = resume.technical_skills.length + resume.soft_skills.length;
  const contactCount = [resume.email, resume.phone, resume.linkedin_url, resume.portfolio_url].filter(Boolean).length;
  const improvementChars = charsOf(resume.improvement_areas);
  const upskillsCount = resume.upskill_suggestions.length;

  const sections: SectionProfile[] = [
    { key: "work", label: "Work experience", itemCount: resume.work_experience.length, charCount: workChars, richness: richnessFor(resume.work_experience.length, workChars) },
    { key: "education", label: "Education", itemCount: resume.education.length, charCount: eduChars, richness: richnessFor(resume.education.length, eduChars) },
    { key: "projects", label: "Projects", itemCount: resume.projects.length, charCount: projectsChars, richness: richnessFor(resume.projects.length, projectsChars) },
    { key: "certifications", label: "Certifications", itemCount: resume.certifications.length, charCount: certificationsChars, richness: richnessFor(resume.certifications.length, certificationsChars) },
  ];

  const panels: SectionProfile[] = [
    { key: "contact", label: "Contact", itemCount: contactCount, charCount: 0, richness: richnessFor(contactCount, 0) },
    { key: "skills", label: "Skills", itemCount: skillsCount, charCount: 0, richness: richnessFor(skillsCount, 0) },
    { key: "improvement", label: "Improvement areas", itemCount: improvementChars > 0 ? 1 : 0, charCount: improvementChars, richness: richnessFor(improvementChars > 0 ? 1 : 0, improvementChars) },
    { key: "upskills", label: "Upskill suggestions", itemCount: upskillsCount, charCount: 0, richness: richnessFor(upskillsCount, 0) },
  ];

  return { sections, panels };
}

const RICHNESS_ORDER: Record<SectionRichness, number> = { rich: 0, moderate: 1, sparse: 2, empty: 3 };

// Stable sort, richest first - ties keep their original (input) order rather
// than being shuffled, so layout doesn't jitter for near-identical resumes.
export function byRichnessThenOriginal<T extends { richness: SectionRichness }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const diff = RICHNESS_ORDER[a.item.richness] - RICHNESS_ORDER[b.item.richness];
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ item }) => item);
}
