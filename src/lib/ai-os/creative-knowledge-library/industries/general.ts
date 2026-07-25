// Creative Knowledge Library — General (fallback for unmatched industries)

import type { IndustryKnowledge } from "../types";

export const general: IndustryKnowledge = {
  id:    "general",
  label: "General",
  campaigns: [

    {
      type: "brand_launch",
      tags: ["brand", "launch", "new", "business", "startup", "company", "service", "product", "announce", "introducing"],
      goal: "Drive brand awareness and first inquiries by communicating the specific human transformation the brand enables, not the business's features or origin story.",
      audience: "Indian adults who are encountering this brand for the first time and have no specific prior category need activated.",

      heroSubject: {
        bad:          "Founder standing in front of their business. Logo prominent. 'We are open' announcement.",
        whyBad:       "Founder-in-front-of-business photography communicates 'we exist' — which is the minimum information and not a conversion motivation. No new customer chooses a business because it has a founder who stands in front of it.",
        good:         "A real customer at the specific moment the business's value becomes evident — the first use, the first result, the first time the product does what the business promised.",
        goldStandard: "The first customer's first experience of the business's core value: a real Indian person at the exact moment the product or service delivers on its promise. Not the founder, not the team, not the building — the customer, at the moment of value delivery. Specific and real: an elderly woman holding a document that her phone just helped her fill out. A teenager whose glasses order just arrived, holding them up to the light. A small shop owner looking at his first digital order notification. The specific moment the business matters to one person.",
        why:          "Brand launch advertising that leads with customer value delivery converts at higher rates than brand launch advertising that leads with founder story because it answers the only question the new customer has: 'what will this business do for me specifically?'",
      },

      visualHierarchy: {
        bad:          "Logo dominant. 'Now Open'. Brand colours. Contact information.",
        whyBad:       "'Now Open' is announcement advertising. It communicates existence without communicating reason. A new customer does not visit a business because it announced that it opened — they visit because the business communicated something that matters to them.",
        good:         "Customer's value delivery moment 50%, the business context that makes it possible 25%, brand name and one benefit statement 15%, inquiry or visit CTA 10%.",
        goldStandard: "P1 Customer's specific moment of value delivery (45%) — the reason to choose this business. P2 The environment where the value is delivered (25%) — the business context communicating quality and reliability. P3 Brand name at 15% — present and confident. P4 One benefit statement (10%): the specific thing this business does better than alternatives. P5 Inquiry CTA (5%).",
        why:          "When customer value delivery dominates over logo and announcement, the advertisement communicates 'here is what will happen when you come here' rather than 'here is that we are here'. The first communicates motivation; the second communicates existence.",
      },

      composition: {
        bad:          "Business exterior. Team photo. Product grid on white background.",
        whyBad:       "Business exterior communicates real estate. Team photos communicate the business's internal perspective. Product grids communicate catalogue. None of these communicates the customer's experience.",
        good:         "The customer at the moment of value delivery: close enough to see the expression, wide enough to see the context, composed to communicate the specific experience.",
        goldStandard: "50mm at customer level — the perspective that places the viewer in the position of the customer experiencing the value. The customer occupies the primary zone of the frame. The business context — the physical space, the product, the service being delivered — is visible in the peripheral frame without being the compositional anchor. The customer's expression is the compositional anchor. Reading flow: customer's expression → the specific value being delivered → the business context that made it possible.",
        why:          "Camera at customer level is the compositional choice that communicates 'this advertisement is about the customer's experience' rather than 'this advertisement is about the business's existence'. The angle alone communicates whose story this is.",
      },

      photography: {
        bad:          "Professional brand photography. Perfect lighting. Posed team or product shots.",
        whyBad:       "Professional brand photography with perfect lighting communicates advertising budget rather than customer experience. Indian consumers have become sophisticated at distinguishing between 'business advertising their existence' and 'business communicating genuine customer value'.",
        good:         "Documentary-style photography of the customer's real experience: available light, real environment, the authentic expression of someone experiencing genuine value.",
        goldStandard: "50mm lens in the business's real environment. Available light — whether that is the natural light of the business's physical space or the artificial light of its operating environment. 1/80s shutter — slightly loose, communicating real life rather than photoshoot. The colour temperature of the real environment, not corrected to a brand aesthetic. The image communicates: 'this is what it actually looks like when a customer experiences what this business provides'.",
        why:          "Documentary photography for brand launch advertising is more conversion-effective than professional brand photography because it communicates honesty — 'this is what you will actually experience here' — which is the primary trust signal for a customer evaluating a brand they have not encountered before.",
      },

      subjectDirection: {
        bad:          "Customer smiling at camera, giving thumbs up. Founder explaining product to camera.",
        whyBad:       "Camera-directed customer satisfaction smiles and thumbs-ups communicate performed satisfaction rather than authentic value delivery. Founder explanation communicates sales pitch rather than customer experience.",
        good:         "Customer directed to experience the business's core value and photographed at the moment the value is evident — not at the camera, at the value.",
        goldStandard: "The customer is not directed to acknowledge the camera. They are directed to do the thing the business enables — to hold the document, to try on the glasses, to read the notification. The photograph is taken at the moment the value registers in their expression. The expression is not directed — it arrives from the experience. Whatever it is — satisfaction, relief, surprise, quiet pleasure — that expression is the business's most honest advertisement.",
        why:          "Undirected authentic response to genuine value delivery is the most powerful brand launch advertising image available because it is the only genre that cannot be replicated by a competitor — it requires actually delivering value to a real customer and capturing the real response.",
      },

      environment: {
        bad:          "Generic commercial space. White walls. Branded elements prominent.",
        whyBad:       "Generic commercial spaces are indistinguishable from each other. Branded elements prominent in the environment communicate brand over customer experience.",
        good:         "The real environment where the business delivers its value: specific, honest, with the specific details that communicate the business's approach and quality.",
        goldStandard: "The actual physical or digital environment where the business operates: the specific quality of the space, the specific organisation of the products or services, the specific details that communicate how this business approaches its work. One detail that communicates quality or care: the handwritten label on a product, the precisely organised service station, the clean and specific interface on a screen. The environment communicates the business's standard through detail rather than through announcement.",
        why:          "Environmental detail communicates business quality more efficiently than any claim. A handwritten label on a product communicates care. A precisely organised service station communicates professionalism. These details require no copy — they communicate directly through the evidence of how the business operates.",
      },

      typography: {
        bad:          "Business Name. Tagline. 'Now Open'. Contact number. Visit us at [address].",
        whyBad:       "'Now Open' is the minimum possible headline — it communicates existence without reason. Taglines that describe the business category ('Your trusted [category] partner') communicate no differentiation.",
        good:         "One specific benefit headline that names what the customer gets. Business name at appropriate hierarchy. One differentiator. Contact or visit CTA.",
        goldStandard: "Headline at 20% visual weight: one specific benefit — not a category description but a specific outcome: 'Glasses that fit your face. Ready in an hour.' or 'Documents filled, forms filed, fees paid — without the queue.' or 'The tailor who remembers your measurements'. Business name at 14%. One differentiator at 10%: the specific thing this business does that the customer could not easily get elsewhere. CTA at 14%: 'Visit us' or 'Call to book' or 'WhatsApp us' — whichever is most natural for the specific business type.",
        why:          "The specific benefit headline — 'glasses that fit your face, ready in an hour' — converts new customers at higher rates than category headlines ('your vision care partner') because it answers the specific question 'what will I get?' with a specific answer that creates immediate motivation.",
      },

      layout: {
        bad:          "Exterior of business prominent. Logo dominant. Multiple service offerings listed. Contact details in multiple formats.",
        whyBad:       "Business exterior as the primary visual element communicates real estate advertising. Multiple services listed create choice paralysis before any specific motivation is established. Multiple contact formats suggest that the business is uncertain how to be reached.",
        good:         "Customer value moment dominant. One specific benefit headline. Business name. One primary contact or visit CTA.",
        goldStandard: "Customer value moment image (65%). Upper zone (20%): specific benefit headline; business name below at smaller weight. Lower zone (15%): one specific differentiator left; primary CTA centre (WhatsApp / call number / visit address — one only); area indicator right if relevant. No multiple service listing, no multiple CTAs. The layout communicates: we do one thing for you specifically, and here is how to get it.",
        why:          "Brand launch advertisements that communicate one specific benefit and provide one specific action path convert new customers at higher rates than advertisements that list multiple services — because the new customer who does not know the business cannot evaluate a service list but can respond to a specific benefit.",
      },

      commercialDetails: {
        bad:          "Affordable prices. Quality guaranteed. Customer satisfaction our priority. Open 7 days a week.",
        whyBad:       "These four claims are made by every business in every category. They communicate baseline expectation rather than specific differentiation. 'Customer satisfaction our priority' is particularly dismissed by Indian consumers who have been told this by businesses that did not deliver.",
        good:         "One specific differentiator that is honest and verifiable. One specific quality signal. One specific accessibility detail (hours, location, contact method). No generic quality or satisfaction claims.",
        goldStandard: "One specific differentiator: 'Same-day service for orders placed before 2 PM' (if true) or 'No appointment needed — walk in any time' (if true) or 'WhatsApp us your requirements — we'll reply in 15 minutes' (if true). One quality signal: one specific detail that communicates the business's approach to quality — a material, a process, a standard. Contact: the single most natural contact method for this business's customers — WhatsApp for most Indian consumer businesses. No generic quality claims. Every word in the commercial details zone must be specific and verifiable.",
        why:          "Specific, verifiable commercial details for a new brand convert new Indian customers at higher rates than generic quality claims because they demonstrate that the business knows what it is actually offering rather than claiming to offer everything to everyone. 'Same-day service for orders before 2 PM' is trusted; 'fast service' is dismissed.",
      },

      negativeSpace: {
        bad:          "All space used for business information, service listing, and multiple contact methods.",
        whyBad:       "Dense brand launch advertising communicates a business that is uncertain about its primary offer and is therefore listing everything. This communicates lack of confidence in a specific value proposition.",
        good:         "The customer value moment has breathing room. The specific benefit headline is weighted and isolated. The CTA is singular and clear.",
        goldStandard: "The customer value moment image has 5% breathing margin within the image zone. The specific benefit headline in the upper zone has 8% space above it — this claim deserves a moment of consideration from the new customer. Between headline and image: 4%. The lower zone contains three elements maximum with 8% internal spacing. Total impression: this business knows what it offers and is confident that one clear communication is sufficient.",
        why:          "Brand launch advertising with generous negative space communicates business confidence — the confidence of a business that knows its specific value and trusts one clear statement to communicate it. This confidence is itself a trust signal for the new customer evaluating an unknown brand.",
      },

      marketingPsychology: {
        bad:          "Experience the difference. Quality you can trust. We're here for you.",
        whyBad:       "Abstract quality claims activate no specific desire and create no specific motivation to act. Indian consumers have been told 'experience the difference' by hundreds of businesses and experienced no difference from any of them.",
        good:         "Specific outcome psychology: name the specific outcome the customer will experience. First-time customer anxiety resolution: communicate what the first experience will feel like. Social proof if available: other real Indian customers who have already chosen this business.",
        goldStandard: "Specific outcome psychology: the new Indian customer's primary question is 'what will I actually get?' The advertisement that answers this with a specific, honest answer creates more motivation than any abstract quality claim. First-time anxiety resolution: communicating the ease of the first experience — 'walk in any time', 'WhatsApp us your requirements', '15-minute response' — reduces the risk-perception of trying a new business. Honest social proof: one real customer's real experience is more conversion-powerful than any general quality claim.",
        why:          "Indian consumers evaluating an unknown brand are primarily asking one question: 'Can I trust this business to deliver what it claims?' The advertisement that answers with specificity rather than generality — one honest specific outcome, one honest specific process detail — converts this trust-evaluation at higher rates than abstract quality language.",
      },

      antiPattern: {
        bad:          "Logo as the hero element. Generic 'We are the best' language. Multiple service categories listed. Stock photography of international-looking people. No specific CTA.",
        whyBad:       "Logo as hero communicates institutional advertising for established brands — not appropriate for launch. 'Best' claims are dismissed. Multiple categories create no specific motivation. International stock photography creates identification distance for Indian consumers. No specific CTA leaves the motivated new customer without an action path.",
        good:         "One real Indian customer at one specific value delivery moment. One specific benefit headline. Business name. One honest differentiator. One specific contact or visit CTA.",
        goldStandard: "The brand launch advertisement that converts new Indian customers shows one real Indian person experiencing the specific value this business provides, at the specific moment the value is evident. It has one specific benefit headline — not a category description but a specific outcome. It has one honest differentiator. It has one specific contact method. It does not claim to be the best; it communicates what it actually does for one specific person. The new customer reads it and thinks: 'This is the business that does [specific thing] — I need [specific thing] — I should contact them.' That thought is the only conversion required.",
        why:          "Brand launch advertising converts new customers when it creates a clear and specific connection between the customer's specific need and the business's specific capability. Generic quality language creates no connection. One specific outcome for one specific person, photographed honestly, headlined specifically — this creates the connection that produces the first inquiry.",
      },

      conversionInsight: "New customers choose a new brand when they can answer one question: 'What specifically will this business do for me?' The customer at the moment of value delivery answers this question through image. The specific benefit headline answers it through words. The single WhatsApp or call CTA makes acting on the answer immediate. These three elements, together, are a complete brand launch advertisement.",
    },

  ],
};
