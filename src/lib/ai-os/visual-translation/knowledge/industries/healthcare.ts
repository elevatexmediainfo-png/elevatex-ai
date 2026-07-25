import type { IndustryEntry } from "../../types";

export const healthcareIndustry: IndustryEntry = {
  key: "healthcare",
  aliases: [
    "healthcare", "hospital", "clinic", "medical", "doctor", "physician",
    "general practitioner", "gp", "specialist", "surgeon", "physiotherapy",
    "rehabilitation", "diagnostic centre", "pathology", "pharmacy",
    "ayurveda", "homeopathy", "naturopath", "health centre",
  ],
  concepts: {

    trust: [
      {
        type: "person",
        value: "A doctor sits at eye level with the patient rather than behind a desk, the physical barrier removed to allow an equal conversation.",
        weight: 0.94,
        tags: ["human", "proximity", "eye_level", "healthcare"],
      },
      {
        type: "action",
        value: "The doctor shows the patient their own test results on a screen, explaining each value in plain language before noting any implications.",
        weight: 0.92,
        tags: ["action", "transparency", "results", "healthcare"],
      },
      {
        type: "object",
        value: "Medical degrees, specialist board certifications, and hospital affiliations are displayed in an organised frame cluster visible from the patient's chair.",
        weight: 0.88,
        tags: ["object", "credential", "certification", "healthcare"],
      },
    ],

    care: [
      {
        type: "person",
        value: "A nurse gently takes a patient's hand during a difficult conversation — the human contact that no medication or procedure can replicate.",
        weight: 0.95,
        tags: ["human", "touch", "nurse", "healthcare"],
      },
      {
        type: "action",
        value: "A doctor kneels beside a bed to be at a patient's level rather than standing above them — the physical gesture of choosing not to hold positional power.",
        weight: 0.92,
        tags: ["action", "proximity", "eye_level", "healthcare"],
      },
      {
        type: "object",
        value: "A family member is visible in the consultation room — the clinic that welcomes the support network rather than isolating the patient.",
        weight: 0.88,
        tags: ["object", "family", "support", "healthcare"],
      },
    ],

    authority: [
      {
        type: "person",
        value: "A specialist presents a case at a medical conference, the assembled audience communicating the scale of recognition they have earned in their field.",
        weight: 0.92,
        tags: ["human", "conference", "authority", "healthcare"],
      },
      {
        type: "object",
        value: "Published research papers or a clinical guideline contribution in a visible frame position this physician as someone who shapes the standards of their field.",
        weight: 0.90,
        tags: ["object", "research", "publication", "healthcare"],
      },
    ],

    cleanliness: [
      {
        type: "action",
        value: "A healthcare professional demonstrates the full seven-step hand hygiene protocol before entering a treatment area — the procedure performed, not implied.",
        weight: 0.95,
        tags: ["action", "hand_hygiene", "protocol", "healthcare"],
      },
      {
        type: "object",
        value: "A surgical instrument set is laid out in sterile sequence on a pre-autoclaved tray — the visual language of a system that does not tolerate improvisation.",
        weight: 0.92,
        tags: ["object", "sterile", "instrument", "healthcare"],
      },
      {
        type: "material",
        value: "The consultation room floor, walls, and surfaces are shown in the seamless, flush format of medical-grade infection control — no joins, no gaps, no dirt traps.",
        weight: 0.90,
        tags: ["material", "seamless", "clinical", "healthcare"],
      },
    ],

    premium: [
      {
        type: "material",
        value: "The private patient suite features hotel-standard bedding, a curated art piece, and natural light through full-height windows — the aesthetic of healing, not of processing.",
        weight: 0.92,
        tags: ["material", "suite", "hotel_standard", "healthcare"],
      },
      {
        type: "lighting",
        value: "Biodynamic lighting in the recovery area adjusts through the day — warm in the morning, cooler at noon — following the natural rhythm that supports healing.",
        weight: 0.88,
        tags: ["lighting", "biodynamic", "recovery", "healthcare"],
      },
    ],

    transformation: [
      {
        type: "person",
        value: "A patient stands unaided for the first time post-surgery, their expression containing both surprise and the beginning of belief that the goal was real.",
        weight: 0.96,
        tags: ["human", "recovery", "first_step", "healthcare"],
      },
      {
        type: "composition",
        value: "A before-and-after pair shows the same patient in pre-treatment condition and in recovered health — the medical outcome made undeniably visual.",
        weight: 0.94,
        tags: ["composition", "before_after", "recovery", "healthcare"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A surgeon consults a real-time imaging display during a procedure — the data and the physical act in constant dialogue, the way expertise actually works.",
        weight: 0.94,
        tags: ["action", "imaging", "procedure", "healthcare"],
      },
      {
        type: "object",
        value: "A diagnostic instrument — an ultrasound probe, an ophthalmoscope, a neurological hammer — is handled with the complete fluency of someone who uses it every day.",
        weight: 0.90,
        tags: ["object", "diagnostic", "instrument", "healthcare"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A patient management system on screen shows appointment history, lab results, and referral records all in one view — the continuity of care made visible.",
        weight: 0.90,
        tags: ["object", "patient_record", "continuity", "healthcare"],
      },
    ],

    safety: [
      {
        type: "action",
        value: "A surgical team completes a pre-operative checklist aloud together — the WHO protocol performed as a team ritual, not a bureaucratic formality.",
        weight: 0.95,
        tags: ["action", "checklist", "team", "healthcare"],
      },
      {
        type: "object",
        value: "Emergency protocols, sharps disposal units, and first-response equipment are visible in their correct positions — the infrastructure of prepared response.",
        weight: 0.88,
        tags: ["object", "emergency", "protocol", "healthcare"],
      },
    ],
  },
};
