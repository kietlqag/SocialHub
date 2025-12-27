import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SESSION_KEY = "socialhub_auth_session";

const seedSession = (role: "user" | "admin" = "user") => {
  const payload = {
    user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role },
    token: "test-token",
  };
  return `localStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)})); sessionStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)}));`;
};

test("Logout clears session and shows sign in", async ({ page }) => {
  await page.addInitScript(seedSession());
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
      }),
    });
  });

  await page.goto(`${BASE_URL}/home`);

  await page.getByRole("button", { name: /tran phuong/i }).click();
  await page.getByRole("button", { name: /sign out/i }).click();

  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
