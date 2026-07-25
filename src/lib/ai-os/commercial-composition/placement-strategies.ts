// Phase 8.7C — 14 named composition strategies.
// Each strategy defines heroZone, default placements per asset, whitespace,
// and safe zones. Pure data — no logic, no generation.

import type {
  CompositionStrategyId,
  CompositionInput,
  HeroZone,
  AssetPlacementDefaults,
  StrategyDefinition,
} from "./types";
import { SAFE_ZONES, WHITESPACE_DEFAULTS } from "./layout-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Hero zone definitions per strategy
// ─────────────────────────────────────────────────────────────────────────────

const HERO_ZONES: Record<CompositionStrategyId, HeroZone> = {
  luxury:       { region: "mid_center",  dominancePercent: 65, aspectMode: "bleed", safeZonePercent: 0 },
  minimal:      { region: "mid_center",  dominancePercent: 55, aspectMode: "fit",   safeZonePercent: 5 },
  editorial:    { region: "mid_center",  dominancePercent: 60, aspectMode: "fill",  safeZonePercent: 3 },
  product:      { region: "mid_center",  dominancePercent: 65, aspectMode: "fit",   safeZonePercent: 5 },
  healthcare:   { region: "mid_center",  dominancePercent: 50, aspectMode: "fill",  safeZonePercent: 5 },
  real_estate:  { region: "top_center",  dominancePercent: 60, aspectMode: "fill",  safeZonePercent: 0 },
  restaurant:   { region: "mid_center",  dominancePercent: 65, aspectMode: "bleed", safeZonePercent: 0 },
  fashion:      { region: "mid_center",  dominancePercent: 70, aspectMode: "bleed", safeZonePercent: 0 },
  corporate:    { region: "mid_center",  dominancePercent: 50, aspectMode: "fill",  safeZonePercent: 5 },
  social:       { region: "mid_center",  dominancePercent: 60, aspectMode: "fill",  safeZonePercent: 3 },
  mobile_first: { region: "top_center",  dominancePercent: 55, aspectMode: "fill",  safeZonePercent: 5 },
  landscape:    { region: "mid_center",  dominancePercent: 70, aspectMode: "fill",  safeZonePercent: 0 },
  square:       { region: "mid_center",  dominancePercent: 65, aspectMode: "fill",  safeZonePercent: 3 },
  vertical:     { region: "mid_center",  dominancePercent: 55, aspectMode: "fill",  safeZonePercent: 3 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fallback placements per strategy
// Used for any asset not specifically defined in the strategy.
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACKS: Record<CompositionStrategyId, AssetPlacementDefaults> = {
  luxury:       { region: "footer_center",  alignment: "center", safeZonePercent: 10, prominence: "subtle",   clearSpace: 6,  size: "small",  stackOrder: 10 },
  minimal:      { region: "footer_center",  alignment: "center", safeZonePercent: 8,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 10 },
  editorial:    { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 10 },
  product:      { region: "footer_center",  alignment: "center", safeZonePercent: 5,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 10 },
  healthcare:   { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 10 },
  real_estate:  { region: "footer_center",  alignment: "center", safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 10 },
  restaurant:   { region: "footer_center",  alignment: "center", safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 10 },
  fashion:      { region: "footer_center",  alignment: "center", safeZonePercent: 5,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 10 },
  corporate:    { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 10 },
  social:       { region: "bottom_center",  alignment: "center", safeZonePercent: 5,  prominence: "low",      clearSpace: 3,  size: "small",  stackOrder: 10 },
  mobile_first: { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 3,  size: "small",  stackOrder: 10 },
  landscape:    { region: "footer_center",  alignment: "center", safeZonePercent: 5,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 10 },
  square:       { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 10 },
  vertical:     { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 3,  size: "small",  stackOrder: 10 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Strategy asset placements
// Partial: only assets commonly used in this context are specified.
// Everything else falls through to `fallbackPlacement`.
// ─────────────────────────────────────────────────────────────────────────────

const LUXURY_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:    { region: "bottom_left",   alignment: "left",   safeZonePercent: 10, prominence: "critical", clearSpace: 8,  size: "large",  stackOrder: 30 },
  subheadline: { region: "below_headline",alignment: "left",   safeZonePercent: 10, prominence: "medium",   clearSpace: 6,  size: "medium", stackOrder: 25, spacing: 2 },
  cta:         { region: "bottom_right",  alignment: "right",  safeZonePercent: 10, prominence: "high",     clearSpace: 8,  size: "medium", stackOrder: 35 },
  logo:        { region: "top_right",     alignment: "right",  safeZonePercent: 8,  prominence: "high",     clearSpace: 10, size: "medium", stackOrder: 20 },
  award_badge: { region: "bottom_left",   alignment: "left",   safeZonePercent: 10, prominence: "medium",   clearSpace: 6,  size: "small",  stackOrder: 22 },
  trust_badge: { region: "footer_left",   alignment: "left",   safeZonePercent: 10, prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  phone:       { region: "footer_right",  alignment: "right",  safeZonePercent: 10, prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  website:     { region: "footer_center", alignment: "center", safeZonePercent: 10, prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 12 },
  whatsapp:    { region: "footer_right",  alignment: "right",  safeZonePercent: 10, prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 14 },
};

const MINIMAL_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:    { region: "top_center",    alignment: "center", safeZonePercent: 8,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 30 },
  subheadline: { region: "below_headline",alignment: "center", safeZonePercent: 8,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 2 },
  cta:         { region: "bottom_center", alignment: "center", safeZonePercent: 8,  prominence: "high",     clearSpace: 6,  size: "medium", stackOrder: 35 },
  logo:        { region: "top_right",     alignment: "right",  safeZonePercent: 6,  prominence: "medium",   clearSpace: 8,  size: "medium", stackOrder: 20 },
  phone:       { region: "footer_right",  alignment: "right",  safeZonePercent: 8,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 15 },
  website:     { region: "footer_center", alignment: "center", safeZonePercent: 8,  prominence: "subtle",   clearSpace: 4,  size: "small",  stackOrder: 12 },
};

const EDITORIAL_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:    { region: "top_left",      alignment: "left",   safeZonePercent: 6,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 30 },
  subheadline: { region: "below_headline",alignment: "left",   safeZonePercent: 6,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:         { region: "bottom_left",   alignment: "left",   safeZonePercent: 6,  prominence: "high",     clearSpace: 6,  size: "medium", stackOrder: 35 },
  logo:        { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 6,  size: "medium", stackOrder: 20 },
  benefits:    { region: "mid_left",      alignment: "left",   safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "auto",   stackOrder: 15 },
  phone:       { region: "footer_left",   alignment: "left",   safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 15 },
  address:     { region: "footer_left",   alignment: "left",   safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
};

const PRODUCT_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:       { region: "top_center",    alignment: "center", safeZonePercent: 5,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline:    { region: "below_headline",alignment: "center", safeZonePercent: 5,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:            { region: "bottom_center", alignment: "center", safeZonePercent: 5,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 35 },
  logo:           { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 6,  size: "medium", stackOrder: 20 },
  benefits:       { region: "bottom_left",   alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "auto",   stackOrder: 15, columns: 3 },
  feature_icons:  { region: "below_hero",    alignment: "center", safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 14 },
  offer_ribbon:   { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  discount_badge: { region: "top_right",     alignment: "right",  safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  review_stars:   { region: "above_cta",     alignment: "center", safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 20 },
  google_rating:  { region: "above_cta",     alignment: "center", safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 20 },
  qr_code:        { region: "bottom_right",  alignment: "right",  safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "medium", stackOrder: 25 },
};

const HEALTHCARE_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:           { region: "top_center",    alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 30 },
  subheadline:        { region: "below_headline",alignment: "center", safeZonePercent: 6,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 2 },
  doctor_name:        { region: "mid_left",       alignment: "left",   safeZonePercent: 5,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 30 },
  doctor_credentials: { region: "below_headline", alignment: "left",   safeZonePercent: 5,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1 },
  clinic_logo:        { region: "top_right",      alignment: "right",  safeZonePercent: 6,  prominence: "high",     clearSpace: 8,  size: "medium", stackOrder: 20 },
  appointment_button: { region: "bottom_center",  alignment: "center", safeZonePercent: 8,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 40 },
  trust_badge:        { region: "mid_right",      alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 18 },
  certification:      { region: "mid_right",      alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 17 },
  google_rating:      { region: "above_cta",      alignment: "center", safeZonePercent: 8,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 20 },
  review_stars:       { region: "above_cta",      alignment: "center", safeZonePercent: 8,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 20 },
  before_after_badge: { region: "mid_center",     alignment: "center", safeZonePercent: 5,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, dominancePercent: 18 },
  phone:              { region: "footer_left",    alignment: "left",   safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  whatsapp:           { region: "footer_right",   alignment: "right",  safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  address:            { region: "footer_center",  alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
};

const REAL_ESTATE_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:       { region: "top_center",    alignment: "center", safeZonePercent: 5,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline:    { region: "below_headline",alignment: "center", safeZonePercent: 5,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  builder_logo:   { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "critical", clearSpace: 8,  size: "medium", stackOrder: 20 },
  location:       { region: "mid_left",      alignment: "left",   safeZonePercent: 5,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  possession_date:{ region: "mid_right",     alignment: "right",  safeZonePercent: 5,  prominence: "high",     clearSpace: 5,  size: "medium", stackOrder: 28 },
  cta:            { region: "bottom_center", alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 40 },
  developer_seal: { region: "bottom_left",   alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 22 },
  rera_number:    { region: "footer_right",  alignment: "right",  safeZonePercent: 5,  prominence: "subtle",   clearSpace: 3,  size: "small",  stackOrder: 10 },
  price_tag:      { region: "mid_right",     alignment: "right",  safeZonePercent: 5,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 28 },
  phone:          { region: "footer_left",   alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  whatsapp:       { region: "footer_right",  alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  award_badge:    { region: "top_left",      alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 22 },
  trust_badge:    { region: "bottom_left",   alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  qr_code:        { region: "footer_center", alignment: "center", safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "medium", stackOrder: 20 },
};

const RESTAURANT_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:            { region: "top_center",    alignment: "center", safeZonePercent: 5,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline:         { region: "below_headline",alignment: "center", safeZonePercent: 5,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:                 { region: "bottom_center", alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 38 },
  booking_button:      { region: "bottom_center", alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  logo:                { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "high",     clearSpace: 6,  size: "medium", stackOrder: 20 },
  chef_recommendation: { region: "bottom_left",   alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "medium", stackOrder: 22 },
  google_rating:       { region: "top_left",      alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 22 },
  review_stars:        { region: "top_left",      alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 22 },
  offer_ribbon:        { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  opening_badge:       { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  festival_sticker:    { region: "top_right",     alignment: "right",  safeZonePercent: 0,  prominence: "medium",   clearSpace: 0,  size: "small",  stackOrder: 38 },
  discount_badge:      { region: "top_right",     alignment: "right",  safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  qr_code:             { region: "bottom_right",  alignment: "right",  safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "medium", stackOrder: 22 },
  address:             { region: "footer_left",   alignment: "left",   safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
  phone:               { region: "footer_right",  alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  whatsapp:            { region: "footer_right",  alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
};

const FASHION_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:         { region: "bottom_left",   alignment: "left",   safeZonePercent: 5,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline:      { region: "below_headline",alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "medium", stackOrder: 24, spacing: 1.5 },
  cta:              { region: "bottom_right",  alignment: "right",  safeZonePercent: 5,  prominence: "high",     clearSpace: 5,  size: "medium", stackOrder: 35 },
  logo:             { region: "top_center",    alignment: "center", safeZonePercent: 5,  prominence: "high",     clearSpace: 6,  size: "medium", stackOrder: 20 },
  offer_ribbon:     { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 42 },
  limited_time_badge:{ region: "top_right",   alignment: "right",  safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "small",  stackOrder: 40 },
  discount_badge:   { region: "top_right",     alignment: "right",  safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  festival_sticker: { region: "top_right",     alignment: "right",  safeZonePercent: 0,  prominence: "medium",   clearSpace: 0,  size: "small",  stackOrder: 38 },
  social_icons:     { region: "footer_right",  alignment: "right",  safeZonePercent: 5,  prominence: "subtle",   clearSpace: 3,  size: "small",  stackOrder: 12 },
  website:          { region: "footer_center", alignment: "center", safeZonePercent: 5,  prominence: "subtle",   clearSpace: 3,  size: "small",  stackOrder: 10 },
};

const CORPORATE_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:         { region: "top_center",    alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 30 },
  subheadline:      { region: "below_headline",alignment: "center", safeZonePercent: 6,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 2 },
  cta:              { region: "bottom_center", alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 38 },
  logo:             { region: "top_left",      alignment: "left",   safeZonePercent: 6,  prominence: "high",     clearSpace: 8,  size: "medium", stackOrder: 20 },
  benefits:         { region: "mid_left",      alignment: "left",   safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "auto",   stackOrder: 15 },
  trust_badge:      { region: "top_right",     alignment: "right",  safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 18 },
  certification:    { region: "top_right",     alignment: "right",  safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 17 },
  award_badge:      { region: "bottom_left",   alignment: "left",   safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 22 },
  phone:            { region: "footer_left",   alignment: "left",   safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  website:          { region: "footer_center", alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
  address:          { region: "footer_right",  alignment: "right",  safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
  email:            { region: "footer_right",  alignment: "right",  safeZonePercent: 6,  prominence: "subtle",   clearSpace: 3,  size: "small",  stackOrder: 10 },
};

const SOCIAL_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:         { region: "top_center",    alignment: "center", safeZonePercent: 5,  prominence: "critical", clearSpace: 4,  size: "large",  stackOrder: 30 },
  subheadline:      { region: "below_headline",alignment: "center", safeZonePercent: 5,  prominence: "high",     clearSpace: 3,  size: "medium", stackOrder: 25, spacing: 1 },
  cta:              { region: "bottom_center", alignment: "center", safeZonePercent: 8,  prominence: "critical", clearSpace: 4,  size: "large",  stackOrder: 40 },
  logo:             { region: "top_right",     alignment: "right",  safeZonePercent: 4,  prominence: "medium",   clearSpace: 5,  size: "small",  stackOrder: 20 },
  offer_ribbon:     { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 42 },
  limited_time_badge:{region: "top_right",     alignment: "right",  safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "small",  stackOrder: 40 },
  review_stars:     { region: "above_cta",     alignment: "center", safeZonePercent: 8,  prominence: "medium",   clearSpace: 3,  size: "small",  stackOrder: 20 },
  google_rating:    { region: "above_cta",     alignment: "center", safeZonePercent: 8,  prominence: "medium",   clearSpace: 3,  size: "small",  stackOrder: 20 },
  qr_code:          { region: "bottom_right",  alignment: "right",  safeZonePercent: 5,  prominence: "low",      clearSpace: 3,  size: "small",  stackOrder: 22 },
  social_icons:     { region: "footer_right",  alignment: "right",  safeZonePercent: 4,  prominence: "subtle",   clearSpace: 3,  size: "small",  stackOrder: 12 },
};

const MOBILE_FIRST_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:         { region: "top_center",    alignment: "center", safeZonePercent: 8,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline:      { region: "below_headline",alignment: "center", safeZonePercent: 8,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:              { region: "bottom_center", alignment: "center", safeZonePercent: 10, prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  booking_button:   { region: "bottom_center", alignment: "center", safeZonePercent: 10, prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  appointment_button:{ region:"bottom_center", alignment: "center", safeZonePercent: 10, prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  logo:             { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 5,  size: "small",  stackOrder: 20 },
  offer_ribbon:     { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 42 },
  phone:            { region: "above_cta",     alignment: "center", safeZonePercent: 10, prominence: "medium",   clearSpace: 4,  size: "medium", stackOrder: 28 },
  whatsapp:         { region: "above_cta",     alignment: "center", safeZonePercent: 10, prominence: "medium",   clearSpace: 4,  size: "medium", stackOrder: 28 },
};

const LANDSCAPE_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:    { region: "mid_left",      alignment: "left",   safeZonePercent: 8,  prominence: "critical", clearSpace: 6,  size: "large",  stackOrder: 30 },
  subheadline: { region: "below_headline",alignment: "left",   safeZonePercent: 8,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:         { region: "bottom_left",   alignment: "left",   safeZonePercent: 8,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 38 },
  logo:        { region: "top_right",     alignment: "right",  safeZonePercent: 6,  prominence: "high",     clearSpace: 6,  size: "medium", stackOrder: 20 },
  benefits:    { region: "mid_left",      alignment: "left",   safeZonePercent: 8,  prominence: "medium",   clearSpace: 4,  size: "auto",   stackOrder: 15 },
  phone:       { region: "bottom_right",  alignment: "right",  safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  website:     { region: "bottom_right",  alignment: "right",  safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
};

const SQUARE_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:    { region: "top_center",    alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline: { region: "below_headline",alignment: "center", safeZonePercent: 6,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:         { region: "bottom_center", alignment: "center", safeZonePercent: 6,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 38 },
  logo:        { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 6,  size: "small",  stackOrder: 20 },
  offer_ribbon:{ region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 40 },
  review_stars:{ region: "above_cta",     alignment: "center", safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 20 },
  qr_code:     { region: "bottom_right",  alignment: "right",  safeZonePercent: 5,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 22 },
  phone:       { region: "footer_left",   alignment: "left",   safeZonePercent: 6,  prominence: "medium",   clearSpace: 4,  size: "small",  stackOrder: 15 },
  address:     { region: "footer_center", alignment: "center", safeZonePercent: 6,  prominence: "low",      clearSpace: 4,  size: "small",  stackOrder: 12 },
};

const VERTICAL_ASSETS: StrategyDefinition["assetDefaults"] = {
  headline:         { region: "top_center",    alignment: "center", safeZonePercent: 8,  prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 30 },
  subheadline:      { region: "below_headline",alignment: "center", safeZonePercent: 8,  prominence: "high",     clearSpace: 4,  size: "medium", stackOrder: 25, spacing: 1.5 },
  cta:              { region: "bottom_center", alignment: "center", safeZonePercent: 10, prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  booking_button:   { region: "bottom_center", alignment: "center", safeZonePercent: 10, prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  appointment_button:{ region:"bottom_center", alignment: "center", safeZonePercent: 10, prominence: "critical", clearSpace: 5,  size: "large",  stackOrder: 40 },
  logo:             { region: "top_right",     alignment: "right",  safeZonePercent: 5,  prominence: "medium",   clearSpace: 5,  size: "small",  stackOrder: 20 },
  offer_ribbon:     { region: "top_left",      alignment: "left",   safeZonePercent: 0,  prominence: "high",     clearSpace: 0,  size: "medium", stackOrder: 42 },
  benefits:         { region: "mid_left",      alignment: "left",   safeZonePercent: 5,  prominence: "medium",   clearSpace: 4,  size: "auto",   stackOrder: 15 },
  phone:            { region: "above_cta",     alignment: "center", safeZonePercent: 10, prominence: "medium",   clearSpace: 4,  size: "medium", stackOrder: 28 },
  whatsapp:         { region: "above_cta",     alignment: "center", safeZonePercent: 10, prominence: "medium",   clearSpace: 4,  size: "medium", stackOrder: 28 },
  address:          { region: "footer_center", alignment: "center", safeZonePercent: 8,  prominence: "low",      clearSpace: 3,  size: "small",  stackOrder: 12 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const STRATEGY_REGISTRY: Record<CompositionStrategyId, StrategyDefinition> = {
  luxury:       { id: "luxury",       heroZone: HERO_ZONES.luxury,       whitespaceDefaults: WHITESPACE_DEFAULTS.luxury,       safeZones: SAFE_ZONES.luxury,       assetDefaults: LUXURY_ASSETS,       fallbackPlacement: FALLBACKS.luxury       },
  minimal:      { id: "minimal",      heroZone: HERO_ZONES.minimal,      whitespaceDefaults: WHITESPACE_DEFAULTS.minimal,      safeZones: SAFE_ZONES.minimal,      assetDefaults: MINIMAL_ASSETS,      fallbackPlacement: FALLBACKS.minimal      },
  editorial:    { id: "editorial",    heroZone: HERO_ZONES.editorial,    whitespaceDefaults: WHITESPACE_DEFAULTS.editorial,    safeZones: SAFE_ZONES.editorial,    assetDefaults: EDITORIAL_ASSETS,    fallbackPlacement: FALLBACKS.editorial    },
  product:      { id: "product",      heroZone: HERO_ZONES.product,      whitespaceDefaults: WHITESPACE_DEFAULTS.product,      safeZones: SAFE_ZONES.product,      assetDefaults: PRODUCT_ASSETS,      fallbackPlacement: FALLBACKS.product      },
  healthcare:   { id: "healthcare",   heroZone: HERO_ZONES.healthcare,   whitespaceDefaults: WHITESPACE_DEFAULTS.healthcare,   safeZones: SAFE_ZONES.healthcare,   assetDefaults: HEALTHCARE_ASSETS,   fallbackPlacement: FALLBACKS.healthcare   },
  real_estate:  { id: "real_estate",  heroZone: HERO_ZONES.real_estate,  whitespaceDefaults: WHITESPACE_DEFAULTS.real_estate,  safeZones: SAFE_ZONES.real_estate,  assetDefaults: REAL_ESTATE_ASSETS,  fallbackPlacement: FALLBACKS.real_estate  },
  restaurant:   { id: "restaurant",   heroZone: HERO_ZONES.restaurant,   whitespaceDefaults: WHITESPACE_DEFAULTS.restaurant,   safeZones: SAFE_ZONES.restaurant,   assetDefaults: RESTAURANT_ASSETS,   fallbackPlacement: FALLBACKS.restaurant   },
  fashion:      { id: "fashion",      heroZone: HERO_ZONES.fashion,      whitespaceDefaults: WHITESPACE_DEFAULTS.fashion,      safeZones: SAFE_ZONES.fashion,      assetDefaults: FASHION_ASSETS,      fallbackPlacement: FALLBACKS.fashion      },
  corporate:    { id: "corporate",    heroZone: HERO_ZONES.corporate,    whitespaceDefaults: WHITESPACE_DEFAULTS.corporate,    safeZones: SAFE_ZONES.corporate,    assetDefaults: CORPORATE_ASSETS,    fallbackPlacement: FALLBACKS.corporate    },
  social:       { id: "social",       heroZone: HERO_ZONES.social,       whitespaceDefaults: WHITESPACE_DEFAULTS.social,       safeZones: SAFE_ZONES.social,       assetDefaults: SOCIAL_ASSETS,       fallbackPlacement: FALLBACKS.social       },
  mobile_first: { id: "mobile_first", heroZone: HERO_ZONES.mobile_first, whitespaceDefaults: WHITESPACE_DEFAULTS.mobile_first, safeZones: SAFE_ZONES.mobile_first, assetDefaults: MOBILE_FIRST_ASSETS, fallbackPlacement: FALLBACKS.mobile_first },
  landscape:    { id: "landscape",    heroZone: HERO_ZONES.landscape,    whitespaceDefaults: WHITESPACE_DEFAULTS.landscape,    safeZones: SAFE_ZONES.landscape,    assetDefaults: LANDSCAPE_ASSETS,    fallbackPlacement: FALLBACKS.landscape    },
  square:       { id: "square",       heroZone: HERO_ZONES.square,       whitespaceDefaults: WHITESPACE_DEFAULTS.square,       safeZones: SAFE_ZONES.square,       assetDefaults: SQUARE_ASSETS,       fallbackPlacement: FALLBACKS.square       },
  vertical:     { id: "vertical",     heroZone: HERO_ZONES.vertical,     whitespaceDefaults: WHITESPACE_DEFAULTS.vertical,     safeZones: SAFE_ZONES.vertical,     assetDefaults: VERTICAL_ASSETS,     fallbackPlacement: FALLBACKS.vertical     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Strategy selection — deterministic, no AI
// ─────────────────────────────────────────────────────────────────────────────

export function selectCompositionStrategy(input: CompositionInput): CompositionStrategyId {
  const { strategy, industry, layoutPlan } = input;

  const aspectRatio   = layoutPlan.canvas.aspectRatio.value;
  const orientation   = layoutPlan.canvas.canvasOrientation.value;
  const luxuryLevel   = strategy.visual.luxuryLevel.value;
  const commStyle     = strategy.communication.communicationStyle.value;

  const isVertical    = orientation === "portrait" || ["9:16", "4:5"].includes(aspectRatio);
  const isLandscape   = orientation === "landscape" || ["16:9", "1.91:1", "6:1"].includes(aspectRatio);
  const isSquare      = orientation === "square" || aspectRatio === "1:1";

  // Dedicated professional strategies always win — they have industry-specific
  // asset placements (RERA number, possession date, credentials) that a generic
  // luxury layout would discard.
  switch (industry) {
    case "dental":
    case "healthcare": return "healthcare";
    case "real_estate": return "real_estate";
  }

  // Luxury override — explicit luxury signal wins for non-dedicated industries
  if (luxuryLevel === "ultra_luxury" || luxuryLevel === "high" ||
      commStyle === "luxury" || industry === "jewelry") {
    return "luxury";
  }

  // Remaining industry-driven strategies
  switch (industry) {
    case "restaurant": return isVertical ? "mobile_first" : "restaurant";
    case "fashion":
    case "salon":      return isVertical ? "vertical" : "fashion";
    case "events":     return isVertical ? "mobile_first" : "social";
    case "finance":
    case "education":  return "corporate";
    case "tech":       return commStyle === "minimal" ? "minimal" : "corporate";
    case "automotive": return isLandscape ? "landscape" : "product";
    case "general":    break;
  }

  // Aspect ratio fallback
  if (luxuryLevel === "medium" || commStyle === "premium") return "minimal";
  if (isLandscape) return "landscape";
  if (isSquare)    return "square";
  if (isVertical)  return "vertical";
  return "minimal";
}

export function getStrategyDefinition(id: CompositionStrategyId): StrategyDefinition {
  return STRATEGY_REGISTRY[id];
}
