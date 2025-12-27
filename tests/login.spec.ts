import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const API_HOST_RE = /:\/\/(localhost|127\.0\.0\.1):4000\//;
const isApiCall = (url: string, resourceType: string) =>
  API_HOST_RE.test(url) || resourceType !== "document";

test("Login with valid credentials redirects to home", async ({ page }) => {
  await page.route("**/login", async (route) => {
    if (!isApiCall(route.request().url(), route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", email: "tran.phuong@example.com" },
        token: "test-token",
      }),
    });
  });

  await page.goto(`${BASE_URL}/login`);

  await page.locator("#email").fill("tran.phuong@example.com");
  await page.locator("#password").fill("BOYHOLO2003");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("tran.phuong@example.com")).toBeVisible();
});

test("Login with invalid credentials shows error toast", async ({ page }) => {
  await page.route("**/login", async (route) => {
    if (!isApiCall(route.request().url(), route.request().resourceType())) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Invalid email or password." }),
    });
  });

  await page.goto(`${BASE_URL}/login`);

  await page.locator("#email").fill("tran.phuong@example.com");
  await page.locator("#password").fill("wrongpass");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("Forgot password without email shows validation toast", async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);

  await page.getByRole("button", { name: /forgot password/i }).click();
  await expect(page.getByText("Please enter your email.")).toBeVisible();
});

test("Forgot password with email shows reset panel", async ({ page }) => {
  await page.route("**/auth/forgot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Reset code sent." }),
    });
  });

  await page.goto(`${BASE_URL}/login`);

  await page.locator("#email").fill("tran.phuong@example.com");
  await page.getByRole("button", { name: /forgot password/i }).click();

  await expect(page.getByPlaceholder("Enter code you received")).toBeVisible();
});

test("Reset password success returns to login form", async ({ page }) => {
  await page.route("**/auth/forgot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Reset code sent." }),
    });
  });
  await page.route("**/auth/reset", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Password reset successfully. Please sign in." }),
    });
  });

  await page.goto(`${BASE_URL}/login`);

  await page.locator("#email").fill("tran.phuong@example.com");
  await page.getByRole("button", { name: /forgot password/i }).click();
  await expect(page.getByPlaceholder("Enter code you received")).toBeVisible();

  await page.locator("#resetCode").fill("123456");
  await page.locator("#newPassword").fill("NEWPASSWORD123");
  await page.locator("#confirmNewPassword").fill("NEWPASSWORD123");
  await page.getByRole("button", { name: /update password/i }).click();

  await expect(page.getByText("Password reset successfully. Please sign in.")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
