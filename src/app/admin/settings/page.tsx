"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SensitiveField } from "@/features/admin/components/SensitiveField";
import { Save } from "lucide-react";

const categories = [
  "general",
  "ai",
  "agent",
  "identity",
  "vps",
  "security",
] as const;

type Category = (typeof categories)[number];

// ── AI tab section grouping ─────────────────────────────────
const AI_SECTIONS: { label: string; keys: string[]; showWhen?: string }[] = [
  {
    label: "Text-to-Speech",
    keys: ["ai.tts_provider", "ai.tts_auto"],
  },
  {
    label: "OpenAI TTS",
    keys: ["ai.tts_openai_model", "ai.tts_openai_voice", "ai.tts_openai_speed"],
    showWhen: "openai",
  },
  {
    label: "ElevenLabs TTS",
    keys: [
      "ai.elevenlabs_api_key",
      "ai.elevenlabs_model",
      "ai.elevenlabs_voice_id",
      "ai.elevenlabs_stability",
      "ai.elevenlabs_similarity",
    ],
    showWhen: "elevenlabs",
  },
];

const ALL_TTS_KEYS = new Set(AI_SECTIONS.flatMap((s) => s.keys));

type SettingRow = {
  _id: string;
  key: string;
  value: string;
  category: Category;
  description?: string;
  sensitive: boolean;
  inputType?: string;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Category>("general");
  const settings = useQuery(api.systemSettings.list, {
    category: activeTab,
  });
  const upsertSetting = useMutation(api.systemSettings.upsert);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async (setting: SettingRow) => {
    const newValue = edits[setting.key];
    if (newValue === undefined || newValue === setting.value) return;
    setSaving(true);
    try {
      await upsertSetting({
        key: setting.key,
        value: newValue,
        category: setting.category,
        description: setting.description,
        sensitive: setting.sensitive,
        inputType: setting.inputType,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[setting.key];
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  // For select inputs, save immediately on change
  const handleSelectChange = async (setting: SettingRow, value: string) => {
    setEdits((prev) => ({ ...prev, [setting.key]: value }));
    setSaving(true);
    try {
      await upsertSetting({
        key: setting.key,
        value,
        category: setting.category,
        description: setting.description,
        sensitive: setting.sensitive,
        inputType: setting.inputType,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[setting.key];
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  // Resolve TTS provider from edits or DB
  const ttsProvider =
    activeTab === "ai" && settings
      ? edits["ai.tts_provider"] ??
        settings.find((s) => s.key === "ai.tts_provider")?.value ??
        "disabled"
      : "disabled";

  // Build settings lookup for AI tab
  const settingsMap = new Map(
    (settings ?? []).map((s) => [s.key, s]),
  );

  const renderField = (s: SettingRow) => {
    const isSelect = s.inputType?.startsWith("select:");

    if (s.sensitive && !(s.key in edits)) {
      return (
        <div className="flex items-center gap-2">
          <SensitiveField
            maskedValue={s.value}
            onReveal={async () => s.value}
          />
          <button
            onClick={() => setEdits((prev) => ({ ...prev, [s.key]: "" }))}
            className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            Edit
          </button>
        </div>
      );
    }

    if (isSelect) {
      const options = s.inputType!.slice(7).split(",");
      return (
        <div className="flex items-center gap-2">
          <select
            value={edits[s.key] ?? s.value}
            onChange={(e) => handleSelectChange(s, e.target.value)}
            className="flex-1 rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <input
          type={
            s.inputType === "password"
              ? "password"
              : s.inputType === "number"
                ? "number"
                : "text"
          }
          value={edits[s.key] ?? s.value}
          onChange={(e) =>
            setEdits((prev) => ({ ...prev, [s.key]: e.target.value }))
          }
          className="flex-1 rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        {s.key in edits && (
          <button
            onClick={() => handleSave(s)}
            disabled={saving}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 font-mono text-[10px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={12} />
            Save
          </button>
        )}
      </div>
    );
  };

  const renderSettingRow = (s: SettingRow) => (
    <div key={s._id} className="flex items-start gap-4">
      <div className="flex-1 space-y-1">
        <label className="font-mono text-xs font-medium text-foreground">
          {s.key}
        </label>
        {s.description && (
          <p className="font-mono text-[10px] text-muted-foreground">
            {s.description}
          </p>
        )}
        {renderField(s)}
      </div>
    </div>
  );

  // Render AI tab with grouped TTS sections
  const renderAiTab = () => {
    if (!settings) return null;

    // Settings not in any TTS section
    const ungrouped = settings.filter((s) => !ALL_TTS_KEYS.has(s.key));

    return (
      <>
        {ungrouped.map((s) => renderSettingRow(s as SettingRow))}

        {AI_SECTIONS.filter((section) => {
          if (!section.showWhen) return true;
          return ttsProvider === section.showWhen;
        }).map((section) => {
          const sectionSettings = section.keys
            .map((key) => settingsMap.get(key))
            .filter(Boolean);
          if (sectionSettings.length === 0) return null;
          return (
            <div key={section.label} className="space-y-3">
              <h3 className="mt-2 border-t border-border/40 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {section.label}
              </h3>
              {sectionSettings.map((s) => renderSettingRow(s as SettingRow))}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="console-title text-2xl text-foreground">
        System Settings
      </h1>

      <div className="flex gap-1 border-b border-border">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveTab(cat);
              setEdits({});
            }}
            className={`rounded-t-md px-3 py-1.5 font-mono text-xs capitalize transition-colors ${
              activeTab === cat
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="glass-panel space-y-4 rounded-lg p-4">
        {settings === undefined ? (
          <p className="font-mono text-xs text-muted-foreground">Loading...</p>
        ) : settings.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            No settings in this category.
          </p>
        ) : activeTab === "ai" ? (
          renderAiTab()
        ) : (
          settings.map((s) => renderSettingRow(s as SettingRow))
        )}
      </div>
    </div>
  );
}
