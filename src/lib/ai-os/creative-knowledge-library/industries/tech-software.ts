// Creative Knowledge Library — Tech & Software

import type { IndustryKnowledge } from "../types";

export const techSoftware: IndustryKnowledge = {
  id:    "tech_software",
  label: "Tech & Software",
  campaigns: [

    {
      type: "saas_product",
      tags: ["software", "saas", "app", "tool", "platform", "subscription", "productivity", "automation", "dashboard", "workflow", "startup", "tech", "b2b"],
      goal: "Drive free trial sign-ups or demo requests by communicating the specific relief the software provides, not its feature list.",
      audience: "Indian SMB owners, team leads, and founders aged 25–45 who are drowning in manual work and have seen too many software advertisements claiming to fix everything.",

      heroSubject: {
        bad:          "Person using laptop showing software dashboard. Happy team around a screen.",
        whyBad:       "Laptop-with-dashboard photography communicates every software product simultaneously. The Indian B2B decision maker who has been approached by hundreds of software vendors is immune to this image.",
        good:         "The specific moment of relief when the software completes a task the user has been doing manually — the notification arriving, the report generating automatically, the alarm that didn't need to be set.",
        goldStandard: "An Indian woman in her early 30s — a team lead or small business owner — is at her desk at 6:45 PM. Her team has gone home. On her laptop screen: the software has just finished generating the monthly report that she has manually compiled from five sources every month for two years. The notification says: 'Report ready — sent to all stakeholders'. She is reading the notification. Her expression is not joy — it is the specific expression of someone realising that a task they have been dreading for two years just completed itself in six seconds.",
        why:          "The 'realising a task just completed itself' expression is the most powerful SaaS advertising image available because it is the specific emotional peak of every software adoption decision. The B2B buyer buys relief, not features.",
      },

      visualHierarchy: {
        bad:          "Software dashboard screenshot dominant. Feature list. Pricing tiers. Free trial CTA.",
        whyBad:       "Feature-list hierarchy communicates product comparison rather than relief experience. The Indian B2B decision maker evaluating software has already seen twenty feature lists this month and remembers none of them.",
        good:         "User's relief moment 50%, the specific task that just completed 25%, the software name and one specific benefit 15%, free trial CTA 10%.",
        goldStandard: "P1 The specific relief expression (45%) — the software's actual value communicating itself through the user. P2 The laptop screen with the completion notification (25%) — the specific task automated. P3 The empty desk around her (15%) — the team has gone home; she is alone with the software that is doing the work. P4 Software name and one benefit statement (10%). P5 Free trial CTA (5%).",
        why:          "The empty desk communicates scale of impact: this software is saving time across the entire team, not just making one person's dashboard slightly more convenient. The empty office at 6:45 PM communicates that real work is being done here.",
      },

      composition: {
        bad:          "Clean desk with laptop showing beautiful dashboard. Professional office.",
        whyBad:       "Clean desk with beautiful dashboard communicates aspirational product marketing — every SaaS company's website aesthetic. It is immediately recognised and dismissed.",
        good:         "Real working desk at end of day: the desk of someone who has been working, the laptop screen as the primary light source, the notification as the compositional anchor.",
        goldStandard: "Camera at desk level from the front — the position of someone sitting across from her. She is three-quarter profile, looking at the laptop screen. The screen's notification is visible — legible but not dominant. The desk around the laptop: papers from the day, a coffee cup, her phone turned face-down (she is focused on this). The office behind her: dark, empty chairs, the suggestion of the team that has left. The laptop screen is the only light source in the lower third of the frame. Reading flow: her expression → the screen notification → the empty office behind her.",
        why:          "The empty office behind the laptop user at end-of-day is the most specific and honest SaaS advertising environmental detail available. It communicates: the software is solving a real problem at the real time when the problem is most acute.",
      },

      photography: {
        bad:          "Bright, clean, modern office photography. Cheerful team. Professional lighting.",
        whyBad:       "Bright clean office photography communicates brand aspiration rather than product function. The Indian SMB decision maker who is evaluating software does not work in a photographer's ideal office — they work in a real one at the end of a real day.",
        good:         "End-of-day office: the laptop screen as primary light, the room naturally lit at 6:45 PM, the real desk of a real working person.",
        goldStandard: "50mm lens at desk level — the natural perspective of the working environment. Available light: the laptop screen creating warm-white illumination on the user's face and the desk surface. The office behind her: the natural ambient light of an office at the end of the working day — neither bright workday light nor complete darkness. 1/80s shutter — the slight softness of the end-of-day moment, when people are less perfectly still. The image is slightly warm — the specific colour temperature of an office at 6:45 PM.",
        why:          "End-of-day colour temperature in software advertising communicates that this product is solving the real problem at the real moment when the problem is most acute — not in a photoshoot where everything is perfectly lit.",
      },

      subjectDirection: {
        bad:          "Business person smiling at laptop. Team high-fiving over shared screen.",
        whyBad:       "Camera-directed smiling communicates performance of software satisfaction. Team high-fiving communicates the rare celebratory outcome rather than the daily relief.",
        good:         "The user alone at her desk at end of day, directed to read the completion notification as though for the first time — the expression of someone realising a task they have been dreading just completed itself.",
        goldStandard: "The direction: 'You have been doing this report manually every month for two years. You set this software up last week without much confidence. It is 6:45 PM and your team has gone home and you are about to start the report — and then this notification appears. Read it. The report is done. Read it again.' Her eyes move across the notification. Her expression settles — not into joy but into the specific quietness of someone whose two-year problem just resolved itself in six seconds. That expression, at that moment, is the software's advertisement.",
        why:          "The expression of 'two-year problem resolving in six seconds' is the authentic relief expression — quiet, slightly disbelieving, deeply satisfied. It is more conversion-powerful than any joy expression because it is the specific emotional tone of the software evaluation moment.",
      },

      environment: {
        bad:          "Modern coworking space. Startup aesthetic. Ping-pong table visible.",
        whyBad:       "Coworking and startup aesthetics communicate the aspirational software lifestyle that Indian SMB buyers are not buying. The Indian SMB owner works in their own small office, their home, or a rented room — not a VC-funded coworking space.",
        good:         "A real Indian SMB office at the end of the working day: the specific environment of the Indian small business or team lead whose problem this software is solving.",
        goldStandard: "An Indian SMB office at 6:45 PM: a realistic desk in a medium-sized office or a commercial space. The walls: not minimalist white but the cream-painted walls of a real working office. Other chairs and desks visible in the background, empty now. A plant on the windowsill that is partially alive. The specific organised-but-lived-in quality of a desk where real work happens every day. This is the environment the software's buyer works in — and showing it communicates that the software understands them.",
        why:          "The partially-alive plant is the most specific honest environmental detail in Indian SMB software advertising. It communicates 'real office' rather than 'photoshoot office' immediately — and real-office recognition is the most powerful trust signal in B2B advertising.",
      },

      typography: {
        bad:          "Software Name. '10X your productivity'. Free trial. Feature list. Pricing starts at ₹X.",
        whyBad:       "'10X your productivity' is the most overused SaaS headline in the industry. Feature lists in software campaign advertising communicate information that belongs on the website after the desire is established.",
        good:         "One specific relief headline naming the specific task the software completes. Software name. One specific time-saving statistic if honest and verifiable. Free trial CTA.",
        goldStandard: "Headline at 20%: 'The report that used to take 4 hours now takes 6 seconds.' — this is the specific version of the software's value proposition. Not '10X productivity' but the specific task, the specific time before, the specific time after. Software name at 14% below. One honest statistic at 10%: 'Used by 10,000+ Indian SMBs' (if true) or 'Average time saved: 6 hours/week' (if measurable). Free trial CTA at 14%: 'Try free for 14 days — no card required'.",
        why:          "'The report that used to take 4 hours now takes 6 seconds' converts at higher rates than '10X your productivity' because it is specific and therefore credible. The Indian B2B buyer has dismissed 1,000 '10X productivity' claims. They have never seen '4 hours to 6 seconds' before because it requires knowing what the product actually does.",
      },

      layout: {
        bad:          "Dashboard screenshot. Feature grid. Three pricing tiers. Multiple CTAs.",
        whyBad:       "Dashboard screenshots communicate the product's interface rather than the product's impact. Feature grids and pricing tiers belong on the website, not the acquisition advertisement.",
        good:         "Relief moment image dominant. One specific time-saving headline. Software name. One usage statistic. Free trial CTA. No dashboard screenshot, no feature list.",
        goldStandard: "Relief moment image (65%) — user at end of day with completion notification. Upper zone (20%): time-saving headline; software name below at smaller weight. Lower zone (15%): honest usage statistic left; 'Try free for 14 days' CTA centre; 'No card required' right. No dashboard screenshot in the primary campaign advertisement — this belongs on the website landing page after the desire is established.",
        why:          "'No card required' is the single most important commercial detail in free trial software advertising for Indian SMBs because it removes the primary conversion barrier — the fear of being automatically charged. It is more conversion-effective than any feature listed.",
      },

      commercialDetails: {
        bad:          "Integrates with 200+ tools. 99.9% uptime. GDPR compliant. Enterprise-grade security.",
        whyBad:       "These four claims are the minimum expectation of any credible SaaS product in 2024. Listing them communicates that the software has nothing more compelling to say.",
        good:         "One specific time-saving metric. One adoption signal. Free trial specifics. Support commitment relevant to Indian SMBs.",
        goldStandard: "Time saving: 'Average team saves 6 hours per week on [specific task]' — specific and believable. Adoption: 'Trusted by 10,000+ Indian businesses' or 'Used in 50+ cities across India' — Indian-specific social proof converts at higher rates than global user counts for Indian SMB buyers. Trial: '14-day free trial — full access, no card required'. Support: 'WhatsApp support — response in under 2 hours' — Indian SMBs specifically value WhatsApp support over email/ticket systems.",
        why:          "WhatsApp support as a commercial detail converts Indian SMB software buyers at higher rates than any technical specification because it communicates that the software company understands how Indian businesses actually work and communicate. It is a local market signal, not a technical claim.",
      },

      negativeSpace: {
        bad:          "All space used for dashboard image, feature grid, and multiple pricing options.",
        whyBad:       "Dense software advertising communicates 'another software trying to sell me something' — which triggers the dismissal response that Indian SMB decision makers have developed from years of being targeted by SaaS vendors.",
        good:         "The relief moment has breathing room. The time-saving headline is isolated and credible. The free trial CTA is the singular next step.",
        goldStandard: "The relief moment image has 5% breathing margin within the image zone. The upper zone headline has 8% space above it — the specific time-saving claim deserves a moment of consideration. Between headline and image: 4%. The lower zone contains three elements maximum with 8% internal spacing. The layout communicates: this software is confident enough in its value proposition that it does not need to show you a feature list.",
        why:          "Software advertising with negative space communicates product confidence. The vendor who leads with one specific claim and one free trial CTA communicates that the claim is verifiable — which is the most powerful trust signal in Indian B2B software advertising.",
      },

      marketingPsychology: {
        bad:          "Work smarter. Transform your business. The future of work is here.",
        whyBad:       "Abstract transformation language is the ambient vocabulary of SaaS marketing. Indian SMB buyers have seen 1,000 'future of work' claims and converted from none of them.",
        good:         "Specific task relief: name the exact task the software completes and the exact time it saves. Procrastination pattern interruption: 'you have been doing this the hard way for too long'. Low-friction first step: 14-day trial, no card, WhatsApp support.",
        goldStandard: "Specific task relief psychology: Indian SMB buyers adopt software to solve a specific painful task — not to 'transform their business'. The advertisement that names the specific task, the specific time it was taking, and the specific time it now takes converts because it speaks to a real pain the buyer is experiencing today. Procrastination pattern interruption: 'The report that used to take 4 hours now takes 6 seconds' — this headline interrupts the pattern of accepting the manual task as unavoidable. The buyer has accepted the 4-hour task; the advertisement tells them they don't have to. Low-friction activation: 14-day trial + no card + WhatsApp support removes every barrier between the desire and the first use.",
        why:          "The Indian SMB decision maker's primary software adoption barrier is not the price or the features — it is the time and effort required to evaluate and adopt a new tool. The advertisement that reduces this barrier to a single 14-day trial with WhatsApp support converts the motivated buyer who has been thinking about this problem for six months.",
      },

      antiPattern: {
        bad:          "Diverse international stock team celebrating. Software dashboard screenshot showing confusing UI. '10X', '5X', 'infinity' productivity claims. 'Enterprise-grade' language for SMB product. Annual pricing only — no monthly option mentioned.",
        whyBad:       "International stock team photography communicates irrelevance to the Indian SMB buyer. Dashboard screenshots of complex UI communicate the software's complexity, not its relief. 'Enterprise-grade' language intimidates the SMB buyer. Annual-only pricing creates commitment anxiety.",
        good:         "Real Indian SMB user at their real end-of-day moment. One specific time-saving claim. Free trial with monthly option available. WhatsApp support mentioned. No dashboard screenshot in the advertisement.",
        goldStandard: "The SaaS advertisement that converts Indian SMB buyers shows one real Indian SMB user at the exact moment of relief the software provides. It names the specific task and the specific time saved. It offers a free trial with no card required. It mentions WhatsApp support. It has no dashboard screenshot, no feature list, no international stock photography, and no abstract transformation claims. It converts because it speaks directly to the specific person experiencing the specific pain the software solves — at the specific moment when they are most open to being helped.",
        why:          "Indian SMB buyers adopt software from vendors who clearly understand their specific business environment. The advertisement that shows a real Indian working environment, names a real specific pain, and offers a real low-friction first step converts the buyer who has been in evaluation mode for months into an active trial user.",
      },

      conversionInsight: "SaaS free trial sign-ups convert when the buyer can name the specific task they will stop doing manually. 'The report that used to take 4 hours now takes 6 seconds' creates the specific motivation. '14-day trial, no card required, WhatsApp support' removes every barrier. Show the relief moment. Name the specific relief. Make the first step free.",
    },

  ],
};
