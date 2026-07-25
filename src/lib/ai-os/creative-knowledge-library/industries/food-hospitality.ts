// Creative Knowledge Library — Food & Hospitality

import type { IndustryKnowledge } from "../types";

export const foodHospitality: IndustryKnowledge = {
  id:    "food_hospitality",
  label: "Food & Hospitality",
  campaigns: [

    // ─── LUXURY DINING ────────────────────────────────────────────────────────
    {
      type: "luxury_dining",
      tags: ["restaurant", "fine dining", "premium", "chef", "gourmet", "luxury", "upscale", "tasting menu", "reservation"],
      goal: "Drive reservation bookings by communicating craftsmanship, exclusivity, and the promise of a memorable experience.",
      audience: "Indian urban professionals aged 28–50 who treat fine dining as a social identity statement.",

      heroSubject: {
        bad:          "Chef cooking food in restaurant kitchen.",
        whyBad:       "No decisive moment, no emotional content — this is the default stock photograph every restaurant advertisement already uses and communicates nothing about this restaurant's specific standard.",
        good:         "An Indian executive chef at the pass, hand positioned above the plated dish during the final garnish placement. His focused expression communicates craft and precision.",
        goldStandard: "An Indian executive chef in his early 40s pauses with tweezers above the signature dish — the microgreen not yet released, the decision still being made. This private moment, which exists in every fine kitchen and is photographed in almost none, communicates that this restaurant's standards exist for the chef, not for an audience.",
        why:          "The withheld action — the pause before release — is more powerful than the action itself. It communicates standards that exist independent of observation, which is the highest form of culinary credibility.",
      },

      visualHierarchy: {
        bad:          "Chef (large). Dish (medium). Logo (corner). Everything equal priority.",
        whyBad:       "Equal visual weight means the viewer's eye has no path. They see everything simultaneously and are moved by nothing. The frame lacks a dominant signal.",
        good:         "Chef 45%, dish 25%, table environment 20%, brand 5%, CTA 5%. The human earns attention first; the product follows; brand arrives last.",
        goldStandard: "P1 Chef's hands and expression (45%) — creative authority. P2 Plated dish in natural light (25%) — product proof. P3 Table environment (20%) — ambience promise. P4 Guest silhouettes softly blurred (5%) — social desirability. P5 Brand CTA (5%) — the reservation ask. The hierarchy is a journey: trust the chef → want the dish → imagine yourself at the table → act.",
        why:          "When the human creator dominates over the product, the viewer first trusts the chef, then wants the dish, then imagines themselves as the recipient. Each hierarchy level earns the next.",
      },

      composition: {
        bad:          "Chef centred in frame with dish in front. Logo top-right. Symmetrical.",
        whyBad:       "Centred composition creates visual stasis — the eye arrives and stops. No reading flow is created between the emotional content and the commercial ask.",
        good:         "Chef placed at left golden ratio. Dish at frame centre. Negative space right of chef for headline. Reading flow: chef → dish → headline → CTA.",
        goldStandard: "Chef occupies the left 55% of frame from counter level to upper third. The plated dish sits at the golden ratio intersection. The right 45% holds the editorial headline in the upper zone and the reservation CTA in the lower safe zone. The viewer's eye travels: chef's expression → hands → dish → across negative space → headline → CTA. One continuous visual journey, no dead ends.",
        why:          "The subject's gaze direction creates implied motion into the negative space — the viewer's eye follows the chef's attention toward the headline, arriving at the commercial message through natural visual travel, not instruction.",
      },

      photography: {
        bad:          "Professional camera, good lighting, food photography.",
        whyBad:       "No guidance for the decisive moment, camera position, or light quality. Produces technically adequate images that carry no commercial power — competent but forgettable.",
        good:         "50mm lens at counter level. Warm amber practical lighting. Focus on chef's hands during the garnish moment. Shallow depth of field compresses the kitchen background.",
        goldStandard: "50mm prime at counter-height — the level where the dish is served, not the level where humans tower over it. Warm 2800K practical amber from above mixed with single window fill at reduced power. Focus locked on the tweezers and the microgreen. Chef's face in upper third, 70% sharp — expression readable, skin texture present. Kitchen depth visible but fully compressed behind.",
        why:          "Counter-height photography removes the power hierarchy of looking down at food. The dish is at the level of professional evaluation — the chef's eye level. This perspective communicates respect for the craft that no other angle delivers.",
      },

      subjectDirection: {
        bad:          "Chef smiling at camera. Customers looking pleased and smiling at camera.",
        whyBad:       "Camera-directed smiles break narrative immersion immediately. The brain identifies 'advertisement' and skips forward. No genuine moment is communicated.",
        good:         "Chef entirely focused on the dish — not the camera. In soft focus background, two diners in genuine conversation, one mid-sentence.",
        goldStandard: "The chef does not acknowledge the camera at any point — his full attention is on the dish. His left hand steadies the plate rim; his right holds tweezers mid-descent. In the softly blurred background, two Indian diners: one is mid-sentence, the other is listening with the forward lean of genuine interest. No one is performing for the photograph.",
        why:          "When subjects are unaware of the camera, the viewer becomes the camera — they enter the scene rather than observe it. This creates the immersive experience that makes luxury restaurant advertising convert at a higher rate than any posed alternative.",
      },

      environment: {
        bad:          "Luxury restaurant with nice decor.",
        whyBad:       "Completely non-specific. Cannot be differentiated from any other luxury restaurant advertisement. No visual detail communicates why this specific restaurant is worth the price.",
        good:         "Dark walnut finishes, warm amber chandeliers, handcrafted ceramic dinnerware, brass accents. Open kitchen visible behind. A real premium Indian fine dining environment with specific material identity.",
        goldStandard: "Dark walnut millwork and brass fixtures warm the room from above. The open pass reveals controlled kitchen activity. Handcrafted ceramic dinnerware in matte earth tones, thick-rimmed, catching the candlelight. White linen with visible texture — not starched flat. In the background: Indian diners at other tables, visible but not competing, their presence communicating that this restaurant is already chosen by people like the viewer.",
        why:          "The specific material details — walnut, brass, handcrafted ceramic, textured linen — communicate investment without stating price. Indian diners in the background create aspirational peer social proof: people like the viewer are already here.",
      },

      typography: {
        bad:          "Elegant font. Premium feeling. Restaurant name prominent.",
        whyBad:       "No hierarchy, no measurement, no tone direction. Produces type that fills space rather than guides reading — technically present, commercially inert.",
        good:         "One editorial headline at 20% visual weight. Restaurant name smaller. Reservation CTA clear. Warm cream on deep dark background.",
        goldStandard: "Single editorial headline occupies 18–22% of total visual attention — large enough to anchor the negative space, restrained enough to communicate confidence. Thin-weight high-contrast typeface with generous tracking. Below: restaurant name at 60% headline size; opening hours at 40% size. CTA: 'Reserve Your Table' — slightly bolder than body, never competing with headline. Palette: warm cream on deep charcoal.",
        why:          "Typographic restraint communicates the same thing as architectural restraint: this brand does not need to shout. A single dominant headline surrounded by breathing room reads as premium. Competing type elements read as anxiety.",
      },

      layout: {
        bad:          "Hero image takes most of the frame. CTA at bottom. Logo somewhere. Arrangement ad hoc.",
        whyBad:       "No spatial precision means inconsistent execution across campaign assets. 'Most of the frame' cannot be reproduced consistently.",
        good:         "Top 18% for headline. Middle 55% for hero image. Bottom 15% for CTA, contact, logo. Clear zone separation with measured proportions.",
        goldStandard: "Top zone (18%): editorial headline, right-aligned, 8% left margin. Hero zone (55%): full-bleed image, chef at left golden ratio, dish at centre, negative space right. Transition zone (12%): single benefit line. Commercial zone (15%): left — reservation details; centre — CTA button; right — logo. All typography observes 8% left and right margins. No element touches the frame edge.",
        why:          "Named zones create a reproducible layout system. The same proportions across social, print, and outdoor assets create brand recognition through layout consistency — not just visual identity.",
      },

      commercialDetails: {
        bad:          "Phone number and website at the bottom.",
        whyBad:       "Phone and website are contact details, not commercial conversion elements. They communicate 'reach us if you want' rather than 'act now because this is worth it'.",
        good:         "Reservation badge. 'Limited seatings nightly'. Google rating if 4.5+. One press mention if credible. Clear reservation CTA — not 'call us'.",
        goldStandard: "'Reserve' — not 'Book', not 'Call Us'. Limited seating signal: 'Seatings nightly at 7:30 and 9:30 — table availability limited'. One credible press mention only. Google rating 4.7+ only — never display below this threshold. QR code linking directly to reservation page, not the homepage. No phone number in the primary commercial zone.",
        why:          "Every commercial detail must answer: does this communicate quality, create urgency, or reduce friction? A direct reservation flow with limited availability signals answers all three. A phone number answers none.",
      },

      negativeSpace: {
        bad:          "Some empty space around the text so it's readable.",
        whyBad:       "'Some' empty space is whatever was left over after everything else was placed. This produces crowded layouts masquerading as considered design.",
        good:         "Headline sits in the upper-right negative space. The chef's gaze direction points toward this space, creating visual connection between the human moment and the commercial message.",
        goldStandard: "The right 40% of the hero image is intentional negative space — background chosen and lit to be free of competing visual detail. Headline occupies the upper portion with minimum 12% margin from frame edge. CTA occupies the lower portion with the same margin discipline. Between headline and CTA: pure breathing room, never violated by any element. The chef's gaze points directly into this zone.",
        why:          "Negative space is not absence — it is the field through which the eye travels from emotional content to commercial message. When this field is clean, the journey is natural and the conversion follows.",
      },

      marketingPsychology: {
        bad:          "Luxury feeling. Exclusive atmosphere. Premium quality.",
        whyBad:       "Abstract emotion words activate no specific psychological trigger. 'Luxury feeling' cannot be executed in a photograph — it produces generic aspirational imagery that no Indian diner has ever acted on.",
        good:         "Social identity: dining here communicates who you are. Scarcity: limited seatings create real urgency. Craft trust: the chef's precision makes quality tangible.",
        goldStandard: "Identity signal: 'This is where people like me dine' — activated by showing aspirational Indian peers in the background, not celebrities. Craft trust: precision visible in the tweezers moment makes quality tangible, not just claimed. Exclusivity mechanism: 'Limited seatings nightly' creates real urgency, not fabricated scarcity. Occasion framing: this restaurant is the setting for the dinner you will still remember years from now — the bill is the cost of a permanent memory.",
        why:          "Indian luxury dining conversion happens when the viewer projects themselves into a specific social identity moment — not 'a nice dinner' but 'the kind of dinner that communicates who I am'. The image must trigger that projection.",
      },

      antiPattern: {
        bad:          "Multiple dishes displayed together. Bright overhead studio lighting. Chef with crossed arms smiling at camera. Generic marble table background.",
        whyBad:       "Multiple dishes fragment visual hierarchy. Overhead studio lighting makes food look artificial. Crossed-arm chef is a power pose, not a craftsman. Marble table is so overused in Indian food advertising it has become invisible.",
        good:         "One dish. One decisive chef moment. Natural or warm practical lighting. Environment specific to this restaurant, not a universal 'premium' backdrop.",
        goldStandard: "Single dish, single chef moment, single emotional journey. The lighting is the restaurant's own — the overhead kitchen lamp, the candle, the window fill — not imported from a studio. The chef's hands are working, not posing. Every element is specific: this chef, this dish, this kitchen, this light. Nothing could belong to any other restaurant.",
        why:          "Specificity is the only luxury signal that cannot be faked. A specific environment, specific chef, specific dish, specific light communicate authenticity that generic premium aesthetics never can. The viewer trusts what is irreplaceably specific.",
      },

      conversionInsight: "Luxury dining reservations convert when the viewer imagines one specific dinner they want to have at this restaurant. The decisive chef moment is the trigger: it makes the viewer think 'someone made this for someone, and I want to be that someone'.",
    },

    // ─── GRAND OPENING ────────────────────────────────────────────────────────
    {
      type: "grand_opening",
      tags: ["grand opening", "new restaurant", "launch", "opening", "now open", "debut", "first day"],
      goal: "Drive foot traffic and social buzz in the first 2–4 weeks of opening.",
      audience: "Food-curious Indian urban adults aged 22–45 in the restaurant's catchment area.",

      heroSubject: {
        bad:          "Restaurant exterior with 'Now Open' banner.",
        whyBad:       "The banner-on-facade photograph is the most generic restaurant opening image in existence. It communicates 'we exist' but not 'you should come now'.",
        good:         "The restaurant founder standing inside the completed restaurant, looking at the space with visible pride — not at the camera.",
        goldStandard: "The Indian founder — mid-40s, wearing something between formal and casual — stands at the entrance of the completed dining room looking in. Not at the camera. At the room. His expression holds the specific satisfaction of someone seeing a two-year vision become a physical space. In the background: the full restaurant, lit and set but not yet occupied. The chairs are empty but the diners are about to arrive.",
        why:          "The founder looking at what he built answers the only question that converts: 'Do I trust this?' A human being with visible investment in this space is the trust signal that no banner or logo can create.",
      },

      visualHierarchy: {
        bad:          "Restaurant name big. 'Grand Opening' text. Date. Address. Offers. Equal weights.",
        whyBad:       "Text-heavy opening announcements communicate urgency anxiety — the brand is afraid the audience won't come unless they list everything. This undermines premium positioning before a single meal is served.",
        good:         "Founder 50%, restaurant interior 30%, opening information 15%, logo 5%. Human earns attention; space confirms the promise; details close the visit.",
        goldStandard: "P1 Founder's expression and posture (50%) — personal investment creates trust. P2 Restaurant interior (30%) — the promise of what awaits. P3 'Now Open' minimal text with date (15%) — commercial information, kept light. P4 Logo (5%) — present but restrained. No discount offers in the opening announcement — these come in week 2.",
        why:          "An opening that leads with human investment rather than commercial offers signals confidence: 'we built something worth visiting'. Offer-led openings signal insecurity before the first guest arrives.",
      },

      composition: {
        bad:          "Exterior shot of restaurant with big 'Grand Opening' text overlay.",
        whyBad:       "The exterior shot announces a location, not an experience. Text overlay on an uninspiring exterior creates the worst possible first impression for a new restaurant.",
        good:         "Interior shot. Founder at the entrance threshold — between the street world and the restaurant world. The frame contains both simultaneously.",
        goldStandard: "The founder stands at the threshold — looking back at what he created. The frame's left edge catches the street outside: real, ordinary, the viewer's world. The right two-thirds: the warm, lit, specific interior of this restaurant. The viewer's eye travels from the familiar street into the warm promise of the new space, with the founder as the guide across the threshold.",
        why:          "The threshold composition creates a visual invitation — the viewer is positioned at the same entry point as the founder, looking in. This creates the feeling of being personally invited rather than advertised at.",
      },

      photography: {
        bad:          "Wide angle restaurant photography, good lighting.",
        whyBad:       "Wide angle without a human anchor creates real estate photography, not restaurant photography. The viewer sees a room, not an experience worth visiting.",
        good:         "35mm wide lens at standing level. Warm interior lighting only. Founder as anchor. Restaurant depth visible but experiential, not architectural.",
        goldStandard: "35mm at standing eye level — the perspective of someone entering for the first time. Founder as human anchor in the left third, full restaurant depth in remaining frame. Interior lighting only — no flash — so the warmth of chandeliers and candles is exactly what the viewer will see on opening night. Depth of field: founder sharp, interior slightly compressed but readable.",
        why:          "The 35mm standing-level perspective is the entry experience made visual. The viewer's eye moves through the frame the way their body would move through the door — spatial familiarity before the first visit.",
      },

      subjectDirection: {
        bad:          "Founder smiling at camera giving thumbs up. Staff standing in a row.",
        whyBad:       "Founder thumbs-up is the most ubiquitous Indian grand opening photograph and has been completely drained of meaning. Staff rows communicate a company announcement, not a dining destination.",
        good:         "Founder looking at the room with pride. One waiter in background setting the final table. The restaurant is ready but not yet open — the last act before the first guest.",
        goldStandard: "The founder's gaze is directed inward — into the restaurant, toward its centre, the way you look at something you love when you think no one is watching. In the background, one waiter places the final centrepiece on the last table. This is the moment before the first guest arrives. The restaurant is complete. The founder knows it. The waiter knows it. The camera has caught this private readiness.",
        why:          "The moment before opening is more emotionally powerful than the moment of opening. It contains the entire two-year journey and the hope of the first night simultaneously — the feeling that makes someone decide to be among the first visitors.",
      },

      environment: {
        bad:          "New restaurant interior with fresh decor.",
        whyBad:       "All new restaurants have fresh decor. This communicates nothing specific about why this restaurant's interior is worth the visit.",
        good:         "Specific interior design identity: dark wood, warm lighting, premium table settings. The room has a distinct character, not a generic modern restaurant look.",
        goldStandard: "An Indian fine casual interior designed with intention: exposed brick on one wall, warm plaster on the others. Brass pendant lights at 2800K over dark oak tables set for four. Handpainted ceramic plates — visible texture. Napkins folded with precision. At the bar: bottles organised by height and colour with evident care. Through the glass front: a small queue of 4–5 people already waiting. This restaurant is ready and other people already know it.",
        why:          "The queue outside — even a small one of 4–5 people — is the single most powerful grand opening conversion signal. It says 'others have already chosen this' before the viewer makes their decision.",
      },

      typography: {
        bad:          "GRAND OPENING in large all-caps text. Restaurant name. Date. Address.",
        whyBad:       "All-caps celebration typography communicates commodity, not destination. It sets a promotional register that ages badly and undermines brand positioning from the first week.",
        good:         "Minimal announcement. Restaurant name dominant. 'Now Open' as secondary element. Date and address in utility zone. Typography that would look appropriate in six months.",
        goldStandard: "Restaurant name in brand's primary typeface at 22% visual weight — this IS the opening announcement, not a subheading. 'Now open' in lighter weight below, at 11% — present but deferential. Opening date and area at 8%. Reservation or walk-in CTA at 10% with slight emphasis. Overall tone: confident announcement, not excited proclamation.",
        why:          "Opening announcement typography sets the permanent brand register. Typography that shouts 'GRAND OPENING' trains viewers to expect promotions — not the association a premium restaurant wants to create in its first week.",
      },

      layout: {
        bad:          "Big announcement text. Restaurant image. All details listed. Maximum information density.",
        whyBad:       "Listing all details creates visual anxiety and communicates that the advertiser is uncertain the venue is compelling on its own.",
        good:         "Image-led layout. Founder moment dominant. Minimal text. One clear CTA. Address in utility zone. No social media handles in acquisition advertising.",
        goldStandard: "Hero image fills 65% — the founder at threshold. Top 20%: restaurant name and 'Now Open', right-aligned. Bottom 15%: area and opening date left; reservation or directions CTA right; logo centred. Hero image is never cut by text — all typography lives above or below it in clear zones. No hashtags — these belong on the in-café chalkboard, not on first-visit advertising.",
        why:          "A layout where the image is never cut by text communicates visual confidence — this image is worth seeing completely. That confidence is registered before a single word is read.",
      },

      commercialDetails: {
        bad:          "Grand Opening! 20% off opening week. Free dessert. All welcome.",
        whyBad:       "Opening discounts permanently damage price perception. Every subsequent meal will be mentally compared to the discounted opening price. Indian diners remember opening offers and resist paying full price thereafter.",
        good:         "No discounts in the opening announcement. Soft urgency: 'Reservations filling for opening week'. Clear address and landmark reference. Direct reservation link or QR.",
        goldStandard: "'Now accepting reservations — walk-ins welcome' (removes friction without discounting). Area and landmark reference so the location is findable without GPS dependence. QR code to reservation page, not homepage. One curated press mention if available from a preview evening. No offers, no percentages — these are earned in week 3 if needed, never in week 1.",
        why:          "A restaurant that opens without discounts communicates confidence in its own quality. The first guests who pay full price become the brand's most valuable advocates — they chose this place on its merits.",
      },

      negativeSpace: {
        bad:          "Text and image combined so both are visible. Text overlaid on the image.",
        whyBad:       "When text overlays image, both are compromised — the image is obscured and the text is less legible. Neither performs at full commercial effectiveness.",
        good:         "Text lives in clear zones above and below the hero image. The image is uninterrupted. The opening communication is: see first, read second.",
        goldStandard: "The hero image is inviolable — no text crosses into it. Upper zone (20%) and lower zone (15%) are the only text territories. Within zones: generous internal margins (8% from frame edge). Between the upper text and the hero image: 4% breathing room. Between the hero and the lower zone: 4% breathing room. The white space communicates: this restaurant does not need to shout over its own photography.",
        why:          "An inviolable hero image signals respect for the visual content. It communicates that this restaurant trusts its space to do the persuasion — exactly the confidence that converts first-visit decisions.",
      },

      marketingPsychology: {
        bad:          "Excitement about new opening. FOMO about being first.",
        whyBad:       "Generic excitement language produces no specific trigger. 'FOMO' without a specific mechanism is just another advertisement shouting for attention.",
        good:         "First-chapter positioning: 'Be among the first to experience this'. Social identity: being an early discoverer of a quality restaurant is culturally valued in Indian urban food culture.",
        goldStandard: "First-chapter psychology: Indian food culture specifically values being the person who discovers a quality restaurant before it becomes famous — the recommender is socially valuable. This advertisement positions the viewer as that person. Authority transfer: the founder's visible investment gives the viewer permission to trust this restaurant before eating there. Imminent scarcity: the small queue through the glass communicates real, not fabricated, early demand.",
        why:          "The most powerful grand opening trigger for Indian urban diners is not discount but discovery identity — 'I found this first'. The advertisement must make the viewer feel like a discoverer, not a discount-hunter.",
      },

      antiPattern: {
        bad:          "Balloons and ribbons. 'Inaugural offer'. Staff in matching uniforms smiling. Menu displayed in opening announcement. 'Best restaurant in the city' self-claim.",
        whyBad:       "Balloons signal celebration for the restaurant's benefit, not the diner's. Inaugural offers destroy price positioning. Matching-uniform group photos are company announcements, not dining invitations. Self-proclaimed superlatives are dismissed instantly by Indian consumers.",
        good:         "No balloons, no ribbons, no group uniform photo, no menu display, no self-proclaimed rankings. One human moment. One clear invitation. Zero decorative celebration that exists for the brand rather than the viewer.",
        goldStandard: "The opening announcement does one thing: it makes the viewer want to be there. It does not explain the menu, describe the concept, list the offers, or describe the ambience in copy. The photography communicates the ambience. The founder communicates the investment. The restraint communicates the confidence.",
        why:          "The opening-week decision is binary: 'I want to go now' or 'I'll go eventually' — which means never. Restraint and specificity produce the first response. Information overload and celebration graphics produce the second.",
      },

      conversionInsight: "Grand opening conversions happen in the first 72 hours or not at all. The image of the founder looking at his ready restaurant — private readiness before the first guest — is the trigger. It communicates: this person built this for you. That is the invitation that converts.",
    },

    // ─── CAFÉ ─────────────────────────────────────────────────────────────────
    {
      type: "cafe",
      tags: ["cafe", "coffee", "café", "coffee shop", "brew", "espresso", "pour over", "barista", "specialty coffee", "workspace"],
      goal: "Drive daily visits and build the café as a third-place identity — the space between work and home.",
      audience: "Indian urban professionals and students aged 20–38 who use cafés as work-social environments.",

      heroSubject: {
        bad:          "Latte art on a coffee cup. Coffee beans on a table.",
        whyBad:       "Coffee cup and bean photography communicates product, not experience. The viewer sees a beverage, not a destination. Every specialty coffee brand uses this imagery.",
        good:         "A barista mid-pour over a customer's cup, full attention on the pour angle. The customer visible but not posed — looking at their phone or notebook until the sound of the pour pulls their attention.",
        goldStandard: "An Indian barista in her mid-20s executes the final 30-degree turn of a pour-over at the café counter. Her attention is entirely on the pour — angle, height, rate. The customer across the bar has looked up from their laptop instinctively, not because they're supposed to watch, but because this level of precision creates a gravity around itself. This is the moment when a coffee order becomes a coffee.",
        why:          "The customer looking up instinctively communicates the craft quality better than any photograph of the coffee itself. The viewer projects themselves into the customer's position — drawn to watch something done with real skill.",
      },

      visualHierarchy: {
        bad:          "Coffee cup centred. Café name. Tagline. Hours.",
        whyBad:       "Product-centred hierarchy communicates 'we sell coffee' — not 'this is a place you want to spend your morning in'. All cafés sell coffee; the differentiation is the experience.",
        good:         "Barista-customer interaction 50%, brew craft detail 25%, café environment 20%, brand 5%. Experience first, product second.",
        goldStandard: "P1 Barista's hands and the pour (40%) — craft as primary signal. P2 Customer's instinctive attention pulled toward the pour (25%) — social proof of quality. P3 Café atmosphere behind them (25%) — the workspace-social environment. P4 Menu board if visible (5%) — discovery element. P5 Brand mark (5%) — identity confirmation.",
        why:          "When the customer is drawn toward the craft instinctively, the viewer's mirror neurons activate — they feel the same pull. The hierarchy creates identification before commercial intent is visible.",
      },

      composition: {
        bad:          "Counter-level shot of coffee cup with café in background.",
        whyBad:       "Counter-level cup shots are the most photographed image in specialty coffee and differentiate nothing. The café background serves as decoration rather than context.",
        good:         "Behind-the-bar perspective: barista dominant with customer partially visible across the counter. The counter becomes the divide between craft and appreciation.",
        goldStandard: "Camera positioned behind and slightly above the barista's shoulder — the perspective of someone watching someone else work with genuine skill. Barista occupies the left two-thirds. Pour-over device and cup in lower centre. Customer's face visible in right third across the counter — soft focus but expression readable: the instinctive look-up. Café depth behind communicates environment without competing for attention.",
        why:          "The over-the-barista-shoulder perspective is almost never used in café advertising — making it immediately distinctive. It places the viewer in the position of a fellow craftsperson watching a peer.",
      },

      photography: {
        bad:          "Good natural light. Coffee photography. Lifestyle aesthetic.",
        whyBad:       "Natural light and lifestyle aesthetic describes 80% of café photography on Instagram. It guides nothing specific about the decisive moment or quality of light.",
        good:         "Window light from one side only. 50mm at counter height. The pour in motion, slightly blurred to communicate movement rather than frozen action.",
        goldStandard: "Single natural light source: a large window to the barista's left, casting 45-degree soft side-light across the counter. 50mm lens at counter height. Pour captured at 1/125s — fast enough to resolve the stream, slow enough to communicate motion. Steam visible above the cup. Barista's face in partial profile, 70% sharp — expression readable without being the dominant focus.",
        why:          "Single-source natural light creates the depth and texture that communicates premium craft. The slight motion blur of the pour communicates 'caught in the act' rather than 'posed for the photo' — documentary rather than advertisement.",
      },

      subjectDirection: {
        bad:          "Barista smiling at customer. Customer looking pleased with coffee.",
        whyBad:       "Both posed directions collapse the scene into a service interaction rather than a craft moment. The viewer sees a transaction, not an experience worth going out for.",
        good:         "Barista entirely focused on the pour — not the camera or the customer. Customer attention pulled naturally. No performed interaction — only genuine concentration and instinctive appreciation.",
        goldStandard: "The barista has not spoken to the customer in 90 seconds — she is in the part of the pour that requires complete attention. Her lips are slightly pressed together. The customer had their AirPods in; they took one out when they heard the change in the pour sound. They are watching with one earbud dangling — not performed attention, just genuine curiosity about the sound of good coffee. Neither is performing for anyone.",
        why:          "The detail of the customer removing one AirPod is the most specific and therefore most powerful human direction choice in café advertising. It communicates 'this café's craft breaks through whatever you were doing'. That is the third-place identity in one human gesture.",
      },

      environment: {
        bad:          "Modern café interior with nice furniture and plants.",
        whyBad:       "Every third-wave café in every Indian city has modern furniture and plants. This communicates category membership, not a reason to choose this café.",
        good:         "A specific design identity: worn wooden counter, visible evidence of real use — notebooks on tables, cables on the counter, a person actually working in the background.",
        goldStandard: "Worn wooden counter with visible use — this counter has served thousands of coffees. Copper-finish bar fittings. Behind the barista: bags of single-origin beans with handwritten origin labels. On the right wall: a small chalkboard menu in clear handwriting. In the background: two Indian professionals at separate tables, both working. One has three empty cups in front of them — they've been here for hours. This is a place where people work, not just visit.",
        why:          "The three empty cups in front of the background character is the single most powerful café environment detail — it communicates that real people spend real time here. That is the third-place identity claim, proven visually rather than stated.",
      },

      typography: {
        bad:          "Café name. 'Specialty Coffee'. Hours. WiFi available.",
        whyBad:       "These are the features of a café. Features do not create the desire to visit. The café across the street has the same features.",
        good:         "One identity headline about the experience. 'Your best thinking happens here.' Café name at appropriate scale. Hours in utility zone. No social media handles in acquisition advertising.",
        goldStandard: "Identity headline at 20% visual weight: editorial, specific — 'The morning that belongs to you'. This speaks directly to the third-place identity customer. Café name at 12% — brand, not announcement. Brewing method if distinctive at 8%. Hours in utility zone at 5%, grouped with location. CTA: 'Find us' or the area name — never 'Visit us today'.",
        why:          "'The morning that belongs to you' activates the identity psychology that drives third-place visits. It is not about coffee — it is about what the customer becomes when they are there. Identity activation converts better than product description.",
      },

      layout: {
        bad:          "Coffee cup image. Café name. Social media handles. Hours.",
        whyBad:       "Social media handle in acquisition advertising communicates that you want a follower, not a visitor. It deflects conversion to a lower-value action.",
        good:         "Experience image dominant. Identity headline in negative space. Location and hours in utility zone. No social media handles — these live in the café itself.",
        goldStandard: "Image zone (60%): barista-customer moment, full bleed. Upper zone (20%): identity headline right-aligned, white or cream type, 8% margin. Lower zone (20%): café name left; hours and address centre; area landmark right. No hashtags in the layout. The overall composition reads: experience → identity → location. Exactly in that order.",
        why:          "Acquisition advertising has one job: make someone visit for the first time. Every element not in service of that first visit is wasted space. Social handles serve retention, not acquisition — they have no place in first-visit advertising.",
      },

      commercialDetails: {
        bad:          "Specialty blends available. WiFi. AC. Parking. Takeaway available.",
        whyBad:       "A list of facilities communicates checklist competition. Every competitor has the same checklist. This is the weakest possible commercial signal.",
        good:         "One distinctive commercial detail no competitor can claim: 'Single origin sourced from Coorg farms we visit annually'. Or: 'Reliably fast WiFi. Power at every seat. Open until midnight.'",
        goldStandard: "One specific claim that converts a feature into a reason-to-visit: the farm name, the training pedigree, the brewing method stated with precision. 'Single origin — we source from Coorg farms we visit annually'. Or for a workspace café: 'Reliably fast WiFi. Power at every seat. Open until midnight.' One claim, stated precisely, communicates more than six bullet points — and the precision signals there is a real story behind each claim.",
        why:          "Indian specialty coffee customers are sophisticated. A generic 'specialty coffee' label has lost meaning. One specific, verifiable claim — the farm name, the training, the brewing method — communicates authenticity that broad claims cannot reach.",
      },

      negativeSpace: {
        bad:          "Text placed wherever there's room in the image.",
        whyBad:       "Opportunistic text placement creates visual noise and communicates that the layout is accidental rather than designed — which undermines the premium craft positioning.",
        good:         "All text in clear zones. The craft image uninterrupted by text. Headline in the upper zone. Utility information in the lower zone.",
        goldStandard: "The pour-over moment is a sacred visual zone — no text, no logo, no sticker element crosses into it. Upper 20% is the headline zone: warm cream type, generous tracking, 8% margin from all edges. Lower 20% is the utility zone. Between headline and image: 4% breathing room. Between image and utility zone: 4%. The white space feels like the café itself: intentional, unhurried, made for people who appreciate things done properly.",
        why:          "A café advertisement with generous white space communicates the same thing as the café itself with comfortable table spacing — this is a place that respects your space and your attention. The layout IS the brand promise.",
      },

      marketingPsychology: {
        bad:          "Great coffee. Good ambience. Come relax.",
        whyBad:       "Every café in India claims these three things. They are noise, not signal. No specific psychological trigger is activated by claims that every competitor makes.",
        good:         "Third-place identity: 'This is where I do my best work'. Craft appreciation: 'I understand quality when I see it made with this attention'. Routine ownership: 'This is my morning'.",
        goldStandard: "Third-place psychology: Indian urban professionals aged 25–38 are actively searching for a space that is neither home nor office — a third space where they are fully themselves. This advertisement positions the café as that space. Craft signal: the precision of the pour activates quality-recognition — this is an intentional product made by someone who takes it seriously. Routine ownership: 'the morning that belongs to you' activates the self-determination drive — the desire for one space in the day that is fully yours.",
        why:          "Third-place identity is the deepest motivation for café visits in Indian cities. When the advertisement activates it specifically — rather than claiming 'good vibes' generically — it converts curiosity into a planned first visit.",
      },

      antiPattern: {
        bad:          "Latte art closeup as hero. Flatlay of coffee and props. Overly curated Instagram aesthetic. 'Instagrammable' as selling point. Vocabulary: 'artisanal', 'curated with love', 'crafted'.",
        whyBad:       "Latte art closeup is the most photographed object in Indian food photography and has lost all differentiation value. 'Instagrammable' is a reason to photograph and leave, not a reason to become a regular. Generic craft vocabulary has been absorbed by even the lowest-quality cafés and now signals nothing.",
        good:         "Human craft moment. Real customer in genuine third-place behaviour. Specific coffee claim. Environment that shows evidence of real use by real people.",
        goldStandard: "The café advertisement that converts has no latte art, no flatlay, no 'Good Vibes Only' chalkboard, no 'sip and enjoy', no overproduced symmetrical product photography, no stock images of Western hands around cups. It has one Indian professional caught in a genuine moment of craft or quality-recognition. Everything in the frame is specific to this café. The viewer's first thought: 'Where is this?'",
        why:          "Specificity is the only differentiator available to a café with genuine quality. Generic aesthetic photography communicates that this café is like every other café. A specific, documentary-style human moment communicates that this café has something others don't — even before the viewer can name what it is.",
      },

      conversionInsight: "Café first visits convert when the viewer imagines a specific morning they want to have — not a generic 'nice coffee' but a specific version of their best self in a specific third-place space. The barista's precision and the customer's instinctive attention create that specific morning in the viewer's mind.",
    },

    // ─── DELIVERY ─────────────────────────────────────────────────────────────
    {
      type: "delivery",
      tags: ["delivery", "takeaway", "order online", "home delivery", "zomato", "swiggy", "food delivery", "order now", "quick service"],
      goal: "Drive immediate online order conversion by making the delivery experience feel satisfying, not merely functional.",
      audience: "Indian urban households aged 22–45 ordering food delivery for family meals, weeknight dinners, or late-night hunger.",

      heroSubject: {
        bad:          "Food delivery box with restaurant logo. Food displayed inside the box.",
        whyBad:       "The delivery box is a commodity — every restaurant has one. Photographing the box communicates packaging, not the reason to order from this specific restaurant.",
        good:         "An Indian family's hands reaching simultaneously into the open delivery box. Multiple hands, different sizes — the family discovery moment.",
        goldStandard: "An Indian family kitchen at 8 PM: the delivery box sits on the counter, just opened. Four hands reach in simultaneously — a parent's, a teenager's, a child's, one more. All four faces directed at the box with the specific attention of people about to eat something they've been looking forward to. Steam still rising from the top container. Kitchen light warm overhead. This is the first moment of the meal.",
        why:          "Four hands in one frame communicates family simultaneously. Steam communicates freshness and speed. Faces directed at the box, not at each other, communicates that this food has captured collective attention. Three delivery conversion signals in one image.",
      },

      visualHierarchy: {
        bad:          "Food photo. Discount offer. 'Order Now'. Delivery time. All equal.",
        whyBad:       "Offer-first hierarchy trains viewers to evaluate delivery choices by discount, not food quality — creating price-sensitive customers who switch to whoever has the better offer next week.",
        good:         "Family moment 50%, food visibility 25%, delivery promise 15%, order CTA 10%. Experience first, proof second, ask third.",
        goldStandard: "P1 Family reaching in (45%) — emotional identification. P2 Food visible and steaming in the box (25%) — quality proof. P3 'Delivered in 30 minutes. Still hot.' (20%) — functional promise. P4 Order CTA (10%) — the conversion ask. Discount percentage, if any, appears only as a secondary badge — never as the primary visual or headline.",
        why:          "Price-first hierarchy attracts discount-motivated customers with no loyalty. Experience-first hierarchy attracts quality-motivated customers who reorder. The conversion rates may be similar in week one; the CLV difference over six months is enormous.",
      },

      composition: {
        bad:          "Food photography flatlay with delivery packaging as props.",
        whyBad:       "Flatlay food photography with packaging is a product display, not a delivery experience. It communicates 'here is the food' but not 'here is why you want to order this tonight'.",
        good:         "Counter-height shot at the family's reach level. Open box in lower frame half, hands coming from above. Kitchen environment visible but not dominant.",
        goldStandard: "Camera at counter-height, slightly angled downward — the perspective of someone standing across the kitchen counter watching the family open the box. Open box occupies the lower 40% of frame. Four hands enter from the upper portion — visible from wrist to fingertip, each hand individual and recognisably different. Steam rises from the box into the space between the hands and the upper frame. Kitchen background warm but soft — appliances barely readable, family photographs blurred on the refrigerator.",
        why:          "Counter-height shooting places the viewer at the social level of the event — standing in the kitchen as a family member, not as an observer. Hands entering from above frame create movement and anticipation.",
      },

      photography: {
        bad:          "Food photography with professional setup. Delivery bag included as prop.",
        whyBad:       "Professional setup signals 'advertisement' immediately and removes the authenticity delivery conversion requires. Delivery advertising must feel like a real evening, not a photoshoot.",
        good:         "35mm wide at counter level. Only practical kitchen lighting. Steam in motion. The box lid still moving, not set for the photograph.",
        goldStandard: "35mm wide lens at counter level. Practical kitchen overhead lighting only — no softbox or reflector. 1/100s shutter speed so steam reads as slightly soft rather than frozen. The box lid is at 70 degrees — just opened, not positioned. Hands are mid-reach, not placed for symmetry. The image should feel as though the photographer was in the kitchen when this happened, not that they arranged it to look like it happened.",
        why:          "Kitchen-as-it-is versus kitchen-as-staged is the single most important choice in delivery advertising. Indian families identify staged home photography immediately. The 'caught in the moment' quality — lid at an odd angle, hands mid-motion — is what communicates authenticity.",
      },

      subjectDirection: {
        bad:          "Family sitting at table, food in front of them, everyone smiling at camera.",
        whyBad:       "Dining table with everyone smiling is the most photographed and least trusted image in food delivery advertising. Indian families know this image is staged — it never looks like how anyone actually eats.",
        good:         "Family at counter or table, all focused on the food — serving themselves, choosing, passing. No one looking at camera. Movement and choice visible.",
        goldStandard: "The family never acknowledges the camera. The teenager has taken two containers out of the box and is reading the labels to find his order. The parent is directing the child's hand to the right container — 'that one's yours'. The other parent is lifting the steam-covered lid off the curry, head slightly turned away from the rising steam. These are the genuine micro-actions of a family receiving a delivery. Every action is directed at the food.",
        why:          "The specific gesture of a parent directing a child's hand to 'their' container communicates family dynamics that Indian viewers recognise immediately. It makes the advertisement feel like a memory from their own home.",
      },

      environment: {
        bad:          "Home kitchen background.",
        whyBad:       "Generic 'home kitchen background' could be any kitchen. The specificity of the environment is what makes the family feel real and therefore the food feel desirable.",
        good:         "An Indian kitchen that has been used: half-finished dish on one counter, school bag on a chair, a calendar on the wall. Evidence of a real household at 8 PM.",
        goldStandard: "A mid-range Indian apartment kitchen at 8 PM: the overhead tubelight is on because it is evening. On one counter: a half-full pressure cooker from the afternoon — today was a day when takeaway made sense. School bag on one kitchen chair. Calendar on the wall with some dates circled. The refrigerator has a child's drawing held by a magnet. The kitchen is clean but lived-in — not staged. The delivery box sits on this counter as though it belongs here.",
        why:          "The half-full pressure cooker is the single most powerful environmental detail in food delivery advertising for Indian families. It communicates 'this is a day when cooking didn't happen' without stating it — and every Indian family knows that day. The delivery box is the solution to that specific day.",
      },

      typography: {
        bad:          "ORDER NOW! 30 Minutes Delivery. 20% OFF. All in all-caps urgency.",
        whyBad:       "All-caps urgency combined with a discount offer communicates that the only reason to order is the deal — eroding quality positioning of even a premium restaurant.",
        good:         "Simple delivery promise as headline. Restaurant name as brand anchor. CTA as clear action. No all-caps except for the CTA button label.",
        goldStandard: "Headline: 'Dinner, while it's still hot.' — the delivery value proposition without mentioning the restaurant or the offer. Restaurant name at 12% visual weight below. Delivery promise at 10%: '30 minutes. Hot when it arrives.' Order CTA at 14% — slightly larger than body, clearly actionable. If there is an offer: a badge at the frame edge — 'First order: ₹100 off' — not in the headline zone. The offer feels like a discovery, not the reason to order.",
        why:          "'Dinner, while it's still hot' activates the actual delivery desire: hot food at home tonight without cooking. It speaks to the feeling, not the transaction. This headline converts by speaking to the experience, letting the offer close the deal.",
      },

      layout: {
        bad:          "Big food photo. Big offer text. Order button. Maximum information density.",
        whyBad:       "Offer as the dominant layout element creates price-anchoring — the viewer's attention goes to the discount first and the food second. This is the wrong order for quality positioning.",
        good:         "Family moment image dominant. Delivery promise in upper zone. Order CTA in lower zone. Offer as badge element, not the headline.",
        goldStandard: "Family moment fills 65% — full bleed, counter-height. Upper 15%: restaurant name left, delivery time right. Lower 20%: left — 'Order online' with platform logos; centre — direct order CTA; right — offer badge (if any) at reduced prominence, never exceeding 10% visual weight. Total layout impression: this is about the meal for your family tonight, not about saving ₹100.",
        why:          "Layout is the first communication before a single word is read. When the layout communicates 'this is a meal for your family tonight', the viewer is in a different — and more loyal — decision state than when the layout communicates 'this is about saving ₹100'.",
      },

      commercialDetails: {
        bad:          "Free delivery above ₹299. Use code SAVE20. Limited time offer.",
        whyBad:       "Minimum order thresholds and discount codes create mental calculation that breaks the emotional moment. They communicate that the restaurant is making the ordering process transactional rather than experiential.",
        good:         "Direct order link or QR. Delivery time promise. If there's an offer: 'First order ₹100 off — applied automatically'. No codes, no minimum calculations.",
        goldStandard: "Platform logos (Swiggy/Zomato) with direct order links or QR codes — no codes to remember, no minimum thresholds to calculate. Delivery promise: '30 minutes guaranteed, or your next order is free' — a promise, not a discount. First order offer if applicable: 'Your first order: ₹100 off, applied at checkout'. Code-free, calculation-free. The ordering process should feel as easy as the family's decision to order.",
        why:          "Code-free, calculation-free ordering communicates confidence in the product. It says 'we want you to order so much that we've removed every reason not to'. That confidence is itself a trust signal — and trust is what creates the second order.",
      },

      negativeSpace: {
        bad:          "All available space used for offers and information. Maximum density.",
        whyBad:       "Filling all space with offer information creates a promotional flyer — precisely the discount-hunter association that quality restaurant delivery advertising must avoid.",
        good:         "The family moment has uninterrupted breathing room. The steam rising from the box has space to register. Text is in clear zones.",
        goldStandard: "The family reach-in moment occupies the full image zone without text interruption. The steam rising above the box has at least 8% of vertical space before reaching any text element — this breathing room is what makes the steam visible as a freshness signal rather than visual noise. Between upper text zone and image: 3%. Between image and lower commercial zone: 3%. The steam, the hands, the open box — these must never compete with text for the viewer's attention.",
        why:          "The steam above the food is the most important visual proof element in delivery advertising — it communicates 'still hot', addressing the primary Indian delivery anxiety. When steam has breathing room, the viewer registers it consciously as proof. When text crowds it, the viewer registers neither.",
      },

      marketingPsychology: {
        bad:          "Delicious food. Fast delivery. Good value. Three generic claims.",
        whyBad:       "These are table-stakes claims for every food delivery option in every Indian city. They communicate nothing about why to choose this restaurant over a dozen alternatives visible in the same app.",
        good:         "Family permission psychology: 'tonight you don't need to cook'. Hot food certainty: the steam proves freshness. Shared anticipation: the family reaching in together creates joint desire.",
        goldStandard: "Weeknight permission: the half-finished pressure cooker activates the specific Indian household psychology of 'some days, cooking doesn't happen, and that's a reasonable decision'. This advertisement gives that decision permission. Freshness proof: the steam is visual evidence that the restaurant's food survived delivery without quality loss — it addresses the primary Indian delivery anxiety without stating it. Family cohesion: four hands reaching in together communicates that this meal creates the shared moment a home-cooked dinner does.",
        why:          "Indian family delivery decisions are made by the person who would otherwise be cooking. The advertisement that gives that person permission to not cook tonight — while proving the food will be good — converts fastest. Permission + quality proof = order.",
      },

      antiPattern: {
        bad:          "Delivery box hero shot with no family. Big discount percentage as headline. 'Order now and save!' Countdown timer graphic. Celebrity chef endorsement without the food.",
        whyBad:       "Box-as-hero removes the experiential element entirely. Discount-as-headline creates a price-anchored customer with no loyalty. Countdown timers communicate anxiety and are resisted by Indian consumers who have learned to distrust artificial urgency.",
        good:         "Family with the food in a real home environment. Delivery promise as headline. Food quality visible through steam and texture. Order CTA clear without discount dependency.",
        goldStandard: "The delivery advertisement that creates loyal customers shows a family that looks like the target audience receiving food that looks genuinely good, in a home that looks genuinely like their home. Every claim is visually proven: food steaming — proven fresh; family reaching in — proven desirable; kitchen real — proven authentic; order CTA clear — proven simple. The offer, if present, is a quiet bonus. Everything else is honest.",
        why:          "Delivery advertising that focuses on experience over deals creates the first-order customer who comes back. Every percentage-off headline creates the first-order customer who waits for the next deal. The first customer is worth 10× the second over a 6-month period.",
      },

      conversionInsight: "Delivery orders convert when the viewer can feel the specific satisfaction of that first reach into the open box. The family's simultaneous reach communicates shared desire — and shared desire is more powerful than individual desire for household ordering decisions. Show the first three seconds after the box is opened.",
    },

  ],
};
