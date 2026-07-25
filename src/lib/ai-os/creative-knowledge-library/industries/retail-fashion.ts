// Creative Knowledge Library — Retail & Fashion

import type { IndustryKnowledge } from "../types";

export const retailFashion: IndustryKnowledge = {
  id:    "retail_fashion",
  label: "Retail & Fashion",
  campaigns: [

    {
      type: "fashion_launch",
      tags: ["fashion", "clothing", "apparel", "launch", "collection", "brand", "wear", "outfit", "style", "ethnic", "western", "kurta", "saree"],
      goal: "Drive footfall or online orders by communicating the identity the garment enables, not the garment itself.",
      audience: "Indian women aged 22–38 making fashion purchases for self-expression, occasions, or professional image.",

      heroSubject: {
        bad:          "Model on white background displaying the garment. Front-facing pose.",
        whyBad:       "White background model photography communicates catalogue, not campaign. The white background removes all context — and fashion sells context as much as garment. The Indian woman buying fashion is not buying a garment; she is buying herself in a specific moment.",
        good:         "An Indian woman wearing the garment in a specific moment that the garment enables — not a photoshoot, but the occasion the garment was designed for.",
        goldStandard: "An Indian woman in her late 20s in a kurta set is standing at the edge of a rooftop at golden hour in Mumbai. She is not looking at the camera. She has a glass of something cold in her hand. Her attention is on the conversation happening just off-frame — someone she is glad to be with, on an evening she will remember. The kurta moves slightly in the evening breeze. She looks exactly like someone who chose this deliberately and got it completely right.",
        why:          "The image of a woman looking exactly right in a specific moment — not at the camera, not displaying the garment — communicates the aspiration that sells fashion. The viewer buys the feeling of looking that right in that moment, not the garment.",
      },

      visualHierarchy: {
        bad:          "Garment front-facing dominant. Price. 'New Collection'. Website or shop link.",
        whyBad:       "Garment-display hierarchy communicates catalogue. Price in fashion campaign advertising creates a discount evaluation before aesthetic identification is established.",
        good:         "Woman in her specific golden-hour moment 55%, the garment's movement and detail 25%, occasion atmosphere 15%, brand name and CTA 5%.",
        goldStandard: "P1 Woman's ease and rightness in the moment (45%) — the emotional outcome of buying this garment. P2 The garment's silhouette and movement in the evening light (25%) — the garment's quality shown through its behaviour. P3 The golden hour and the rooftop (20%) — the occasion context the garment is suited for. P4 Brand name (5%). P5 Shop CTA (5%). No price, no 'new collection' label.",
        why:          "When the woman's ease in the moment dominates rather than the garment, the viewer buys the ease. Ease is a higher-value purchase motivation than garment specification.",
      },

      composition: {
        bad:          "Full-length model shot on white or solid-colour background. Garment visible front to bottom.",
        whyBad:       "Full-length white-background shots are for catalogue pages. They communicate product for assessment, not experience for identification.",
        good:         "Three-quarter shot at golden hour, the woman slightly turned away or in profile. The garment visible in movement, not display. The rooftop and evening atmosphere framing her.",
        goldStandard: "85mm lens at eye level. The woman in three-quarter profile — turned perhaps 40 degrees from camera, her attention on the conversation off-frame. The kurta is visible from shoulder to below the knee, its silhouette defined by the evening backlight. The rooftop railing or cityscape is visible in the far background. Her hair has the specific arrangement of someone who set it for the evening and the breeze has contributed. The light is warm enough to communicate what golden hour actually looks like rather than what photo-studio golden hour approximates.",
        why:          "Three-quarter profile with off-frame gaze attention creates the most aspiration-effective fashion composition because the viewer's imagination completes the scene — they wonder who she is talking to, what the evening is, and whether they could look like that in that moment.",
      },

      photography: {
        bad:          "Studio lighting on solid background. Clean, technical fashion photography.",
        whyBad:       "Studio fashion photography communicates brand catalogue and separates the garment from the occasions it is suited for. The Indian fashion buyer is not buying in a studio context.",
        good:         "Golden hour natural light, 85mm at eye level. The garment's colour and texture responding to warm evening light rather than studio light.",
        goldStandard: "85mm lens at eye level — the lens that sees the human figure most naturally, without distortion. Golden hour: the 40-minute window of warm directional light that wraps the garment and the wearer simultaneously. The light comes from the horizon, slightly behind the subject, creating a warm edge along the garment's silhouette and the wearer's hair. 1/250s at f/2.8 — the background cityscape is soft, the garment and wearer sharp. The garment's colour shifts slightly toward the warm end of its range — which is how the wearer will actually see it in the occasions she wears it for.",
        why:          "Golden hour photography for Indian fashion advertising converts at higher rates than studio photography because the Indian occasion wardrobe is worn at golden hour — at weddings, at parties, at evenings with people she cares about. Showing the garment in the light it will actually be worn in creates honest desire rather than studio aspiration.",
      },

      subjectDirection: {
        bad:          "Model posing at camera, showing the garment's features.",
        whyBad:       "Directed camera poses communicate model-wearing-garment rather than woman-in-her-own-life. The distinction is everything in fashion advertising.",
        good:         "Woman directed to be in the evening, in the conversation, in her moment — not in the photoshoot. Garment visible through her being in it naturally.",
        goldStandard: "The direction to the woman: 'There is someone just off-frame who you are genuinely glad to see. You are listening to them finish a story. Your drink is cold. You are exactly where you wanted to be tonight.' Her weight shifts to one hip. Her glass is held at shoulder height. Her attention is on the story being told. Her expression is the specific expression of someone who is genuinely in their evening, not in a photoshoot. The photograph is taken when she laughs slightly at the end of the story — before she has arranged her expression.",
        why:          "The laugh that arrives before the expression is arranged is the most authentic and therefore most aspirational fashion image available. It communicates 'this is what she is actually like in this garment on this evening' — which is the viewer's exact aspiration.",
      },

      environment: {
        bad:          "Studio with coloured backdrop. Outdoor street with no occasion context.",
        whyBad:       "Studio backdrops communicate catalogue. Generic outdoor streets communicate casualwear rather than the occasion Indian ethnic fashion is primarily purchased for.",
        good:         "A Mumbai or Delhi rooftop at golden hour: the city visible below, the sky warm, the occasion implied by the elevation above the ordinary street.",
        goldStandard: "A rooftop in Mumbai or Delhi at golden hour: the city below is visible but soft — buildings and lights beginning to appear in the early evening. The rooftop surface: stone or concrete, with potted plants at one edge creating a garden-above-the-city feeling. Other people visible at the rooftop's periphery — this is a gathering, not a solo moment — but soft-focused enough that she is the only sharp presence. The occasion is clear from the context: this is the kind of evening the garment was designed for.",
        why:          "Rooftop evening context for Indian fashion advertising communicates the specific social occasion — the gathering, the celebration at the end of a working week, the birthday dinner — that is the primary purchase motivation for Indian women's ethnic fashion. The garment is being purchased for this evening, not for the studio.",
      },

      typography: {
        bad:          "BRAND NAME. New Collection. Shop Now. Starting from ₹X.",
        whyBad:       "'Starting from ₹X' in fashion campaign advertising attracts price-comparison buyers. 'New Collection' communicates every fashion brand simultaneously. 'Shop Now' demands action before desire is established.",
        good:         "One occasion-moment headline. Brand name at appropriate hierarchy. One specific garment name or collection name. Shop or explore CTA.",
        goldStandard: "Headline at 18% visual weight: 'For the evenings that deserve to be remembered.' — this speaks directly to the specific Indian woman buying ethnic fashion for occasions. Brand name at 15% — confident, not dominant. Collection name at 10%: 'The Summer Evening Collection'. Shop CTA at 12%: 'Explore the collection' — not 'Shop Now'. No price, no 'Starting from'. The typography communicates: this brand makes garments for evenings that matter.",
        why:          "'For the evenings that deserve to be remembered' is the headline that the rooftop golden hour image earns. It names the aspiration explicitly — the occasions that the Indian woman who buys ethnic wear is actually purchasing for.",
      },

      layout: {
        bad:          "Full garment display image. Price panel. Discount offer. Multiple garments in grid.",
        whyBad:       "Multi-garment grids in fashion campaign advertising create choice paralysis rather than desire. Discount offer framing communicates clearance rather than collection launch.",
        good:         "One occasion moment image dominant. One headline. Brand name. Single explore CTA. No price, no grid.",
        goldStandard: "Occasion moment image (70%) — full golden hour rooftop moment, uncrowded. Upper zone (15%): headline left-aligned; brand name below at smaller weight. Lower zone (15%): collection name left; 'Explore the collection' CTA centre; 'Available online and in-store' right. No price in the layout. No multiple-garment grid. The layout communicates: one moment, one brand, one CTA to enter.",
        why:          "Fashion advertising with a single strong occasion image and a single explore CTA converts browsers to shoppers at higher rates than multi-garment grids because it creates a specific desire before offering a catalogue. Specific desire precedes purchase; catalogue browsing does not.",
      },

      commercialDetails: {
        bad:          "20% off launch offer. Free shipping above ₹X. Easy returns. COD available.",
        whyBad:       "Discount offers at launch undermine the premium positioning of a fashion collection. 'Easy returns' communicates purchase doubt. COD availability communicates mistrust.",
        good:         "Collection name and one distinguishing characteristic. Occasion it is suited for. Website where it can be explored. Delivery information as service, not as anxiety resolution.",
        goldStandard: "Collection name: '[Name] Collection — [season] [year]'. Garment occasion: 'Crafted for festive evenings, dinner gatherings, and moments worth dressing for'. Website: '[brand].com' — clean, present. Delivery: 'Free delivery above ₹X — 3–5 days' — present as a service, not as a concern resolver. No launch discount. No 'easy returns' in campaign advertising. These belong in the checkout experience, not the desire-building campaign.",
        why:          "Fashion commercial details that focus on the occasion and the website rather than discounts and logistics attract buyers who are motivated by desire rather than transaction efficiency. Desire-motivated buyers have higher average order values and lower return rates.",
      },

      negativeSpace: {
        bad:          "All space used for garment displays, discount badge, and multiple CTAs.",
        whyBad:       "Dense fashion advertising communicates fast fashion and clearance rather than considered collection. The visual density communicates the opposite of the premium occasion the garment is positioned for.",
        good:         "The golden hour moment breathes. The headline has space. The brand name is present and unhurried. The CTA is singular.",
        goldStandard: "The occasion moment image has 5% breathing margin within the image zone. The golden hour sky should have room above the subject — do not crop the warmth of the evening light. The upper zone headline has 8% space above it. Between headline and image: 4%. The lower zone contains three elements maximum with 8% internal spacing. Total impression: this is a brand that makes garments for moments, not for catalogues. Visual space communicates that this brand does not need to compete for attention.",
        why:          "Fashion advertising negative space communicates editorial — the same visual quality as the fashion editorial pages Indian women use as their aspiration reference. When campaign advertising has the negative space of editorial photography, it occupies the same mental category.",
      },

      marketingPsychology: {
        bad:          "Look amazing. Express yourself. Fashion that speaks for you.",
        whyBad:       "Generic fashion language activates no specific aspiration. 'Express yourself' is the most overused fashion advertising instruction in the industry.",
        good:         "Occasion enablement: 'this garment makes the evening you've been imagining possible'. Rightness feeling: 'exactly where I wanted to be, exactly how I wanted to look'. Memory creation: 'for evenings that deserve to be remembered'.",
        goldStandard: "Occasion enablement psychology: the Indian woman buying ethnic fashion is primarily motivated by specific occasions she is planning for — a wedding she will attend, a dinner she is hosting, an evening she imagines. The advertisement that places the garment in that specific evening activates the most direct possible purchase motivation. Rightness feeling: 'she looks exactly right' is the internal experience of every Indian woman who has found the garment for the specific occasion. The advertisement that creates this feeling — through the three-quarter profile, the golden hour, the ease — is the one that converts. Memory creation: 'for evenings that deserve to be remembered' activates the buyer who is purchasing the garment for a significant occasion.",
        why:          "Indian ethnic fashion advertising converts at highest rates when it places the buyer in the specific occasion she is purchasing for, rather than showing her the garment in isolation. The garment is purchased for the occasion; the advertisement that shows the occasion with the garment in it is selling what the buyer is actually buying.",
      },

      antiPattern: {
        bad:          "International model wearing Indian ethnic wear. White background catalogue. Festival discount banner. Influencer looking at phone. Collection grid with prices.",
        whyBad:       "International models wearing Indian ethnic wear create an aspiration distance — Indian women buying ethnic fashion want to see themselves in the garment. White background catalogue communicates price comparison rather than occasion aspiration. Festival discount banners communicate transaction anxiety rather than collection confidence.",
        good:         "Indian woman in Indian occasion context, wearing the garment in the evening it was designed for. No international model, no catalogue background, no discount banner. One evening. One garment. One moment.",
        goldStandard: "The fashion launch advertisement that converts Indian women buyers shows one Indian woman — real enough to identify with, aspirational enough to reach toward — in the specific golden hour occasion the garment was designed for. She is not displaying the garment. She is in the evening. The garment is what she chose for it. The headline names the kind of evening. The CTA opens the collection. No discount, no catalogue, no white background. One evening, perfectly composed.",
        why:          "Indian women who purchase ethnic fashion for occasions are not comparing garments — they are imagining themselves in the occasion. The advertisement that shows them in the occasion rather than the garment converts the buyer who has that occasion coming up and has not yet found her garment for it.",
      },

      conversionInsight: "Fashion purchases happen when the buyer can imagine herself in the advertisement's moment — not when she has compared the garment against alternatives. The rooftop golden hour, the three-quarter profile, the conversation off-frame — these create the moment the buyer is purchasing for. Show the moment. The garment follows.",
    },

  ],
};
