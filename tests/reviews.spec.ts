import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

test("Submit review from contact page", async ({ page }) => {
  await page.route("**/api/reviews", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        review: {
          id: "review-1",
          rating: 5,
          message: "Great experience with SocialHub.",
          name: "Guest",
        },
      }),
    });
  });

  await page.goto(`${BASE_URL}/contact`);

  await page.getByText("Share your review").scrollIntoViewIfNeeded();
  await page.getByPlaceholder("Share your experience with SocialHub.").fill("Great experience with SocialHub.");
  await page.getByRole("button", { name: /submit review/i }).click();

  await expect(page.getByText("Thank you! Your review was saved.")).toBeVisible();
});
