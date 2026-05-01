/** Preset spec groups for phones / electronics — stored as `Section — Field` in DB. */

export interface ProductSpecField {
  label: string;
}

export interface ProductSpecSection {
  id: string;
  title: string;
  fields: ProductSpecField[];
}

export const PRODUCT_SPEC_SECTIONS: ProductSpecSection[] = [
  {
    id: "launch",
    title: "Launch",
    fields: [{ label: "Announced" }],
  },
  {
    id: "platform",
    title: "Platform",
    fields: [
      { label: "Operating system" },
      { label: "OS version" },
      { label: "User interface" },
      { label: "Chipset" },
      { label: "CPU" },
      { label: "CPU cores" },
      { label: "Architecture" },
      { label: "Fabrication" },
      { label: "GPU" },
    ],
  },
  {
    id: "display",
    title: "Display",
    fields: [
      { label: "Type" },
      { label: "Size" },
      { label: "Resolution" },
      { label: "Pixel density" },
      { label: "Screen to body ratio" },
      { label: "Bezel-less display" },
      { label: "Touch screen" },
      { label: "Brightness" },
      { label: "HDR" },
      { label: "Refresh rate" },
      { label: "Protection" },
      { label: "Notch" },
    ],
  },
  {
    id: "main-camera",
    title: "Main Camera",
    fields: [
      { label: "Camera setup" },
      { label: "Resolution" },
      { label: "Autofocus" },
      { label: "OIS" },
      { label: "Flash" },
      { label: "Image resolution" },
      { label: "Settings" },
      { label: "Zoom" },
      { label: "Shooting mode" },
      { label: "Aperture" },
      { label: "Video recording" },
      { label: "Video FPS" },
      { label: "Features" },
      { label: "Video" },
    ],
  },
  {
    id: "selfie-camera",
    title: "Selfie camera",
    fields: [
      { label: "Camera setup" },
      { label: "Resolution" },
      { label: "Video recording" },
      { label: "Video FPS" },
      { label: "Aperture" },
      { label: "Features" },
      { label: "Video" },
    ],
  },
  {
    id: "design",
    title: "Design",
    fields: [
      { label: "Height" },
      { label: "Width" },
      { label: "Thickness" },
      { label: "Weight" },
      { label: "Color" },
    ],
  },
  {
    id: "comms",
    title: "Comms",
    fields: [
      { label: "Network" },
      { label: "SIM slot" },
      { label: "SIM size" },
      { label: "EDGE" },
      { label: "GPRS" },
      { label: "VoLTE" },
      { label: "Speed" },
      { label: "Wi-Fi" },
      { label: "WLAN" },
      { label: "Bluetooth" },
      { label: "Positioning" },
      { label: "NFC" },
      { label: "Radio" },
      { label: "USB" },
    ],
  },
  {
    id: "sensors",
    title: "Sensors",
    fields: [
      { label: "Light sensor" },
      { label: "Fingerprint sensor" },
      { label: "Finger sensor position" },
      { label: "Finger sensor type" },
      { label: "Face unlock" },
    ],
  },
  {
    id: "multimedia",
    title: "Multimedia",
    fields: [
      { label: "Loudspeaker" },
      { label: "Audio jack" },
      { label: "Video" },
    ],
  },
  {
    id: "memory",
    title: "Memory",
    fields: [
      { label: "Card slot" },
      { label: "Internal" },
      { label: "USB OTG" },
      { label: "RAM" },
      { label: "ROM" },
    ],
  },
  {
    id: "battery",
    title: "Battery",
    fields: [
      { label: "Battery type" },
      { label: "Capacity" },
      { label: "Reverse charging" },
      { label: "Placement" },
      { label: "Type" },
      { label: "Charging" },
    ],
  },
  {
    id: "features",
    title: "Features",
    fields: [{ label: "Others" }],
  },
];

const SEP = " — ";

export function productSpecRowName(sectionTitle: string, fieldLabel: string): string {
  return `${sectionTitle}${SEP}${fieldLabel}`;
}

export const ALL_PRODUCT_SPEC_ROW_NAMES: ReadonlySet<string> = new Set(
  PRODUCT_SPEC_SECTIONS.flatMap((s) =>
    s.fields.map((f) => productSpecRowName(s.title, f.label))
  )
);

export function parseProductSpecs(specs: { name: string; value: string }[]): {
  templateValues: Record<string, string>;
  customRows: { name: string; value: string }[];
} {
  const templateValues: Record<string, string> = {};
  const customRows: { name: string; value: string }[] = [];
  for (const row of specs) {
    if (ALL_PRODUCT_SPEC_ROW_NAMES.has(row.name)) {
      templateValues[row.name] = row.value;
      continue;
    }
    // Keep all non-template rows (including empty placeholders for "Add custom row").
    customRows.push({ name: row.name, value: row.value });
  }
  return { templateValues, customRows };
}

export function buildProductSpecsPayload(
  templateValues: Record<string, string>,
  customRows: { name: string; value: string }[]
): { name: string; value: string }[] {
  const rows: { name: string; value: string }[] = [];
  for (const section of PRODUCT_SPEC_SECTIONS) {
    for (const field of section.fields) {
      const name = productSpecRowName(section.title, field.label);
      const v = (templateValues[name] ?? "").trim();
      if (v) rows.push({ name, value: v });
    }
  }
  for (const row of customRows) {
    // Preserve blank rows in form state so new custom lines appear in the UI.
    // API layer still drops rows where name or value is empty.
    rows.push({ name: row.name, value: row.value });
  }
  return rows;
}
