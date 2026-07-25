"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_LOGO_STYLES, BRAND_PALETTE_MOODS } from "@/lib/validations/brand-kit";
import { AssetUploadTile, type AssetUploadValue } from "@/components/creative/asset-upload-tile";

// "Numeric-ish" — digits plus the punctuation real phone numbers use
// (+91 98765 43210, (022) 1234-5678). Empty is always valid: both fields
// are optional.
function isPhoneLike(value: string): boolean {
  if (!value.trim()) return true;
  return /^[+\d][\d\s\-().]*$/.test(value.trim());
}

interface BrandKit {
  logoAssetId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addressLine: string | null;
  websiteOrSocial: string | null;
  guidelinesText: string | null;
}

export function BrandKitClient() {
  const [brandKit, setBrandKit] = React.useState<BrandKit | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [businessName, setBusinessName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [logoStyle, setLogoStyle] = React.useState<(typeof BRAND_LOGO_STYLES)[number]>("MODERN");
  const [paletteMood, setPaletteMood] = React.useState<(typeof BRAND_PALETTE_MOODS)[number]>("VIBRANT");
  const [toneDescription, setToneDescription] = React.useState("");
  const [fontFamily, setFontFamily] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [contactWhatsapp, setContactWhatsapp] = React.useState("");
  const [addressLine, setAddressLine] = React.useState("");
  const [websiteOrSocial, setWebsiteOrSocial] = React.useState("");
  const [logoUploadValue, setLogoUploadValue] = React.useState<AssetUploadValue | null>(null);

  const [generatingLogo, setGeneratingLogo] = React.useState(false);
  const [generatingPalette, setGeneratingPalette] = React.useState(false);
  const [generatingGuidelines, setGeneratingGuidelines] = React.useState(false);

  const load = React.useCallback(() => {
    fetch("/api/brand-kit")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setBrandKit(json.data.brandKit);
          setLogoUrl(json.data.logoUrl);
          setFontFamily(json.data.brandKit?.fontFamily ?? "");
          setContactPhone(json.data.brandKit?.contactPhone ?? "");
          setContactWhatsapp(json.data.brandKit?.contactWhatsapp ?? "");
          setAddressLine(json.data.brandKit?.addressLine ?? "");
          setWebsiteOrSocial(json.data.brandKit?.websiteOrSocial ?? "");
        }
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function generate(
    endpoint: string,
    body: Record<string, unknown>,
    setLoading: (v: boolean) => void,
    successMessage: string
  ) {
    if (!businessName.trim()) {
      toast.error("Enter your business name first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Generation failed.");
        return;
      }
      toast.success(successMessage);
      load();
    } finally {
      setLoading(false);
    }
  }

  async function patchBrandKitField(
    key: string,
    value: string,
    previous: string | null | undefined,
    validate?: (v: string) => boolean
  ) {
    if (value === (previous ?? "")) return;
    if (validate && !validate(value)) {
      toast.error("That doesn't look like a valid phone number.");
      return;
    }
    const res = await fetch("/api/brand-kit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save. Please try again.");
      return;
    }
    toast.success("Saved.");
    load();
  }

  async function saveLogoAsset(value: AssetUploadValue) {
    const res = await fetch("/api/brand-kit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoAssetId: value.assetId }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save the logo. Please try again.");
      return;
    }
    toast.success("Logo uploaded.");
    // Reset the tile to its empty "Upload" state — the existing preview
    // circle above (driven by logoUrl, refreshed by load()) is the single
    // source of truth for "what the current logo is," so this avoids
    // showing the logo twice.
    setLogoUploadValue(null);
    load();
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Label className="text-label-sm text-dash-ink/65">Business name</Label>
        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Sharma Sweets" className="mt-1 h-11 max-w-sm" />
        <Label className="mt-3 block text-label-sm text-dash-ink/65">Industry (optional)</Label>
        <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Restaurant, retail, healthcare…" className="mt-1 h-11 max-w-sm" />
        <p className="mt-2 text-body-sm text-dash-ink/55">Used by every &quot;Generate with AI&quot; action below.</p>
      </div>

      <section className="flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Logo</h2>
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-glass-subtle">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Brand logo" className="size-full object-contain" />
            ) : (
              <ImageIcon className="size-6 text-dash-ink/20" />
            )}
          </div>
          <div className="flex flex-1 flex-wrap items-end gap-3">
            <div>
              <Label className="text-label-sm text-dash-ink/65">Style</Label>
              <Select value={logoStyle} onValueChange={(v) => setLogoStyle(v as typeof logoStyle)}>
                <SelectTrigger className="mt-1 h-10 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_LOGO_STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="primary"
              size="default"
              disabled={generatingLogo}
              onClick={() =>
                generate(
                  "/api/brand-kit/generate/logo",
                  { businessName: businessName.trim(), industry: industry.trim() || undefined, style: logoStyle },
                  setGeneratingLogo,
                  "Logo generated."
                )
              }
            >
              {generatingLogo ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate logo
            </Button>
            <span className="text-body-sm text-dash-ink/45">or</span>
            <AssetUploadTile
              label="Upload your logo"
              helperText="PNG, JPG, WebP, or GIF — used as-is on posters"
              value={logoUploadValue}
              onChange={(value) => {
                setLogoUploadValue(value);
                if (value) saveLogoAsset(value);
              }}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Colors</h2>
        <div className="flex items-center gap-3">
          <span className="size-8 rounded-full border border-edge-card" style={{ backgroundColor: brandKit?.primaryColor ?? "#e5e7eb" }} />
          <span className="text-body-sm text-dash-ink/65">{brandKit?.primaryColor ?? "Not set"}</span>
          <span className="size-8 rounded-full border border-edge-card" style={{ backgroundColor: brandKit?.secondaryColor ?? "#e5e7eb" }} />
          <span className="text-body-sm text-dash-ink/65">{brandKit?.secondaryColor ?? "Not set"}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-label-sm text-dash-ink/65">Mood</Label>
            <Select value={paletteMood} onValueChange={(v) => setPaletteMood(v as typeof paletteMood)}>
              <SelectTrigger className="mt-1 h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_PALETTE_MOODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="primary"
            size="default"
            disabled={generatingPalette}
            onClick={() =>
              generate(
                "/api/brand-kit/generate/palette",
                { businessName: businessName.trim(), mood: paletteMood },
                setGeneratingPalette,
                "Palette generated."
              )
            }
          >
            {generatingPalette ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate palette
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Typography</h2>
        <Label className="text-label-sm text-dash-ink/65">Font family</Label>
        <Input
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          onBlur={() => patchBrandKitField("fontFamily", fontFamily, brandKit?.fontFamily)}
          placeholder="Poppins"
          className="h-10 max-w-xs"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Contact details</h2>
        <p className="text-body-sm text-dash-ink/55">Auto-filled into generated posters. Leave any field blank to omit it.</p>
        <div className="flex flex-wrap gap-4">
          <div>
            <Label className="text-label-sm text-dash-ink/65">Phone</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              onBlur={() => patchBrandKitField("contactPhone", contactPhone, brandKit?.contactPhone, isPhoneLike)}
              placeholder="+91 98765 43210"
              className="mt-1 h-10 max-w-xs"
            />
          </div>
          <div>
            <Label className="text-label-sm text-dash-ink/65">WhatsApp</Label>
            <Input
              value={contactWhatsapp}
              onChange={(e) => setContactWhatsapp(e.target.value)}
              onBlur={() => patchBrandKitField("contactWhatsapp", contactWhatsapp, brandKit?.contactWhatsapp, isPhoneLike)}
              placeholder="+91 98765 43210"
              className="mt-1 h-10 max-w-xs"
            />
          </div>
          <div className="w-full">
            <Label className="text-label-sm text-dash-ink/65">Address</Label>
            <Input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              onBlur={() => patchBrandKitField("addressLine", addressLine, brandKit?.addressLine)}
              placeholder="Shop 12, MG Road, Bengaluru"
              className="mt-1 h-10 max-w-lg"
            />
          </div>
          <div>
            <Label className="text-label-sm text-dash-ink/65">Website / social</Label>
            <Input
              value={websiteOrSocial}
              onChange={(e) => setWebsiteOrSocial(e.target.value)}
              onBlur={() => patchBrandKitField("websiteOrSocial", websiteOrSocial, brandKit?.websiteOrSocial)}
              placeholder="instagram.com/sharmasweets"
              className="mt-1 h-10 max-w-xs"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl">
        <h2 className="text-label-lg text-dash-ink">Brand Guidelines</h2>
        <Textarea value={brandKit?.guidelinesText ?? ""} readOnly rows={6} placeholder="Generate guidelines to see them here." />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Label className="text-label-sm text-dash-ink/65">Tone of voice (optional)</Label>
            <Input value={toneDescription} onChange={(e) => setToneDescription(e.target.value)} placeholder="Warm, family-friendly, a little playful" className="mt-1 h-10" />
          </div>
          <Button
            type="button"
            variant="primary"
            size="default"
            disabled={generatingGuidelines}
            onClick={() =>
              generate(
                "/api/brand-kit/generate/guidelines",
                { businessName: businessName.trim(), industry: industry.trim() || undefined, toneDescription: toneDescription.trim() || undefined },
                setGeneratingGuidelines,
                "Guidelines generated."
              )
            }
          >
            {generatingGuidelines ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate guidelines
          </Button>
        </div>
      </section>
    </div>
  );
}
