import { expect, test } from "@playwright/test";

test("loads canvas empty state", async ({ page }) => {
  await page.route("**/api/projects", async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: 2, activeProjectId: null, projects: [] }),
    });
  });
  await page.goto("/");
  await expect(page.getByText("Create a workspace to begin.")).toBeVisible();
});
