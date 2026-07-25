// Creative Knowledge Library — Events & Entertainment

import type { IndustryKnowledge } from "../types";

export const eventsEntertainment: IndustryKnowledge = {
  id:    "events_entertainment",
  label: "Events & Entertainment",
  campaigns: [

    {
      type: "event_promotion",
      tags: ["event", "show", "concert", "festival", "performance", "live", "ticket", "venue", "gig", "experience", "wedding", "comedy", "music"],
      goal: "Drive ticket sales and attendance by communicating the specific experience the event creates, not the lineup or venue.",
      audience: "Indian urban adults aged 20–40 deciding between staying home and attending a live event.",

      heroSubject: {
        bad:          "Event poster with artist/performer name large. Date, venue, ticket price. Generic excitement.",
        whyBad:       "Name-dominant event posters communicate information, not experience. The audience deciding between attending and not attending is not making an information decision — they have the information. They are making an experience decision.",
        good:         "The specific moment during the event that audiences remember after — the second the performer hits the peak note, the crowd lighting moment, the comedian's expression after the best joke lands.",
        goldStandard: "A performer at the peak moment of their craft on stage: a musician at the highest emotional point of a specific song — eyes closed, head back, microphone angled — the moment when the entire audience is doing the same thing simultaneously. The stage lighting creates a single beam of warm gold on the performer. The audience is visible in the foreground — a sea of phones up and people with eyes closed simultaneously. This is the moment 3,000 people drove through traffic to get to.",
        why:          "The performer's peak moment image converts because it shows the viewer what the event will feel like at its best moment — which is the experience they are buying. Artist name and venue are information; the peak moment is the reason.",
      },

      visualHierarchy: {
        bad:          "Artist name 60% visual weight. Date. Venue. Ticket price. Buy now.",
        whyBad:       "Artist-name-dominant design communicates to fans who already know they want to attend. It does not convert the undecided buyer — who has heard of the artist but not yet committed to the experience.",
        good:         "Peak performance moment 55%, the atmosphere and crowd 25%, artist name and date 15%, ticket CTA 5%.",
        goldStandard: "P1 The peak performance moment (50%) — the experience the ticket buys. P2 The audience at that moment (25%) — 3,000 people doing the same thing simultaneously, communicating that this is a collective experience worth being part of. P3 Artist name at 15% — visible, confident, not dominant. P4 Date, venue, ticket CTA (10%) — the information needed to act after the desire is established.",
        why:          "Hierarchy that leads with the peak experience moment then provides the artist name and booking information converts at higher rates than hierarchy that leads with the artist name — because it converts the undecided buyer by establishing desire before providing the booking path.",
      },

      composition: {
        bad:          "Performer headshot on dark background. Event details overlaid. Generic concert stock image.",
        whyBad:       "Performer headshot on dark background is the standard event poster format — it communicates 'event advertisement' without communicating 'specific experience worth attending'.",
        good:         "Stage level or audience level: looking from the crowd toward the performer at their peak moment. The performer small but the atmosphere vast. The crowd visible as active participants.",
        goldStandard: "Wide 24mm shot from slightly elevated above the front row, looking toward the performer on stage. The performer is in the upper third of frame, lit by a single warm stage beam. The crowd occupies the lower two-thirds — phones up, people lost in the moment. The stage lighting creates dramatic warm/blue contrast. Reading flow: the performer (the source) → the crowd experiencing it (the outcome) → the specific atmosphere of this specific event.",
        why:          "Shooting from crowd level toward the performer communicates 'what it feels like to be in the audience' — which is the specific experiential purchase the ticket buyer is making. The buyer wants to be in that crowd at that moment.",
      },

      photography: {
        bad:          "Promotional photography. Artist headshot. Clean studio lighting.",
        whyBad:       "Studio photography for live event advertising creates the opposite of the event's experience — the event's value is rawness, energy, and the specific chaos of live music. Studio photography communicates controlled rather than alive.",
        good:         "Real live performance photography: stage lighting, crowd, the specific chaotic warmth of 3,000 people in a room together. 24mm at crowd level.",
        goldStandard: "24mm lens at crowd level. Real stage lighting: the specific colour of the venue's rig, haze from the fog machine creating visible light beams, the warmth of key lights on the performer versus cooler crowd lighting. 1/500s shutter — fast enough to freeze the performer's peak expression; slow enough that crowd phones create light trails at the frame's periphery. ISO 3200 — the grain communicates live, not studio.",
        why:          "High ISO grain in event advertising communicates authenticity — 'this is what live events look like, feel like, sound like'. ISO 3200 grain is the photographic equivalent of the smell of a venue and the feel of the crowd. It cannot be faked in studio, and the viewer knows it.",
      },

      subjectDirection: {
        bad:          "Artist posing for promotional photo in studio. Professional photoshoot expression.",
        whyBad:       "Promotional studio photos for event advertising communicate that the event is being sold to the viewer rather than experienced with them. The best event advertising looks like documentation of something that actually happened.",
        good:         "Real performance photography: the artist at their authentic peak moment, the expression that arrives naturally at the climax of the song or set, not directed.",
        goldStandard: "The photographer is positioned at the front of the crowd at the point in the set where the artist always hits the peak — the bridge of their signature song, the closing number. The artist is not directed — they are performing. The camera is at crowd height, 24mm, waiting for the peak expression. When the moment arrives — head back, eyes closed, the specific expression of a performer fully inside the music — the shutter fires. This image is the only honest event advertisement image available.",
        why:          "Peak-moment performance photography with no direction is the only genre of event advertising photography that is entirely unambiguous about what the event will actually feel like. Every other approach can be questioned. The authentic peak moment cannot.",
      },

      environment: {
        bad:          "Empty venue exterior. Stage setup before the event. Logo backdrop.",
        whyBad:       "Empty venue photography communicates absence — the absence of the crowd that is the event's actual value. Stage setup before the event communicates preparation rather than experience.",
        good:         "The venue full and alive: the specific atmosphere of 3,000 people in the room, the stage lighting, the crowd energy visible as a physical force.",
        goldStandard: "The venue at capacity during the event: the ceiling, the crowd dense, the stage lights creating warm beams through visible haze. The venue's character is present — an outdoor amphitheatre with the open sky, a heritage venue with its architectural detail, a converted industrial space — but alive with people rather than presented architecturally. This is a room full of people having the best evening of the week.",
        why:          "Venue photography with the crowd inside communicates demand and atmosphere simultaneously — the two most powerful event purchase motivations. 'This place fills up' communicates demand; 'this place has this atmosphere' communicates the experience.",
      },

      typography: {
        bad:          "ARTIST NAME. Date. Venue. Ticket price. Book at [website]. All caps, aggressive font.",
        whyBad:       "All-caps aggressive typography communicates alarm rather than experience. The information load of name + date + venue + price + website in equal hierarchy communicates a notice board rather than a campaign.",
        good:         "Artist name in a confident font that reflects the event's genre. One experience descriptor. Date and venue in secondary weight. Single booking CTA.",
        goldStandard: "Artist name at 22% visual weight in genre-appropriate typeface. Experience descriptor at 14%: '[City] doesn't get a night like this often.' Date and venue at 12%: '[Day], [date] [month] · Doors open [time]'. Booking CTA at 14%: 'Get tickets' with the platform name below. No price in the event campaign advertisement — price belongs on the booking platform.",
        why:          "The experience descriptor — '[City] doesn't get a night like this often' — is the typography that converts the undecided buyer. It activates FOMO more directly than any artist name or lineup listing.",
      },

      layout: {
        bad:          "Artist face filling the frame. Bold name. Date. Venue. Price. Multiple CTA options.",
        whyBad:       "Multiple booking platform CTAs create choice paralysis at the exact moment the buyer has decided to attend.",
        good:         "Peak moment image dominant. Artist name and experience descriptor. Single date/venue line. One primary booking CTA with the platform.",
        goldStandard: "Peak performance image (65%) — wide angle, crowd visible. Upper zone (20%): artist name at appropriate hierarchy; experience descriptor below at smaller weight. Lower zone (15%): date and venue left-aligned; 'Get tickets' CTA with one booking platform centre; venue city right. One booking platform only. The layout communicates: one night, one experience, one place to get your ticket.",
        why:          "Single booking platform CTA in event advertising converts at higher rates than multiple platform options because it removes the micro-decision of 'which platform' from the conversion path.",
      },

      commercialDetails: {
        bad:          "Tickets from ₹X. VIP packages available. 10% off with code [X]. Group discounts.",
        whyBad:       "Discount codes in event advertising communicate that seats are unsold and urgency is manufactured. Indian urban event buyers are highly sophisticated at detecting this.",
        good:         "Ticket availability signal if honest: 'selling fast', 'limited seats remaining'. Date and venue clearly. Single booking platform.",
        goldStandard: "Availability signal (if true): 'Limited tickets remaining — [X]% sold'. If not true, omit. One primary ticket category: 'General admission · [venue] · [city]'. Date and time: '[Day], [date] [month] · Doors open [time]'. Booking: 'Get tickets on BookMyShow' — one platform, one link. No discount codes, no group offers in the campaign advertisement.",
        why:          "Authentic availability signals ('X% sold' if true) convert event ticket buyers at the highest rate of any commercial detail because they activate genuine FOMO — the fundamental event purchase trigger.",
      },

      negativeSpace: {
        bad:          "Entire frame filled with event information, artist imagery, sponsor logos, and booking platforms.",
        whyBad:       "Dense event advertising communicates a concert hall notice board rather than an experience worth clearing the schedule for.",
        good:         "The peak performance moment breathes. The artist name is prominent but not desperate. The experience descriptor has weight. The booking CTA is singular and clear.",
        goldStandard: "The performance image has 4% breathing margin within the image zone. The stage lighting and haze should feel unconstrained — do not crop the atmosphere. The upper zone artist name has 8% space above. The lower zone date/booking CTA has 8% internal spacing and 3 elements maximum. No sponsor logos in the primary campaign advertisement. The impression: this event does not need to compete for space.",
        why:          "Event advertising with generous negative space communicates scarcity and desirability — the visual equivalent of 'sold out'. An event that does not need to fill every pixel with argument communicates an event that sells itself.",
      },

      marketingPsychology: {
        bad:          "Don't miss out! Last few tickets! The concert of the year!",
        whyBad:       "'Concert of the year' is claimed by every promoter for every show. Indian urban event buyers are highly sophisticated at detecting and dismissing manufactured urgency.",
        good:         "FOMO through specificity: this artist, this venue, this city, this night, only once. Collective experience: 3,000 people doing the same thing at the same time. Future memory creation: 'the night you were there'.",
        goldStandard: "Specificity FOMO: '[City] doesn't get a night like this often' is more powerful than 'concert of the year' because it is specific to the viewer's city. Collective experience psychology: the crowd photograph communicates that 3,000 people have already decided to attend — social proof through visible demand. Future memory psychology: the event advertisement that positions itself as something the viewer will want to have been at activates retrospective FOMO — the most powerful event purchase motivation available.",
        why:          "Indian urban event buyers aged 20–40 have limited free weekend time and multiple competing options. The advertisement that converts them communicates not 'you will enjoy this' but 'you will wish you had been there if you don't go'.",
      },

      antiPattern: {
        bad:          "Generic crowd stock photography. Artist standing with arms crossed. 'LIMITED TICKETS' in red box. Three booking platform logos of equal size. Sponsor logos grid.",
        whyBad:       "Generic crowd stock communicates every event simultaneously. Arms-crossed pose communicates press release, not performance. Red 'LIMITED TICKETS' boxes are universally dismissed. Equal-size booking logos create confusion. Sponsor logo grids communicate commercial obligation rather than event quality.",
        good:         "Real peak performance image. Artist at their authentic best. One booking platform CTA. One experience descriptor. No manufactured urgency, no sponsor grid.",
        goldStandard: "The event advertisement that sells tickets shows one real peak performance moment from this artist at their actual best. It has one experience descriptor specific to this city and this night. It has one booking platform CTA. It has no manufactured urgency, no stock imagery, no sponsor logos. The photograph alone communicates the reason to attend. The typography communicates the specific night. The CTA makes attending immediate.",
        why:          "The Indian urban event buyer who is undecided about attending is not lacking information. They are lacking the specific experience motivation: 'I want to be in that room for that moment'. The only way to create that motivation is to show them the moment.",
      },

      conversionInsight: "Event tickets sell when the buyer can feel what the event will feel like at its best moment. The wide-angle peak performance image with the crowd visible is that feeling. One experience descriptor specific to the city and the night, one booking CTA — that is the complete advertisement.",
    },

  ],
};
