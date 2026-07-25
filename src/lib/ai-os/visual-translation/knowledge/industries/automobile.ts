import type { IndustryEntry } from "../../types";

export const automobileIndustry: IndustryEntry = {
  key: "automobile",
  aliases: [
    "automobile", "automotive", "car", "car dealership", "auto", "vehicle",
    "bikes", "two-wheeler", "motorbike", "used cars", "car showroom",
    "fleet", "electric vehicle", "ev", "luxury car", "SUV", "commercial vehicles",
  ],
  concepts: {

    trust: [
      {
        type: "object",
        value: "A vehicle's inspection report is shown open on the sales desk — every system checked, every item ticked, the paper trail of a vehicle that has been assessed rather than just offered.",
        weight: 0.92,
        tags: ["object", "inspection_report", "verification", "automobile"],
      },
      {
        type: "action",
        value: "A service advisor walks the customer around the vehicle after the service, showing each item that was replaced — the physical demonstration of what was done before the invoice is signed.",
        weight: 0.90,
        tags: ["action", "walkthrough", "service", "automobile"],
      },
      {
        type: "object",
        value: "Manufacturer-authorised service badges and OEM parts certifications are displayed at the service entrance — the difference between authorised accountability and general repair.",
        weight: 0.88,
        tags: ["object", "certification", "authorised", "automobile"],
      },
    ],

    authority: [
      {
        type: "spatial",
        value: "A flagship showroom with a double-height glass facade and vehicles displayed on raised platforms communicates that the brand occupies the top of its category.",
        weight: 0.92,
        tags: ["spatial", "showroom", "flagship", "automobile"],
      },
      {
        type: "person",
        value: "A product specialist presents the vehicle's technical architecture from memory, without a brochure — the embodied knowledge that earns the right to advise.",
        weight: 0.90,
        tags: ["human", "specialist", "technical", "automobile"],
      },
    ],

    premium: [
      {
        type: "lighting",
        value: "A vehicle is lit with studio-quality overhead directional light that reveals the depth and uniformity of the paint, the clarity of the glass, and the precision of the panel gaps.",
        weight: 0.96,
        tags: ["lighting", "studio", "paint", "automobile"],
      },
      {
        type: "material",
        value: "The interior is shot with a wide aperture at the threshold of the open door — hand-stitched leather, machined aluminium trim, and an analogue gauge cluster filling the frame.",
        weight: 0.94,
        tags: ["material", "interior", "leather", "aluminium", "automobile"],
      },
      {
        type: "spatial",
        value: "A vehicle detail bay in a high-end service centre shows the car on a lift in a clean white-walled space — the clinical environment of a brand that treats its product seriously.",
        weight: 0.90,
        tags: ["spatial", "detail_bay", "service", "automobile"],
      },
    ],

    luxury: [
      {
        type: "lighting",
        value: "A luxury vehicle is photographed at dusk on an empty road, the last sky light silhouetting the roofline while the interior ambient glow shows through the glass.",
        weight: 0.96,
        tags: ["lighting", "dusk", "silhouette", "automobile"],
      },
      {
        type: "material",
        value: "The personalisation atelier — colour swatches, leather samples, bespoke stitching patterns — communicates that this vehicle is configured, not selected from a stock list.",
        weight: 0.92,
        tags: ["material", "bespoke", "personalisation", "automobile"],
      },
    ],

    desire: [
      {
        type: "action",
        value: "The vehicle moves through a sweeping corner at the exact angle where the dynamic line of the body is most pronounced — the shape made alive by motion.",
        weight: 0.96,
        tags: ["action", "cornering", "dynamic", "automobile"],
      },
      {
        type: "lighting",
        value: "A detail shot captures the vehicle's headlight signature at twilight — the designed light source that makes the brand recognisable even in darkness.",
        weight: 0.94,
        tags: ["lighting", "headlight", "twilight", "signature", "automobile"],
      },
    ],

    precision: [
      {
        type: "object",
        value: "A panel gap along the body of the vehicle is photographed in raking light — the uniform, hairline tolerance that separates a precision-built car from one assembled to a budget.",
        weight: 0.94,
        tags: ["object", "panel_gap", "tolerance", "automobile"],
      },
      {
        type: "action",
        value: "An engineer calibrates wheel alignment on a four-post alignment rig, the millimetre-level adjustment translating directly into handling response.",
        weight: 0.90,
        tags: ["action", "alignment", "calibration", "automobile"],
      },
    ],

    craftsmanship: [
      {
        type: "action",
        value: "A craftsman hand-stitches the leather-wrapped steering wheel using an upholstery needle and thread — the forty minutes of skilled labour hidden inside the driving experience.",
        weight: 0.95,
        tags: ["action", "handstitch", "steering_wheel", "automobile"],
      },
      {
        type: "object",
        value: "The engine bay of a hand-built vehicle is shown after final assembly — every hose routed, every bracket positioned, every bolt torqued — the organised completeness of something made with intention.",
        weight: 0.90,
        tags: ["object", "engine_bay", "assembly", "automobile"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A side-by-side shows the vehicle arriving at the workshop in its deteriorated state and leaving after restoration — the same vehicle, an entirely different future.",
        weight: 0.94,
        tags: ["composition", "restoration", "before_after", "automobile"],
      },
      {
        type: "action",
        value: "Keys are handed to the customer in the showroom beside the vehicle they have just collected — the completion of a decision process that began with a want and ends with ownership.",
        weight: 0.90,
        tags: ["action", "key_handover", "delivery", "automobile"],
      },
    ],

    innovation: [
      {
        type: "object",
        value: "An EV charging port illuminates as the cable connects — the quiet, toolless, effortless ritual of an energy model that has no moving parts at the moment of refuelling.",
        weight: 0.92,
        tags: ["object", "EV", "charging", "innovation", "automobile"],
      },
      {
        type: "action",
        value: "A driver releases the steering wheel on a clear highway and the vehicle maintains lane position under full driver-assistance — the first moment of trusting autonomous capability.",
        weight: 0.90,
        tags: ["action", "autonomous", "driver_assistance", "automobile"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "A service interval chart on the workshop wall maps every model's maintenance schedule — the institution that tracks what needs to happen before problems develop.",
        weight: 0.90,
        tags: ["object", "service_schedule", "maintenance", "automobile"],
      },
    ],
  },
};
