// Creative Knowledge Library — Anti-Pattern Library

import type { AntiPattern } from "../types";

export const ADVERTISING_FAILURES: AntiPattern[] = [

  {
    label:       "Subject Centred in Frame",
    description: "The primary subject — person, product, or hero element — is placed dead centre in the frame with equal space on all sides.",
    why:         "Centred composition creates visual stasis. The viewer's eye has nowhere to travel — it arrives and stops. Commercial advertising requires visual movement that guides the eye from hero to commercial details to CTA. A centred subject also consumes the composition budget that should be reserved for hierarchy, leaving no room for supporting elements to breathe.",
    fix:         "Place the primary subject at the golden ratio point (approximately one-third from left or right, one-third from top or bottom). Allow the remaining two-thirds to carry supporting elements, environment context, and white space that the composition needs to breathe.",
  },

  {
    label:       "Flat Studio Lighting",
    description: "A single softbox or ring light placed directly in front of the subject, eliminating all shadows and depth.",
    why:         "Flat lighting removes depth, texture, and three-dimensionality from the subject. It communicates 'product catalogue' rather than 'aspirational context'. Indian consumers have developed sophisticated recognition of flat studio photography as low-budget execution. Depth and shadow are what make subjects look premium and real.",
    fix:         "Use a key light at 30–45 degrees from the subject with a fill light at reduced power to preserve shadow. Add a practical light source from the environment (window, lamp, diya) to create depth layers. Light the environment, not just the subject.",
  },

  {
    label:       "People Looking Directly at Camera",
    description: "The human subject makes full eye contact with the camera lens, performing happiness or emotion directly for the viewer.",
    why:         "Direct camera eye contact turns a character into a performer. It breaks narrative immersion and communicates 'this is an advertisement, these people are pretending'. Indian advertising that converts does so because the viewer can project themselves into the moment. A person staring at the camera is in a different world than the viewer — they cannot enter it.",
    fix:         "Capture the human subject in a genuine decisive moment directed at another person, an object, or a discovery — never the camera. The exception is direct address formats (testimonials, spokespeople) where the eye contact is intentional and the viewer is the audience.",
  },

  {
    label:       "Equal Type Weight Hierarchy",
    description: "Headline, subheadline, body copy, CTA, and logo all appear at similar sizes and weights, creating a democratic but navigationally useless layout.",
    why:         "Human eyes are scanners. They enter a frame at the highest contrast point and follow a path. When all type elements have equal visual weight, the eye has no path to follow. The viewer reads nothing because the layout demands they read everything simultaneously, which is impossible. Commercial advertising must have one dominant message that captures the eye in 0.5 seconds.",
    fix:         "Establish a strict 3-level hierarchy: (1) DOMINANT — one headline at 200–300% of body size, (2) SECONDARY — one subheadline at 130–150%, (3) SUPPORT — all other elements at base size. The CTA should be larger than body copy but smaller than the headline. The logo should be the smallest named element.",
  },

  {
    label:       "Random Background Objects",
    description: "Background elements — furniture, objects, decorative items — chosen for visual texture rather than for what they communicate about the subject or brand.",
    why:         "Every pixel of an advertising image is either working or wasting. Background objects that are present for texture create visual noise that dilutes the message. More critically, random objects communicate randomness — suggesting the creative team did not think carefully about what each element should say. Viewers process backgrounds unconsciously but they do process them.",
    fix:         "Every background element must earn its place by either (a) communicating something specific about the subject's world, (b) creating a depth layer that makes the hero more legible, or (c) establishing the environmental context that the story requires. If you cannot state why an element is there, remove it.",
  },

  {
    label:       "Product Floating in White Space",
    description: "A product photographed in isolation against pure white, with no environment, no human interaction, and no context communicating its use.",
    why:         "Products without context communicate nothing about who uses them, when, why, or how they make life different. Indian consumers do not buy features — they buy what the product makes possible. A product floating in white space forces the viewer to supply all the imagination for why this matters, which they will not do. Only premium minimalist brands can use context-free product photography, and only because context is implied by brand recognition.",
    fix:         "Show the product in the decisive moment of its use — in the hand of the person who will use it, in the environment where it belongs, at the moment the benefit is being received. The product's best advertisement is the person's face or body one second after the product has worked.",
  },

  {
    label:       "Generic Stock Smile",
    description: "The human subject displays a broad, generic, camera-directed smile that communicates performed happiness rather than authentic response to a real moment.",
    why:         "The generic stock smile is the most quickly processed signal of inauthenticity in advertising. Indian consumers — sophisticated and media-literate — have been shown thousands of generic smiles. The brain immediately processes 'advertisement' and skips to the next piece of content. Authentic emotion, even if smaller or less visually dramatic, converts because it registers as real.",
    fix:         "Capture the micro-expressions that precede or follow larger emotions — the exhale, the pause before speaking, the eyes softening before a smile. These moments are real and therefore register as real. A genuine half-smile converts better than a perfect full smile, because the viewer's brain cannot dismiss it as performance.",
  },

  {
    label:       "All Copy in UPPERCASE",
    description: "Running the full headline, subheadline, and body copy in uppercase letters throughout the entire advertisement.",
    why:         "Uppercase is high contrast and fast to read for headlines. Applied uniformly, it creates a monotonic visual rhythm where all text shouts at the same volume. The hierarchy collapses — everything is urgent, which means nothing is. Uppercase at body copy length also dramatically reduces reading speed because word shapes (which aid reading fluency) are eliminated in all-caps text.",
    fix:         "Reserve uppercase for: (a) the single most important word or phrase in the headline, (b) short CTA phrases of 2–4 words. Headlines should use title case or sentence case. Body copy should always use sentence case. The uppercase element reads as emphasis only when surrounded by mixed-case text.",
  },

  {
    label:       "Multiple Call-to-Actions",
    description: "The advertisement asks the viewer to take more than one action: 'Call us / Visit website / Follow us / Book now / Learn more'.",
    why:         "Each additional CTA halves the probability that any CTA is acted upon. The brain presented with multiple equivalent choices experiences decision paralysis and chooses none. More fundamentally, having multiple CTAs reveals that the advertiser does not know what they want from the viewer — which communicates a lack of conviction that the viewer unconsciously processes as a reason not to act.",
    fix:         "Select the single highest-value action for this specific advertisement objective and make it the only CTA. If secondary CTAs are genuinely required (website + phone), establish a strict primary/secondary hierarchy where one is visually dominant and the other is utility-only.",
  },

  {
    label:       "Incongruent Typography Register",
    description: "A mismatched combination of typeface register and brand promise — for example, a playful rounded font for a premium financial service, or a severe serif for a children's dental clinic.",
    why:         "Typography speaks before words do. The visual register of a typeface communicates personality, price point, and emotional territory in the first 50 milliseconds of viewing — before the viewer has read a single word. A typeface that contradicts the brand promise creates subconscious dissonance that reduces trust and message retention, even when the viewer cannot identify the source of the discomfort.",
    fix:         "Match typeface register to brand promise: premium/aspirational → thin weights with generous tracking; trust/authority → moderate weight serif or humanist sans; approachable/accessible → slightly rounded sans-serif at comfortable weight; urgency/energy → condensed sans-serif at bold weight. Never use decorative or display fonts for body copy.",
  },

  {
    label:       "Oversaturated Festive Palette",
    description: "For festive or sale advertising, using the maximum possible saturation of orange, red, yellow, and gold simultaneously, creating a palette that communicates cheapness rather than celebration.",
    why:         "Festive colours are earned through restraint. When all festive colours are used at maximum saturation simultaneously, they cancel each other's signal — the eye sees noise, not celebration. More critically, maximum-saturation multi-colour palettes are associated with budget advertising in Indian consumer psychology, which directly contradicts the value signal that even sale advertising should maintain.",
    fix:         "Select one festive dominant colour and two supporting tones, with one significant area of neutral (white, cream, or deep black) that the festive colour contrast against. The festive signal is strongest when the dominant colour is surrounded by space. Gold works best as an accent, not a background.",
  },

  {
    label:       "Feature List as Advertising",
    description: "The advertisement's primary content is a bullet list of product features or service inclusions, without any emotional frame or human benefit.",
    why:         "Features are the language of the manufacturer. Benefits are the language of the buyer. A list of features communicates that the advertiser is more interested in the product than in the viewer. More practically, feature lists require the viewer to do the work of translating features into their personal relevance — which most viewers will not do. Features that are not emotionally framed are forgotten within seconds of viewing.",
    fix:         "Select the single most impactful feature and translate it into the specific human benefit it delivers. Show that benefit in the advertisement's visual. The feature can be mentioned in subheadline or body copy once the emotional benefit has been established. 'GST-compliant reports in 4 minutes' is a feature. 'Your evenings back' is the benefit.",
  },

  {
    label:       "Logo as Primary Visual Element",
    description: "The brand logo is the largest, most prominent element in the advertisement, occupying 20% or more of the total frame.",
    why:         "Logos communicate nothing to viewers who do not already know the brand. For established brands, an oversized logo is redundant — the design system communicates brand recognition without it. For new brands, an oversized logo communicates insecurity rather than confidence. In both cases, the logo space could be occupied by the human benefit, the hero moment, or the environmental context that would actually convert viewers.",
    fix:         "The logo should occupy 3–5% of the total frame, positioned in the lower-right corner or upper-right corner of the safe zone. The brand is communicated through the entire visual system — palette, tone, composition, and emotional register — not through logo size.",
  },

  {
    label:       "Green Screen Composite Environments",
    description: "Subjects photographed in front of a green screen and composited against a digital environment or stock background that was not photographed at the same time.",
    why:         "Green screen composites — even technically proficient ones — produce an uncanny valley effect because light direction, shadow quality, depth of field, and colour temperature between the subject and background rarely match perfectly. Indian viewers have been exposed to enough quality content to process composites as low-budget within seconds. The inauthenticity signal undermines the trust that commercial advertising requires.",
    fix:         "Photograph the subject in the actual environment the advertisement requires, or in a purpose-built practical set. If budget constraints make this difficult, choose a simpler authentic environment (even a single wall of the right colour) over a complex composited one. A simple authentic environment always outperforms a complex fake one.",
  },

  {
    label:       "Motion Without Direction",
    description: "Hair, fabric, or objects are shown mid-movement — but the movement has no discernible direction, source, or narrative purpose.",
    why:         "Motion in advertising is a visual promise: it implies energy, life, and transformation. Motion without direction breaks this promise — it communicates 'we added motion because motion looks dynamic' rather than 'this energy comes from somewhere and goes somewhere'. Directionless motion is the visual equivalent of a generic stock smile: technically executed but emotionally empty.",
    fix:         "Every motion element should have a clear physical cause and a discernible direction that supports the narrative. Hair blowing toward the left has a source (wind) and implies forward movement. A dupatta caught at arm's length has a cause (the buyer evaluating in doorway light) and communicates the buyer's confidence. Motion should be explained by the scene.",
  },

];
