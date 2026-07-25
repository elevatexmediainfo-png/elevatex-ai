// Creative Knowledge Library — Healthcare & Dental

import type { IndustryKnowledge } from "../types";

export const healthcareDental: IndustryKnowledge = {
  id:    "healthcare_dental",
  label: "Healthcare & Dental",
  campaigns: [

    {
      type: "smile_makeover",
      tags: ["smile", "smile makeover", "dental", "teeth", "whitening", "veneers", "cosmetic dentistry", "confidence", "smile transformation"],
      goal: "Drive consultation bookings for cosmetic dental treatments by showing emotional transformation, not clinical results.",
      audience: "Indian women and men aged 25–45 self-conscious about their smile and considering cosmetic treatment for the first time.",

      heroSubject: {
        bad:          "Woman with perfect white teeth smiling at camera.",
        whyBad:       "Perfect-teeth smile photography for a dental ad communicates the impossible destination without showing the patient's emotional journey. The viewer with imperfect teeth cannot see themselves in this image.",
        good:         "An Indian woman in the dental chair looking at her new smile in a hand mirror for the first time — not posing, just seeing.",
        goldStandard: "An Indian woman in her early 30s sits in the dental chair with a small hand mirror. She is not yet smiling. She is looking at her own reflection with the specific expression of someone registering a change they had stopped believing was possible. Her hand is at her chin — not touching, just near, the instinctive gesture of someone orienting themselves to a new version of their face.",
        why:          "The 'pre-smile' expression — before the full smile breaks — is more emotionally powerful than the smile itself. It communicates the internal experience of transformation, which is what potential patients are actually buying.",
      },

      visualHierarchy: {
        bad:          "Before/after split. Big smile photo. Clinic name. CTA.",
        whyBad:       "Before/after splits in dental advertising communicate infomercial rather than premium clinical care. They frame the treatment as a product, not a professional relationship.",
        good:         "Patient's emotional moment 50%, smile visible but secondary 25%, clinic environment signals 15%, consultation CTA 10%. Emotion before aesthetics.",
        goldStandard: "P1 Patient's expression of discovery (45%) — the emotional truth. P2 Her hands near her face and the mirror (25%) — the moment of recognition. P3 Smile visible in reflection (20%) — the result, revealed through her experience of it. P4 Warm, non-clinical clinic environment detail (5%). P5 Consultation CTA (5%).",
        why:          "Showing the result through the patient's experience of it — the reflection rather than the direct image — creates vicarious identification. The viewer imagines their own discovery, not someone else's perfect outcome.",
      },

      composition: {
        bad:          "Dental chair central. Patient visible. Clinical setting. Standard dental advertisement.",
        whyBad:       "The standard dental chair framing communicates clinical procedure rather than emotional transformation. It creates distance rather than aspiration.",
        good:         "Patient as the frame anchor. The hand mirror at 45 degrees, catching her reflection. The dental environment warm and background-softened, communicating quality without clinical sterility.",
        goldStandard: "Patient occupies the left two-thirds of frame, three-quarter view toward the mirror. The hand mirror is held at 45 degrees at the right side of frame — creating a frame-within-a-frame of her new smile as she sees it. The clinic behind her is soft focus but warm — cream walls, professional lighting, the detail of a framed print visible. Reading flow: patient's expression → mirror → reflected smile → clinic quality → consultation CTA.",
        why:          "The mirror-within-the-frame creates a doubled discovery — the viewer sees both the patient's expression and what the patient sees. This creates an immersive emotional experience unavailable in any direct smile photography.",
      },

      photography: {
        bad:          "Dental photography. Bright lighting. Patient in chair.",
        whyBad:       "Bright white dental office lighting communicates clinical sterility — the most anxiety-inducing environment for dental-phobic patients, who are the primary target for cosmetic consultation advertising.",
        good:         "85mm lens at patient eye level. Warm lighting that eliminates clinical associations. Focus on the patient's face and expression, not on the teeth themselves.",
        goldStandard: "85mm lens at patient eye level — the perspective of a peer, not a clinician looking down. Warm 3200K practical clinic lighting, specifically chosen to eliminate the cold blue-white that patients associate with anxiety. Focus locked on the patient's eyes and expression — the teeth visible in the mirror reflection but not the compositional anchor. The clinic detail behind should communicate 'premium and professional' without communicating 'intimidating procedure'.",
        why:          "Lens height communicates power relationship. Eye level says 'you and this clinic are equals' — a message that is critical for converting dental-phobic patients who have delayed treatment due to anxiety.",
      },

      subjectDirection: {
        bad:          "Patient smiling at camera. Dentist pointing at teeth model. Staff smiling at reception.",
        whyBad:       "Patient directed at camera performing happiness signals a result the viewer hasn't earned yet. The dentist with a teeth model communicates academic rather than empathetic care. Reception smiles communicate service industry, not healthcare.",
        good:         "Patient looking at her own reflection — fully directed at the mirror, not the camera. Her expression is private discovery, not performed satisfaction.",
        goldStandard: "The patient has not been told the photo is being taken in this moment — the direction is 'look at your new smile as though we are not here'. Her eyes move across the reflection slowly. Her lips part slightly — not a full smile yet, just the first breath before the smile. Her hand has drifted unconsciously to her chin. The dentist behind her is slightly visible at the frame edge, also watching — not the patient, but the patient's face in the mirror. He has seen this expression before and it never gets ordinary.",
        why:          "The dentist watching the patient's expression in the mirror creates a second emotional layer — his reaction to her reaction is the clinical validation of the transformation. This detail communicates that the dentist cares about the outcome, not just the procedure.",
      },

      environment: {
        bad:          "Modern dental clinic with equipment.",
        whyBad:       "Modern dental clinic with equipment communicates procedure and clinical anxiety — the exact associations that prevent dental-phobic patients from booking consultations.",
        good:         "A premium dental suite designed to feel warm rather than clinical: cream walls, warm lighting, art on the walls, minimal visible equipment. Looks like a premium consultation room, not an operating theatre.",
        goldStandard: "A premium dental consultation suite: cream-painted walls, warm pendant lighting over the chair, framed prints on the walls — not clinical charts. The dental chair is premium and visible but positioned as furniture rather than apparatus. Equipment trays are retracted and not in frame. Through a window: a garden or street view — the outside world communicating that this is a professional space within a normal world, not an isolated clinical environment.",
        why:          "The dental-phobic patient — the primary target for cosmetic consultation advertising — makes booking decisions based entirely on how anxious the environment makes them feel. An environment that removes clinical anxiety triggers from the frame removes the primary barrier to consultation.",
      },

      typography: {
        bad:          "Dental clinic name. 'Transform Your Smile.' Phone number. 10 Years Experience.",
        whyBad:       "Headline commands ('Transform Your Smile') create distance — they describe an outcome the viewer is uncertain of and cannot yet imagine for themselves.",
        good:         "Empathy-first headline. 'The smile you've been thinking about.' Clinic name. Consultation CTA with low commitment framing: 'Free consultation — no pressure'.",
        goldStandard: "Headline at 20% visual weight: 'The smile you've stopped thinking is possible.' — this speaks directly to the suppressed hope of the dental-phobic patient who has delayed treatment. Clinic name at 12% below. 'Free consultation' CTA at 14% — the low-commitment first step. 'No obligation' in small text beneath the CTA — addresses the primary booking barrier. The entire typographic system communicates: 'we understand where you are, and the first step is easy'.",
        why:          "The headline 'The smile you've stopped thinking is possible' activates suppressed hope — the specific emotional state of the patient who has wanted this for years but has told themselves reasons not to. Reactivating that hope is the conversion mechanism.",
      },

      layout: {
        bad:          "Before/after photos. List of treatments. Clinic details. CTA.",
        whyBad:       "Treatment lists create cognitive overload and position the clinic as a service provider rather than a healthcare partner. Before/after photos prime price comparison rather than emotional identification.",
        good:         "Transformation moment dominant. Single empathy headline. One low-commitment CTA. Clinic name and credentials. No treatment list in acquisition advertising.",
        goldStandard: "Discovery moment image (65% of frame). Upper zone (20%): empathy headline right-aligned, warm palette. Lower zone (15%): clinic name left; 'Free consultation' CTA centre with 'No obligation' micro-text; one credential right (e.g., '15 years in cosmetic dentistry'). No treatment price list, no before/after grid, no multiple CTA options. One journey: discovery image → emotional headline → easy first step.",
        why:          "Dental consultation advertising that leads with a low-commitment CTA ('Free consultation — no obligation') converts dental-phobic patients at significantly higher rates than price-led or treatment-led layouts. The layout must make the first step feel safe.",
      },

      commercialDetails: {
        bad:          "EMI available. All treatments. Latest technology. 100% results guaranteed.",
        whyBad:       "EMI availability communicates affordability concern before the patient has decided they want the treatment. '100% results guaranteed' is either dishonest or legally inadvisable. 'Latest technology' is a claim made by every clinic.",
        good:         "One specific credential: years in cosmetic dentistry, number of smile transformations, or a specific qualification. Free consultation clearly stated. No results guarantee language.",
        goldStandard: "Credential statement: 'Over 2,000 smile transformations in [city] — cosmetic dentistry since 2009'. This is specific, verifiable, and communicates both experience and demand. Free consultation CTA: 'Your first consultation is free — bring your questions'. Contact: WhatsApp number preferred over phone — Indian patients book dental consultations via WhatsApp more readily than phone calls. No EMI mention in acquisition advertising.",
        why:          "'2,000 smile transformations since 2009' converts better than '100% results guaranteed' because it is specific and believable. Specific claims are trusted; universal guarantees are dismissed as marketing language.",
      },

      negativeSpace: {
        bad:          "All frame real estate used for before/after and information.",
        whyBad:       "Maximum information density in dental advertising creates visual anxiety — which mirrors the clinical anxiety that prevents booking. The layout is itself an obstacle to conversion.",
        good:         "The discovery moment has uninterrupted breathing room. The headline is surrounded by space that communicates professional confidence. The CTA is isolated and prominent.",
        goldStandard: "The patient's discovery moment occupies the image zone without text intrusion. The upper zone headline is surrounded by a minimum 8% margin on all sides — isolation communicates that this headline carries weight. The CTA in the lower zone sits alone, not grouped with other commercial elements. Between the headline and the image: 4% breathing room that communicates 'take a moment here before you read further'. The layout breathes in proportion to the emotional weight of what it is communicating.",
        why:          "A dental advertisement with generous white space communicates the same thing as a dental suite without visible equipment: professional confidence, control, and the absence of anxiety triggers. The visual breathing room gives the viewer emotional breathing room to imagine themselves making the booking.",
      },

      marketingPsychology: {
        bad:          "Beautiful smile. Confidence boost. Feel better about yourself.",
        whyBad:       "These abstract outcomes have been claimed by every cosmetic dental advertisement and have lost meaning. They describe the result without activating the suppressed desire that precedes the booking decision.",
        good:         "Reactivated hope: 'The smile you've been thinking about is achievable'. Low-commitment framing: the first step is only a free conversation. Social permission: Indian peers are making this decision and benefiting from it.",
        goldStandard: "Suppressed hope activation: the primary dental patient has been telling themselves reasons not to pursue treatment for years — cost, time, anxiety, 'it's not that important'. This advertisement must interrupt that self-talk. Specific social proof: '2,000 transformations in this city' communicates that the patient's desire is not unusual — many Indian adults in this city have already acted on it. Low commitment psychology: 'free consultation, no obligation' frames the first step as risk-free information gathering rather than a treatment decision.",
        why:          "The primary conversion barrier for cosmetic dental consultation is not cost — it is the patient's belief that their specific case is either too difficult or not worth the investment. Social proof of scale ('2,000 transformations') addresses the first belief; 'free consultation' addresses the second.",
      },

      antiPattern: {
        bad:          "Perfectly white porcelain-teeth stock photo. Clinical equipment prominently visible. 'Book now for 20% off'. Bright white sterile environment. Dentist in full PPE smiling.",
        whyBad:       "Porcelain-perfect stock photo teeth communicate unattainable rather than achievable transformation. Clinical equipment and PPE maximise anxiety. Discount in dental advertising communicates low quality — Indian patients associate discounted dental care with compromised standards.",
        good:         "Real Indian patient in a warm, non-clinical environment during the discovery moment. No visible clinical equipment. No discount language. Empathetic headline rather than command headline.",
        goldStandard: "The cosmetic dental advertisement that converts has no gleaming white studio teeth, no dental tool in frame, no sterile clinical environment, no percentage discounts, and no 'Transform Your Smile Now' command language. It has one Indian person in a warm and non-threatening space experiencing the specific private emotion of seeing their own smile changed. That image, with a free consultation CTA, converts better than any configuration of the above.",
        why:          "The primary barrier to dental consultation is anxiety — about the environment, the procedure, and the commitment. The advertisement that removes every anxiety trigger from the frame — clinical equipment, discount urgency, sterile lighting, command language — leaves only the aspiration. Aspiration without anxiety converts.",
      },

      conversionInsight: "Cosmetic dental consultations convert when the patient can imagine the specific moment of seeing their own new smile — not the before/after grid, but the private second of discovery. Show that private second. The free consultation CTA with 'no obligation' framing makes the first step feel safe enough to take.",
    },

    {
      type: "general_healthcare",
      tags: ["doctor", "clinic", "healthcare", "physician", "general practitioner", "gp", "consultation", "health", "care", "medical"],
      goal: "Drive patient appointments by communicating trust, listening, and genuine clinical empathy rather than clinical authority.",
      audience: "Indian families aged 25–55 seeking a primary care doctor they can trust for ongoing family health management.",

      heroSubject: {
        bad:          "Doctor in white coat smiling at camera.",
        whyBad:       "The white coat and direct camera smile communicates authority and institutional distance — exactly the perception that prevents Indian families from building ongoing relationships with a primary care doctor.",
        good:         "An Indian doctor leaning forward toward the patient with clasped hands, listening intently. Not yet speaking — listening.",
        goldStandard: "An Indian doctor in his 50s sits leaning forward toward the patient across the desk, his hands clasped on the table in front of him. He is not speaking. He is listening with his entire attention — the specific body posture of someone who is fully present, not waiting for his turn to respond. His face shows engaged concern, not neutral clinical attention. The patient is partially visible across the desk — we are in the patient's perspective.",
        why:          "The listening doctor is more powerful than the diagnosing doctor. Indian patients convert to regular relationships with doctors who they believe will listen to them. The leaning-forward posture, clasped hands, and attentive expression communicate 'I am here for you' in a way that no clinical credential can.",
      },

      visualHierarchy: {
        bad:          "Doctor photo. Clinic name. List of specialties. Book appointment.",
        whyBad:       "Specialty lists create a transactional frame — this clinic has these services, what do you need? Primary care relationships are built on trust, not service menus.",
        good:         "Listening moment 55%, consultation room warmth 25%, clinic name and specialty 15%, appointment CTA 5%. Trust before credentials.",
        goldStandard: "P1 Doctor's attentive posture and expression (50%) — the trust signal. P2 Patient perspective — the desk, the doctor's hands, the room (25%) — the viewer's position. P3 Clinic environment warmth (15%) — professional but not intimidating. P4 Doctor's name, brief credential (5%). P5 'Book an appointment' CTA (5%).",
        why:          "The doctor's attentive posture as the dominant element communicates the thing that converts families to regular patients: this doctor will listen to me. Everything else in the hierarchy supports and confirms that primary message.",
      },

      composition: {
        bad:          "Doctor at desk, standard clinical portrait, direct eye contact with camera.",
        whyBad:       "Clinical portrait from across the desk creates the exact patient-doctor power differential that most Indian patients find intimidating and prevents ongoing relationship building.",
        good:         "We are in the patient's chair — the camera is at patient eye level across the desk. The doctor is leaning toward us, his full attention directed at our position.",
        goldStandard: "Camera at patient-chair height, slightly below the doctor's eye level — the precise perspective of someone sitting across from the doctor during a consultation. The doctor fills 50% of frame, leaning forward, hands clasped on the desk. The desk between them communicates professional relationship without clinical authority. Through the window behind the doctor: a warm exterior view. Reading flow: doctor's attentive face → his clasped hands → the desk — the entire space communicating 'I am here with you'.",
        why:          "Patient-perspective composition is almost never used in Indian healthcare advertising. It immediately differentiates this doctor as someone who sees their patients as equals rather than cases — the most powerful trust signal available in healthcare advertising.",
      },

      photography: {
        bad:          "Clinical photography. Good lighting. Doctor and patient.",
        whyBad:       "Clinical photography defaults to bright, neutral lighting that communicates medical institution rather than trusted healthcare relationship. The environment matters as much as the people in healthcare advertising.",
        good:         "Warm window light from behind and to the side of the doctor. 50mm at patient seated height. Focus on the doctor's eyes and hands. Room visible but warm, not sterile.",
        goldStandard: "50mm at patient-seated height — specifically not standing level, because standing creates a power differential. Warm afternoon window light from the doctor's right, creating a soft side-light that warms his face without flattening it. The clinic background is warm — cream walls, a plant, framed medical certificates (legible but not dominant), a bookshelf. No cold overhead fluorescent light. The image should feel warmer than a hospital but more professional than a home.",
        why:          "Light temperature is the single most powerful controller of anxiety in healthcare photography. Cold white light activates clinical anxiety associations that prevent primary care relationship building. Warm light activates trust.",
      },

      subjectDirection: {
        bad:          "Doctor and patient having a friendly conversation, both smiling.",
        whyBad:       "Mutual smiling in a consultation framing communicates social rather than clinical care — the viewer doubts whether the doctor will take their health concerns seriously.",
        good:         "Doctor leaning forward, genuinely attentive, expression of engaged concern. The patient's hands visible on the desk — leaning slightly in, communicating that they feel safe enough to speak.",
        goldStandard: "The doctor's clasped hands are on the desk, not crossed over his chest or held behind his back — open posture communicating approachability. His eyebrows are slightly raised — not in surprise, but in the specific expression of someone processing information carefully. He has not yet spoken. He is still taking in what the patient is saying. The patient's hands on the desk communicate that they are comfortable enough to be open. Neither is performing wellness — both are engaged in the genuine work of a good consultation.",
        why:          "The doctor's specific micro-expression — eyebrows slightly raised, processing rather than responding — is the most trustworthy clinical expression in advertising because it communicates 'I am thinking about your specific situation'. Generic clinical neutrality communicates 'I am running a standard protocol'.",
      },

      environment: {
        bad:          "Modern medical clinic with standard equipment.",
        whyBad:       "Standard medical equipment visible communicates clinical procedure rather than ongoing relationship. The 'modern' qualifier communicates nothing specific about the quality of care.",
        good:         "A consultation room that feels like a professional's private office rather than a medical procedure room: books, certificates, a plant, warm lighting, a real window.",
        goldStandard: "A private consultation room in an Indian city clinic: cream walls, a substantial wooden desk that communicates permanence and seriousness, framed medical certificates at eye level behind the doctor, a bookshelf with reference texts visible — their presence communicating that this doctor keeps current. A plant on the windowsill. The room has been used for years by someone who considers it their professional home, not a rented space. No examination table visible in frame.",
        why:          "The consultation room that communicates 'this doctor has practiced here for years' activates the trust that families assign to the 'family doctor' — the doctor they return to across generations. That permanence signal is the primary driver of primary care relationship formation in Indian healthcare.",
      },

      typography: {
        bad:          "Clinic name. 'Your Health is Our Priority'. List of specialties. 'Book Now'.",
        whyBad:       "'Your Health is Our Priority' is the most overused tagline in Indian healthcare advertising and communicates nothing. Specialty lists communicate service provider, not trusted doctor.",
        good:         "Doctor's name prominent — the relationship is with this specific person. One clear empathy statement. Appointment CTA with easy first-step framing.",
        goldStandard: "Doctor's name at 20% visual weight: 'Dr. Suresh Mehta' — the relationship is with this person, not with 'the clinic'. Specialty and years in practice at 12% below: 'Family Medicine · 18 years in practice'. Empathy headline at 15%: 'The doctor who takes time.' Appointment CTA at 12%: 'Book a consultation — same-week availability'. Clinic name and address at 8% in the utility zone.",
        why:          "'The doctor who takes time' activates the primary complaint of Indian patients about the healthcare system — that their doctor sees them for three minutes. It positions this doctor as the exception they have been looking for.",
      },

      layout: {
        bad:          "Clinic logo dominant. Services listed. Contact details. Doctor photo small.",
        whyBad:       "Clinic-brand-dominant layouts communicate institution over individual — which is the wrong framing for primary care relationships where the personal connection with the doctor is the entire product.",
        good:         "Doctor's listening moment dominant. Doctor's name and specialty prominent. Easy appointment CTA. Clinic name secondary to doctor's name.",
        goldStandard: "Listening moment image (60%). Upper zone (20%): doctor's name dominant, specialty and years in practice below. Lower zone (20%): 'The doctor who takes time' headline left-aligned; 'Book a consultation' CTA centre; phone/WhatsApp right. Clinic name in the footer zone at reduced scale — this advertisement is for the doctor's relationship, not the clinic's brand. The doctor IS the brand.",
        why:          "Primary care advertising that leads with the individual doctor rather than the clinic brand outperforms clinic-brand-led advertising because the purchase decision in primary care is 'do I trust this specific person', not 'do I trust this institution'.",
      },

      commercialDetails: {
        bad:          "All insurance accepted. Free health checkup. Corporate health packages. Emergency line available.",
        whyBad:       "Insurance and corporate packages communicate volume and institutional care, undermining the individual-relationship positioning. Free health checkup communicates low value for the consultation.",
        good:         "Same-week appointment availability if true — communicates accessibility. WhatsApp consultation booking. Doctor's specific qualification relevant to family medicine.",
        goldStandard: "'Same-week consultations available' — Indian patients cancel the mental appointment they are about to make when availability feels uncertain. 'WhatsApp to book: [number]' — the lowest-friction booking mechanism for Indian patients seeking primary care. One specific qualification: 'MBBS, MD (Family Medicine), AIIMS Delhi' — the institution communicates the credential more powerfully than any generic 'qualified doctor' claim. No 'free consultation' language — this undermines the value of the doctor's time.",
        why:          "WhatsApp booking converts primary care consultation intention into booked appointments at significantly higher rates than phone or online form booking for Indian patients aged 30–55. Same-week availability converts patients who have already decided to see a doctor but haven't yet committed to when.",
      },

      negativeSpace: {
        bad:          "Maximum information density — all services and contact methods visible.",
        whyBad:       "Dense information layouts communicate institutional breadth at the cost of personal relationship depth. The primary care patient is not comparison-shopping — they are looking for trust.",
        good:         "The listening moment has space around it. The doctor's name is isolated and prominent. The layout breathes at the same pace as a good consultation.",
        goldStandard: "The listening moment image has an uninterrupted 10% breathing margin on all sides within the image zone — the frame within the frame communicates that this moment deserves contemplation. The doctor's name sits with 6% space above and 6% below. The CTA is the only element in the lower zone, surrounded by space that communicates 'the next step is simple and unambiguous'. The entire layout communicates: unhurried, attentive, professional.",
        why:          "A healthcare advertisement with generous white space communicates the same thing as a consultation with a doctor who is not watching the clock: this professional has time for you. The layout is the implicit promise of the care experience.",
      },

      marketingPsychology: {
        bad:          "Good healthcare. Experienced doctor. Your health matters.",
        whyBad:       "Every clinic in India claims these three things. They are noise. No specific psychological trigger is activated.",
        good:         "Listening credibility: 'The doctor who takes time' activates the primary unmet need in Indian primary care. Permanence: a doctor who has practiced in the same space for years will be there next year. Safety: first step is easy — just a conversation.",
        goldStandard: "Listening activation: the primary complaint of Indian urban patients about healthcare is that their doctor doesn't listen — the consultation is three minutes, the prescription is written before the patient finishes speaking. 'The doctor who takes time' directly addresses this and positions the doctor as the solution the patient has been looking for. Continuity psychology: Indian families build generational relationships with primary care doctors — advertising that communicates permanence and individual relationship activates this cultural pattern. Low-friction entry: WhatsApp booking and same-week availability eliminate the two primary reasons Indian patients delay primary care consultations.",
        why:          "The most powerful trigger for Indian primary care relationship formation is 'this doctor will listen to me and will be here next year'. Every other healthcare claim is secondary to these two.",
      },

      antiPattern: {
        bad:          "Doctor in full surgical scrubs. Equipment-heavy clinic photo. 'Book now for free health checkup'. Celebrity endorsement. Claims of '100% success rate'.",
        whyBad:       "Surgical scrubs communicate surgical procedure, not primary care relationship. Equipment-heavy environment maximises clinical anxiety. Free health checkup devalues clinical time. Celebrity endorsement communicates advertising budget, not clinical quality. '100% success rate' is medically inadvisable and legally problematic.",
        good:         "Doctor in professional consultation attire — neither casual nor surgical. Warm consultation room. No free offer language. Doctor's own name and credentials as the trust signal.",
        goldStandard: "The primary care advertisement that builds long-term patient relationships shows a real doctor in real consultation attire (smart casual or professional, not surgical) in a warm consultation room, visibly listening. No equipment visible. No discount. No guarantee. The doctor's name, qualification, and years in practice as the only credentials. One easy first step. The advertisement communicates: 'I am a person who has dedicated their professional life to being the doctor families can trust'. Nothing more, nothing less.",
        why:          "Trust in primary care is built through consistent signals of genuine human attention, professional permanence, and low-friction accessibility. Any element that communicates institution over individual, discount over quality, or procedure over relationship undermines this trust framework before the first appointment is made.",
      },

      conversionInsight: "Primary care appointments are booked when the patient believes this specific doctor will listen to them and will still be there in five years. The listening posture and the WhatsApp booking option answer both needs simultaneously. Show the listening; make the first step effortless.",
    },

  ],
};
