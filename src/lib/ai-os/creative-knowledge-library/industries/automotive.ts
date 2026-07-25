// Creative Knowledge Library — Automotive

import type { IndustryKnowledge } from "../types";

export const automotive: IndustryKnowledge = {
  id:    "automotive",
  label: "Automotive",
  campaigns: [

    {
      type: "car_launch",
      tags: ["car", "vehicle", "launch", "new car", "sedan", "suv", "hatchback", "electric", "automobile", "test drive"],
      goal: "Drive test drive bookings by communicating the ownership feeling, not the specifications.",
      audience: "Indian car buyers aged 28–50 making a considered, identity-significant purchase.",

      heroSubject: {
        bad:          "Car on the road with beautiful scenery. Hero shot of the vehicle exterior.",
        whyBad:       "The scenic car exterior shot is the format of every car advertisement in every market. It communicates the product as an object rather than as an experience. The viewer knows what a car looks like.",
        good:         "An Indian owner in the driver's seat at the moment before starting the car — hand on the wheel, looking at the open road ahead, not yet moving.",
        goldStandard: "An Indian man in his late 30s sits in the driver's seat of the car in an open showroom — the car has just been handed over. The keys are in his hand but not yet in the ignition. His other hand rests on the steering wheel at the 12 o'clock position. He is not looking at the car's interior. He is looking at the showroom doors in front of him — which are open to the street, to the city, to the first drive. He has been thinking about this moment for two years. It is the morning of the day he finally drives his own car.",
        why:          "The moment before the first drive — keys in hand, looking at the open door ahead — is the highest emotional peak of the car ownership experience. It contains the entire aspiration: the planning, the saving, the choosing, and the beginning. No car exterior photograph can communicate this.",
      },

      visualHierarchy: {
        bad:          "Car exterior dominant. Specifications listed. EMI. Model name. Test drive CTA.",
        whyBad:       "Specification-first hierarchy communicates that this is a product comparison exercise. Indian car buyers at the point of final decision have already compared specifications — they are buying an identity, not a spec sheet.",
        good:         "Owner's anticipation moment 45%, car interior quality 25%, open road or showroom doors 20%, brand and test drive CTA 10%.",
        goldStandard: "P1 Owner's expression at the moment before the first drive (40%) — the ownership feeling. P2 His hand on the steering wheel (25%) — the physical connection to the vehicle. P3 The view through the windscreen — open showroom doors or open road (20%) — the promise ahead. P4 Interior quality details in peripheral frame (10%) — premium material proof. P5 Brand mark and test drive CTA (5%).",
        why:          "The hand on the steering wheel is the single most powerful car advertising visual element — more powerful than the car's exterior because it places the viewer in the driver's position. When the hand is on the wheel, the viewer's imagination completes the experience.",
      },

      composition: {
        bad:          "Three-quarter exterior shot of the car. Beauty lighting. Road background.",
        whyBad:       "Three-quarter exterior shots are the industry default for automotive photography. They differentiate nothing — the viewer processes 'car advertisement' and moves on.",
        good:         "Interior perspective: we are in the passenger seat looking at the driver. His profile, his hand on the wheel, the view through the windscreen visible beyond him.",
        goldStandard: "Camera positioned in the passenger seat position — looking at the driver from the right. The driver occupies the left two-thirds of frame in profile. His hand on the steering wheel at 12 o'clock is in the centre of the frame. Through the windscreen and beyond his profile: the open showroom doors or the first stretch of open road. The car's interior — the dashboard, the display, the premium material of the door trim — is visible in the peripheral frame without being the compositional anchor. Reading flow: driver's anticipation expression → hand on the wheel → the open road ahead.",
        why:          "Passenger-seat perspective creates the 'we are in the car together' immersion that no exterior shot can achieve. The viewer is in the car, beside the owner, at the moment of first ownership. This is the advertising equivalent of a test drive experience.",
      },

      photography: {
        bad:          "Automotive photography. Beauty lighting. Professional car shoot.",
        whyBad:       "Professional automotive beauty lighting — key lights, rim lights, the controlled lighting environment of a car shoot — produces a car photograph that communicates studio rather than experience.",
        good:         "Available light inside the showroom: warm incandescent overhead + the natural light flooding through the open showroom doors. 50mm lens at passenger-seat level.",
        goldStandard: "50mm lens at passenger-seat height — the natural sitting perspective. Available light: warm showroom incandescent overhead creating a warm glow on the dashboard and driver, combined with the natural blue-grey morning light flooding through the open showroom doors in front. This creates the specific contrast of 'safe inside' versus 'open road ahead' that is the automotive ownership feeling. 1/80s shutter speed — the driver is still, but the slight softness of movement in his expression communicates life, not pose.",
        why:          "The contrast between warm interior light and the daylight through the open showroom doors is the most emotionally powerful automotive lighting available because it communicates the threshold experience: you are safe inside your new car, and the world is open ahead of you. No studio lighting can create this.",
      },

      subjectDirection: {
        bad:          "Owner smiling at camera beside the car. Family getting in the car together.",
        whyBad:       "Camera-directed smiling beside the car communicates 'I am happy with my purchase' — a post-purchase feeling, not the decisive moment of the ownership experience. Family loading into the car communicates practicality, not aspiration.",
        good:         "Owner in the driver's seat, directed to look through the windscreen at the open showroom doors — not at the camera, not at the interior. His hand on the wheel, not positioned for the photograph.",
        goldStandard: "The direction to the owner: 'Look at the doors in front of you. You are about to drive for the first time. The keys are in your hand. You're not in a hurry — you're just taking a moment. Your hand is on the wheel because it belongs there now.' His hand rises naturally to 12 o'clock on the wheel. His eyes rest on the showroom doors. His breathing settles. The photograph is taken in the second of stillness before he would start the car. He does not acknowledge the camera — because the doors ahead are more interesting than anything in the showroom.",
        why:          "The direction to look at the open doors rather than the camera creates a natural gaze direction that simultaneously communicates ownership (I'm in the driver's seat) and future (the road is ahead of me). These are the two most powerful car ownership emotions, activated in a single authentic expression.",
      },

      environment: {
        bad:          "Car showroom interior. Professional automotive display.",
        whyBad:       "Generic showroom photography communicates 'this car is for sale here' rather than 'this car is yours'. The showroom is a transaction environment; the advertisement must transform it into an ownership environment.",
        good:         "The specific transition moment: the car is in the showroom with the doors open to the street. The inside of the car is warm; the street ahead is real. This is the last moment before the car becomes the owner's.",
        goldStandard: "An Indian city street visible through the open showroom doors: morning light, the sounds of the street implied by the visual openness, a few parked vehicles and moving auto-rickshaws visible. The showroom floor around the car is polished but real — not a photostudio floor. The car salesperson is visible at the very edge of the frame, slightly behind the driver's side door: present but stepping back, their role in this completed. The car belongs to him now.",
        why:          "The salesperson stepping back at the edge of the frame is the single most powerful ownership-transfer visual detail available in automotive advertising. It communicates 'the transaction is complete; what happens now is between you and the road'. This is the moment every car buyer has imagined.",
      },

      typography: {
        bad:          "MODEL NAME. Specifications. Starting ₹X Lakh. EMI from ₹X. Book a test drive.",
        whyBad:       "Specification and starting price as the dominant typographic elements communicate product transaction rather than ownership aspiration. EMI in automotive advertising primes financial calculation before identity aspiration is established.",
        good:         "One ownership-feeling headline. Model name and key distinguishing feature. Test drive CTA — not 'Book Now' but 'Experience It'.",
        goldStandard: "Headline at 20% visual weight: 'The morning it finally becomes yours.' — this speaks to the long decision journey every Indian car buyer goes through. Model name and brand at 15% — present and confident. One distinguishing feature at 10%: 'The first electric SUV engineered for Indian roads' or 'The SUV that fits the family, the trip, and the story'. Test drive CTA at 14%: 'Book your experience drive' — not 'test drive', which sounds clinical. No EMI, no starting price in the primary campaign advertisement.",
        why:          "'The morning it finally becomes yours' speaks to the specific emotional arc of an Indian car purchase — the months of research, the family discussions, the comparison visits, and the final morning of ownership. It communicates that this brand understands the journey, not just the product.",
      },

      layout: {
        bad:          "Car exterior hero image. Specifications panel. Price. Multiple CTA options.",
        whyBad:       "Exterior-hero with specifications panel communicates product brochure, not campaign advertising. Multiple CTAs divide the viewer's conversion path.",
        good:         "Ownership feeling image dominant. One emotional headline. Model name. Single experience drive CTA.",
        goldStandard: "Ownership feeling image (65%) — interior perspective with driver and open road ahead. Upper zone (20%): headline right-aligned with generous tracking; model name below at smaller weight. Lower zone (15%): brand mark left; 'Book your experience drive' CTA centre; showroom location or area right. No specification panel. No EMI. No price. One CTA. The layout communicates: this is an experience, not a transaction.",
        why:          "Automotive advertising that removes price and specification from the primary campaign creates a test drive booking from a buyer who has already decided to buy — they are only deciding from which brand. That is the highest-value automotive advertising position available.",
      },

      commercialDetails: {
        bad:          "EMI from ₹X/month. Ex-showroom price ₹X Lakh. 5-year warranty. Features list.",
        whyBad:       "EMI-first communicates financial strain before ownership aspiration. Features lists in campaign advertising position the car as a checklist rather than an experience.",
        good:         "One specific differentiator stated clearly. Warranty and service promise. Experience drive availability. No EMI in primary ad.",
        goldStandard: "One differentiator: '5-year / 1,00,000 km warranty — the longest in this segment' (if true). Service: 'Doorstep service pickup in [city]' — communicates convenience that Indian buyers specifically value. Experience drive: 'Book a 2-hour experience drive — keep it overnight if you need more time'. No ex-showroom price in the campaign advertisement — this belongs in the performance media layer, not the brand campaign.",
        why:          "The '2-hour experience drive — keep it overnight if you need more time' is the highest-converting automotive commercial detail because it communicates that the brand is confident enough in the car's quality to let the buyer live with it before committing. Confidence in the product converts the buyer who is on the fence.",
      },

      negativeSpace: {
        bad:          "All frame space used for the car, specifications, and multiple options.",
        whyBad:       "Dense automotive advertising communicates information overload — which mirrors the analysis paralysis that causes Indian car buyers to delay purchase decisions.",
        good:         "The ownership moment has breathing room. The headline is the single most prominent text element. The CTA is clear and singular.",
        goldStandard: "The ownership feeling image has 5% breathing margin within the image zone. The driver's gaze toward the open doors should have visual space to extend toward — do not crowd the frame ahead of the windscreen view. The headline in the upper zone has 8% space above. Between headline and image: 4%. The lower zone CTA sits with 10% internal space. Total visual impression: spacious, confident, unhurried. The negative space communicates that the road ahead of the car is also open.",
        why:          "Automotive advertising negative space communicates road ahead. When the image and layout have generous space toward the direction of the car's potential movement, the viewer's eye and imagination travel in that direction — into the ownership experience. This is negative space activating aspiration.",
      },

      marketingPsychology: {
        bad:          "Power. Performance. Prestige. Your dream car awaits.",
        whyBad:       "These four words are the abstract vocabulary of every automotive advertisement. They produce recognition of the advertising category, not identification with the ownership experience.",
        good:         "Ownership morning activation: the specific feeling of the first drive. Identity validation: 'this car communicates who I am'. Long-journey acknowledgement: 'I've been thinking about this for two years; this brand understands that'.",
        goldStandard: "Ownership morning psychology: the Indian car buyer's primary emotional peak is not the car — it is the morning of the first drive. This advertisement places itself at that exact emotional peak. Identity validation: Indian car purchases are significant identity statements, especially for the buyer making their first premium car purchase after years of smaller vehicles. The brand that communicates 'this car communicates who you have become' speaks to this aspiration directly. Journey acknowledgement: 'The morning it finally becomes yours' acknowledges that Indian car purchases involve a long journey of research, family discussion, and financial planning — and honours that journey.",
        why:          "The Indian car buyer who is at the point of brand selection (not category selection) is motivated by identity and the end of a planning journey. The advertisement that honours that journey and places the brand at the peak emotional moment of its resolution converts at higher rates than any specification comparison.",
      },

      antiPattern: {
        bad:          "Car drifting on empty race track. Car in the mountains with no Indian context. Actor endorsing the car without driving it. 5-year EMI calculation in the headline. Specifications as the hero.",
        whyBad:       "Race track contexts are irrelevant to 99% of Indian car buyers' driving lives. Mountain settings without Indian context create aspiration without identification. Actor endorsement without the car experience communicates advertising budget, not product quality. EMI headline creates financial anxiety before aspiration is established.",
        good:         "Indian owner in an Indian city context, at the peak ownership moment, before the first drive. No race track, no actor, no EMI headline. One emotional moment that is specific and achievable.",
        goldStandard: "The automotive advertisement that converts the Indian car buyer shows one Indian man at the most emotionally specific moment of the car ownership experience — keys in hand, hand on the wheel, looking at the open road through the showroom doors — in a real Indian city showroom with a real Indian street visible ahead. No race track, no actor, no mountains, no EMI. One feeling. One headline that names that feeling. One CTA to experience it. The car sells itself through the viewer's imagination of that morning. The brand's job is only to place the viewer there.",
        why:          "The Indian car buyer who has been researching for six months has already seen the race track, the mountains, and the celebrity. He has not yet seen the specific morning when the car becomes his — which is the morning he is actually planning toward. Show him that morning.",
      },

      conversionInsight: "Car experience drive bookings convert when the viewer can feel the specific morning of first ownership. The driver's hand on the wheel, looking at the open showroom doors, keys in hand — this is that morning. Show it. The specification comparison is already complete. The buyer needs only to be shown where the road begins.",
    },

  ],
};
