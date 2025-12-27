import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

const dashboards = [
  {
    _id: "dash-1",
    name: "Retail Overview",
    ownerName: "Alice",
    description: "Commerce insights",
    type: "commerce",
    updatedAt: "2025-01-02T10:00:00.000Z",
  },
  {
    _id: "dash-2",
    name: "Clinic Metrics",
    ownerName: "Bob",
    description: "Healthcare KPIs",
    type: "healthcare",
    updatedAt: "2025-01-01T10:00:00.000Z",
  },
];

test("Explore dashboards shows public list", async ({ page }) => {
  await page.route("**/api/dashboards/public", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboards),
    });
  });

  await page.goto(`${BASE_URL}/explore`);

  await expect(page.getByText("Retail Overview")).toBeVisible();
  await expect(page.getByText("Clinic Metrics")).toBeVisible();
  await expect(page.getByText("2 public dashboards")).toBeVisible();
});

test("Explore dashboards search filters results", async ({ page }) => {
  await page.route("**/api/dashboards/public", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dashboards),
    });
  });

  await page.goto(`${BASE_URL}/explore`);

  await page.getByPlaceholder("Search by name or owner").fill("Clinic");
  await expect(page.getByText("Clinic Metrics")).toBeVisible();
  await expect(page.getByText("Retail Overview")).toHaveCount(0);
  await expect(page.getByText("1 public dashboards")).toBeVisible();
});
