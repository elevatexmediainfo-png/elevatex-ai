import type { IndustryEntry } from "../../types";

export const genericIndustry: IndustryEntry = {
  key: "generic",
  aliases: [
    "business", "company", "brand", "service", "local business", "shop",
    "store", "office", "agency", "consultant", "freelancer", "professional",
    "organisation", "organization", "enterprise", "small business",
  ],
  concepts: {

    trust: [
      {
        type: "person",
        value: "A business owner stands in their own space, looking directly at camera — the presence of the named person behind the name on the sign.",
        weight: 0.90,
        tags: ["human", "founder", "presence", "generic"],
      },
      {
        type: "object",
        value: "Customer reviews or testimonials are shown as physical cards, printed quotes, or screen-capture ratings alongside the reviewer's real name and context.",
        weight: 0.88,
        tags: ["object", "testimonial", "review", "generic"],
      },
      {
        type: "action",
        value: "A staff member explains a product or process to a customer with full attention and no interruption — the consultation that treats the customer's question as worth answering properly.",
        weight: 0.86,
        tags: ["action", "consultation", "attention", "generic"],
      },
    ],

    authority: [
      {
        type: "object",
        value: "Industry memberships, association logos, or chamber of commerce affiliations are displayed at point of contact — the third-party context that positions this business within a professional community.",
        weight: 0.88,
        tags: ["object", "membership", "association", "generic"],
      },
      {
        type: "person",
        value: "A team photo taken at the business location communicates the size, organisation, and real human investment behind the operation.",
        weight: 0.86,
        tags: ["human", "team_photo", "scale", "generic"],
      },
    ],

    premium: [
      {
        type: "material",
        value: "The business environment — the counter surface, the display materials, the signage — is shown in a condition that communicates investment in the customer-facing experience.",
        weight: 0.90,
        tags: ["material", "environment", "surface", "generic"],
      },
      {
        type: "lighting",
        value: "The business space is photographed in good natural or designed light — the difference between a place that presents itself and one that simply exists.",
        weight: 0.88,
        tags: ["lighting", "natural", "environment", "generic"],
      },
    ],

    care: [
      {
        type: "person",
        value: "A staff member listens to a customer with full eye contact and no phone — the signal that this interaction is the most important thing happening at this moment.",
        weight: 0.92,
        tags: ["human", "attention", "listening", "generic"],
      },
      {
        type: "action",
        value: "A follow-up call, a handwritten note, or a post-service check-in communicates that the relationship continues after the transaction ends.",
        weight: 0.88,
        tags: ["action", "followup", "relationship", "generic"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A specialist demonstrates or explains their work to a customer in the space where the work happens — the explanation grounded in the physical reality of the craft.",
        weight: 0.90,
        tags: ["action", "demonstration", "craft", "generic"],
      },
      {
        type: "object",
        value: "Tools, equipment, or materials that are specific to the trade are shown in active use — the visual language of someone who does this every day, not occasionally.",
        weight: 0.88,
        tags: ["object", "tools", "trade", "generic"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A business that has been operating for a measurable number of years displays that number — the longevity that proves the model works and the customers keep returning.",
        weight: 0.88,
        tags: ["object", "longevity", "years", "generic"],
      },
    ],

    community: [
      {
        type: "person",
        value: "Returning customers or long-standing clients are shown interacting naturally in the business space — the visual evidence that this place has regulars.",
        weight: 0.90,
        tags: ["human", "regular_customers", "loyalty", "generic"],
      },
    ],

    freshness: [
      {
        type: "lighting",
        value: "The business space is shown in morning light before the day begins — the clean, prepared state of a place that starts each day from a position of readiness.",
        weight: 0.88,
        tags: ["lighting", "morning", "readiness", "generic"],
      },
    ],

    transformation: [
      {
        type: "action",
        value: "A customer departs in a different condition than they arrived — carrying a purchase, displaying a result, or moving with the confidence of someone whose problem is solved.",
        weight: 0.90,
        tags: ["action", "departure", "outcome", "generic"],
      },
    ],

    confidence: [
      {
        type: "person",
        value: "A business owner or team member completes a task in the customer's presence with visible competence — no hesitation, no reference checking, just the fluency of regular practice.",
        weight: 0.90,
        tags: ["human", "competence", "fluency", "generic"],
      },
    ],
  },
};
