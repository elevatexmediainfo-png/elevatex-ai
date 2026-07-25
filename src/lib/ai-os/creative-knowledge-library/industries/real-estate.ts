// Creative Knowledge Library — Real Estate

import type { IndustryKnowledge } from "../types";

export const realEstate: IndustryKnowledge = {
  id:    "real_estate",
  label: "Real Estate",
  campaigns: [

    {
      type: "luxury_launch",
      tags: ["luxury", "premium", "apartment", "villa", "penthouse", "exclusive", "launch", "property", "real estate", "residential"],
      goal: "Drive site visits and expression of interest for a premium residential launch.",
      audience: "Indian HNI and upper-middle-class households aged 32–55 purchasing a second home or upgrade home as a status and investment decision.",

      heroSubject: {
        bad:          "Exterior rendering of luxury apartment building. Architecture at sunset.",
        whyBad:       "Building exteriors communicate the architecture firm's achievement, not the future resident's life inside it. Renders communicate 'will exist', not 'is worth wanting now'.",
        good:         "An Indian woman standing inside a spacious, naturally lit apartment interior — not looking at the view, but looking at the empty space itself, imagining what it holds.",
        goldStandard: "An Indian woman in her late 30s stands in the centre of an empty apartment living room. She is not looking at the panoramic city view behind her. She is looking at the space in front of her — at the room that does not yet have her family's life in it. Her arms are slightly open, as though measuring a space or a feeling. This is the moment of ownership imagination: the room is empty because it belongs to her now.",
        why:          "The woman looking at the empty space rather than the view is the most powerful luxury real estate image. It communicates that the value is in the possibility, not the specification — which is what premium residential buyers are actually purchasing.",
      },

      visualHierarchy: {
        bad:          "Building render dominant. Project name large. Price or size. Developer branding.",
        whyBad:       "Developer-brand-first hierarchy communicates builder confidence, not resident aspiration. The buyer does not want to see the developer's achievement — they want to see their life in this space.",
        good:         "Resident in the space 50%, interior quality 30%, project identity 15%, CTA 5%. The life first; the specification second.",
        goldStandard: "P1 Woman imagining ownership (45%) — the aspiration of the life inside. P2 Interior quality — Italian marble, ceiling height, natural light flooding in (30%) — the specification proven visually. P3 City view or landscape softly visible through the windows (15%) — the lifestyle context. P4 Project name and developer credential (5%). P5 Site visit CTA (5%).",
        why:          "Premium real estate purchases are identity purchases — the buyer is buying a statement about who they are and where they live. The hierarchy must present identity before specification, aspiration before amenity list.",
      },

      composition: {
        bad:          "Wide angle of apartment showing maximum space. Furniture visible to indicate scale.",
        whyBad:       "Wide-angle architecture photography communicates square footage, not emotional ownership. Furniture for scale reduces the space to a size comparison exercise.",
        good:         "The resident in the space, with the natural light and the view visible behind them. The room's quality demonstrated by the light falling across the floor, not by showing furniture.",
        goldStandard: "The woman stands at the golden ratio point of the empty room — neither at the centre nor at the edge, but at the point from which the room looks like it has already begun to be hers. The ceiling height is visible above her, communicating scale without furniture. Through the windows: soft natural light flooding across Italian marble floors, the play of light revealing the quality of the material. The view is visible but out of focus — it is there but the room is what matters.",
        why:          "Showing the quality of light on the floor communicates premium materials more powerfully than furniture placement or specification sheets. The floor that receives and reveals beautiful light is the floor worth paying for.",
      },

      photography: {
        bad:          "Architectural photography. Natural light. Empty apartment.",
        whyBad:       "Standard architectural photography is optimised for the architecture, not for the residential aspiration. It shows the apartment as a container, not as a home waiting to happen.",
        good:         "24mm wide lens at standing human level. Golden hour light through the windows. The resident as the emotional anchor. The space experienced through the person, not the other way around.",
        goldStandard: "24mm wide lens at standing human height — the perspective of someone entering the apartment for the first time. Golden hour light from the western windows — the specific quality of late afternoon light that makes empty apartments feel like possibilities rather than constructions. The resident's figure occupies the golden ratio point. The light pools on the floor around her feet. The ceiling and the far wall are both visible, communicating the proportion of the space without requiring measurement.",
        why:          "Golden hour photography of an empty apartment is the most aspirational residential image available because golden hour light makes every space look like the best version of itself. The buyer's imagination fills the room; the golden light makes that imagination feel achievable.",
      },

      subjectDirection: {
        bad:          "Couple standing on the balcony looking at the view, smiling.",
        whyBad:       "Balcony-view couple photography is the most overused image in Indian real estate advertising and has been drained of meaning. The camera-directed smiles communicate performance of aspiration rather than genuine ownership feeling.",
        good:         "Woman alone in the space, looking at the room — not the view and not the camera. The private ownership imagination moment.",
        goldStandard: "The woman has been in the apartment alone for three minutes. She has walked through the rooms and has returned to this one — the largest, the most light-filled. Her back is slightly turned toward the camera and she is looking at the far corner of the room: the corner where she has already decided the reading chair will go. Her arms are relaxed. She is not performing — she is planning. This is the private moment of ownership before the papers are signed.",
        why:          "The 'planning the reading chair' moment is the most powerful residential ownership moment available in advertising. It is entirely private, entirely specific, and entirely recognisable to anyone who has ever imagined living somewhere new. It converts because it makes the imagination of ownership viscerally real.",
      },

      environment: {
        bad:          "Luxury apartment interior with premium finishes.",
        whyBad:       "Premium finishes as a claim without a specific visual proof is the most common and least effective real estate claim. Every luxury developer claims premium finishes.",
        good:         "Specific material quality visible in the natural light: the depth of Italian marble, the grain of engineered wood, the play of light through floor-to-ceiling windows. Materials proving themselves.",
        goldStandard: "Italian marble floors with visible veining — the light from the western windows revealing the depth and variation that separates real Italian marble from Indian-manufactured substitutes. Floor-to-ceiling windows — not windows, but glass from slab to slab. The living room ceiling height visible in the frame: minimum 3.2 metres, evident without measurement. One visible interior detail that communicates Indian premium sensibility rather than generic luxury: perhaps a textured plaster wall, a handcrafted ceiling element, or a naturally lit interior alcove.",
        why:          "Indian luxury buyers distinguish between premium claims and premium proof. The specific material details — the veining in the marble, the slab-to-slab glass, the ceiling height you can feel — are the proof that a specification sheet can state but only photography can make real.",
      },

      typography: {
        bad:          "PROJECT NAME. 'Where Luxury Meets Life.' Starting from ₹X Cr. 3/4 BHK Available.",
        whyBad:       "'Where Luxury Meets Life' is one of the most overused real estate taglines in India. Starting price in the launch advertisement anchors price comparison before aspiration is established.",
        good:         "Project name in editorial weight. One aspirational headline without tagline clichés. Site visit CTA. No price in the launch advertisement.",
        goldStandard: "Project name at 22% visual weight in the upper zone — premium weight, generous tracking. One headline at 18%: 'The home you have been composing in your mind for a decade.' No price. No BHK count. No starting from. Developer credential at 8%: 'By [Developer] · [Established Year]' — the credential is the longevity, not the marketing claim. Site visit CTA at 12%: 'Register for a private site visit'. Nothing else.",
        why:          "'The home you have been composing in your mind for a decade' speaks to the long-term aspiration of the premium Indian home buyer who has been planning this purchase for years. It communicates that this developer understands the buyer's internal journey — which is the highest form of marketing empathy.",
      },

      layout: {
        bad:          "Large building render. All amenities listed. Price range. Floor plan inset. Multiple CTAs.",
        whyBad:       "Amenity lists and floor plans in launch advertising create a comparison shopping frame. Premium residential launches should not be compared — they should be experienced.",
        good:         "Aspiration image dominant. Project name and aspirational headline. Private site visit CTA. Developer credential. No amenity list in launch advertising.",
        goldStandard: "Aspiration image (65%): woman in the empty apartment with golden hour light. Upper zone (20%): project name and aspirational headline. Lower zone (15%): developer credential left; 'Register for a private site visit' CTA centre; location indicator right. No price, no amenity list, no floor plan, no multiple CTA options. One clear journey: aspire → identify → register to experience.",
        why:          "Premium real estate advertising that removes price and specification from the launch advertisement creates a site visit request from a buyer who has already decided they want this life, not a buyer who wants to compare specifications.",
      },

      commercialDetails: {
        bad:          "Starting ₹2.5 Cr. 2/3/4 BHK. RERA Approved. Limited units. Call for price.",
        whyBad:       "Price in launch advertising creates price anchoring before aspiration is established. 'RERA Approved' is a legal minimum, not a trust signal. 'Call for price' communicates sales pressure before relationship is established.",
        good:         "RERA registration number only — legal compliance without 'RERA Approved' claim. Private site visit registration. Developer's completed project count as credential.",
        goldStandard: "Developer credential: 'X million sq ft delivered across [city]' — scale communicates that this developer has honoured commitments at scale. RERA registration number in the footer — present for legal compliance, not highlighted as a selling point. Private site visit: 'Register for an exclusive preview of the show apartment' — 'exclusive preview' and 'show apartment' communicate scarcity and quality without stating them. No price. No BHK count. No 'call for best price' — this communication is not a price negotiation, it is an introduction.",
        why:          "The 'exclusive preview of the show apartment' framing converts site visit registrations at a higher rate than 'site visit' because it communicates that the experience of visiting this project is itself premium — not a sales appointment, but a private experience.",
      },

      negativeSpace: {
        bad:          "All frame space used for renders, amenity icons, price ranges, and testimonials.",
        whyBad:       "Dense information in premium real estate advertising creates the anxiety of a purchase decision, not the aspiration of a lifestyle change. The buyer stops imagining and starts calculating.",
        good:         "The aspiration image has breathing room. The project name is surrounded by space communicating premium restrained confidence. The CTA is the only commercial element.",
        goldStandard: "The aspiration image has a 6% margin on all sides within the image zone — the frame itself communicates that what is inside it is worth contemplating. The project name in the upper zone has 10% space above it and 6% below — it stands alone. Between the project name and the image: 5% breathing space. The lower zone contains only the developer credential, CTA, and location. Total visual impression: vast, considered, confident. The negative space is proportional to the premium of the product.",
        why:          "Premium real estate buyers make large, emotionally significant purchases. A layout that communicates space and restraint signals that the developer understands this gravity. Dense layouts communicate sales urgency — which is the wrong emotional frame for a ₹2.5 Cr+ decision.",
      },

      marketingPsychology: {
        bad:          "Luxury living. Premium lifestyle. Your dream home.",
        whyBad:       "Generic premium language has been used so many times in Indian real estate advertising that it produces no emotional response. 'Dream home' specifically has become a cliché that communicates routine aspiration.",
        good:         "Ownership imagination: the woman in the space activates the buyer's specific version of this life. Longevity validation: the developer's track record communicates that this aspiration will be delivered. Private exclusivity: site visit framing communicates that not everyone can access this.",
        goldStandard: "Specific ownership imagination: the woman looking at the corner where the reading chair will go activates the buyer's own version — the home office corner they have planned, the kitchen island they have been researching, the bedroom that will finally have room for the wardrobe they want. Longevity signal: the developer's completed projects communicate that this specific builder delivers — the most important trust signal in Indian real estate where delivery failure has created widespread buyer anxiety. Exclusivity mechanism: 'private preview' for 'registered buyers' communicates that access to this opportunity is curated.",
        why:          "The primary conversion barriers in Indian premium real estate are delivery anxiety (will this be built?) and aspiration activation (can I see my life in this space?). The advertisement must address the aspiration barrier while the developer's track record addresses the delivery barrier.",
      },

      antiPattern: {
        bad:          "CG render of the building. 'Best luxury project in [city]' self-claim. Bollywood celebrity in the apartment. Price starting 'only' ₹X Cr. 'Last few units' artificial scarcity.",
        whyBad:       "CG renders communicate the future at the expense of the present aspiration. Self-proclaimed superlatives are dismissed. Celebrity in the apartment creates identification with the celebrity rather than the buyer. 'Only' before a price cheapens the product. 'Last few units' is so overused in Indian real estate that it creates no urgency.",
        good:         "Real photography of the space with natural light and a real person. No self-proclaimed superlatives. Developer's verified track record as the only credential. No price. No artificial scarcity.",
        goldStandard: "The premium real estate launch advertisement that converts shows a real apartment (or show apartment photographed as real) with real golden-hour light and one real person imagining their ownership of it. The developer is identified by their track record. There is no render, no celebrity, no superlative claim, no price, and no artificial scarcity. The advertisement makes one promise: 'this life exists and you can access it by registering for a private visit'. That promise, made with beautiful photography and restrained confidence, converts the buyer who has been planning this purchase for a decade.",
        why:          "Premium Indian buyers who can afford ₹2.5 Cr+ residential projects have sophisticated advertising literacy — they instantly identify renders, artificial scarcity, and manufactured celebrity endorsements. The only thing that converts this buyer is beauty, specificity, and the confidence to present the product without pressure. Pressure communicates that the product cannot sell itself.",
      },

      conversionInsight: "Luxury residential site visits convert when the buyer can imagine a specific life inside a specific space. The woman planning her reading chair corner triggers that specific imagination. Remove the price. Remove the amenity list. Present the life. The site visit follows.",
    },

    {
      type: "affordable_homes",
      tags: ["affordable", "first home", "home loan", "emi", "first time buyer", "apartment", "flat", "bhk", "ready to move", "rera"],
      goal: "Drive site visits and loan inquiry among first-time Indian home buyers who are making the most emotionally significant purchase of their lives.",
      audience: "Indian families aged 26–40, dual-income or single-income, making their first home purchase with financial stretch and significant emotional investment.",

      heroSubject: {
        bad:          "Happy family at the entrance of their new home.",
        whyBad:       "The entry-photo is the most photographed moment in Indian real estate advertising and communicates nothing specific about why this project is worth the financial stretch.",
        good:         "A daughter spinning in the centre of an empty room while her parents watch from the doorway — the child's joy before the parents' relief.",
        goldStandard: "An Indian girl of about seven spins in the centre of what is about to become her bedroom — arms outstretched, eyes closed, that specific joy of open space that children have in new rooms before furniture arrives. In the doorway behind her, her parents stand side by side watching. The father has his arm around the mother. She has her hand on his chest. They are not looking at the room. They are looking at their daughter. This is the moment they have been working toward.",
        why:          "The daughter's joy before the parents look at her — the parents watching the child discover what their sacrifice has created — is the most emotionally powerful first-home image available. It communicates that the purchase's value is not the flat; it is what happens in it.",
      },

      visualHierarchy: {
        bad:          "Project name. 2BHK/3BHK. Starting ₹X lakh. Bank loan available. RERA approved.",
        whyBad:       "Specification-first hierarchy communicates financial transaction rather than life milestone. First-home buyers are not specification-comparing — they are life-imagining. The purchase decision is emotional first; the specification is the validation.",
        good:         "Family moment 50%, space quality 25%, financial accessibility 15%, project credentials 10%. Emotion before finance.",
        goldStandard: "P1 Daughter spinning, parents watching (45%) — the life that the home makes possible. P2 Empty room — light, proportion, the potential (25%) — proof of the space. P3 One financial accessibility signal (15%): 'EMI from ₹X/month' or 'Home loan assistance'. P4 RERA registration and developer track record (10%). P5 Site visit CTA (5%).",
        why:          "First-home buyers are experiencing a milestone, not a transaction. The hierarchy that presents the milestone first creates an emotional commitment to visiting the site. The financial information validates the decision the buyer has already emotionally made.",
      },

      composition: {
        bad:          "Split frame: exterior on left, interior on right. Project details overlaid.",
        whyBad:       "Split-frame layouts communicate comparison rather than aspiration — the buyer is being asked to evaluate two pieces of information simultaneously, which prevents the single emotional identification that drives site visits.",
        good:         "The spinning daughter at the centre of the room, parents framed in the doorway. The room's proportion visible around the spinning child. Light from one window catching the movement.",
        goldStandard: "The daughter occupies the centre of the frame, arms outstretched, the spinning motion creating a slight blur at the edges of her figure. She is surrounded by the empty room — floor, walls, ceiling all visible, communicating proportion without measurement. The doorway at the rear of the frame contains the parents: two silhouettes close together, watching. The window at the left side of frame casts afternoon light across the floor at her feet. Reading flow: spinning daughter → the room around her → the parents watching → the window light → the life this space will hold.",
        why:          "The spinning child at the centre of the frame creates movement in a still image — the image communicates life happening in this space before any furniture or possession is in it. That movement is the advertisement's most powerful visual claim.",
      },

      photography: {
        bad:          "Interior photography with natural light. Family in the apartment.",
        whyBad:       "Standard interior photography communicates space, not life. The family in an apartment without emotional direction communicates generic residential advertising.",
        good:         "35mm wide at standing level. Afternoon light from one window. The spinning moment caught in motion — slight blur at the child's hands and dress hem. Parents in soft focus at the doorway.",
        goldStandard: "35mm wide lens at standing adult level — the perspective of entering a room and seeing what is happening in it. 1/60s shutter — fast enough to capture the child's face, slow enough to communicate the spin as motion rather than freeze it. Afternoon window light from the left side, creating a pool of warm light that the spinning child moves through. Parents in the doorway: 70% soft focus but their posture and closeness fully readable. No artificial fill light — only the apartment's own afternoon light.",
        why:          "1/60s shutter speed for a spinning child creates the specific blur that communicates movement without creating a chaotic image. The child's face is sharp; the dress hem is blur. This is the decisive photographic moment — the visual equivalent of hearing a sound that made you stop.",
      },

      subjectDirection: {
        bad:          "Family standing at the building entrance, key in hand, smiling.",
        whyBad:       "The key-handover photograph has been performed by every real estate developer in India for thirty years. It communicates 'we do this many times' rather than 'this is the only time this matters for this family'.",
        good:         "Daughter spinning independently — not directed to spin, but caught in the natural behaviour of a child in a new empty room. Parents watching, directed not to look at each other or the camera, only at their daughter.",
        goldStandard: "The daughter is genuinely spinning — the direction is 'this is your room, it's empty, you can do whatever you want in it'. The spinning is real, not posed. Her eyes are closed, which means she has done this before in their small rented flat and this room finally has the space for it. The parents are directed to 'watch her and not speak' — their silence is what communicates the weight of this moment. The father's arm around the mother's shoulder tightens slightly as they watch. This tightening is the advertisement's emotional peak.",
        why:          "The father's arm tightening is the detail that makes this family real. It is the involuntary physical response to a moment of arrival — the specific gesture of a person experiencing something they have worked for over years. This cannot be directed; it must be captured.",
      },

      environment: {
        bad:          "New apartment with standard finishes.",
        whyBad:       "Standard finishes communicate minimum standard, not aspiration. The first-home buyer needs to see a space they are proud of — not just a space that meets specifications.",
        good:         "A well-proportioned room with quality light, clean walls, and an evident standard of construction. The room communicates 'this is a serious place to build a life', not just 'this meets code'.",
        goldStandard: "A 2BHK apartment room with proportions that communicate space even when empty: 3-metre ceiling, large window with a quality frame, walls smooth and cleanly finished, tile floor with a subtle pattern that elevates without being flashy. A cardboard moving box in the corner — the family is in the first hour of possession. The box communicates that this is real possession day, not a showroom. Outside the window: other rooftops or green trees — not a highway or an industrial estate. The view communicates that the neighbourhood is liveable.",
        why:          "The cardboard moving box in the corner is the single most powerful authenticating detail in affordable housing photography. It communicates 'this is real possession day, for a real family, in a real apartment' — separating this advertisement from the staged show-flat photography that every buyer has learned to distrust.",
      },

      typography: {
        bad:          "YOUR DREAM HOME AWAITS. 2BHK @ ₹45 Lakhs. Limited Units. Call Now.",
        whyBad:       "'Your Dream Home Awaits' is among the five most used real estate headlines in India and converts no one. Price as the headline creates price-comparison evaluation rather than aspiration activation.",
        good:         "One emotional milestone headline. EMI framing rather than price framing. RERA number. Bank approvals. Site visit CTA.",
        goldStandard: "Headline at 20% visual weight: 'The room she's been waiting for.' — addressing the specific emotion of parents purchasing their first home for their children's future. RERA number prominently below at 10% — first-home buyers are specifically attuned to RERA after decades of delivery failure in Indian affordable housing. EMI framing at 12%: 'EMI from ₹18,000/month — approved by 12 banks' — this makes the financial stretch feel manageable and validated. Site visit CTA at 12%: 'Visit this Sunday — families welcome'.",
        why:          "'The room she's been waiting for' makes the purchase personal — this room is for her. The child is the conversion trigger. RERA number communicates delivery credibility — the primary barrier in the affordable segment. 'Families welcome' at the site visit CTA communicates that the visit experience will be appropriate for the decision-makers (the whole family), not just the bread-winner.",
      },

      layout: {
        bad:          "Multiple flat images. All specifications. Price chart. Floor plan. CTA.",
        whyBad:       "Specification-dense layouts convert into comparison spreadsheets rather than aspiration journeys. First-home buyers who enter comparison mode are easily lost to competitors with better specifications at lower prices.",
        good:         "Family milestone image dominant. Emotional headline. EMI framing. RERA number visible. Site visit CTA. One floor plan option at smaller scale if needed.",
        goldStandard: "Family milestone image (60%). Upper zone (20%): emotional headline right-aligned; RERA number in the upper-left corner at 8% size — present, credible, non-dominant. Lower zone (20%): EMI framing left; site visit CTA centre ('Visit this Sunday — families welcome'); bank approval logos right at reduced scale. If a floor plan is required: at the very bottom margin at 15% of total frame area, clearly labelled but visually subordinate. The layout communicates: 'this life first; the details are available when you visit'.",
        why:          "The RERA number in the upper-left corner (not the upper-right) is a specific layout decision: it communicates legal seriousness without being the first element the eye encounters. The buyer sees the family first, then the headline, then registers the RERA number as they scan. This order creates emotional buy-in before legal validation.",
      },

      commercialDetails: {
        bad:          "Free parking. Club house. Kids play area. Bank approvals. Stamp duty discount.",
        whyBad:       "Amenity lists in first-home advertising create feature comparison rather than life aspiration. 'Stamp duty discount' communicates financial urgency that undermines the milestone framing of the purchase.",
        good:         "RERA registration number prominently. Bank approvals with bank logos. EMI figure calculated at current rates. Possession date stated clearly if confident.",
        goldStandard: "RERA number: '[RERA-XXXXX]' — the number itself, not the 'RERA Approved' badge, because the number is specific and therefore credible where the badge is generic. Bank approval logos: 5–6 recognisable Indian banks displayed at small scale — their presence communicates that institutional due diligence has been done. Possession: 'Ready to move in — no waiting' (if true) or '[Month Year] possession — RERA committed'. EMI: '₹18,000/month for 20 years at current rate — pre-qualified at 8 banks'. Everything is specific, verifiable, and calibrated to address first-home buyer anxiety about delivery, financing, and commitment.",
        why:          "First-home buyers have three specific anxieties: will this be built, can I afford it, and will the bank approve me. The commercial details zone must address all three in order of their anxiety priority: RERA addresses delivery, bank approval addresses institutional validation, EMI figure addresses affordability perception.",
      },

      negativeSpace: {
        bad:          "Maximum frame usage with all information visible without scrolling.",
        whyBad:       "Dense layouts for first-home advertising create the anxiety of a financial decision rather than the emotion of a life milestone. The buyer enters calculation mode instead of aspiration mode.",
        good:         "The family moment has generous breathing room. The headline has space to be read slowly. The lower zone is orderly but not crowded.",
        goldStandard: "The family milestone image has 5% breathing margin within the image zone — enough to give the spinning child visual air. The headline in the upper zone sits with 8% space above it. Between the image and the lower zone: 4% clear. The lower zone groups all commercial details with comfortable 6% internal spacing — no element crowds its neighbour. The spinning child's outspread arms should never be cropped or visually interrupted by text elements. The visual breathing room communicates that this purchase, while financially significant, is a milestone worth taking a moment to feel.",
        why:          "First-home buyers are making a 20-year financial commitment. A layout that gives them visual breathing room communicates that this developer respects the weight of that commitment — which is itself a trust signal in a market where developers have historically rushed buyers through decisions.",
      },

      marketingPsychology: {
        bad:          "Your dream home. Affordable luxury. Invest in your future.",
        whyBad:       "These phrases activate no specific emotional state. They are universal claims with no specific trigger for the first-home buyer's actual emotional experience.",
        good:         "Legacy creation: 'the room for the life you're building'. Delivery credibility: RERA + bank approvals address the primary fear. Financial clarity: specific EMI makes the stretch feel manageable.",
        goldStandard: "Legacy psychology: first-home buyers are not purchasing square footage — they are purchasing the specific version of their family's future that involves a child with her own room, a kitchen that is theirs, a building with their name on the ownership documents. The spinning daughter activates this legacy motivation directly. Delivery credibility: the RERA number and bank approvals address the deep-seated anxiety of Indian first-home buyers whose parents or neighbours experienced developer defaults. Financial clarity: the specific EMI figure converts 'I can't afford this' into 'this is ₹18,000 more than rent' — a comparison the buyer can make.",
        why:          "The first-home buyer's decision is governed by fear of two things: financial overreach and delivery failure. Every commercial element of the advertisement must address one of these fears while the creative element activates the emotional motivation that makes the fear worth overcoming.",
      },

      antiPattern: {
        bad:          "CG render of the building. Bollywood celebrity inaugurating. '20% down payment, rest easy'. 'Last 5 units'. Identical flat photos without human context.",
        whyBad:       "CG renders communicate that the real product is unavailable. Celebrity inauguration communicates marketing spend, not construction quality. '20% down, rest easy' communicates financial pressure. 'Last 5 units' creates artificial urgency that first-home buyers, after years of developer manipulation, have learned to distrust completely.",
        good:         "Real photography of the actual apartment. No celebrity. No artificial scarcity. Honest financial framing. RERA number prominent. A real family in a real moment.",
        goldStandard: "The affordable housing advertisement that builds genuine trust shows a real apartment with real light and a real family in a real possession-day moment. The RERA number is the first credential, not the last. The EMI is calculated honestly at current rates, not a teaser rate. There is no 'last X units' language. There is no CG render. There is no celebrity. There is one family, one spinning child, and the communication that this developer builds homes that create this moment. That is the only claim this advertisement makes — and it is the only claim that converts a first-home buyer who has been waiting, working, and planning for this purchase for years.",
        why:          "The first-home buyer has been burned by developer promises, CG renders that didn't match reality, and celebrities endorsing projects they have never visited. The advertisement that has no render, no celebrity, no manufactured urgency, and one honest human moment converts because it looks nothing like what they have learned to distrust.",
      },

      conversionInsight: "First-home site visits convert when the buyer can imagine their child discovering their own room. The spinning daughter image plants that imagination. The RERA number and EMI figure give the buyer permission to act on it. Show the moment; provide the credibility; make the site visit easy.",
    },

  ],
};
