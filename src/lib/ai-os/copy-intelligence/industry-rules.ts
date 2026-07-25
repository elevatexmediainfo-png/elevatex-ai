// Phase 8.8A — Industry-specific copy rules.
// Template banks for CTA, benefits, social proof, disclaimers, and subheadlines.
// Pure data — no logic, no LLM, no generation.

import type { SupportedIndustryId } from "../commercial-assets/types";

// ─────────────────────────────────────────────────────────────────────────────
// CTA map per industry × objective
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_CTA: Record<SupportedIndustryId, Record<string, string>> = {
  restaurant: {
    default:             "Reserve Your Table",
    lead_generation:     "Book Now",
    footfall:            "Visit Us Today",
    brand_awareness:     "View Our Menu",
    event_attendance:    "Book Your Seat",
    direct_sale:         "Order Now",
    appointment_booking: "Make Reservation",
    trust_building:      "Explore Our Menu",
    product_launch:      "Try It First",
  },
  dental: {
    default:             "Book Consultation",
    lead_generation:     "Book Free Consultation",
    appointment_booking: "Schedule Appointment",
    brand_awareness:     "Learn More",
    trust_building:      "Meet Our Doctors",
    direct_sale:         "Get Treatment Quote",
    footfall:            "Visit Our Clinic",
    event_attendance:    "Register Now",
    product_launch:      "Explore Treatments",
  },
  real_estate: {
    default:             "Book Site Visit",
    lead_generation:     "Register Your Interest",
    brand_awareness:     "Download Brochure",
    direct_sale:         "Book Now",
    appointment_booking: "Schedule Site Visit",
    trust_building:      "Know More",
    footfall:            "Visit Project Site",
    event_attendance:    "Attend Launch Event",
    product_launch:      "Explore Project",
  },
  healthcare: {
    default:             "Book Appointment",
    lead_generation:     "Consult Now",
    appointment_booking: "Schedule Appointment",
    brand_awareness:     "Learn More",
    trust_building:      "Meet Our Doctors",
    direct_sale:         "Get Treatment",
    footfall:            "Visit Us Today",
    event_attendance:    "Register Now",
    product_launch:      "Know More",
  },
  jewelry: {
    default:             "Explore Collection",
    lead_generation:     "Book Appointment",
    brand_awareness:     "View Collection",
    direct_sale:         "Shop Now",
    appointment_booking: "Visit Showroom",
    trust_building:      "Discover More",
    footfall:            "Visit Showroom",
    event_attendance:    "Attend Preview",
    product_launch:      "See New Arrivals",
  },
  salon: {
    default:             "Book Appointment",
    lead_generation:     "Book Now",
    appointment_booking: "Schedule Service",
    brand_awareness:     "View Services",
    direct_sale:         "Claim Offer",
    trust_building:      "See Transformations",
    footfall:            "Walk In Today",
    event_attendance:    "Book Session",
    product_launch:      "Try New Service",
  },
  education: {
    default:             "Enroll Now",
    lead_generation:     "Get Free Demo",
    brand_awareness:     "Explore Courses",
    direct_sale:         "Join Now",
    appointment_booking: "Schedule Demo",
    trust_building:      "View Placements",
    footfall:            "Visit Campus",
    event_attendance:    "Register Free",
    product_launch:      "Apply Now",
  },
  automotive: {
    default:             "Book Test Drive",
    lead_generation:     "Get Price Quote",
    brand_awareness:     "Explore Models",
    direct_sale:         "Buy Now",
    appointment_booking: "Schedule Test Drive",
    trust_building:      "View Reviews",
    footfall:            "Visit Showroom",
    event_attendance:    "Attend Launch",
    product_launch:      "Discover New Model",
  },
  finance: {
    default:             "Get Started",
    lead_generation:     "Apply Now",
    brand_awareness:     "Learn More",
    direct_sale:         "Invest Now",
    appointment_booking: "Book Consultation",
    trust_building:      "View Plans",
    footfall:            "Visit Branch",
    event_attendance:    "Attend Webinar",
    product_launch:      "Explore Plans",
  },
  tech: {
    default:             "Get Started Free",
    lead_generation:     "Start Free Trial",
    brand_awareness:     "See How It Works",
    direct_sale:         "Buy Now",
    appointment_booking: "Schedule Demo",
    trust_building:      "View Case Studies",
    footfall:            "Visit Us",
    event_attendance:    "Register Free",
    product_launch:      "Try For Free",
  },
  fashion: {
    default:             "Shop Now",
    lead_generation:     "Get Offer",
    brand_awareness:     "Explore Collection",
    direct_sale:         "Shop Sale",
    appointment_booking: "Book Styling Session",
    trust_building:      "Our Story",
    footfall:            "Visit Store",
    event_attendance:    "Attend Sale Event",
    product_launch:      "Shop New Arrivals",
  },
  events: {
    default:             "Register Now",
    lead_generation:     "Book Your Spot",
    brand_awareness:     "Learn More",
    direct_sale:         "Buy Tickets",
    appointment_booking: "Reserve Your Seat",
    trust_building:      "View Past Events",
    footfall:            "Attend Event",
    event_attendance:    "Register Free",
    product_launch:      "Join Us",
  },
  general: {
    default:             "Learn More",
    lead_generation:     "Contact Us",
    brand_awareness:     "Discover More",
    direct_sale:         "Shop Now",
    appointment_booking: "Book Now",
    trust_building:      "Know More",
    footfall:            "Visit Us",
    event_attendance:    "Register",
    product_launch:      "Explore Now",
  },
};

// Secondary CTAs (optional)
export const INDUSTRY_SECONDARY_CTA: Partial<Record<SupportedIndustryId, Partial<Record<string, string>>>> = {
  dental:      { lead_generation: "Call Today", appointment_booking: "Call Now" },
  real_estate: { lead_generation: "Call Sales Team", direct_sale: "Download Brochure" },
  healthcare:  { lead_generation: "Call Now", appointment_booking: "WhatsApp Us" },
  finance:     { lead_generation: "Schedule Call", trust_building: "Download Fact Sheet" },
  automotive:  { lead_generation: "Call Dealer", direct_sale: "View Finance Options" },
  education:   { lead_generation: "Call Counsellor", brand_awareness: "Download Brochure" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Benefits bank per industry
// Each entry is ≤ 6 words. Ordered by general applicability.
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_BENEFITS: Record<SupportedIndustryId, string[]> = {
  restaurant: [
    "Fresh Locally Sourced Ingredients",
    "Award-Winning Executive Chef",
    "Private Dining Rooms Available",
    "Extensive Wine & Cocktail Selection",
    "Handcrafted Seasonal Menus",
    "Family-Friendly Atmosphere",
    "Online Reservation Available",
    "Outdoor Terrace Seating",
  ],
  dental: [
    "Painless Advanced Procedures",
    "Same-Day Appointments Available",
    "State-of-the-Art Technology",
    "Board-Certified Dental Specialists",
    "Affordable EMI Options",
    "Complete Family Dental Services",
    "Child-Friendly Dental Care",
    "Smile Makeover Specialists",
  ],
  real_estate: [
    "Prime Location Connectivity",
    "World-Class Amenities",
    "RERA Registered Project",
    "Bank Loan Approved",
    "24/7 Security Surveillance",
    "Green Building Standards",
    "Flexible Payment Plans",
    "Ready for Possession",
  ],
  healthcare: [
    "Expert Medical Specialists",
    "State-of-the-Art Equipment",
    "24/7 Emergency Services",
    "Insurance Accepted",
    "Compassionate Patient Care",
    "Same-Day Consultations Available",
    "Certified Accredited Hospital",
    "Holistic Treatment Approach",
  ],
  jewelry: [
    "Certified Diamond Collection",
    "Hallmarked Gold Jewelry",
    "Custom Design Available",
    "Expert Craftsmanship Guaranteed",
    "Lifetime Polishing & Cleaning",
    "International Quality Standards",
    "BIS Certified Gold",
    "Easy Exchange Policy",
  ],
  salon: [
    "Expert Styling Professionals",
    "Premium Hair Products Used",
    "Relaxing Spa Experience",
    "Trained International Stylists",
    "Hygienic Sterilized Equipment",
    "Bridal Packages Available",
    "Walk-Ins Welcome",
    "Personalized Style Consultation",
  ],
  education: [
    "Expert Faculty Members",
    "100% Placement Assistance",
    "Industry-Relevant Curriculum",
    "Online & Offline Classes",
    "Small Batch Learning",
    "Lifetime Access to Content",
    "Certificate Upon Completion",
    "Live Project Experience",
  ],
  automotive: [
    "Zero Down Payment Offers",
    "5-Year Warranty Available",
    "Free Service Package",
    "Advanced Safety Features",
    "Fuel-Efficient Performance",
    "Connected Car Technology",
    "Easy Loan Processing",
    "Authorized Dealer Service",
  ],
  finance: [
    "SEBI Registered Fund",
    "Transparent Fee Structure",
    "Goal-Based Financial Planning",
    "Expert Investment Advisors",
    "Digital-First Platform",
    "Tax-Saving Benefits Available",
    "Portfolio Diversification Strategy",
    "Proven Track Record",
  ],
  tech: [
    "Easy 5-Minute Setup",
    "Bank-Level Data Security",
    "24/7 Customer Support",
    "Free 14-Day Trial",
    "Scales With Your Growth",
    "No Credit Card Required",
    "API Integration Available",
    "Trusted by 10,000+ Businesses",
  ],
  fashion: [
    "Latest Global Trends",
    "Premium Quality Fabrics",
    "Easy Returns Policy",
    "Fast Delivery Available",
    "Exclusive Designer Collection",
    "Sustainable Fashion Choices",
    "Sizes XS to 4XL",
    "Style for Every Budget",
  ],
  events: [
    "World-Class Venue Setup",
    "Expert Event Management",
    "Customizable Event Packages",
    "Experienced Professional Team",
    "Full Catering Available",
    "Audio Visual Equipment",
    "Corporate & Private Events",
    "Stress-Free Event Planning",
  ],
  general: [
    "Quality Guaranteed",
    "Fast Reliable Service",
    "Expert Team Available",
    "Affordable Pricing Plans",
    "Customer Satisfaction Priority",
    "24/7 Support Available",
    "ISO Certified Quality",
    "Trusted by Thousands",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Social proof templates per industry
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_SOCIAL_PROOF: Record<SupportedIndustryId, string[]> = {
  restaurant: [
    "4.9 Stars on Google",
    "500+ Happy Diners Monthly",
    "10 Years of Culinary Excellence",
    "Featured in Times Food Guide",
    "Award-Winning Restaurant 2024",
  ],
  dental: [
    "4.8 Google Rating",
    "10,000+ Smiles Transformed",
    "15+ Years of Experience",
    "BDS & MDS Certified",
    "IDA Member Practice",
  ],
  real_estate: [
    "Trusted Since 2005",
    "500+ Happy Families",
    "RERA Registered Project",
    "Award-Winning Developer",
    "10 Million Sq Ft Delivered",
  ],
  healthcare: [
    "4.9 Patient Satisfaction Score",
    "NABH Accredited Hospital",
    "50,000+ Patients Treated",
    "20+ Years of Excellence",
    "ISO 9001 Certified",
  ],
  jewelry: [
    "BIS Hallmarked Gold Assured",
    "Since 1985",
    "100,000+ Happy Customers",
    "Award-Winning Jeweler",
    "Certified Diamond Grader",
  ],
  salon: [
    "4.8 Stars on Google",
    "10,000+ Happy Clients",
    "International Certified Stylists",
    "Featured in Vogue India",
    "Award-Winning Salon 2024",
  ],
  education: [
    "98% Placement Record",
    "25,000+ Students Trained",
    "ISO 9001:2015 Certified",
    "Top-Ranked Institute 2024",
    "Industry-Recognized Certification",
  ],
  automotive: [
    "4.9 Google Rating",
    "Authorized Service Center",
    "10,000+ Cars Delivered",
    "Award-Winning Dealer 2024",
    "25 Years in Automotive",
  ],
  finance: [
    "SEBI Registered Advisor",
    "₹500 Cr+ AUM Managed",
    "15+ Years Track Record",
    "4.8 Client Satisfaction",
    "AMFI Registered Distributor",
  ],
  tech: [
    "10,000+ Businesses Trust Us",
    "99.9% Uptime Guaranteed",
    "G2 Top-Rated Software 2024",
    "SOC 2 Certified",
    "4.9 App Store Rating",
  ],
  fashion: [
    "1 Lakh+ Happy Customers",
    "Featured in Vogue India",
    "Award-Winning Fashion Brand",
    "4.8 Stars on Google",
    "Trusted Since 2010",
  ],
  events: [
    "500+ Events Successfully Managed",
    "4.9 Client Satisfaction",
    "Certified Event Management",
    "Pan-India Event Network",
    "Award-Winning Event Company",
  ],
  general: [
    "Trusted by Thousands",
    "4.8 Google Rating",
    "Award-Winning Service",
    "ISO Certified",
    "10+ Years in Business",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Disclaimer texts (legally required industries)
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_DISCLAIMERS: Partial<Record<SupportedIndustryId, string>> = {
  finance:    "Mutual fund investments are subject to market risks. Please read all scheme-related documents carefully before investing. Past performance is not indicative of future returns.",
  healthcare: "Results may vary. Please consult a qualified medical professional before starting any treatment or medication.",
  dental:     "Results may vary. Treatment outcomes depend on individual patient conditions. Please consult our dental specialist for a personalised assessment.",
  real_estate:"This is not a legal offer. Prices and specifications are subject to change. Please verify all project details with RERA registration before making any purchase decision.",
  automotive: "Fuel efficiency and performance figures are indicative. Actual results may vary based on driving conditions and usage patterns.",
};

// Industries that legally require disclaimers
export const DISCLAIMER_INDUSTRIES = new Set<SupportedIndustryId>([
  "finance", "healthcare", "dental", "real_estate",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Subheadline defaults per industry (used when no campaign signal is available)
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_DEFAULT_SUBHEADLINES: Record<SupportedIndustryId, string> = {
  restaurant:  "Fine Dining Redefined",
  dental:      "Expert Dental Care",
  real_estate: "Premium Living Spaces",
  healthcare:  "Compassionate, Expert Care",
  jewelry:     "Where Elegance Meets Craftsmanship",
  salon:       "Your Style, Perfected",
  education:   "Shaping Tomorrow's Leaders",
  automotive:  "Drive Excellence",
  finance:     "Building Wealth, Securing Futures",
  tech:        "Simplifying Business Technology",
  fashion:     "Style for Every Story",
  events:      "Creating Unforgettable Experiences",
  general:     "Excellence You Can Count On",
};

// ─────────────────────────────────────────────────────────────────────────────
// Audience defaults per industry (used in headline slot {audience})
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_AUDIENCE_NOUN: Record<SupportedIndustryId, string> = {
  restaurant:  "Food Lovers",
  dental:      "Patients",
  real_estate: "Homebuyers",
  healthcare:  "Patients",
  jewelry:     "Jewelry Lovers",
  salon:       "Clients",
  education:   "Students",
  automotive:  "Drivers",
  finance:     "Investors",
  tech:        "Businesses",
  fashion:     "Fashion Lovers",
  events:      "Attendees",
  general:     "Customers",
};

// ─────────────────────────────────────────────────────────────────────────────
// Industry noun phrases for headline slots
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_NOUNS: Record<SupportedIndustryId, string[]> = {
  restaurant:  ["Culinary Experience", "Fine Dining", "Cuisine", "Flavors"],
  dental:      ["Smile", "Dental Care", "Oral Health", "Smile Transformation"],
  real_estate: ["Living Spaces", "Dream Home", "Properties", "Homes"],
  healthcare:  ["Healthcare", "Medical Care", "Wellness", "Health"],
  jewelry:     ["Craftsmanship", "Jewelry", "Elegance", "Collection"],
  salon:       ["Transformation", "Beauty", "Style", "Look"],
  education:   ["Future", "Learning", "Excellence", "Success"],
  automotive:  ["Performance", "Drive", "Excellence", "Engineering"],
  finance:     ["Growth", "Financial Freedom", "Wealth", "Returns"],
  tech:        ["Innovation", "Solutions", "Technology", "Platform"],
  fashion:     ["Style", "Fashion", "Collection", "Wardrobe"],
  events:      ["Experience", "Event", "Celebration", "Moments"],
  general:     ["Excellence", "Quality", "Experience", "Solutions"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Badge text templates
// ─────────────────────────────────────────────────────────────────────────────

export const OBJECTIVE_BADGE: Partial<Record<string, string>> = {
  direct_sale:         "Limited Time",
  event_attendance:    "Limited Seats",
  lead_generation:     "Free Consultation",
  product_launch:      "New Launch",
  appointment_booking: "Book Today",
  footfall:            "Visit Now",
};

export const CATEGORY_BADGE: Partial<Record<string, string>> = {
  launch:     "Grand Opening",
  offer:      "Exclusive Offer",
  festival:   "Festival Special",
  promotion:  "Limited Offer",
  corporate:  "Exclusive Access",
  branding:   "Now Available",
};
