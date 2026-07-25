import type { IndustryEntry } from "../../types";

export const dentalIndustry: IndustryEntry = {
  key: "dental",
  aliases: [
    "dental", "dentist", "dental clinic", "dental implant", "orthodontics",
    "oral health", "cosmetic dentistry", "teeth whitening", "periodontist",
    "endodontist", "dental surgery", "smile clinic",
  ],
  concepts: {

    trust: [
      {
        type: "action",
        value: "The dentist turns a digital X-ray screen to face the patient at eye level, walking through the findings with a pointer and plain language.",
        weight: 0.96,
        tags: ["transparency", "action", "x_ray", "dental"],
      },
      {
        type: "object",
        value: "A framed IDA certification, university dental degree, or postgraduate implant qualification is clearly visible on the consultation room wall.",
        weight: 0.90,
        tags: ["credential", "object", "dental", "certification"],
      },
      {
        type: "person",
        value: "The patient's hands, previously clenched on the chair armrests, slowly release and settle flat as the dentist's explanation continues.",
        weight: 0.88,
        tags: ["human", "tension_release", "patient", "dental"],
      },
      {
        type: "action",
        value: "The dentist shows a before-and-after photograph of a comparable past case, making the treatment outcome tangible before it begins.",
        weight: 0.85,
        tags: ["action", "evidence", "before_after", "dental"],
      },
    ],

    authority: [
      {
        type: "object",
        value: "Framed specialist certifications — implantology, orthodontics, cosmetic dentistry — are arranged visibly on a consultation room feature wall.",
        weight: 0.92,
        tags: ["object", "credential", "specialist", "dental"],
      },
      {
        type: "person",
        value: "The dentist stands at a teaching position beside a dental anatomy model while colleagues or students observe.",
        weight: 0.88,
        tags: ["human", "teaching", "authority", "dental"],
      },
      {
        type: "object",
        value: "A published clinical case study or peer-reviewed research paper is visible on the desk, positioning the dentist as a knowledge source.",
        weight: 0.85,
        tags: ["object", "research", "authority", "dental"],
      },
    ],

    premium: [
      {
        type: "material",
        value: "The consultation room features warm timber joinery, premium marble-effect surfaces, and discreet medical-grade equipment with no exposed cable management.",
        weight: 0.92,
        tags: ["material", "premium", "interior", "dental"],
      },
      {
        type: "object",
        value: "Digital scanning technology, cone beam imaging, or same-day ceramic CAD/CAM production equipment is visible and in active use.",
        weight: 0.88,
        tags: ["object", "technology", "premium", "dental"],
      },
      {
        type: "lighting",
        value: "Soft, tunable LED ambient lighting in the consultation suite creates a warm clinical atmosphere that feels like a private suite rather than a surgery.",
        weight: 0.85,
        tags: ["lighting", "premium", "tunable", "dental"],
      },
    ],

    cleanliness: [
      {
        type: "action",
        value: "A dental nurse opens a sealed sterile pouch to reveal individually wrapped instruments, holding them up before placement on the sterile tray.",
        weight: 0.96,
        tags: ["action", "sterilisation", "hygiene", "dental"],
      },
      {
        type: "object",
        value: "An autoclave unit with a fresh cycle completion indicator is visible in the sterilisation zone — the equipment of clinical hygiene, not just the promise of it.",
        weight: 0.90,
        tags: ["object", "autoclave", "sterilisation", "dental"],
      },
      {
        type: "material",
        value: "The dental chair upholstery, bracket table, and overhead light are shown in pristine condition — no staining, no wear marks, no residue.",
        weight: 0.85,
        tags: ["material", "pristine", "hygiene", "dental"],
      },
    ],

    care: [
      {
        type: "person",
        value: "The dentist sits beside the patient at chair height during the consultation, maintaining eye-level contact throughout the explanation.",
        weight: 0.92,
        tags: ["human", "proximity", "care", "dental"],
      },
      {
        type: "action",
        value: "A dental nurse holds the patient's hand briefly during a difficult moment — the human reassurance that clinical equipment cannot provide.",
        weight: 0.90,
        tags: ["action", "touch", "reassurance", "dental"],
      },
      {
        type: "object",
        value: "A comfort menu — noise-cancelling headphones, a blanket, a choice of ambient scent — is displayed at the patient's eye level before treatment begins.",
        weight: 0.85,
        tags: ["object", "comfort", "menu", "dental"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A side-by-side split frame shows the pre-treatment profile and the post-treatment result at the same angle and focal length.",
        weight: 0.96,
        tags: ["composition", "split_frame", "before_after", "dental"],
      },
      {
        type: "person",
        value: "A patient smiles fully and openly for the first time in the image — unguarded, no hand near the mouth, completely natural.",
        weight: 0.93,
        tags: ["human", "smile", "transformation", "dental"],
      },
      {
        type: "object",
        value: "A digital smile design preview is shown on screen beside the patient's current profile — the destination visible before the journey begins.",
        weight: 0.88,
        tags: ["object", "digital_design", "preview", "dental"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "A dentist handles an implant component with a fine torque wrench, the instrument communicating that this is a calibrated, precision procedure.",
        weight: 0.93,
        tags: ["action", "implant", "precision", "dental"],
      },
      {
        type: "object",
        value: "A dental loupes magnification system is worn, communicating that the work requires vision enhancement beyond the naked eye.",
        weight: 0.90,
        tags: ["object", "loupes", "magnification", "dental"],
      },
      {
        type: "action",
        value: "The dentist examines a CBCT scan with the specific attentiveness of reading bone density and nerve mapping — not general scan reviewing.",
        weight: 0.88,
        tags: ["action", "scan", "reading", "dental"],
      },
    ],

    luxury: [
      {
        type: "spatial",
        value: "The clinic reception features a single signature floral arrangement, designer seating, and a curated ambient scent that communicates investment in every sensory detail.",
        weight: 0.90,
        tags: ["spatial", "luxury", "reception", "dental"],
      },
      {
        type: "object",
        value: "Premium zirconia or lithium disilicate ceramic restorations are shown in close-up, the light playing across the translucent natural-looking material.",
        weight: 0.92,
        tags: ["object", "ceramic", "zirconia", "luxury_dental"],
      },
      {
        type: "material",
        value: "The treatment room features Italian marble counter surfaces, seamless cabinetry with no visible handles, and custom lighting that eliminates visible fixtures.",
        weight: 0.88,
        tags: ["material", "marble", "seamless", "luxury_dental"],
      },
    ],

    confidence: [
      {
        type: "person",
        value: "A treated patient smiles directly at the camera with full teeth showing — unguarded, no hand near the mouth, completely natural.",
        weight: 0.96,
        tags: ["human", "smile", "unguarded", "dental"],
      },
      {
        type: "action",
        value: "The same patient who previously spoke with a closed mouth now laughs openly in conversation — the camera records what treatment enabled.",
        weight: 0.92,
        tags: ["action", "laugh", "open", "dental"],
      },
      {
        type: "action",
        value: "A patient studies their own smile in a handheld mirror immediately after treatment, the expression on their face confirming satisfaction before any words.",
        weight: 0.88,
        tags: ["action", "mirror", "self_examination", "dental"],
      },
    ],

    comfort: [
      {
        type: "object",
        value: "A ceiling-mounted TV monitor plays a calming nature scene directly above the dental chair — the patient has something to focus on beyond the overhead light.",
        weight: 0.88,
        tags: ["object", "TV", "distraction", "dental"],
      },
      {
        type: "material",
        value: "The dental chair is shown in a reclined position with a soft neck pillow and contoured arm support — the patient's body supported at every contact point.",
        weight: 0.90,
        tags: ["material", "chair", "support", "dental"],
      },
    ],

    freshness: [
      {
        type: "material",
        value: "The clinical environment is shown post-morning setup — every surface polished, every instrument laid out in perfect order before the first patient of the day.",
        weight: 0.88,
        tags: ["material", "setup", "morning", "dental"],
      },
      {
        type: "object",
        value: "Fresh flowers or a living plant are visible in the reception area — organic, alive, the natural opposite of clinical artificiality.",
        weight: 0.82,
        tags: ["object", "plant", "living", "dental"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A patient treatment plan printout or digital care record is visible — evidence that each visit has a systematic record and a planned next step.",
        weight: 0.90,
        tags: ["object", "record", "treatment_plan", "dental"],
      },
      {
        type: "action",
        value: "A receptionist confirms the follow-up appointment in the patient's presence before they leave — the next visit booked, the care cycle visible.",
        weight: 0.85,
        tags: ["action", "follow_up", "booking", "dental"],
      },
    ],
  },
};
