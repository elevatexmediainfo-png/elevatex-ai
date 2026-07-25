import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Coffee,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Hotel,
  ShoppingBag,
  Scissors,
  Stethoscope,
  Utensils,
} from "lucide-react";

// PRD Section 4.2 — the 10 initial verticals (SAM).
export const VERTICALS: Array<{
  name: string;
  icon: LucideIcon;
  colorVar: string;
  businesses: string;
}> = [
  { name: "Restaurants & Cloud Kitchens", icon: Utensils, colorVar: "--color-vertical-restaurant", businesses: "7.5M" },
  { name: "Cafes & Bakeries", icon: Coffee, colorVar: "--color-vertical-restaurant", businesses: "1.2M" },
  { name: "Salons & Spas", icon: Scissors, colorVar: "--color-vertical-salon", businesses: "2.8M" },
  { name: "Dental & Diagnostic Centres", icon: Stethoscope, colorVar: "--color-vertical-dental", businesses: "2.3M" },
  { name: "Real Estate & Builders", icon: Building2, colorVar: "--color-vertical-realestate", businesses: "0.9M" },
  { name: "Retail Stores", icon: ShoppingBag, colorVar: "--color-vertical-retail", businesses: "12M+" },
  { name: "Gyms & Fitness Centres", icon: Dumbbell, colorVar: "--color-vertical-gym", businesses: "0.6M" },
  { name: "Hospitals & Nursing Homes", icon: HeartPulse, colorVar: "--color-vertical-hospital", businesses: "0.7M" },
  { name: "Coaching & EdTech Centres", icon: GraduationCap, colorVar: "--color-vertical-coaching", businesses: "1.4M" },
  { name: "Hotels & Guest Houses", icon: Hotel, colorVar: "--color-vertical-hotel", businesses: "0.5M" },
];

// PRD Section 1.2 — Strategic pillars.
export const PILLARS = [
  {
    title: "Speed & Simplicity",
    description: "Go from idea to a publish-ready video in under 5 minutes — zero creative expertise needed.",
  },
  {
    title: "Vernacular First",
    description: "Full Hindi and English support across UI, voice-over, subtitles, and AI-generated copy.",
  },
  {
    title: "Industry-Smart",
    description: "AI-tuned templates for 10 core verticals that understand industry vocabulary and aesthetics.",
  },
  {
    title: "Affordable Tiers",
    description: "Freemium to Enterprise pricing built for Indian MSME cash flow, with UPI and card payments.",
  },
  {
    title: "Distribution-Ready",
    description: "One-click export and scheduling for WhatsApp, Instagram, YouTube Shorts, Facebook, and Google Business.",
  },
  {
    title: "Trust & Compliance",
    description: "DPDP Act 2023 compliant, with watermark control and brand-safe, content-moderated AI output.",
  },
];

// PRD Section 3.1 — the problem, in numbers.
export const PROBLEM_STATS = [
  { value: "₹15,000+", label: "Avg. cost of a single professional video shoot" },
  { value: "5–7 days", label: "Time to receive a finished video from an agency" },
  { value: "78%", label: "MSMEs with no in-house digital content creator" },
  { value: "91%", label: "Local businesses with no active YouTube/Reels strategy" },
];

// PRD Section 5 — user personas (used for "built for businesses like yours",
// not as fabricated testimonial quotes).
export const PERSONAS = [
  {
    name: "Ramesh Agarwal",
    role: "Owner, Multi-cuisine Restaurant — Indore",
    goal: "Wants to show off his food beautifully and fast, without hiring a designer or learning complex editing tools.",
  },
  {
    name: "Priya Menon",
    role: "Marketing Manager, 4-location Salon Chain — Bengaluru",
    goal: "Needs one tool to brief once and get on-brand videos across all four branches, without chasing an agency.",
  },
  {
    name: "Dr. Anjali Sharma",
    role: "Dentist & Clinic Owner — Jaipur",
    goal: "Wants her online presence to look as professional as her clinic does in person, without ever stepping on camera.",
  },
];

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Verticals", href: "#verticals" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

// PRD Section 8.4 / 11 — plan tiers referenced across the platform.
// Exact rupee pricing is set at go-to-market and intentionally not hard-coded here.
export const PLANS = [
  {
    name: "Free",
    tagline: "Try your first videos",
    price: "₹0",
    cadence: "forever",
    features: ["720p downloads with watermark", "Monthly free credits", "Access to all core templates", "1 brand kit"],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Starter",
    tagline: "For solo owners posting regularly",
    price: "From ₹499",
    cadence: "/month",
    features: ["1080p downloads with watermark", "5 GB media storage", "Post scheduling", "Custom voice-over upload"],
    cta: "Choose Starter",
    featured: false,
  },
  {
    name: "Growth",
    tagline: "For teams and multi-location brands",
    price: "From ₹1,499",
    cadence: "/month",
    features: ["1080p downloads, no watermark", "25 GB media storage", "Social package export (9:16/1:1/16:9)", "Team seats & approvals"],
    cta: "Choose Growth",
    featured: true,
  },
  {
    name: "Enterprise",
    tagline: "For franchises & agencies",
    price: "Custom",
    cadence: "",
    features: ["4K exports, no watermark", "100 GB pooled storage per seat", "White-label & custom templates", "Dedicated account support"],
    cta: "Talk to Sales",
    featured: false,
  },
];

export const FAQS = [
  {
    question: "Do I need any design or video editing experience?",
    answer:
      "No. Elevatex AI is built for business owners with zero creative expertise — pick an objective, choose a template, and the AI writes your script and assembles your video.",
  },
  {
    question: "Does it really support Hindi?",
    answer:
      "Yes — Hindi and English are supported across the UI, AI-generated scripts, voice-overs, and subtitles, with Hinglish content language also available.",
  },
  {
    question: "How fast is a video actually ready?",
    answer:
      "Most 60-second videos render in under 3 minutes once you approve your template. Most users go from sign-up to their first published video in under 8 minutes.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The Free plan includes monthly credits with no credit card required, so you can create and download your first videos before paying anything.",
  },
  {
    question: "Where can I publish my videos?",
    answer:
      "Directly to WhatsApp, Instagram (Feed, Reels, Story), Facebook, YouTube Shorts, and Google Business Profile — or download and share manually.",
  },
  {
    question: "Is my business data used to train AI models?",
    answer:
      "No, not without your explicit, revocable consent. Elevatex AI is built to be compliant with India's DPDP Act, 2023.",
  },
];
