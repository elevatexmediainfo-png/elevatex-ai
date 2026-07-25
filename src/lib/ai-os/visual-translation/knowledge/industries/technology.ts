import type { IndustryEntry } from "../../types";

export const technologyIndustry: IndustryEntry = {
  key: "technology",
  aliases: [
    "technology", "tech", "software", "IT", "app", "saas", "startup",
    "product", "platform", "digital", "web app", "mobile app", "cloud",
    "cybersecurity", "data", "AI", "artificial intelligence", "enterprise software",
    "fintech", "healthtech", "developer tools", "API",
  ],
  concepts: {

    trust: [
      {
        type: "object",
        value: "An SOC 2 Type II or ISO 27001 certification badge is displayed beside a data flow diagram — the independent audit that makes a security claim verifiable rather than aspirational.",
        weight: 0.92,
        tags: ["object", "compliance", "SOC2", "technology"],
      },
      {
        type: "action",
        value: "A product status page is shown with 99.97% uptime history for the past twelve months — the public record of a system that has been available when customers needed it.",
        weight: 0.90,
        tags: ["action", "uptime", "status_page", "technology"],
      },
      {
        type: "object",
        value: "A customer's logo appears in a recognisable brand tier of the case study library — the social proof that a company of standing chose this platform and stayed.",
        weight: 0.88,
        tags: ["object", "customer_logos", "case_study", "technology"],
      },
    ],

    authority: [
      {
        type: "person",
        value: "A founder or technical lead speaks at a recognised industry conference — the public stage that measures an idea by whether peers judge it worth listening to.",
        weight: 0.92,
        tags: ["human", "conference", "speaking", "technology"],
      },
      {
        type: "object",
        value: "A contributed paper or technical deep-dive published in an engineering blog, peer-reviewed journal, or open-source repository communicates that this team builds knowledge, not just product.",
        weight: 0.90,
        tags: ["object", "publication", "research", "technology"],
      },
    ],

    innovation: [
      {
        type: "action",
        value: "A developer types a natural language instruction and watches the system generate a working output in real time — the gap between intention and result reduced to a single line.",
        weight: 0.96,
        tags: ["action", "real_time", "generation", "technology"],
      },
      {
        type: "object",
        value: "A product roadmap is shown with the percentage of items shipped versus promised — the evidence that this team's commitments have a high completion rate.",
        weight: 0.90,
        tags: ["object", "roadmap", "execution", "technology"],
      },
      {
        type: "action",
        value: "A UI element that did not exist six months ago solves a problem that users had to work around before — the product change made visible by the workaround it eliminated.",
        weight: 0.88,
        tags: ["action", "UI", "iteration", "technology"],
      },
    ],

    expertise: [
      {
        type: "action",
        value: "An engineer reviews a pull request with specific, technical in-line comments — the annotation of someone who has considered the implications at the system level, not just the function level.",
        weight: 0.94,
        tags: ["action", "code_review", "PR", "technology"],
      },
      {
        type: "object",
        value: "An architecture diagram shows the data flow across services with latency numbers and ownership labels — the kind of documentation that exists only in mature engineering organisations.",
        weight: 0.90,
        tags: ["object", "architecture", "diagram", "technology"],
      },
    ],

    precision: [
      {
        type: "object",
        value: "A monitoring dashboard shows P50/P95/P99 latency figures at sub-millisecond resolution — the instrumentation of a system that measures what it promises rather than estimating it.",
        weight: 0.94,
        tags: ["object", "monitoring", "latency", "technology"],
      },
      {
        type: "action",
        value: "A test coverage report shows 94% line coverage for the core domain — the engineering discipline that catches the edge cases before users discover them.",
        weight: 0.90,
        tags: ["action", "test_coverage", "quality", "technology"],
      },
    ],

    reliability: [
      {
        type: "object",
        value: "An incident post-mortem document is shared publicly — the root cause, the timeline, the fix, and the prevention measure — the transparency of a team that learns from failure rather than concealing it.",
        weight: 0.92,
        tags: ["object", "postmortem", "transparency", "technology"],
      },
      {
        type: "object",
        value: "An on-call rotation board shows named engineers assigned to each service — the accountability structure that ensures someone is always responsible for uptime.",
        weight: 0.90,
        tags: ["object", "on_call", "accountability", "technology"],
      },
    ],

    transformation: [
      {
        type: "composition",
        value: "A before-state shows the manual, multi-step process the user performed previously; the after-state shows the same outcome achieved in a single interaction with the product.",
        weight: 0.94,
        tags: ["composition", "before_after", "workflow", "technology"],
      },
      {
        type: "object",
        value: "A customer outcome metric — time saved per week, error rate reduced by X percent, revenue attributed — is shown as a clean data point rather than a marketing claim.",
        weight: 0.92,
        tags: ["object", "metric", "outcome", "technology"],
      },
    ],

    premium: [
      {
        type: "spatial",
        value: "An engineering office shows a quiet, high-quality workspace — sit-stand desks, quality monitors, natural light — the environment of a company that invests in the people who build the product.",
        weight: 0.88,
        tags: ["spatial", "office", "workspace", "technology"],
      },
    ],

    community: [
      {
        type: "person",
        value: "A developer community forum or Discord shows active, helpful answers from the product team alongside users — the company visible as a participant, not just a vendor.",
        weight: 0.90,
        tags: ["human", "community", "forum", "technology"],
      },
    ],

    confidence: [
      {
        type: "action",
        value: "A product demo is run live, without slides, on a real customer's data — the team's willingness to be tested under real conditions rather than controlled conditions.",
        weight: 0.92,
        tags: ["action", "live_demo", "real_data", "technology"],
      },
    ],
  },
};
