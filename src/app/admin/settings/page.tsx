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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Category>("general");
  const settings = useQuery(api.systemSettings.list, {
    category: activeTab,
  });
  const upsertSetting = useMutation(api.systemSettings.upsert);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async (
    setting: {
      _id: unknown;
      key: string;
      value: string;
      category: Category;
      description?: string;
      sensitive: boolean;
      inputType?: string;
    },
  ) => {
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
        ) : (
          settings.map((s) => (
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
                {s.sensitive && !(s.key in edits) ? (
                  <div className="flex items-center gap-2">
                    <SensitiveField
                      maskedValue={s.value}
                      onReveal={async () => {
                        // In a real app this would call the reveal query
                        return s.value;
                      }}
                    />
                    <button
                      onClick={() => setEdits((prev) => ({ ...prev, [s.key]: "" }))}
                      className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
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
                        setEdits((prev) => ({
                          ...prev,
                          [s.key]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                    {s.key in edits && (
                      <button
                        onClick={() => handleSave(s as any)}
                        disabled={saving}
                        className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 font-mono text-[10px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Save size={12} />
                        Save
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
