import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SESSION_KEY = "socialhub_auth_session";
const DASHBOARD_SESSION_KEY = "socialhub:dashboards_session";
const API_URL = process.env.API_URL || "http://127.0.0.1:4000";
const REAL_API_ENABLED = process.env.E2E_REAL_API === "1";

const mockDashboards = [
  {
    id: "dash-1",
    name: "Sales Overview",
    description: "Monthly revenue",
    userId: "user-1",
    tables: [],
    widgets: [],
    insights: [],
    updatedAt: "2025-01-02T10:00:00.000Z",
  },
  {
    id: "dash-2",
    name: "Clinic Metrics",
    description: "Healthcare KPIs",
    userId: "user-1",
    tables: [],
    widgets: [],
    insights: [],
    updatedAt: "2025-01-01T10:00:00.000Z",
  },
];

const seedSession = () => {
  const payload = {
    user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
    token: "test-token",
  };
  return `localStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)})); sessionStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)}));`;
};

const seedSessions = (dashboardSessionId: string) => {
  const authPayload = {
    user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
    token: "test-token",
  };
  return [
    `localStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(authPayload)}));`,
    `sessionStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(authPayload)}));`,
    `localStorage.setItem("${DASHBOARD_SESSION_KEY}", ${JSON.stringify(dashboardSessionId)});`,
  ].join(" ");
};

const createDashboardViaApi = async (request: import("@playwright/test").APIRequestContext, params: {
  sessionId: string;
  userId: string;
  name: string;
}) => {
  const res = await request.post(`${API_URL}/api/dashboards`, {
    data: {
      name: params.name,
      description: "E2E dashboard",
      sessionId: params.sessionId,
      userId: params.userId,
      fields: [{ key: "name", label: "Name", type: "string" }],
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body?.dashboard?.id || body?.dashboard?._id;
};

// Basic smoke test to replicate the user-reported issue quickly in CI.
test("Create from AI button opens the generator dialog", async ({ page }) => {
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
  await page.route("**/api/dashboards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: [] }),
    });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`Console error: ${msg.text()}`);
    }
  });

  await page.goto(`${BASE_URL}/managedash`);

  const createButton = page.getByRole("button", { name: /create new dashboard/i });
  await expect(createButton).toBeVisible();
  await createButton.click();

  await expect(
    page.getByRole("heading", { name: /design your next dashboard/i })
  ).toBeVisible({ timeout: 5000 });
});

test("ManageDash search filters dashboards in All dashboards", async ({ page }) => {
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
  await page.route("**/api/dashboards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: mockDashboards }),
    });
  });

  await page.goto(`${BASE_URL}/managedash`);

  const allDashboardsSection = page.locator("section.dashboard-section", {
    has: page.getByRole("heading", { name: "All dashboards" }),
  });
  await expect(allDashboardsSection.getByText("Sales Overview")).toBeVisible();
  await expect(allDashboardsSection.getByText("Clinic Metrics")).toBeVisible();

  await page.getByPlaceholder("Search dashboards").fill("Clinic");
  await expect(allDashboardsSection.getByText("Clinic Metrics")).toBeVisible();
  await expect(allDashboardsSection.getByText("Sales Overview")).toHaveCount(0);
});

test("ManageDash can rename dashboard", async ({ page }) => {
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
  await page.route("**/api/dashboards**", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dashboard: { ...mockDashboards[0], name: "Sales Overview Updated" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: [mockDashboards[0]] }),
    });
  });

  await page.goto(`${BASE_URL}/managedash`);

  const allDashboardsSection = page.locator("section.dashboard-section", {
    has: page.getByRole("heading", { name: "All dashboards" }),
  });
  const card = allDashboardsSection.locator(".dashboard-card", { hasText: "Sales Overview" });
  await card.getByRole("button", { name: "Rename dashboard" }).click({ force: true });
  const input = page.locator("input.dashboard-card__title-input").first();
  await input.fill("Sales Overview Updated");
  await input.press("Enter");

  await expect(card.getByText("Sales Overview Updated")).toBeVisible();
});

test("ManageDash can toggle favorite", async ({ page }) => {
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
  await page.route("**/api/dashboards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: [mockDashboards[0]] }),
    });
  });

  await page.goto(`${BASE_URL}/managedash`);

  const allDashboardsSection = page.locator("section.dashboard-section", {
    has: page.getByRole("heading", { name: "All dashboards" }),
  });
  const addFavorite = allDashboardsSection.getByRole("button", { name: "Add to favorites" }).first();
  const removeFavorite = allDashboardsSection.getByRole("button", { name: "Remove from favorites" }).first();
  if (await addFavorite.count()) {
    await addFavorite.click();
    await expect(removeFavorite).toBeVisible();
  } else {
    await removeFavorite.click();
    await expect(addFavorite).toBeVisible();
  }
});

test("ManageDash share dialog opens", async ({ page }) => {
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
  await page.route("**/api/dashboards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: [mockDashboards[0]] }),
    });
  });
  await page.route("**/api/dashboards/dash-1/access**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ownerId: "user-1",
        accessMode: "restricted",
        rolePermissions: [
          { role: "Admin", permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true } },
        ],
        userAssignments: [],
      }),
    });
  });

  await page.goto(`${BASE_URL}/managedash`);
  const allDashboardsSection = page.locator("section.dashboard-section", {
    has: page.getByRole("heading", { name: "All dashboards" }),
  });
  await allDashboardsSection.getByRole("button", { name: "Share" }).first().click();
  await expect(page.getByText("Share dashboard")).toBeVisible();
});

test("ManageDash can use template without navigation", async ({ page }) => {
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
  await page.route("**/api/dashboards**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: [mockDashboards[0]] }),
    });
  });
  await page.route("**/api/dashboards/dash-1/use-template", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dashboard: {
          id: "dash-template-1",
          name: "Template Copy",
          userId: "user-1",
          tables: [],
          widgets: [],
          insights: [],
        },
      }),
    });
  });

  await page.goto(`${BASE_URL}/managedash`);
  const allDashboardsSection = page.locator("section.dashboard-section", {
    has: page.getByRole("heading", { name: "All dashboards" }),
  });
  await allDashboardsSection.getByRole("button", { name: "Use template" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create" }).click();

  await expect(allDashboardsSection.getByText("Template Copy")).toBeVisible();
  await expect(page.getByText("Dashboard created from template.")).toBeVisible();
});

test.describe("Real API", () => {
  test.skip(!REAL_API_ENABLED, "E2E real API disabled");

  test("ManageDash lists dashboards from real API", async ({ page, request }) => {
    const sessionId = `e2e-${Date.now()}`;
    const userId = "user-1";
    const dashboardName = `API Dashboard ${Date.now()}`;
    const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });

    await page.addInitScript(seedSessions(sessionId));
    await page.route("**/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
        }),
      });
    });

    await page.goto(`${BASE_URL}/managedash`);
    const allDashboardsSection = page.locator("section.dashboard-section", {
      has: page.getByRole("heading", { name: "All dashboards" }),
    });
    await expect(allDashboardsSection.getByText(dashboardName)).toBeVisible();

    if (dashboardId) {
      await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
    }
  });
});
