// Phase 8.5 — Per-industry decision matrices + priority weights.
//
// dimension names must exactly match CampaignKnowledge field names from CKL types.

import type { IndustryDecisionProfile } from "./types";

export const DECISION_MATRICES: IndustryDecisionProfile[] = [

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "food_hospitality",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "photography",         priority: 10, mandatory: true  },
      { dimension: "composition",         priority:  9, mandatory: true  },
      { dimension: "subjectDirection",    priority:  8, mandatory: true  },
      { dimension: "environment",         priority:  8, mandatory: true  },
      { dimension: "marketingPsychology", priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "typography",          priority:  7, mandatory: false },
      { dimension: "layout",              priority:  6, mandatory: false },
      { dimension: "negativeSpace",       priority:  6, mandatory: false },
      { dimension: "commercialDetails",   priority:  5, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",          level: "YES"    },
      { dimension: "Food Visible",        level: "YES"    },
      { dimension: "Appetite Trigger",    level: "YES"    },
      { dimension: "Warm Lighting",       level: "YES"    },
      { dimension: "Premium Environment", level: "HIGH"   },
      { dimension: "Trust Signal",        level: "MEDIUM" },
      { dimension: "CTA",                 level: "YES"    },
      { dimension: "Price Mention",       level: "LOW"    },
      { dimension: "Empty Background",    level: "NO"     },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "healthcare_dental",
    priorities: [
      { dimension: "marketingPsychology", priority: 10, mandatory: true  },
      { dimension: "antiPattern",         priority: 10, mandatory: true  },
      { dimension: "heroSubject",         priority:  9, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  9, mandatory: true  },
      { dimension: "commercialDetails",   priority:  8, mandatory: true  },
      { dimension: "photography",         priority:  8, mandatory: false },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "negativeSpace",       priority:  7, mandatory: false },
      { dimension: "composition",         priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",        level: "YES"       },
      { dimension: "Trust",             level: "VERY_HIGH" },
      { dimension: "Clinical Setting",  level: "HIGH"      },
      { dimension: "Natural Smile",     level: "YES"       },
      { dimension: "Fear Avoidance",    level: "YES"       },
      { dimension: "Doctor Presence",   level: "HIGH"      },
      { dimension: "Product/Equipment", level: "LOW"       },
      { dimension: "Social Proof",      level: "HIGH"      },
      { dimension: "CTA",               level: "YES"       },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "real_estate",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "marketingPsychology", priority: 10, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  9, mandatory: true  },
      { dimension: "composition",         priority:  9, mandatory: true  },
      { dimension: "commercialDetails",   priority:  9, mandatory: true  },
      { dimension: "photography",         priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "typography",          priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  7, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",             level: "YES"    },
      { dimension: "Property Visible",       level: "YES"    },
      { dimension: "Emotional Ownership",    level: "YES"    },
      { dimension: "Family Presence",        level: "MEDIUM" },
      { dimension: "RERA Compliance",        level: "HIGH"   },
      { dimension: "Location Context",       level: "YES"    },
      { dimension: "Price / EMI",            level: "MEDIUM" },
      { dimension: "Trust Signal",           level: "HIGH"   },
      { dimension: "Aspirational Lifestyle", level: "HIGH"   },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "jewelry_luxury",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "photography",         priority: 10, mandatory: true  },
      { dimension: "composition",         priority: 10, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "negativeSpace",       priority:  9, mandatory: true  },
      { dimension: "marketingPsychology", priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "commercialDetails",   priority:  6, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",          level: "YES"   },
      { dimension: "Jewellery Visible",   level: "YES"   },
      { dimension: "Private Moment",      level: "YES"   },
      { dimension: "Luxury Atmosphere",   level: "HIGH"  },
      { dimension: "Warm Natural Light",  level: "YES"   },
      { dimension: "Trust Signal",        level: "HIGH"  },
      { dimension: "Price Mention",       level: "LOW"   },
      { dimension: "Group Photography",   level: "NO"    },
      { dimension: "Studio Background",   level: "NO"    },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "financial_services",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "marketingPsychology", priority: 10, mandatory: true  },
      { dimension: "commercialDetails",   priority:  9, mandatory: true  },
      { dimension: "antiPattern",         priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  8, mandatory: true  },
      { dimension: "subjectDirection",    priority:  8, mandatory: true  },
      { dimension: "composition",         priority:  8, mandatory: false },
      { dimension: "photography",         priority:  8, mandatory: false },
      { dimension: "typography",          priority:  8, mandatory: true  },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  6, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",          level: "YES"       },
      { dimension: "Trust",               level: "VERY_HIGH" },
      { dimension: "Specific Numbers",    level: "YES"       },
      { dimension: "Lifestyle / Joy",     level: "NO"        },
      { dimension: "Family Reference",    level: "HIGH"      },
      { dimension: "Honest Arithmetic",   level: "YES"       },
      { dimension: "Claim Settlement",    level: "HIGH"      },
      { dimension: "Celebrity Endorse",   level: "NO"        },
      { dimension: "CTA",                 level: "YES"       },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "fitness_wellness",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "photography",         priority:  9, mandatory: true  },
      { dimension: "composition",         priority:  9, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "marketingPsychology", priority:  9, mandatory: true  },
      { dimension: "commercialDetails",   priority:  8, mandatory: true  },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "environment",         priority:  7, mandatory: false },
      { dimension: "typography",          priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  6, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",         level: "YES"    },
      { dimension: "Mid-Effort Moment",  level: "YES"    },
      { dimension: "Before/After Split", level: "NO"     },
      { dimension: "Physique Display",   level: "NO"     },
      { dimension: "Identity Trigger",   level: "YES"    },
      { dimension: "Low Commitment CTA", level: "YES"    },
      { dimension: "Trust Signal",       level: "MEDIUM" },
      { dimension: "Real Environment",   level: "HIGH"   },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "automotive",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "composition",         priority: 10, mandatory: true  },
      { dimension: "photography",         priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  9, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "marketingPsychology", priority:  9, mandatory: true  },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  7, mandatory: false },
      { dimension: "commercialDetails",   priority:  7, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",         level: "YES"    },
      { dimension: "Car Exterior Hero",  level: "NO"     },
      { dimension: "Ownership Moment",   level: "YES"    },
      { dimension: "Indian City Context",level: "YES"    },
      { dimension: "EMI Headline",       level: "NO"     },
      { dimension: "Spec List",          level: "NO"     },
      { dimension: "Test Drive CTA",     level: "YES"    },
      { dimension: "Identity Trigger",   level: "HIGH"   },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "education",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "environment",         priority: 10, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "photography",         priority:  9, mandatory: false },
      { dimension: "marketingPsychology", priority:  9, mandatory: true  },
      { dimension: "commercialDetails",   priority:  8, mandatory: true  },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  7, mandatory: true  },
      { dimension: "composition",         priority:  8, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  7, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",          level: "YES"    },
      { dimension: "Campus Photography",  level: "NO"     },
      { dimension: "Domestic Setting",    level: "HIGH"   },
      { dimension: "Achievement Moment",  level: "YES"    },
      { dimension: "Rankings",            level: "LOW"    },
      { dimension: "Specific Credential", level: "HIGH"   },
      { dimension: "Journey Honour",      level: "YES"    },
      { dimension: "CTA Friction",        level: "LOW"    },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "beauty_cosmetics",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "composition",         priority: 10, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "photography",         priority:  9, mandatory: true  },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "marketingPsychology", priority:  8, mandatory: false },
      { dimension: "environment",         priority:  8, mandatory: false },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "commercialDetails",   priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  7, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",          level: "YES"    },
      { dimension: "Before/After Split",  level: "NO"     },
      { dimension: "Relationship Moment", level: "YES"    },
      { dimension: "Professional Cred",   level: "HIGH"   },
      { dimension: "Discount Language",   level: "NO"     },
      { dimension: "WhatsApp CTA",        level: "YES"    },
      { dimension: "Generic Model",       level: "NO"     },
      { dimension: "Scarcity Signal",     level: "MEDIUM" },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "retail_fashion",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "photography",         priority: 10, mandatory: true  },
      { dimension: "composition",         priority:  9, mandatory: true  },
      { dimension: "subjectDirection",    priority:  9, mandatory: true  },
      { dimension: "marketingPsychology", priority:  8, mandatory: false },
      { dimension: "environment",         priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  7, mandatory: true  },
      { dimension: "typography",          priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "commercialDetails",   priority:  5, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",           level: "YES"   },
      { dimension: "White Background",     level: "NO"    },
      { dimension: "Occasion Context",     level: "YES"   },
      { dimension: "Golden Hour Light",    level: "HIGH"  },
      { dimension: "Camera-Directed Pose", level: "NO"    },
      { dimension: "Discount Language",    level: "NO"    },
      { dimension: "Indian Model",         level: "YES"   },
      { dimension: "Multi-garment Grid",   level: "NO"    },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "events_entertainment",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "photography",         priority: 10, mandatory: true  },
      { dimension: "composition",         priority:  9, mandatory: true  },
      { dimension: "marketingPsychology", priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  8, mandatory: true  },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "subjectDirection",    priority:  8, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "commercialDetails",   priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  6, mandatory: false },
    ],
    matrix: [
      { dimension: "Peak Moment Image",      level: "YES"   },
      { dimension: "Crowd Visible",          level: "HIGH"  },
      { dimension: "Artist Name Dominant",   level: "NO"    },
      { dimension: "Authentic Photography",  level: "YES"   },
      { dimension: "Stock Crowd Image",      level: "NO"    },
      { dimension: "Manufactured Urgency",   level: "NO"    },
      { dimension: "Single Booking CTA",     level: "YES"   },
      { dimension: "Sponsor Logo Grid",      level: "NO"    },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "tech_software",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "marketingPsychology", priority: 10, mandatory: true  },
      { dimension: "commercialDetails",   priority:  9, mandatory: true  },
      { dimension: "antiPattern",         priority:  9, mandatory: true  },
      { dimension: "typography",          priority:  9, mandatory: true  },
      { dimension: "environment",         priority:  8, mandatory: false },
      { dimension: "photography",         priority:  8, mandatory: false },
      { dimension: "subjectDirection",    priority:  8, mandatory: false },
      { dimension: "composition",         priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  6, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",            level: "YES"   },
      { dimension: "Dashboard Screenshot",  level: "NO"    },
      { dimension: "Specific Time Saving",  level: "YES"   },
      { dimension: "Abstract Productivity", level: "NO"    },
      { dimension: "Indian SMB Context",    level: "HIGH"  },
      { dimension: "Free Trial CTA",        level: "YES"   },
      { dimension: "No Card Required",      level: "HIGH"  },
      { dimension: "WhatsApp Support",      level: "HIGH"  },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    industryId: "general",
    priorities: [
      { dimension: "heroSubject",         priority: 10, mandatory: true  },
      { dimension: "marketingPsychology", priority:  9, mandatory: false },
      { dimension: "subjectDirection",    priority:  8, mandatory: true  },
      { dimension: "photography",         priority:  8, mandatory: false },
      { dimension: "typography",          priority:  8, mandatory: false },
      { dimension: "commercialDetails",   priority:  8, mandatory: false },
      { dimension: "composition",         priority:  8, mandatory: false },
      { dimension: "antiPattern",         priority:  7, mandatory: true  },
      { dimension: "environment",         priority:  7, mandatory: false },
      { dimension: "layout",              priority:  7, mandatory: false },
      { dimension: "visualHierarchy",     priority:  7, mandatory: false },
      { dimension: "negativeSpace",       priority:  6, mandatory: false },
    ],
    matrix: [
      { dimension: "Hero Human",         level: "YES"    },
      { dimension: "Customer Value",     level: "YES"    },
      { dimension: "Specific Benefit",   level: "YES"    },
      { dimension: "Generic Claims",     level: "NO"     },
      { dimension: "Multiple CTAs",      level: "NO"     },
      { dimension: "Single CTA",         level: "YES"    },
      { dimension: "Indian Context",     level: "HIGH"   },
      { dimension: "Trust Signal",       level: "MEDIUM" },
    ],
  },

];

// Lookup by industryId — falls back to general
export function getDecisionProfile(industryId: string): IndustryDecisionProfile {
  return (
    DECISION_MATRICES.find(m => m.industryId === industryId) ??
    DECISION_MATRICES.find(m => m.industryId === "general")!
  );
}
