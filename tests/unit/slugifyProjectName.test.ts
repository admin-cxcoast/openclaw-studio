import { describe, expect, it } from "vitest";

import { slugifyProjectName } from "@/lib/ids/slugify";

describe("slugifyProjectName", () => {
  it("slugifies project names", () => {
    expect(slugifyProjectName("My Project")).toBe("my-project");
  });

  it("throws on empty slugs", () => {
    expect(() => slugifyProjectName("!!!")).toThrow(
      "Workspace name produced an empty folder name."
    );
  });
});
