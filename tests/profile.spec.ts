import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SESSION_KEY = "socialhub_auth_session";
const API_HOST_RE = /:\/\/(localhost|127\.0\.0\.1):4000\//;
const isApiCall = (url: string, resourceType: string) =>
  API_HOST_RE.test(url) || resourceType !== "document";

const seedSession = () => {
  const payload = {
    user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
    token: "test-token",
  };
  return `localStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)})); sessionStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)}));`;
};

test("Profile page shows user info", async ({ page }) => {
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
  await page.route("**/profile", async (route) => {
    if (!isApiCall(route.request().url(), route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          fullName: "Tran Phuong",
          email: "tran.phuong@example.com",
          company: "Vietnam",
          job_title: "Engineer",
        },
      }),
    });
  });

  await page.goto(`${BASE_URL}/profile`);

  await expect(page.getByText("Profile", { exact: true })).toBeVisible();
  await expect(page.getByText("Tran Phuong")).toBeVisible();
  await expect(page.getByText("tran.phuong@example.com")).toBeVisible();
});

test("Profile update saves changes", async ({ page }) => {
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
  await page.route("**/profile", async (route) => {
    if (!isApiCall(route.request().url(), route.request().resourceType())) {
      await route.continue();
      return;
    }
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          fullName: "Tran Phuong",
          email: "tran.phuong@example.com",
          company: "Vietnam",
          job_title: "Engineer",
        },
      }),
    });
  });

  await page.goto(`${BASE_URL}/profile`);

  await page.getByRole("button", { name: /edit profile/i }).click();
  const fullNameInput = page.getByText("Full name").locator("..").locator("input");
  await fullNameInput.fill("Tran Phuong Updated");
  await page.getByRole("button", { name: /save changes/i }).click();

  await expect(page.getByText("Profile updated")).toBeVisible();
});
