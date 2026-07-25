// Creative Knowledge Library — Jewellery & Luxury

import type { IndustryKnowledge } from "../types";

export const jewelryLuxury: IndustryKnowledge = {
  id:    "jewelry_luxury",
  label: "Jewellery & Luxury",
  campaigns: [

    {
      type: "bridal",
      tags: ["bridal", "wedding jewellery", "necklace", "bangles", "mangalsutra", "gold", "diamond", "bride", "wedding", "shaadi"],
      goal: "Drive in-store bridal jewellery consultation appointments in the 3–6 months before wedding season.",
      audience: "Indian brides-to-be aged 22–32 and their mothers, jointly making the highest-value jewellery purchase of their lives.",

      heroSubject: {
        bad:          "Indian bride wearing jewellery, looking beautiful.",
        whyBad:       "Bride-wearing-jewellery photography communicates the finished product without communicating the significance of the moment. Every jewellery brand has this image.",
        good:         "An Indian bride alone in a room with a large mirror, touching the necklace she has just put on for the first time — before calling family in to see.",
        goldStandard: "An Indian bride in her mid-20s stands alone before a large mirror in her preparation room. She has just placed the necklace on herself for the first time — a trial before the final choice is made. Her right hand has risen to touch it, not to adjust it, but to feel that it is real. Her eyes are looking at her reflection with an expression that is entirely private — neither performed joy nor staged beauty, but the specific serious pleasure of a woman seeing something she has dreamed about on her own skin for the first time.",
        why:          "The private first-touch moment — before family is called in — is the most intimate bridal jewellery moment available. It communicates that this jewellery is not just an accessory; it is the object of a specific and personal dream.",
      },

      visualHierarchy: {
        bad:          "Jewellery product shot large. Collection name. Price range. Store name.",
        whyBad:       "Product-first hierarchy treats bridal jewellery as merchandise. The bridal jewellery purchase is an emotional and identity milestone — showing the object before the emotion activates comparison-shopping rather than aspiration.",
        good:         "Bride's emotional moment 45%, jewellery visible and beautiful 30%, mirror reflection creating depth 15%, brand identity 10%. Emotion before product.",
        goldStandard: "P1 Bride's expression and hand touching the necklace (40%) — the emotional truth of the purchase. P2 The necklace itself — visible in the mirror, catching the light (30%) — the product, seen through her experience. P3 Her reflection in the mirror (20%) — the doubling of her image communicates the significance of the moment. P4 Room atmosphere — warm light, bridal preparation context (5%). P5 Brand name and consultation CTA (5%).",
        why:          "When the jewellery is visible only through the bride's experience of it — her touch, her reflection — the viewer identifies with the bride rather than the jewellery. This identification is what drives consultation bookings.",
      },

      composition: {
        bad:          "Bride centred in frame, full bridal look, jewellery highlighted with arrows or zoom insets.",
        whyBad:       "Arrows or zoom insets communicates catalogue photography, not aspirational brand advertising. Centred full-bridal-look is performative rather than intimate.",
        good:         "Three-quarter view of the bride toward the mirror. The necklace visible in both the direct view and the mirror reflection. The room creating depth behind her.",
        goldStandard: "The bride occupies the left two-thirds of frame in three-quarter view toward the mirror at the right edge of frame. The necklace is visible from two angles simultaneously — directly from behind and in the reflection. This double visibility communicates the jewellery's presence without catalogue lighting. The mirror creates a frame-within-a-frame of her reflected face — the viewer sees both who she is and who she sees herself becoming. The right third of frame is her reflected self in the mirror, slightly brighter than the room behind.",
        why:          "The mirror-within-frame composition is the defining bridal jewellery compositional device because it creates a doubled identity — she is both the woman looking and the woman seen. The jewellery exists at the intersection of these two identities, which is precisely where bridal jewellery lives psychologically.",
      },

      photography: {
        bad:          "Studio bridal photography. Professional jewellery lighting. Perfect skin. ",
        whyBad:       "Studio bridal photography with professional jewellery lighting communicates high-end catalogue imagery that Indian brides have learned to mentally translate back to reality — 'the actual jewellery won't look like this'. The translation gap creates distrust.",
        good:         "85mm lens at mirror level. Warm room light — morning or late afternoon. Jewellery photographed in the light the bride will actually wear it in. Skin texture present — not retouched to plastic.",
        goldStandard: "85mm lens at the mirror's eye level — the exact perspective of looking into a mirror. Single warm practical light source from the left: a window, a dressing table lamp, or morning light through net curtains — the quality of light a bride will actually experience on her wedding morning. The necklace catches this warm light and communicates its own quality in natural conditions. The bride's skin is lit warmly but shows texture — she is a real person, not a rendered image.",
        why:          "Natural-light jewellery photography converts better than studio jewellery photography because it shows the jewellery as it will actually look when worn — which is the question Indian brides are actually asking when they look at advertising.",
      },

      subjectDirection: {
        bad:          "Bride in full bridal makeup and jewellery, smiling at camera with family around her.",
        whyBad:       "The family-around-bride composition communicates the public moment of the wedding. But the jewellery purchase decision is made in the private moment — the bride alone with her reflection, her mother beside her, the silent agreement between them.",
        good:         "The bride alone in the frame, directed to look at her own reflection and to touch the necklace as she would touch it if no one was watching. Not performing, just feeling.",
        goldStandard: "The bride is directed: 'Look at the necklace in the mirror as though you are alone and you have just put it on for the very first time. You haven't decided yet. You are just feeling it.' Her hand rises slowly to touch it. Her expression is serious — not sad, but the specific seriousness of someone registering something important. The photo is taken at exactly the moment her hand touches the jewellery for the first time. Not the moment after — the first contact.",
        why:          "The first-contact moment — the first time the hand touches a piece of jewellery being tried on — is the most private and therefore most trustworthy bridal jewellery moment in advertising. It communicates 'I am not performing; I am feeling'.",
      },

      environment: {
        bad:          "Luxury bridal setting. Elegant decor. Premium environment.",
        whyBad:       "Generic luxury settings communicate styled photoshoot rather than a real woman's real preparation moment. Indian brides making premium jewellery decisions require authenticity, not aspirational production.",
        good:         "A real preparation room: a dressing table with a large mirror, warm light, a few objects that communicate that this is a specific woman's specific moment — not a generic luxury set.",
        goldStandard: "A private preparation room: a large dressing table mirror with warm practical lighting. On the dressing table: a few personal objects — a small diya, some flowers, the jewellery boxes that have already been opened. The curtain behind the bride is full of warm morning light. The room is warm-toned: cream or ivory walls, wooden furniture. The atmosphere is of a real house on the morning before the wedding — private, focused, full of the specific gravity of a day that has been planned for years.",
        why:          "The jewellery boxes already opened on the dressing table communicate that this is the moment of final choice — other pieces have been considered and set aside. The necklace being tried on has been chosen from among choices. This context makes the jewellery feel more valuable because it was selected, not simply purchased.",
      },

      typography: {
        bad:          "Jewellery collection name. 'Adorn Your Special Day.' Price starting from.",
        whyBad:       "'Adorn Your Special Day' and 'Your Big Day' are the two most overused bridal jewellery headlines in India. Price in bridal jewellery launch advertising creates value anchoring before the emotional commitment is established.",
        good:         "One intimate headline spoken to the bride in her private moment. Brand name and heritage. Consultation CTA — appointment-based, not walk-in framing.",
        goldStandard: "Headline at 20% visual weight: 'The jewellery you will touch first, on a morning only you will remember.' — this speaks to the private preparation morning that every bride has. Brand name at 15% below: present, premium, not dominant. Heritage line at 8%: 'Jewellers since [year]' — longevity communicates trust in a category where quality is invisible until worn for years. Consultation CTA at 12%: 'Schedule a private bridal consultation' — 'private' and 'consultation' communicate that this is not a walk-in store experience.",
        why:          "'The jewellery you will touch first on a morning only you will remember' activates the specific bridal preparation morning that every Indian bride has imagined. It places the jewellery in the context of the most private and significant moment of the wedding — not the public ceremony, but the private preparation.",
      },

      layout: {
        bad:          "Multiple jewellery pieces displayed. Collection range shown. Store locations. Walk-in timing.",
        whyBad:       "Multiple jewellery pieces in bridal advertising creates a collection catalogue rather than an aspirational campaign. Walk-in timing communicates retail, not consultation — which is the wrong register for a high-value bridal relationship.",
        good:         "Single intimate moment dominant. One headline. Brand name and heritage. Private consultation CTA. No product grid, no price range, no walk-in timing.",
        goldStandard: "Intimate moment image (65%). Upper zone (20%): headline right-aligned, brand name below at smaller weight. Lower zone (15%): brand heritage line left; 'Schedule a private bridal consultation' CTA centre; store area right. No product grid, no price range, no collection images — these are for the consultation, not the acquisition advertisement. The layout communicates that this brand's relationship with the bride begins with a private appointment, not a purchase.",
        why:          "Bridal jewellery advertising that positions the first touchpoint as a 'private consultation' rather than a store visit converts brides who are making a high-consideration, high-value purchase into a scheduled, relationship-oriented appointment. Scheduled appointments convert to purchase at significantly higher rates than walk-in store visits.",
      },

      commercialDetails: {
        bad:          "EMI available. 0% interest. Exchange old gold. All occasions. Festival offers.",
        whyBad:       "EMI and 0% interest communicate financial accessibility concerns before the emotional commitment is established. Exchange old gold communicates recycling rather than purchasing. Festival offers create promotional association for what should be a milestone purchase.",
        good:         "One clear quality credential. Private consultation availability. Heritage statement. No financial offers in bridal acquisition advertising.",
        goldStandard: "Quality credential: '[X] years of bridal craftsmanship' or 'Hallmarked [BIS/certification] — certified at purchase'. Private consultation: 'Schedule a private viewing of our bridal collection — by appointment'. Heritage: 'Family jewellers since [year], serving three generations of Indian brides in [city]'. No EMI language, no exchange offer, no festival discount — these are available at consultation but must not be in the acquisition advertisement, where they communicate the wrong register entirely.",
        why:          "'Serving three generations of Indian brides in [city]' is the highest-converting heritage credential in bridal jewellery because it activates the Indian cultural pattern of returning to the same jeweller across generations. The bride is told: 'your mother may have sat here too'.",
      },

      negativeSpace: {
        bad:          "All space used for jewellery display and collection range.",
        whyBad:       "Dense jewellery display in bridal advertising creates a catalogue impression. Indian brides making a significant bridal jewellery purchase require space — visual space that communicates the significance of the decision.",
        good:         "The intimate moment has generous breathing room. The headline sits alone in the upper zone. The consultation CTA is isolated and prominent in the lower zone.",
        goldStandard: "The bride's intimate moment image has a 6% breathing margin within the image zone. The upper zone headline sits with 10% space above it — the extra space communicates that this headline deserves a moment of consideration before reading. Between the headline and the image: 5%. The lower zone CTA sits surrounded by 8% space on each side — it is the only element in the lower zone, communicating that the next step is clear and singular. The negative space in this advertisement is the visual equivalent of the silence in a preparation room on a morning before a wedding.",
        why:          "Bridal jewellery decisions are made slowly, with consideration, and surrounded by family conversations that span months. A layout with generous negative space communicates that this brand operates at the same pace — considered, unhurried, and respectful of the significance of the choice.",
      },

      marketingPsychology: {
        bad:          "Exquisite jewellery for your special day. A gift she will cherish forever.",
        whyBad:       "These phrases are universal bridal marketing language and produce no specific emotional response in a bride who is making a specific purchase for a specific morning she is already imagining in detail.",
        good:         "Private preparation morning activation: the advertisement speaks to the bride's own imagined preparation morning. Legacy aspiration: jewellery that three generations of brides have worn. Intimate self-recognition: this is the jewellery for the version of yourself you have been planning to be.",
        goldStandard: "Preparation morning psychology: every Indian bride has imagined her wedding morning preparation room — the mirror, the jewellery boxes, the family. This advertisement places the bridal jewellery in that specific imagined morning and makes it real. Heritage trust: Indian bridal jewellery purchases are made with trust in the jeweller's permanence — 'three generations of Indian brides' communicates the continuity that makes a ₹5 lakh+ purchase feel safe. Private consultation positioning: the 'private consultation' framing communicates that this jeweller serves brides individually — not as one of fifty customers on a Saturday afternoon, but as the only appointment of that hour.",
        why:          "Indian bridal jewellery purchases are the highest-trust jewellery purchases in the market. The combination of heritage (the jeweller has been here for decades), privacy (the consultation is personal), and intimacy (the advertisement speaks to the bride's own imagined morning) creates the trust framework that converts consideration into appointment.",
      },

      antiPattern: {
        bad:          "Perfectly lit studio jewellery shot with no human context. Multiple pieces displayed as a collection grid. 'Minimum 30% off this Diwali'. Full bridal look from head to toe with jewellery labelled by name and price.",
        whyBad:       "Studio jewellery grids communicate catalogue, not aspiration. Diwali discount on bridal jewellery communicates that the price is negotiable — which destroys the high-value positioning before the first consultation. Labelled full-bridal-look photography is marketing the entire look, not the brand's specific jewellery relationship.",
        good:         "One intimate human moment. One piece of jewellery seen through the bride's experience of it. No discount language. No grid. Private consultation as the CTA.",
        goldStandard: "The bridal jewellery advertisement that converts has one Indian bride, one piece of jewellery seen in natural light through her private emotional experience of trying it on, one intimate headline, one heritage credential, and one private consultation CTA. It has no discount, no collection grid, no studio lighting, no labelled product names, no price indications. It communicates one thing: 'this jewellery is for the private morning you have been imagining, and we would like to have that conversation with you'. That is sufficient for a bride who is ready to make this purchase.",
        why:          "The bridal jewellery buyer who is ready to purchase has already decided on the emotional category and the budget range. The advertisement's job is not to persuade her of a new category or a new budget — it is to communicate that this specific brand is the right relationship for this most significant purchase. Intimacy, heritage, and private consultation accomplish this. Discounts and grids do not.",
      },

      conversionInsight: "Bridal jewellery consultations convert when the bride can see her own private preparation morning in the advertisement. The intimate first-touch moment activates that imagination. The private consultation CTA gives her a next step that matches the intimacy of the decision she is making.",
    },

  ],
};
