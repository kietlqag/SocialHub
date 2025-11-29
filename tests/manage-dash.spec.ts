import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

// Basic smoke test to replicate the user-reported issue quickly in CI.
test("Create from AI button opens the generator dialog", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`Console error: ${msg.text()}`);
    }
  });

  await page.goto(`${BASE_URL}/managedash`);

  const createButton = page.getByRole("button", { name: /create from ai/i });
  await expect(createButton).toBeVisible();
  await createButton.click();

  await expect(
    page.getByRole("heading", { name: "Describe Your Dashboard" })
  ).toBeVisible({ timeout: 5000 });
});
