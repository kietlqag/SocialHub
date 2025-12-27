import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

test("Signup with invalid data shows invalid email", async ({ page }) => {
  await page.goto(`${BASE_URL}/register`);

  await page.locator("#fullName").fill("Tran Phuong");
  await page.locator("#company").fill("Vietnam");
  await page.locator("#email").fill("boyholo2003");
  await page.locator("#password").fill("BOYHOLO2003");
  await page.locator("#confirmPassword").fill("BOYHO20");

  await page.locator("#terms").check();
  await page.getByRole("button", { name: /create account/i }).click();

  const emailInput = page.locator("#email");
  const emailValid = await emailInput.evaluate(
    (el) => (el as HTMLInputElement).checkValidity()
  );
  expect(emailValid).toBe(false);
});

test("Signup with valid data shows verification step", async ({ page }) => {
  await page.route("**/auth/register", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requiresVerification: true,
        user: { email: "tran.phuong@example.com" },
      }),
    });
  });

  await page.goto(`${BASE_URL}/register`);

  await page.locator("#fullName").fill("Tran Phuong");
  await page.locator("#company").fill("Vietnam");
  await page.locator("#email").fill("tran.phuong@example.com");
  await page.locator("#password").fill("BOYHOLO2003");
  await page.locator("#confirmPassword").fill("BOYHOLO2003");

  await page.locator("#terms").check();
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByText("Verify your email")).toBeVisible();
  await expect(page.getByText("tran.phuong@example.com")).toBeVisible();
});

test("Signup with existing email shows error", async ({ page }) => {
  await page.route("**/auth/register", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Email already exists." }),
    });
  });

  await page.goto(`${BASE_URL}/register`);

  await page.locator("#fullName").fill("Tran Phuong");
  await page.locator("#company").fill("Vietnam");
  await page.locator("#email").fill("tran.phuong@example.com");
  await page.locator("#password").fill("BOYHOLO2003");
  await page.locator("#confirmPassword").fill("BOYHOLO2003");

  await page.locator("#terms").check();
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByText("Email already exists.")).toBeVisible();
});

test("Signup success redirects to login", async ({ page }) => {
  await page.route("**/auth/register", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requiresVerification: false,
        message: "Account created successfully!",
        user: { email: "tran.phuong@example.com" },
      }),
    });
  });

  await page.goto(`${BASE_URL}/register`);

  await page.locator("#fullName").fill("Tran Phuong");
  await page.locator("#company").fill("Vietnam");
  await page.locator("#email").fill("tran.phuong@example.com");
  await page.locator("#password").fill("BOYHOLO2003");
  await page.locator("#confirmPassword").fill("BOYHOLO2003");

  await page.locator("#terms").check();
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /welcome!/i })).toBeVisible();
});
