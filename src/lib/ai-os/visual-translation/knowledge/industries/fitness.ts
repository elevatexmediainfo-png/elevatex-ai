import type { IndustryEntry } from "../../types";

export const fitnessIndustry: IndustryEntry = {
  key: "fitness",
  aliases: [
    "fitness", "gym", "crossfit", "yoga", "personal training", "trainer",
    "physiotherapy", "pilates", "martial arts", "athletics", "sport",
    "wellness", "health club", "bootcamp", "strength training",
  ],
  concepts: {

    trust: [
      {
        type: "object",
        value: "A trainer's certification wall — NASM, ACE, NSCA, or equivalent body — is visible at the entrance to the training space, the credentials available for inspection before the first session.",
        weight: 0.92,
        tags: ["object", "certification", "credentials", "fitness"],
      },
      {
        type: "action",
        value: "A trainer explains a programme's structure at the intake session before a single exercise begins — the evidence that there is a plan, not just a workout.",
        weight: 0.90,
        tags: ["action", "intake", "programme_plan", "fitness"],
      },
      {
        type: "person",
        value: "A returning member signs in at the front desk and is greeted by name — the familiarity of a gym that keeps track of who comes back.",
        weight: 0.86,
        tags: ["human", "returning_member", "recognition", "fitness"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A split frame shows the client's physique before their programme and twelve weeks later, same pose, same lighting — the visual argument for investment in the process.",
        weight: 0.96,
        tags: ["composition", "before_after", "physique", "fitness"],
      },
      {
        type: "action",
        value: "A client completes a personal record lift or finishes a previously impossible circuit — the exact moment of breaking a boundary.",
        weight: 0.94,
        tags: ["action", "personal_record", "breakthrough", "fitness"],
      },
      {
        type: "person",
        value: "Sweat-soaked and at the end of the hardest set, a client's expression shows not pain but arrival — the face of someone who just did what they thought they could not.",
        weight: 0.92,
        tags: ["human", "effort", "arrival", "fitness"],
      },
    ],

    confidence: [
      {
        type: "person",
        value: "A client stands in a power stance — feet hip-width, chest open, chin level — the posture of someone who has rebuilt the physical architecture of how they move.",
        weight: 0.94,
        tags: ["human", "posture", "power", "fitness"],
      },
      {
        type: "action",
        value: "A client adds weight to a bar without hesitation — the embodied knowledge that they can handle more than they could before.",
        weight: 0.90,
        tags: ["action", "loading", "readiness", "fitness"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A personal trainer makes a precise form correction — placing a hand on a shoulder, adjusting a hip angle — the cue that prevents injury and unlocks performance.",
        weight: 0.94,
        tags: ["action", "form_correction", "coaching", "fitness"],
      },
      {
        type: "object",
        value: "A training notebook with periodised programme blocks is open beside the equipment — the evidence that this is a structured science, not a collection of exercises.",
        weight: 0.88,
        tags: ["object", "programme", "periodisation", "fitness"],
      },
    ],

    authority: [
      {
        type: "object",
        value: "NSCA, NASM, or ACSM certifications are displayed at the gym entrance or training space — the credentials that separate an accountable professional from an enthusiast.",
        weight: 0.90,
        tags: ["object", "certification", "authority", "fitness"],
      },
      {
        type: "person",
        value: "A trainer demonstrates an exercise to a full class who replicate the movement — the teacher visible as the physical reference point for the whole group.",
        weight: 0.88,
        tags: ["human", "demonstration", "class", "fitness"],
      },
    ],

    community: [
      {
        type: "person",
        value: "Members cheer for each other at the finish of a class WOD — the spontaneous support of people who trained through the same difficulty together.",
        weight: 0.94,
        tags: ["human", "cheering", "support", "fitness"],
      },
      {
        type: "spatial",
        value: "A gym floor at peak time — every station occupied, every person in motion — communicates the energy of a community moving toward the same physical values.",
        weight: 0.90,
        tags: ["spatial", "gym_floor", "community", "fitness"],
      },
    ],

    premium: [
      {
        type: "material",
        value: "The gym floor is heavy-gauge rubber over solid concrete — the acoustic and tactile commitment to a serious training environment.",
        weight: 0.88,
        tags: ["material", "rubber", "floor", "fitness"],
      },
      {
        type: "object",
        value: "Olympic barbells, competition bumper plates, and calibrated dumbbells communicate that the equipment was chosen for performance, not appearance.",
        weight: 0.90,
        tags: ["object", "olympic", "calibrated", "fitness"],
      },
    ],

    achievement: [
      {
        type: "action",
        value: "A member's name is added to a PR board or performance wall — the public acknowledgement of a personal record that joins a visible community ledger.",
        weight: 0.92,
        tags: ["action", "PR_board", "recognition", "fitness"],
      },
      {
        type: "person",
        value: "A client holds their before photo in one hand and stands in their current physical state — the self-held evidence of a year of consistent work.",
        weight: 0.90,
        tags: ["human", "before_photo", "comparison", "fitness"],
      },
    ],

    freshness: [
      {
        type: "lighting",
        value: "Natural light fills the studio space in the early morning session — the gym before the working day begins, the light communicating the discipline of an early start.",
        weight: 0.88,
        tags: ["lighting", "morning", "natural", "fitness"],
      },
    ],

    care: [
      {
        type: "action",
        value: "A trainer reviews a client's movement assessment results at the start of their programme, explaining the risk factors and the plan to address them.",
        weight: 0.90,
        tags: ["action", "assessment", "plan", "fitness"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A twelve-week training block is mapped out in full on paper or screen at the first session — the programme visible from day one to day eighty-four.",
        weight: 0.90,
        tags: ["object", "programme", "twelve_weeks", "fitness"],
      },
    ],
  },
};
