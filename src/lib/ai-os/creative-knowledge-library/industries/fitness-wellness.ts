// Creative Knowledge Library — Fitness & Wellness

import type { IndustryKnowledge } from "../types";

export const fitnessWellness: IndustryKnowledge = {
  id:    "fitness_wellness",
  label: "Fitness & Wellness",
  campaigns: [

    {
      type: "gym_membership",
      tags: ["gym", "fitness", "membership", "workout", "training", "strength", "weight loss", "muscle", "personal trainer", "crossfit"],
      goal: "Drive gym membership sign-ups among first-time gym joiners and lapsed members by showing the specific moment of progress, not the end result.",
      audience: "Indian adults aged 22–40 who want to begin or return to regular training — motivated but not yet committed.",

      heroSubject: {
        bad:          "Fit person at the gym with perfect physique smiling at camera.",
        whyBad:       "The perfect physique with a camera-directed smile communicates the endpoint the viewer hasn't reached and cannot yet identify with. It creates aspiration distance rather than aspiration identification.",
        good:         "An Indian man mid-pull-up — not at the top where it's easy, but at the hardest point, three-quarters of the way up. His face shows effort, not pain.",
        goldStandard: "An Indian man in his late 20s is at the hardest point of his pull-up — three-quarters of the way up, the last quarter requiring the most effort. His jaw is set but not clenched. His eyes are directed at a fixed point above the bar. Behind him, slightly out of focus: a trainer's hand is just visible at the lower edge of frame — not supporting him, but having let go. He is at this point entirely on his own. He is going to make it.",
        why:          "The mid-effort moment at the hardest point communicates the specific experience of getting stronger — not the achievement, but the act. The trainer's hand having just let go communicates that the support system is there without communicating dependence. The viewer identifies with the effort, not the result.",
      },

      visualHierarchy: {
        bad:          "Before/after body transformation. Gym name. 'Join Now'. Membership price.",
        whyBad:       "Before/after body transformation creates an aspiration gap — the viewer who is starting out cannot see themselves in the 'after' image. It communicates the result without communicating the path.",
        good:         "Mid-effort moment 50%, training environment 25%, progress signal (trainer's hand letting go) 15%, membership CTA 10%. The act before the achievement.",
        goldStandard: "P1 Man at the hardest point of the pull-up (45%) — the effort the viewer will have to make and the identity that comes from making it. P2 The bar and his grip (20%) — the specific tool of transformation. P3 The training environment behind him (20%) — the space where this effort is made. P4 The trainer's hand at the lower edge, having just let go (10%) — the support system present but not dominant. P5 Membership CTA (5%).",
        why:          "When the mid-effort moment dominates, the viewer identifies with the act of becoming rather than the achievement of having become. Identification with becoming is more powerful than aspiration for achievement as a conversion trigger — because becoming is accessible today; achievement is in the uncertain future.",
      },

      composition: {
        bad:          "Gym equipment centred. Model lifting weights. Logo and offer text.",
        whyBad:       "Equipment-centred composition communicates the tools of fitness rather than the human experience of pursuing it. The Indian viewer who has not yet joined a gym is not evaluating equipment — they are evaluating whether they can see themselves in this space.",
        good:         "Man at the bar in the left two-thirds. The bar crossing the upper third of the frame. The training space receding behind him. Trainer's hand visible at the frame's lower edge.",
        goldStandard: "The man is at the left two-thirds of the frame, the bar crossing at the upper third — the composition creates a sense of upward motion. His body creates a diagonal from lower-right to upper-left, communicating effort and ascent. The training space recedes behind him in soft focus: other equipment visible, other people training. The trainer's hand appears at the lower right edge of frame — barely in frame, having just released. The entire composition is directed upward and forward.",
        why:          "The diagonal body creating an upward ascent line is the most powerful gym advertising compositional device. It communicates that the gym is a place where things go up — strength, capacity, self-belief. The trainer's hand at the frame's lower edge communicates that the ascent has support without the support being the story.",
      },

      photography: {
        bad:          "Professional gym photography. Great lighting. Fit models.",
        whyBad:       "Professional gym photography with great lighting communicates photoshoot rather than training session. The viewer's gym experience will not have this lighting, and the mismatch creates distrust.",
        good:         "35mm wide at below-bar level. Available gym lighting — a combination of overhead fluorescent and whatever natural light enters. The effort captured mid-rep, not at the peak or trough.",
        goldStandard: "35mm below-bar level — looking up at the man at the hardest point of his pull-up, from the perspective of the floor, which communicates the effort required and the altitude being achieved simultaneously. Available gym lighting: overhead fluorescent creates natural harsh shadows on the face that communicate genuine effort. If a window provides natural light on one side, it acts as a quality-signal contrast. 1/250s shutter speed — fast enough to freeze the expression of effort; slow enough that the hands on the bar show micro-tension.",
        why:          "Below-bar shooting angle for pull-ups is the most powerful gym advertising perspective because it creates genuine visual heroism — the viewer looks up at the person doing the difficult thing. It communicates that this person is achieving something from a respectful, aspirational distance.",
      },

      subjectDirection: {
        bad:          "Person posing with weights, showing muscles, looking powerful.",
        whyBad:       "Muscle-display posing communicates the result of six months of training, not the experience of starting. The Indian viewer who is considering a first membership cannot see themselves in a muscle display.",
        good:         "Man directed to be at the hardest point of his pull-up with genuine effort — face directed at a fixed point above the bar, not at the camera. The trainer directed to be present but not in frame.",
        goldStandard: "The man is directed: 'Fix your eyes on the point above the bar you are trying to reach. You are at the hardest point. You are going to make it. Don't look at the camera — look at where you are going.' His jaw is set with the specific expression of effort that has nothing performative in it. The trainer behind him has been directed to be in position for a support catch — hand visible at the lower edge, not reaching. He is there if needed. He is not needed.",
        why:          "The direction to 'look at where you are going, not at the camera' is the single most important direction choice in gym advertising. It communicates that the achievement is the goal, not the appearance — which is the internal experience of every person who has ever genuinely trained.",
      },

      environment: {
        bad:          "Modern gym with latest equipment.",
        whyBad:       "Every gym in India claims 'latest equipment'. The environment that converts a potential gym member is not the equipment — it is the sense that real people are genuinely training here.",
        good:         "A gym that shows evidence of real use: chalk on the bar, other members training in the background, the specific textures of a serious training environment.",
        goldStandard: "A serious training gym: chalk on the pull-up bar (the residue of many previous sessions). Other Indian members visible in background — at various stages, various builds, various ages — communicating that this gym serves real people, not just the already-fit. The floor has the scuff marks of heavy equipment moved in serious sessions. The mirrors show fingerprints from hands pressed against them for supported exercises. The smell of effort is implied by the visual evidence of it. This is a gym where people go to train, not to be seen.",
        why:          "Chalk on the bar is the single most powerful gym environmental detail in advertising. It communicates that serious work happens here — that this is a training environment, not a lifestyle space. Indian training-motivated gym joiners respond to seriousness, not aesthetic.",
      },

      typography: {
        bad:          "JOIN NOW. First month free. Best gym in [city]. Unlimited classes.",
        whyBad:       "'First month free' devalues the gym before the member experiences its value. 'Best gym in [city]' is a self-claim that produces no response from the sophisticated Indian urban fitness consumer.",
        good:         "One specific progress-oriented headline. Membership type and price honest. Trial offer if present as a secondary element. No self-proclaimed superlatives.",
        goldStandard: "Headline at 20% visual weight: 'The person you are in the third rep is who you become.' — addressing the specific internal experience of the person who trains rather than the person who joins. Gym name at 12% below. Membership: '₹X/month — month-to-month, no lock-in' at 10% — addresses the primary commitment anxiety. Trial CTA at 14%: 'Come for a free session — no membership required'. No 'best in city' claim.",
        why:          "'Month-to-month, no lock-in' converts first-time gym joiners at significantly higher rates than annual memberships because it addresses the specific anxiety of the person who has previously bought a gym membership and not used it. Removing the commitment barrier removes the guilt barrier.",
      },

      layout: {
        bad:          "Before/after grid. Transformation photos. Membership prices. Facilities list.",
        whyBad:       "Before/after grids activate the aspiration gap — the viewer sees the 'after' body they don't have and the distance feels uncrossable. Facilities lists position the gym as a service provider rather than a transformation partner.",
        good:         "Mid-effort moment dominant. Progress-oriented headline. Month-to-month membership framing. Free session CTA. No before/after, no facilities list.",
        goldStandard: "Mid-effort image (65%). Upper zone (20%): progress headline right-aligned. Lower zone (15%): gym name left; 'Month-to-month, ₹X' centre; 'Free session — come as you are' CTA right. 'Come as you are' communicates that the person does not need to be fit to join — which is the primary first-time joiner anxiety. No before/after in any zone. The layout communicates: start here, today, as you are.",
        why:          "'Come as you are' addresses the specific Indian gym-joining anxiety of feeling out of place in a gym while not yet fit. It removes the requirement to be a certain level before belonging — which is the primary psychological barrier to first-time gym membership.",
      },

      commercialDetails: {
        bad:          "Annual membership ₹X. All facilities. 50+ classes. Free personal training session included.",
        whyBad:       "Annual membership as the primary commercial detail creates maximum commitment anxiety for a first-time joiner who doesn't know if they'll sustain the habit. 50+ classes communicates overwhelming choice for a person who just wants to start.",
        good:         "Month-to-month membership price clearly stated. One free session to try with no commitment. Opening hours relevant to working professional schedules. Trainer availability noted.",
        goldStandard: "Month-to-month: '₹X/month — cancel anytime, no penalty'. Free session: 'One free training session — book online, no card required'. Hours: 'Open 5 AM–11 PM — your schedule works here'. If personal training is available: 'Personal trainers available — book a session from ₹X'. No annual fee primary offering, no forced bundle packages. The commercial details communicate one thing: the barrier to starting is lower than you think.",
        why:          "Every commercial detail in first-time gym membership advertising must reduce friction, not add value. 'Cancel anytime' reduces commitment anxiety. 'No card required for free session' removes the commitment signal of leaving payment details. 'Your schedule works here' removes the scheduling excuse. Reducing friction converts; adding features delays.",
      },

      negativeSpace: {
        bad:          "Full frame utilised for transformation photos, price chart, and facility logos.",
        whyBad:       "Dense gym advertising creates visual overwhelm — which mirrors the psychological overwhelm of a person considering a lifestyle change. The viewer's internal experience of the advertisement predicts their internal experience of the gym.",
        good:         "The mid-effort image has space to breathe. The headline has visual weight. The CTA is the only element in the lower zone.",
        goldStandard: "The mid-effort image has 5% breathing margin within the image zone — enough for the effort to feel uncontained, to extend beyond the frame. The headline in the upper zone has 8% space above it. Between headline and image: 4%. The lower zone contains only the membership price and the free session CTA, with 10% internal spacing between them. The overall visual space communicates: this gym is not trying to overwhelm you. Start with one session. See what happens.",
        why:          "A gym advertisement with generous negative space communicates the same thing as a gym with open floor space: room to grow. The visual breathing room communicates that the gym is not crowded, the membership is not complicated, and the first step is as simple as a single free session.",
      },

      marketingPsychology: {
        bad:          "Get the body you've always wanted. Transform in 90 days. Join the fitness revolution.",
        whyBad:       "Body-achievement promises activate aspiration but not action — the 90-day transformation timeline makes the goal feel distant, and distant goals produce delayed starts. 'Fitness revolution' is generic marketing language.",
        good:         "Identity in progress: 'the person you become while training' not 'the body you achieve after'. Low commitment framing: month-to-month, free session. Social proof: real members at various stages of progress.",
        goldStandard: "Identity formation psychology: the Indian first-time gym joiner is not primarily motivated by body aesthetics — they are motivated by the identity of being 'someone who trains'. The advertisement speaks to the identity aspiration: 'The person you are in the third rep is who you become' communicates that the identity shift happens during training, not after. Low-commitment psychology: 'month-to-month, cancel anytime' removes the most common reason Indian gym joiners don't start — fear of wasting the annual fee if they don't sustain. Free session psychology: 'come for a free session, no card required' removes every commitment signal from the first step.",
        why:          "The Indian gym joiner who converts to a paying long-term member is motivated by identity, not aesthetics. The advertisement that activates the identity of 'someone who trains' — shown in the mid-effort moment, the trainer's letting go of the support, the chalk on the bar — converts this specific person. Body-aesthetic promises activate a different, more fickle motivation.",
      },

      antiPattern: {
        bad:          "Impossible physique as the goal. '6-pack in 6 weeks' guarantee. Celebrity trainer name-drop without the trainer. Intimidating equipment display. Music video gym aesthetic.",
        whyBad:       "Impossible physique goals create an aspiration gap that most Indian adults cannot cross psychologically. '6-pack in 6 weeks' guarantees communicate the advertising language of questionable supplements, not serious training. Celebrity trainer name-drops create association without evidence. Intimidating equipment displays activate the anxiety of not belonging.",
        good:         "Achievable mid-journey moment. Real Indian member at real effort. No physique guarantee. Serious training environment without intimidation. Month-to-month accessibility.",
        goldStandard: "The gym membership advertisement that converts first-time joiners shows a real Indian person at a genuine effort moment that the viewer can imagine experiencing — not an impossible physique that requires years of dedicated training that the viewer doesn't yet believe they will sustain. The environment is serious but not intimidating. The membership is flexible. The first step is a free single session. The visual communicates: 'you could be here tomorrow'. That is the only conversion required.",
        why:          "The first-time gym joiner's conversion happens at the moment they believe they could be in that space, doing that thing, tomorrow. Impossible physiques and celebrity trainers delay that belief indefinitely. A real person at a real difficult moment — with a free session as the first step — makes that belief possible today.",
      },

      conversionInsight: "Gym memberships convert when the uncommitted person can imagine themselves mid-rep, at the hard part, with a trainer's hand having just let go. That mid-effort identification is the moment of conversion. Month-to-month pricing and a free session CTA make acting on that identification immediate.",
    },

  ],
};
