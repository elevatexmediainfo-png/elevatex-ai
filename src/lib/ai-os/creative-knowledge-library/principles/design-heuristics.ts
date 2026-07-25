// Creative Knowledge Library — Design Heuristics

import type { DesignHeuristic } from "../types";

export const DESIGN_HEURISTICS: DesignHeuristic[] = [

  {
    rule:  "The Decisive Moment Law",
    why:   "Henri Cartier-Bresson's insight applies completely to commercial advertising: there is one moment in any story when the emotional truth is most legible on a human face or body. One frame before it, the emotion hasn't arrived yet. One frame after, it has become performance. Advertising that captures this specific frame communicates authenticity that no other moment can.",
    apply: "For every human subject, identify the single decisive moment — not the peak of the emotion (usually over-acted) but the moment just before the peak, or the micro-expression that follows. For the restaurant campaign: the first bite arriving at the lips. For the dental clinic: the patient's hands releasing tension from the armrests. For the insurance campaign: the finger touching a number on a laptop at 11 PM.",
  },

  {
    rule:  "The 40% Hero Rule",
    why:   "The primary visual element — person, product, or hero subject — should occupy 40–55% of the total frame. This creates a visual anchor that the eye returns to while still leaving enough space for supporting hierarchy. Below 35%, the hero loses dominance. Above 60%, the frame feels claustrophobic and there is no room for commercial context.",
    apply: "In post-composition review, verify that the hero element occupies 40–55% of total frame area. The remaining 45–60% is divided between supporting elements (environment, secondary subjects) and the commercial zone (headline, CTA, logo). If the hero is below 40%, crop in. If above 55%, widen the composition.",
  },

  {
    rule:  "The Environmental Trust Signal",
    why:   "Viewers do not consciously evaluate backgrounds — but their brains do. The environment in which a subject is photographed communicates volume, permanence, quality, and cultural accuracy within the first 200 milliseconds of viewing, before any text is read. An authentic Indian environment communicates understanding; a generic or Western environment communicates distance.",
    apply: "Every background element must be chosen for what it communicates, not for aesthetic texture. For a financial services advertisement, a home office at 11 PM with a school bag visible is not decorative — it communicates the specific Indian middle-class family that this service protects. If you cannot state in one sentence what a specific background element communicates, remove it.",
  },

  {
    rule:  "The Specific Detail Law",
    why:   "Advertising that uses specific, accurate details converts more than advertising that uses general, accurate details. 'Cold cup of chai' is more powerful than 'cup on the desk'. 'Flower petals displaced by dancing feet' is more powerful than 'event flowers'. Specific details signal that the creative team had access to actual knowledge of the viewer's world — which creates the strongest form of trust.",
    apply: "For every advertisement, identify three specific cultural details that are accurate to this specific Indian audience at this specific moment in their lives. These details are not headline-level — they are environmental, in the background, or in the hands of the subject. The viewer will process them without reading them and think 'this brand knows my world'.",
  },

  {
    rule:  "The Dual Audience Rule",
    why:   "Most high-value Indian purchases involve two decision-makers: the primary buyer and a validation partner. The dental implant patient and their spouse. The jewellery buyer and the gift recipient's imagined reaction. The home loan couple — one looking at the keys, one looking at the partner. The most powerful advertising activates both perspectives simultaneously.",
    apply: "Identify whether this campaign's purchase decision typically involves a primary and secondary decision-maker. If yes, frame the creative so that the primary actor communicates the aspiration while their body language or gaze implies a second person who is present or imagined. The viewer identifies with the primary actor; the secondary actor creates social validation.",
  },

  {
    rule:  "The Incomplete Narrative Law",
    why:   "The human brain is uncomfortable with incomplete stories and will work to complete them. Advertising that shows an almost-complete moment (the bride not yet revealed, the box not yet opened, the laptop about to close) forces active mental participation from the viewer. This active participation creates stronger encoding and stronger conversion than passive receipt of a complete story.",
    apply: "Identify the moment immediately before the resolution of the campaign's core emotional promise. The bridal MUA places the last kajal line — the reveal hasn't happened yet. The husband watches the wife's face before she opens the gift box. The buyer holds the fabric in the light — she hasn't bought it yet. Stopping just before the resolution gives the viewer's brain the work of completing the story.",
  },

  {
    rule:  "The Proximity and Isolation Principle",
    why:   "Elements that are close to each other are perceived as related; elements with space around them are perceived as important. In commercial layout, the spacing of elements communicates their relationship and hierarchy as powerfully as their size. An unspaced layout creates visual noise even when individual elements are well-designed.",
    apply: "Group elements that belong together (headline + subheadline, logo + tagline, CTA + supporting text) with tight internal spacing. Between groups, use at least twice the internal spacing. The hero element should have the most isolation — surrounded by the most space. The visual hierarchy created by spacing should match the communication hierarchy of the content.",
  },

  {
    rule:  "The Light Source Consistency Rule",
    why:   "A single, consistent, identifiable light source creates depth, dimension, and realism. Multiple light sources of equal power create flat, directionless illumination that reads as artificial. In Indian commercial contexts, warm natural light (window at golden hour, lamp glow, diya) communicates authenticity. Cool artificial light communicates clinical distance.",
    apply: "Choose one dominant light source for every advertisement and make it visible or implied by the shadows. All other light sources are fills that preserve detail — never equals of the key. The light source should be consistent with the emotional register: warm for aspiration and family; cooler for authority and trust; mixed warm-cool for transformation narratives.",
  },

  {
    rule:  "The Commercial Zone Integrity Rule",
    why:   "The commercial zone — headline, subheadline, logo, CTA — must be readable at the smallest intended display size. Indian social media advertisements are frequently viewed on mid-range smartphones with 5-inch screens. Text that requires 100% zoom to read does not convert because most viewers will not zoom.",
    apply: "Test every advertisement at 375px width (standard mid-range smartphone). Verify that: (1) the headline is readable at a glance without zooming, (2) the CTA is large enough to tap accurately, (3) the logo is recognisable if not yet readable. If any of these fail, increase type size or reduce the amount of text in the commercial zone.",
  },

  {
    rule:  "The Indian Context First Principle",
    why:   "Indian viewers are highly sensitive to cultural accuracy in advertising — in faces, in environments, in objects, in light quality. An advertisement that uses Western faces, Western environments, or Western cultural references for an Indian audience communicates either laziness or disconnect. Both responses reduce trust and conversion. The strongest Indian advertising feels specific enough to have been made about the viewer's exact life.",
    apply: "For every campaign, verify cultural accuracy at three levels: (1) faces — unmistakably Indian, appropriate to the specific regional and demographic target, (2) environment — recognisable Indian setting specific to the target audience's actual world, (3) objects and details — culturally specific props (diyas, chai, specific fabrics, particular foods) that Indian viewers recognise as from their world.",
  },

  {
    rule:  "The White Space = Premium Signal",
    why:   "White space in commercial advertising communicates confidence. A brand that does not need to fill every pixel to make its case communicates authority and premium quality. Conversely, an advertisement that fills all available space with information communicates anxiety — the brand does not trust its primary message to do the work alone. Indian premium brand advertising consistently uses more white space than mass-market advertising.",
    apply: "Reserve a minimum of 7% of total frame area as intentional white or near-white space that no visual or copy element crosses. For premium brands, target 15–20%. White space is not wasted space — it is the composition breathing room that makes the hero element more powerful by contrast.",
  },

  {
    rule:  "The One Headline Rule",
    why:   "Every advertisement should have one dominant headline that communicates one idea. Two equally prominent messages create a split-attention problem that causes both to fail. The brain's attention mechanism is a spotlight: it can illuminate one thing well or two things poorly. A headline that tries to say two things says neither.",
    apply: "Write the headline, then ask: 'What is this headline saying?' If the answer has the word 'and' in it, the headline is saying two things. Remove one. The remaining idea should be the single most important thing the viewer needs to understand about this brand at this moment. All other information exists in the hierarchy below it.",
  },

  {
    rule:  "The Trust Before Conversion Rule",
    why:   "Indian consumers — particularly for high-consideration purchases (healthcare, financial services, real estate, education) — require trust before they will consider conversion. An advertisement that leads with conversion asks (Book now, Call today, Get 50% off) before establishing trust will be dismissed by the very high-value audience it is trying to reach. Trust must be established first; conversion is its natural consequence.",
    apply: "For high-consideration industries, the primary visual and headline must establish trust — through authenticity, specificity, professional credibility, or genuine human moment. The CTA exists in the commercial zone, is clear and accessible, but is not the dominant message. The dominant message is always trust.",
  },

  {
    rule:  "The Depth Layer Mandate",
    why:   "Two-dimensional advertising photography — where the subject and background occupy the same focal plane — reads as flat and static. Three-dimensional photography — with a clear foreground element, a sharp mid-ground subject, and a soft background — creates depth that holds the viewer's attention longer. The eye naturally explores layered environments; it rapidly dismisses flat ones.",
    apply: "Compose every advertisement with at minimum three depth layers: (1) a foreground element at the near edge of frame (can be partially out of focus), (2) the primary subject in sharp focus in the mid-ground, (3) a soft background environment. The foreground element can be a hand, a texture, a product, or any physical element that sits between the viewer and the subject.",
  },

  {
    rule:  "The Negative Space = Next Action Rule",
    why:   "The direction a subject looks or moves creates implied motion toward that space. A subject looking right implies something valuable exists to the right of them. In commercial advertising, the commercial zone — headline, CTA — should be placed in the space that the subject's gaze or body position implies. This creates a natural reading path that connects the emotional moment to the commercial message.",
    apply: "After establishing the subject's position and gaze direction, place the commercial zone in the negative space their gaze points toward. If the subject is looking right, the commercial zone is to their right. If they are walking forward, the commercial zone is ahead of them in the composition. The viewer's eye follows the subject's gaze, arriving at the commercial message through natural visual travel rather than instruction.",
  },

];
