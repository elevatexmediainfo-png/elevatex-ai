// Creative Knowledge Library — Beauty & Salon

import type { IndustryKnowledge } from "../types";

export const beautySalon: IndustryKnowledge = {
  id:    "beauty_cosmetics",
  label: "Beauty & Salon",
  campaigns: [

    {
      type: "salon_makeover",
      tags: ["salon", "hair", "makeover", "haircut", "colour", "color", "styling", "hair treatment", "blowout", "keratin"],
      goal: "Drive salon appointment bookings by showing the transformation through the professional relationship, not the finished result.",
      audience: "Indian women aged 20–45 treating a salon visit as self-care, occasion preparation, or professional image investment.",

      heroSubject: {
        bad:          "Woman with beautiful hair at salon looking happy.",
        whyBad:       "Beautiful-hair-with-happiness photography communicates the finished product without showing why this particular salon is the source of trust. Every salon can show a beautiful result.",
        good:         "An Indian stylist standing behind her client at the mirror, having just finished — watching the client's face in the mirror before the client speaks.",
        goldStandard: "An Indian stylist in her early 30s stands behind her client — an Indian woman in her mid-30s — in the salon chair. The stylist has just released the finished style. Her hands are at her sides, not working. She is watching the client's face in the mirror with the specific attention of someone who has made something and is watching the person discover it. The client hasn't spoken yet. The stylist is waiting for the face to say it. In the mirror: the client's expression beginning to register — before she says a word, before she turns around.",
        why:          "The stylist watching the client's expression before the client speaks is more powerful than the client's direct expression. It communicates that the professional is invested in the reaction — which communicates that she cares about the outcome, not just the service.",
      },

      visualHierarchy: {
        bad:          "Before/after hair split. Salon name. Services list. Book now.",
        whyBad:       "Before/after splits communicate infomercial rather than premium professional service. Services lists position the salon as a provider rather than a trusted relationship.",
        good:         "Stylist watching client discover her new hair 45%, client's partial expression in mirror 25%, salon environment 20%, salon name and booking CTA 10%.",
        goldStandard: "P1 Stylist's invested attention watching the client's face (40%) — the professional relationship and quality of care. P2 Client's expression beginning to register in the mirror (25%) — the transformation discovery. P3 The finished hair — visible but not the compositional anchor (20%) — the result, seen through the experience of it. P4 Premium salon environment (10%) — professional quality signal. P5 Salon name and booking CTA (5%).",
        why:          "When the stylist's attention rather than the hair is the primary visual element, the viewer identifies with the professional relationship rather than the product. This relationship identification converts to appointment bookings because the viewer wants to be the person in that chair with a stylist who cares that much.",
      },

      composition: {
        bad:          "Finished hair displayed. Client smiling at camera. Before/after inset.",
        whyBad:       "Camera-directed finished-hair photography communicates product display, not professional experience. The client smiling at the camera communicates performance of satisfaction.",
        good:         "Chair-level perspective: we are at mirror height, capturing both the stylist behind and the client's reflection simultaneously. The mirror creates a doubled frame — the direct scene and the reflected scene.",
        goldStandard: "Camera at chair level, framing the mirror as the compositional centre. In the mirror's reflection: the client's face, beginning to register what she sees. In the direct frame: the stylist standing behind the chair, watching the mirror. The mirror creates a frame-within-frame — the client's expression is inside the mirror's frame, the stylist's watching attention is in the outer frame. Both are reading the same moment from different sides. The finished hair is visible across both frames but is compositionally subordinate to the two human expressions.",
        why:          "The mirror frame-within-frame composition is the defining salon advertising device because it places the viewer at the intersection of two moments simultaneously: the creation and the discovery. The viewer can be either person — the maker watching her work find its audience, or the person discovering what has been made for them.",
      },

      photography: {
        bad:          "Salon photography. Good lighting. Professional quality.",
        whyBad:       "Generic salon photography defaults to overhead studio-style lighting that flattens the hair and eliminates the warm, intimate atmosphere that makes salons feel like safe spaces rather than service transactions.",
        good:         "Natural window light from one side combined with the salon's mirror lighting. 50mm at chair level. The mirror reflection capturing the client's expression.",
        goldStandard: "50mm lens at chair level — the level at which you would sit beside the client and watch what is happening. Natural light from a large salon window on the left side, falling across the client's shoulder and the finished hair at a 45-degree angle that reveals texture and volume. Mirror lighting — the warm bulb strip around the salon mirror — creates a secondary warm fill light on the client's face in the reflection. 1/80s in warm salon light — enough to capture expressions without freezing the scene into a photoshoot.",
        why:          "The combination of natural window light on the hair and warm mirror lighting on the face is the exact quality of light that makes the salon mirror moment feel warm and aspirational rather than clinical. This is the light the client will actually experience when she looks in the mirror — and recreating it communicates that the advertisement is honest about what the salon delivers.",
      },

      subjectDirection: {
        bad:          "Stylist cutting hair and smiling at client. Client looking pleased and smiling.",
        whyBad:       "Mutual smiling during a hair service communicates social performance rather than professional excellence. The client does not pay a premium for a friendly interaction — she pays for the skill and attention of the stylist.",
        good:         "Stylist directed to watch the client's face in the mirror — not to look at the camera, not to speak. Client directed to look at her reflection as though she is seeing it for the first time.",
        goldStandard: "Stylist direction: 'You have just finished. Your hands are at your sides. You are watching her face in the mirror because you want to see the moment she sees it. Don't look at the camera — look at her reflection.' Client direction: 'Look at your reflection as though you are seeing this for the first time. You haven't decided yet what you think. You are just seeing.' The stylist watches. The client looks. Neither speaks. The photograph is taken at the precise second the client's expression begins to change — before the full reaction arrives.",
        why:          "The second before the full reaction — when the expression is beginning to register but hasn't yet formed into a definable emotion — is the most authentic and therefore most conversion-powerful moment in salon advertising. It communicates discovery in progress, which is infinitely more interesting than completed satisfaction.",
      },

      environment: {
        bad:          "Modern salon interior with nice styling stations.",
        whyBad:       "Generic modern salon interiors are indistinguishable from each other. The premium Indian salon customer evaluates the environment before she sits in the chair — and she is evaluating whether this space will make her feel taken care of.",
        good:         "A premium urban Indian salon: clean natural light, white walls, black chairs with chrome frames, professional products organised on lit shelves. One other stylist working in the background — this is a real working salon.",
        goldStandard: "A premium salon interior: large natural light windows creating soft daylight. Black styling chairs with chrome frames at precise intervals. Professional product shelves — organised by brand and height, not randomly arranged. The mirror lighting: warm bulb strips around the full mirror perimeter. One other stylist working with a client in the background — their backs to the camera, deeply involved in their own session. The salon smells of keratin and tea tree — implied by the visible product organisation. Clean floors, clean mirrors, immaculate workstations. This is a salon that operates to a standard.",
        why:          "The other stylist working in the background — backs to the camera, fully engaged with their client — is the most powerful environmental detail in premium salon advertising. It communicates that this is a working professional environment, not a photoshoot set. Multiple sessions happening simultaneously communicates demand and a practiced standard.",
      },

      typography: {
        bad:          "Salon Name. 'Where Beauty Meets Excellence.' All Services Listed. Book Now.",
        whyBad:       "'Where Beauty Meets Excellence' is the salon industry's equivalent of 'Your Health is Our Priority' — overused to meaninglessness. Services lists position the salon as a provider rather than a trusted relationship.",
        good:         "One discovery-moment headline. Salon name at appropriate hierarchy. Signature service. Easy booking CTA — preferably WhatsApp for Indian salon customers.",
        goldStandard: "Headline at 20%: 'The version of you you've been imagining.' — this speaks directly to the salon customer who has had a specific look in mind and has been waiting for the right professional to deliver it. Salon name at 14% below. Signature service at 10%: 'Signature colour and style — by appointment'. Booking CTA at 12%: 'WhatsApp to book: [number]' — Indian salon appointments convert at highest rates through WhatsApp, not website forms. No services menu in the advertisement.",
        why:          "WhatsApp as the booking CTA for salon advertising converts at significantly higher rates than online booking forms for Indian women aged 25–45 because it feels personal rather than transactional — the same register as a relationship with a trusted stylist.",
      },

      layout: {
        bad:          "Hair transformation before/after split. Service menu. Prices. Instagram handle.",
        whyBad:       "Before/after splits in salon advertising attract price-comparison clients who are not loyal. Service menus overwhelm and delay the booking decision. Instagram handles deflect conversion.",
        good:         "Discovery moment image dominant. One emotional headline. Salon name. WhatsApp booking CTA. No before/after, no service menu.",
        goldStandard: "Discovery moment image (65%). Upper zone (20%): headline right-aligned; salon name below at smaller weight. Lower zone (15%): signature service and stylist name left ('Colour and Style — [Stylist Name]'); 'WhatsApp to book' CTA centre; area indicator right ('Bandra / Koregaon Park / [area]'). No before/after in the layout. No service price list. One WhatsApp number. One location indicator. The layout communicates: this is about the experience of being here, not the list of what we offer.",
        why:          "Naming the specific stylist in the commercial details ('Colour and Style — [Stylist Name]') converts at higher rates than naming the salon because premium salon customers are building a relationship with a specific person, not an institution. The stylist is the product.",
      },

      commercialDetails: {
        bad:          "20% off this week. All services available. Qualified staff. International brands used.",
        whyBad:       "Discount language in premium salon advertising devalues the professional relationship. 'Qualified staff' is the minimum expectation, not a differentiator. 'International brands' is claimed by every premium-positioned Indian salon.",
        good:         "Stylist's credential if specific and verifiable: training background. One signature service statement. Booking availability. No discount language.",
        goldStandard: "Stylist credential: 'Trained at [specific credible institution — Mumbai's best, Sassoon, etc.]' — one specific training background communicates more than a list of certifications. Signature service: 'Signature balayage and colour correction — book 2 weeks in advance' (if demand warrants): 'book 2 weeks in advance' communicates demand and quality simultaneously. Availability: 'Limited weekend slots — WhatsApp [number] to confirm'. No discount, no 'first appointment offer' — these attract the wrong client.",
        why:          "'Limited weekend slots' as the commercial detail converts premium salon clients at higher rates than any price-based incentive because it communicates genuine demand. In premium personal service categories, scarcity signals quality more powerfully than any specification or discount.",
      },

      negativeSpace: {
        bad:          "All space used for before/after images, service lists, and discount offers.",
        whyBad:       "Dense salon advertising creates a service provider impression rather than a professional relationship impression. The client who books a premium appointment is not price-comparing on a flyer — she is deciding whether to trust someone with how she looks.",
        good:         "The discovery moment has generous space around it. The headline is isolated and prominent. The booking CTA is the single clear next step.",
        goldStandard: "The stylist-watching-client-discovery image has 5% breathing margin within the image zone. The mirror's warm light should extend into the image zone without being interrupted by text. The upper zone headline has 8% space above it — it stands alone. Between headline and image: 4%. The lower zone CTA has 10% internal spacing and sits as the sole commercial element. The impression: this salon has room for you, not just for services.",
        why:          "A salon advertisement with generous negative space communicates the same thing as a salon with comfortable spacing between styling stations: this professional environment has room for you as an individual, not as one of many. Visual space communicates care for the individual.",
      },

      marketingPsychology: {
        bad:          "Look your best. Feel confident. Expert stylists at your service.",
        whyBad:       "These three phrases activate no specific emotional trigger. They are the ambient language of every beauty service advertisement.",
        good:         "Professional relationship investment: 'this is a professional who understands what I want'. Self-recognition aspiration: 'the version of you you've been imagining' activates the specific look the client has been thinking about. Limited availability scarcity: 'limited weekend slots' creates real urgency.",
        goldStandard: "Professional relationship psychology: Indian women who pay premium prices for hair services are buying access to a specific professional relationship — a stylist who listens, understands, and delivers consistently over years. The advertisement that communicates this relationship (through the stylist watching the client's face) converts the client who is looking for 'her stylist' rather than 'a salon visit'. Self-recognition activation: 'the version of you you've been imagining' is the specific psychological trigger of the client who has had a look in mind and has not yet found the professional to deliver it. It communicates 'we can give you what you've already imagined'. Demand signal: 'book 2 weeks in advance' communicates that others have already decided — social proof through scarcity.",
        why:          "Premium salon clients are not making a service choice — they are making a professional relationship choice. The stylist who watches the client's face in the mirror communicates the professional investment that motivates this kind of loyalty.",
      },

      antiPattern: {
        bad:          "Generic model with perfect hair in studio lighting. Exaggerated before/after split. 'Affordable luxury'. All services listed with prices. Instagram aesthetic flatlay of hair products.",
        whyBad:       "Generic model hair photography communicates a brand lifestyle image that the local salon cannot deliver. Before/after splits attract price-sensitive clients. 'Affordable luxury' is an oxymoron that communicates neither. Services with prices create price-comparison mindset before quality positioning is established.",
        good:         "Real Indian stylist with real Indian client at the discovery moment. No model, no before/after, no prices in the primary advertisement. One specific professional credential. WhatsApp booking.",
        goldStandard: "The salon advertisement that builds a premium loyal client base shows a real stylist watching a real client discover what has been done for her — in a real premium salon with real natural light. It has no model, no before/after, no discount, no services list. It has one discovery moment, one emotional headline, one stylist credential, and one WhatsApp number. It communicates: 'we are a professional relationship waiting to be built'. That is sufficient for the client who is looking for her stylist.",
        why:          "Premium salon clients who book by WhatsApp after seeing one image of a stylist watching her client's face in the mirror are the most loyal salon clients available. They have already decided on the professional relationship before booking. They convert to repeat clients at the highest rate of any salon acquisition source. This is the client worth advertising for.",
      },

      conversionInsight: "Salon bookings convert when the viewer can see herself in that chair, with a professional watching her face in the mirror with that level of investment. The image of the stylist watching — not working, watching — is the conversion trigger. WhatsApp as the booking method makes the first step feel personal. Combine the two.",
    },

  ],
};
