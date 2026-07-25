import type { CreativeStrategy } from "../../creative-brain/types";
import type { VisualDirection } from "../types";
import { cf, unknownCf } from "./shared";

// Builder 5 — Visual Direction
// Sole responsibility: decide what appears visually and the role each element plays.
// Reads: strategy.creative, strategy.visual, strategy.business, strategy.marketing
// Never generates prompts or image instructions.

export function buildVisualDirection(strategy: CreativeStrategy): VisualDirection {
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const trust = strategy.audience.trustRequirement.value;
  const goal = strategy.marketing.campaignGoal.value;

  // Hero subject — more specific direction than Creative Brain's generic decision
  const heroSubject = (() => {
    const brainHero = strategy.creative.heroSubject.value;
    if (brainHero !== "unknown") {
      return cf(`${brainHero} — framed to maximise emotional impact and message clarity`, "high",
        `Hero subject refined from Creative Brain decision with directorial framing guidance`);
    }
    return unknownCf("heroSubject");
  })();

  // Supporting elements
  const supportingElements = (() => {
    const brainSupports = strategy.creative.supportingSubjects.value;
    if (brainSupports !== "unknown") {
      return cf(brainSupports, "medium", `Supporting elements from Creative Brain industry knowledge bank`);
    }
    return unknownCf("supportingElements");
  })();

  // Background story
  const backgroundStory = (() => {
    const env = strategy.visual.environmentPriority.value;
    if (env === "immersive") {
      return cf("The background IS part of the story — it sets the lifestyle context that makes the hero subject aspirational", "high",
        `Immersive environment priority → background carries narrative weight`);
    }
    if (env === "supporting") {
      return cf("The background supports the hero without competing — softly blurred or desaturated to frame the subject", "high",
        `Supporting environment → background frames, not distracts`);
    }
    if (env === "none") {
      return cf("Solid, neutral, or gradient background — the message needs nothing but the hero subject to communicate", "high",
        `No environment priority → clean, distraction-free background`);
    }
    return cf("Clean, uncluttered background that communicates the brand's quality without overwhelming the hero", "low",
      `Default background story — minimal, professional`);
  })();

  // Environment type
  const environment = (() => {
    const envMap: Record<string, string> = {
      dental:           "Premium modern dental clinic — bright, sterile, calming, clinical confidence",
      dental_clinic:    "Premium modern dental clinic — bright, sterile, calming, clinical confidence",
      healthcare:       "Modern, welcoming hospital or clinic — warm lighting, professional atmosphere, visible care",
      food_beverage:    "Warm, inviting restaurant interior — ambient lighting, premium table setting, appetite appeal",
      restaurant:       "Warm, inviting restaurant interior with signature ambiance",
      real_estate:      "The property itself — architectural feature, outdoor living space, or golden-hour exterior",
      luxury_property:  "Luxury property's signature feature — cliffside, infinity pool, grand entrance at golden hour",
      finance:          "Aspirational professional setting — modern office, clean desk, forward-looking context",
      education:        "Vibrant, energetic campus or classroom — optimism, modern facilities, active learning",
      beauty_wellness:  "Softly lit, premium beauty studio — clean, warm, intimate, focused on the service",
      hair_salon:       "Elegant, well-lit salon interior with professional styling in progress",
      jewellery_luxury: "Gallery-quality setting — neutral luxury, the piece isolated or in an aspirational lifestyle moment",
      automotive:       "Open road or premium showroom — dynamic, clean, communicating freedom and engineering quality",
      hospitality:      "Signature property vista or indulgent comfort scene — creates immediate desire to be there",
    };
    const val = envMap[industryKey ?? ""] ?? envMap[strategy.business.industry.value ?? ""];
    if (val) return cf(val, "high", `Environment type selected from industry knowledge for "${industryKey}"`);
    return unknownCf("environment");
  })();

  // Props
  const props = (() => {
    const propsMap: Record<string, string> = {
      dental:           "Dental implant model, mirror, instruments — clinical but not intimidating",
      healthcare:       "Healthcare professional's tools, diagnostic equipment (background), patient comfort signals",
      food_beverage:    "Signature garnish, premium tableware, textured ingredients that communicate freshness",
      real_estate:      "Architectural details, greenery, ambient lifestyle props (coffee table, reading area)",
      finance:          "Growth metaphor objects (seedling, compass), digital device showing positive data",
      education:        "Student work, learning materials, achievement symbols, modern technology in use",
      beauty_wellness:  "Premium product bottles, styling tools shown with craft, before/after prop setup",
      jewellery_luxury: "Fabric or surface that showcases the piece, minimal lifestyle accessories",
      automotive:       "Road, landscape, engineering detail close-ups",
    };
    const val = propsMap[industryKey ?? ""];
    if (val) return cf(val, "medium", `Props curated for industry="${industryKey}" to reinforce message`);
    return unknownCf("props");
  })();

  // Icons
  const icons = (() => {
    const infoDensity = strategy.creative.informationDensity.value;
    if (infoDensity === "single_message") return cf("none", "high", `Single message density → icons would distract`);
    if (trust === "critical" || trust === "high") return cf("minimal_line_icons", "medium",
      `High trust context → clean minimal line icons support credibility without cluttering`);
    if (infoDensity === "complex_infographic") return cf("filled_icons", "high",
      `Complex infographic → filled icons provide visual anchor and improve scannability`);
    return cf("minimal_line_icons", "low", `Default icon treatment — minimal and professional`);
  })();

  // Infographics
  const infographics = (() => {
    const style = strategy.visual.illustrationPreference.value;
    if (style === "infographic_elements") {
      const industryInfographic: Record<string, VisualDirection["infographics"]["value"]> = {
        finance:    "growth_chart",
        mutual_fund:"growth_chart",
        healthcare: "process_flow",
        dental:     "process_flow",
        education:  "timeline_infographic",
      };
      const format = industryInfographic[industryKey ?? ""] ?? "comparison_chart";
      return cf(format, "high", `Infographic elements required for industry="${industryKey}" with educational goal`);
    }
    return cf("none", "medium", `No infographic elements required for this campaign style`);
  })();

  // Trust badges
  const trustBadges = (() => {
    if (trust === "critical") return cf("certification_corner", "high",
      `Critical trust requirement → certification badges in corner establish credibility immediately`);
    if (trust === "high") return cf("badge_strip", "medium",
      `High trust requirement → badge strip below hero validates the primary message`);
    return cf("none", "medium", `Trust level="${trust}" — trust badges not required in this creative`);
  })();

  // Charts and Graphs
  const charts = (() => {
    const needsChart = ["finance", "mutual_fund"].includes(industryKey ?? "")
      && goal === "education";
    if (needsChart) return cf("compound_growth", "high",
      `Finance + education campaign → compound growth chart visualises the SIP/investment argument`);
    if (["healthcare"].includes(industryKey ?? "") && goal === "awareness") {
      return cf("comparison_bar", "medium", `Healthcare awareness → comparison bar shows health risk vs. checkup rate`);
    }
    return cf("none", "medium", `Charts not required for this campaign combination`);
  })();

  const graphs = (() => {
    if (["finance", "mutual_fund"].includes(industryKey ?? "") && goal !== "unknown") {
      return cf("upward_trend", "medium", `Finance campaign → upward trend line reinforces growth narrative`);
    }
    return cf("none", "medium", `Graphs not required for this campaign`);
  })();

  return { heroSubject, supportingElements, backgroundStory, environment, props, icons, infographics, trustBadges, charts, graphs };
}
