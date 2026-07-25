// Creative Knowledge Library — Financial Services

import type { IndustryKnowledge } from "../types";

export const financialServices: IndustryKnowledge = {
  id:    "financial_services",
  label: "Financial Services",
  campaigns: [

    {
      type: "insurance",
      tags: ["insurance", "life insurance", "term plan", "family protection", "cover", "protection", "policy", "premium", "nominee"],
      goal: "Drive insurance policy inquiry and purchase by making protection feel personally relevant, not abstractly responsible.",
      audience: "Indian salaried or self-employed men aged 28–45 who are primary earners with dependents — the person who hasn't yet bought insurance but knows they should.",

      heroSubject: {
        bad:          "Happy family photo. Father and children playing.",
        whyBad:       "Generic happy family imagery communicates a life insurance advertisement to Indian viewers immediately — they have been shown this image thousands of times and respond with recognition and inaction.",
        good:         "An Indian father late at night at his laptop, school bag visible, family sleeping in the background. He is doing the one financial act that makes him feel genuinely responsible.",
        goldStandard: "An Indian father in his mid-30s sits at his desk at 11:30 PM. On the screen: a premium calculator showing a monthly premium amount and a cover amount. His right index finger is touching one specific number on the screen — not the premium, the cover amount. He is calculating what this number means. Behind him, barely visible in the dark: the family's bedroom door is slightly open. From inside: the soft sounds of people sleeping. His school bag is on the chair beside him — it was a long day, and he is still at the desk.",
        why:          "The father touching the cover amount rather than the premium is the single most specific and honest insurance moment in advertising. He is not thinking about what it costs him — he is thinking about what it provides them. That is the emotional truth of insurance purchase.",
      },

      visualHierarchy: {
        bad:          "Insurance company logo. Policy name. 'Protect Your Family'. Premium amount. Buy now.",
        whyBad:       "Logo-first hierarchy communicates institutional advertising. 'Protect Your Family' is the most used insurance headline in India and produces recognition, not action.",
        good:         "Father's private calculation moment 50%, family presence (sleeping) 25%, one specific number (cover amount) 15%, brand and CTA 10%. The human act before the commercial product.",
        goldStandard: "P1 Father at desk, index finger on the cover number (45%) — the responsible act. P2 The laptop screen with the number he is touching (25%) — the specific financial decision. P3 Family presence in background (20%) — who this decision is for. P4 Brand name (5%). P5 'Get a quote in 2 minutes' CTA (5%).",
        why:          "When the father's private calculation moment dominates over the brand, the viewer identifies with the action rather than the advertisement. Insurance advertising that creates identification with the responsible act converts better than advertising that creates identification with the family photograph.",
      },

      composition: {
        bad:          "Family portrait. Insurance company overlaid. Premium figure. Buy now button.",
        whyBad:       "Family portrait + overlay is the format viewers have associated with insurance advertising for thirty years. It creates a pattern-recognition response — 'insurance ad' — that triggers the same mental dismissal every previous insurance advertisement received.",
        good:         "The desk scene: father in the right two-thirds, screen in the centre, family darkness in the left background. Light source is the laptop screen — the financial decision illuminates him.",
        goldStandard: "The father occupies the right two-thirds of the frame, at desk level. The laptop screen occupies the centre of frame at desk height — its light is the primary illumination source for the entire scene. The number he is touching sits at the golden ratio intersection of the frame. The left background: dark, the family bedroom door slightly open, barely visible. Reading flow: father's face, partially lit by the screen → his hand on the screen → the number he is touching → the darkness behind him where his family sleeps.",
        why:          "The laptop screen as the primary light source creates a visual metaphor: the financial decision illuminates the responsible man. The darkness behind him communicates everything the decision is protecting. This is composition communicating narrative without a single word.",
      },

      photography: {
        bad:          "Professional photography of father with family. Insurance policy visible. Happy and secure feeling.",
        whyBad:       "Professional lighting for a late-night insurance decision moment destroys the authenticity that makes the image resonate. Happy-and-secure feeling produces no action — the action comes from the uncomfortable truth.",
        good:         "Only practical light: the laptop screen illuminating the father's face and hands from below-front. The bedroom barely visible in darkness. 35mm lens at desk height.",
        goldStandard: "35mm lens at desk level — sitting across from the father at the desk, the perspective of the financial decision itself. Primary light: laptop screen glow, warm-white, casting shadows under his jaw and cheekbones. Secondary ambient: the faintest bedroom light from the partially open door behind. No additional lighting. 1/80s shutter speed — enough to capture the still desk scene with the slightly soft hands from micro-movement at 11 PM after a long day. The image is slightly underexposed by professional standards — which is exactly right for 11:30 PM.",
        why:          "The laptop screen as the only light source is the most authentic 11 PM working-father image in advertising because it is the only light that is actually present at 11 PM. Any additional lighting communicates 'photoshoot', breaking the identification.",
      },

      subjectDirection: {
        bad:          "Father holding child, looking into camera with confident smile.",
        whyBad:       "The confident-father-with-child directed at camera communicates aspiration achieved, not aspiration-in-process. Insurance converts when it speaks to the man who has not yet done the responsible thing — not the man who has.",
        good:         "Father at the screen, directed to look at one specific number on the screen and to touch it. His expression: not frightened, not relieved — the specific expression of someone understanding the weight of a number.",
        goldStandard: "The father is directed: 'You are looking at the amount your family would receive if you were not here. Your finger is touching that number. You are understanding what it means for the first time.' His expression is not grief — it is the quiet seriousness of someone doing a difficult calculation for a good reason. His other hand rests flat on the desk. He does not move for the photograph. This is the stillness of a man understanding something important.",
        why:          "The 'understanding a number for the first time' expression — quiet, serious, not distressed — is the most honest and most conversion-effective insurance subject direction. It communicates the responsible act being performed, not the comfortable outcome.",
      },

      environment: {
        bad:          "Home office. Modern setup. Family photos visible.",
        whyBad:       "Generic 'home office with family photos' is the most common insurance environmental cliché. It communicates the advertising category before communicating the human moment.",
        good:         "A real home desk at 11:30 PM: cold tea, school bag, papers from the working day, the laptop as the primary light source in an otherwise dark room.",
        goldStandard: "A real home desk in a middle-class Indian apartment: the surface has papers from the day, a phone charger with the phone on it, a cold glass of water, and the cold cup of tea that was made when the family went to bed and never drunk. The school bag on the chair beside him — he put it there after getting home. The wall behind him: no decor, just a cream wall in darkness. The apartment sounds: the ambient hum of the city, distant traffic, the complete silence of a sleeping family. The desk communicates: this man works hard, comes home tired, and is still here at midnight because this decision matters.",
        why:          "The cold cup of tea is the single most powerful environmental detail in insurance advertising. It communicates that this man has been at this desk since the family went to bed and has not stopped to finish his tea. That specific evidence of dedication converts.",
      },

      typography: {
        bad:          "SECURE YOUR FAMILY'S FUTURE. Term Insurance from ₹X/month. Buy Now.",
        whyBad:       "'Secure Your Family's Future' is the most used insurance headline in India and has been deprived of any emotional meaning through repetition. Price-first communicates the transaction before the motivation.",
        good:         "One honest specific headline about the act, not the outcome. Specific cover amount example. Simple inquiry CTA. No lifestyle headline clichés.",
        goldStandard: "Headline at 20% visual weight: '₹1 crore for your family. ₹X per month while you're here.' — this is the specific honest version of the insurance value proposition. Not a lifestyle claim. The specific numbers make it real. Brand name at 12% below. 'Calculate your cover in 2 minutes' CTA at 14% — specific, low-commitment, actionable. No 'Protect Your Family' language, no 'Peace of Mind' language — only the honest arithmetic of responsibility.",
        why:          "'₹1 crore for your family. ₹X per month while you're here.' is the most honest possible insurance headline because it states the transaction without euphemism. Indian insurance buyers who have been converting for decades respond to honesty about the arithmetic of coverage.",
      },

      layout: {
        bad:          "Large family photo. Policy name. 'Peace of Mind' tagline. Premium. CTA.",
        whyBad:       "'Peace of Mind' as the dominant message is what insurance companies use when they do not believe their product will convert on its own merits. It communicates abstract outcome rather than specific motivation.",
        good:         "Father's responsible act image dominant. Honest cover amount headline. Simple calculation CTA. Brand name. No family portrait, no abstract tagline.",
        goldStandard: "Responsible act image (60%). Upper zone (20%): honest cover amount headline — the arithmetic, not the lifestyle claim. Lower zone (20%): brand name left; 'Calculate your cover — 2 minutes' CTA centre; one specific credential right ('Claim settled in 7 days — guaranteed', or claims settlement percentage). No family portrait in the acquisition advertising. The father at the desk IS the family — through his act.",
        why:          "The claim settlement credential ('Claim settled in 7 days — guaranteed') is the highest-converting commercial detail in Indian life insurance advertising because it addresses the primary post-purchase anxiety: will my family actually receive the money when they need it? Addressing this anxiety in the acquisition advertisement converts the motivated buyer who has been hesitating on trust grounds.",
      },

      commercialDetails: {
        bad:          "Low premiums. High coverage. Tax benefits under 80C. Limited period offer.",
        whyBad:       "Every Indian term insurance provider lists these three benefits. They are table stakes, not differentiators. '80C tax benefit' communicates to the tax-saving buyer, not the family-protecting buyer — these are different buyers with different conversion triggers.",
        good:         "Specific claim settlement ratio. Claim settlement time. One specific cover amount at a specific premium — the arithmetic that makes the product real. Online purchase or application process.",
        goldStandard: "'₹1 crore cover for ₹X/month' — the specific arithmetic, not a starting-from. Claim settlement ratio: '98.7% claims honoured' — the specific percentage communicates competence. Claim settlement timeline: 'Average claim settled in 7 days' — communicates efficiency when the family needs it most. Online purchase available: '5-minute online application — no medical tests required' (if applicable). These four elements address the complete insurance decision: cost, coverage, reliability, and process.",
        why:          "Indian life insurance purchase decisions are primarily driven by two questions: Is this affordable? Will my family actually get paid? The commercial details zone must answer both questions with specific, verifiable numbers. Generic claims about reliability produce no action; specific numbers do.",
      },

      negativeSpace: {
        bad:          "Dense information layout with all policy benefits visible.",
        whyBad:       "Dense insurance information creates the calculation anxiety that causes Indian men to delay the insurance decision they have already made emotionally. The visual anxiety mirrors the decision anxiety.",
        good:         "The father's responsible act has breathing room. The cover amount headline is isolated and weighted. The CTA is the singular clear next step.",
        goldStandard: "The responsible act image has 4% breathing margin within the image zone — enough to let the laptop screen glow communicate the isolation of the late-night decision. The cover amount headline in the upper zone has 8% space above it — this number deserves a moment. Between headline and image: 4%. The lower zone CTA is the sole element, surrounded by 8% space — a clear, unambiguous next step. The overall visual weight of the layout communicates: this decision is important, unhurried, and specific.",
        why:          "Insurance advertising with generous negative space communicates that this product does not need to overwhelm the buyer with information — the honest arithmetic is sufficient. Restraint in insurance advertising communicates confidence in the product's value without the buyer having to interpret through marketing excess.",
      },

      marketingPsychology: {
        bad:          "Peace of mind for you and your family. Protect what matters most.",
        whyBad:       "These are abstract outcome claims that activate no specific emotional decision trigger in an Indian man who has been delaying this purchase.",
        good:         "Delayed responsibility activation: 'The one financial decision you keep meaning to make.' Arithmetic clarity: '₹1 crore cover. ₹X per month. 2 minutes to apply.' Specific barrier removal: no medical test required, online process.",
        goldStandard: "Delayed responsibility trigger: the specific Indian man who needs to buy insurance has been thinking about it for two to three years. He has not done it not because he doesn't believe in it but because the process feels complicated and the moment of 'now' never arrives. The father at his desk at 11:30 PM is the trigger image — the viewer recognises themselves. Arithmetic permission: the specific '₹1 crore for ₹X per month' headline converts the 'I can't afford it' objection into arithmetic — and the arithmetic is usually affordable. Barrier removal: '5-minute online process, no medical tests' eliminates the two primary process barriers that cause Indian men to delay insurance purchases.",
        why:          "The Indian man who needs life insurance has three specific barriers: procrastination ('I'll do it later'), cost anxiety ('it must be expensive'), and process fear ('it involves doctors and paperwork'). The advertisement must address all three simultaneously. The image addresses procrastination by showing the act being done. The headline addresses cost. The CTA and commercial details address the process.",
      },

      antiPattern: {
        bad:          "Child running to father in slow motion. 'Your Family Needs You.' Celebrity endorsement. '10X more coverage. Limited offer.' Bollywood background music implied in the static ad.",
        whyBad:       "Slow-motion child running is the emotional manipulation technique of a product that cannot convert on its value proposition. Celebrity endorsement in insurance communicates marketing budget rather than product trust. '10X coverage, limited offer' applies discount psychology to a protection product, undermining the gravity of the decision.",
        good:         "The responsible act at midnight. No slow-motion child. No celebrity. No limited offer. The honest arithmetic of coverage. The specific claim settlement credential.",
        goldStandard: "The insurance advertisement that converts shows one Indian man performing one specific financial responsibility act at the time when responsible men perform them — late at night, when the family is asleep. It shows the specific number he is calculating. It provides the specific arithmetic of the offer. It provides the specific credential of claim settlement. It asks for a 2-minute calculation, not a commitment. It has no celebrity, no emotional manipulation, no artificial urgency. It converts because it speaks the truth to the exact person who needs to hear it.",
        why:          "Indian life insurance advertising has been dominated by emotional manipulation and celebrity endorsement for thirty years — and the coverage gap in India remains enormous. The most underused conversion approach in Indian insurance advertising is honest arithmetic delivered to the specific man at the specific moment he is already thinking about this. Show him that moment. Speak the arithmetic. Convert.",
      },

      conversionInsight: "Insurance purchases convert at the moment the uninsured man recognises himself in the advertisement — the responsible man who has not yet done the responsible thing. The father at 11:30 PM touching the cover amount is that recognition moment. It converts because it is true.",
    },

  ],
};
