import type { IndustryEntry } from "../../types";

export const educationIndustry: IndustryEntry = {
  key: "education",
  aliases: [
    "education", "school", "university", "college", "coaching", "coaching centre",
    "e-learning", "online learning", "tutoring", "academy", "institute",
    "preschool", "kindergarten", "edtech", "training centre", "certification",
  ],
  concepts: {

    trust: [
      {
        type: "object",
        value: "University affiliations, accreditation boards, and alumni outcome data are displayed together — the external verification that this institution delivers what it claims.",
        weight: 0.92,
        tags: ["object", "accreditation", "outcomes", "education"],
      },
      {
        type: "action",
        value: "A teacher returns a marked test with written personal feedback on each student's paper — the evidence that assessment is a teaching instrument, not just a sorting mechanism.",
        weight: 0.90,
        tags: ["action", "feedback", "assessment", "education"],
      },
      {
        type: "person",
        value: "A parent sits with the teacher and the student in a three-way meeting, the conversation conducted as a shared project rather than a report.",
        weight: 0.88,
        tags: ["human", "parent_meeting", "transparency", "education"],
      },
    ],

    authority: [
      {
        type: "person",
        value: "A faculty member is introduced with their research publication, industry role, and university affiliation — the biography that earns the right to teach the subject.",
        weight: 0.92,
        tags: ["human", "faculty", "credentials", "education"],
      },
      {
        type: "object",
        value: "Published textbooks, journal papers, or course certifications authored by the instructor are visible on a shelf or screen — the work of someone who contributes to the field, not merely explains it.",
        weight: 0.90,
        tags: ["object", "publication", "authorship", "education"],
      },
    ],

    transformation: [
      {
        type: "person",
        value: "A student walks across a graduation stage in cap and gown, reaching for their certificate — the moment that represents the distance travelled from first enrolment.",
        weight: 0.96,
        tags: ["human", "graduation", "certificate", "education"],
      },
      {
        type: "composition",
        value: "A student's work from their first week sits beside their capstone project — the measurable distance between where they began and where the programme took them.",
        weight: 0.92,
        tags: ["composition", "before_after", "portfolio", "education"],
      },
      {
        type: "action",
        value: "A student presents their thesis or final project to a panel, speaking with the command of someone who now understands their subject completely.",
        weight: 0.90,
        tags: ["action", "presentation", "thesis", "education"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A teacher annotates a complex diagram on a whiteboard, explaining layer by layer, building a concept from first principles in front of the class.",
        weight: 0.94,
        tags: ["action", "whiteboard", "explanation", "education"],
      },
      {
        type: "action",
        value: "An online instructor records at a professional studio setup — dual monitors, drawing tablet, studio lighting — the production quality that signals the instruction is at the same level.",
        weight: 0.88,
        tags: ["action", "studio", "online", "production", "education"],
      },
    ],

    achievement: [
      {
        type: "person",
        value: "A student holds their certificate or result printout with both hands, the expression of someone whose effort has a physical, holdable proof.",
        weight: 0.94,
        tags: ["human", "certificate", "result", "education"],
      },
      {
        type: "object",
        value: "A trophy case, a merit board, or a wall of alumni achievement photos communicates the depth of the institution's record of producing outcomes.",
        weight: 0.90,
        tags: ["object", "trophy", "achievement_wall", "education"],
      },
    ],

    community: [
      {
        type: "person",
        value: "Students work in a collaborative group around a shared problem — the active, peer-to-peer learning that produces understanding rather than passive retention.",
        weight: 0.92,
        tags: ["human", "group", "collaboration", "education"],
      },
      {
        type: "spatial",
        value: "A campus common area at midday — students seated in clusters, talking, reading, debating — communicates the intellectual energy of a learning community.",
        weight: 0.90,
        tags: ["spatial", "campus", "community", "education"],
      },
    ],

    innovation: [
      {
        type: "object",
        value: "A student-built prototype, science fair model, or published project is showcased — the institution's proof that it produces creators, not only exam-passers.",
        weight: 0.92,
        tags: ["object", "prototype", "project", "education"],
      },
      {
        type: "spatial",
        value: "A makerspace or innovation lab equipped with 3D printers, electronics benches, and prototyping materials communicates that this institution trusts students to build.",
        weight: 0.90,
        tags: ["spatial", "makerspace", "lab", "education"],
      },
    ],

    comfort: [
      {
        type: "spatial",
        value: "Ergonomic chairs, ample desk space, natural light through large windows, and organised supply areas create a learning environment that removes physical friction.",
        weight: 0.88,
        tags: ["spatial", "ergonomic", "natural_light", "education"],
      },
    ],

    premium: [
      {
        type: "material",
        value: "Lab equipment, software licences, and resource libraries are shown at a standard that matches or exceeds the industry the students are entering.",
        weight: 0.90,
        tags: ["material", "lab", "resources", "education"],
      },
    ],
  },
};
