import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SESSION_KEY = "socialhub_auth_session";
const DASHBOARD_SESSION_KEY = "socialhub:dashboards_session";
const API_URL = process.env.API_URL || "http://127.0.0.1:4000";
const REAL_API_ENABLED = process.env.E2E_REAL_API === "1";

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

const routeAuth = async (page: Page) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
      }),
    });
  });
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

const createTableViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  params: {
    dashboardId: string;
    userId: string;
    key: string;
    name: string;
    fields?: Array<{ key: string; label: string; type: string; required?: boolean }>;
  },
) => {
  const fields =
    params.fields && params.fields.length
      ? params.fields
      : [{ key: "name", label: "Name", type: "string", required: true }];
  const res = await request.post(`${API_URL}/api/dashboards/${params.dashboardId}/tables/create`, {
    data: {
      name: params.name,
      key: params.key,
      userId: params.userId,
      fields,
    },
  });
  expect(res.ok()).toBeTruthy();
};

const createRecordViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  params: { dashboardId: string; userId: string; tableKey: string; record: Record<string, unknown> },
) => {
  const res = await request.post(`${API_URL}/api/dashboards/${params.dashboardId}/records`, {
    data: {
      dashboardId: params.dashboardId,
      tableKey: params.tableKey,
      record: params.record,
      userId: params.userId,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body?.record?.record || body?.record || body;
};

const listRecordsViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  params: { dashboardId: string; tableKey: string; sessionId: string; userId: string },
) => {
  const res = await request.get(
    `${API_URL}/api/records?dashboardId=${params.dashboardId}&tableKey=${params.tableKey}&sessionId=${params.sessionId}&userId=${params.userId}`,
  );
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const records = Array.isArray(body?.records) ? body.records : [];
  return records.map((item: any) => (item && typeof item === "object" && "record" in item ? item.record : item));
};

const getDashboardViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  params: { dashboardId: string; sessionId: string; userId: string },
) => {
  const res = await request.get(
    `${API_URL}/api/dashboards/${params.dashboardId}?sessionId=${params.sessionId}&userId=${params.userId}`,
  );
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

const getTableSchemaViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  params: { dashboardId: string; tableKey: string; sessionId: string; userId: string },
) => {
  const res = await request.get(
    `${API_URL}/api/dashboards/${params.dashboardId}/tables/${params.tableKey}/schema?sessionId=${params.sessionId}&userId=${params.userId}`,
  );
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

const getAccessControlViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  params: { dashboardId: string; sessionId: string; userId: string },
) => {
  const res = await request.get(
    `${API_URL}/api/dashboards/${params.dashboardId}/access?sessionId=${params.sessionId}&userId=${params.userId}`,
  );
  expect(res.ok()).toBeTruthy();
  return await res.json();
};

const mockDashboardApi = async (page: Page) => {
  const dashboard = {
    id: "dash-1",
    name: "Demo Dashboard",
    description: "Demo",
    userId: "user-1",
    tables: [
      {
        key: "orders",
        name: "Orders",
        fields: [
          { key: "order_code", type: "string", required: true },
          { key: "amount", type: "number", required: false },
        ],
      },
    ],
    ui: { defaultTableKey: "orders" },
    widgets: [
      {
        id: "widget-1",
        title: "Total Amount",
        tableKey: "orders",
        columnKey: "amount",
        aggregation: "sum",
        metricType: "sum",
        icon: "money",
        type: "metric",
        source: "manual",
      },
    ],
    insights: [
      {
        id: "ins-1",
        title: "Orders by status",
        chartType: "bar",
        sourceTable: "orders",
        metric: { op: "count", field: null },
        autoGenerated: false,
      },
    ],
  };

  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
      }),
    });
  });

  await page.route("**/api/dashboards?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ dashboards: [dashboard] }),
    });
  });
  await page.route("**/api/dashboards/dash-1**", async (route) => {
    const url = route.request().url();
    if (url.includes("/data")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dashboardId: "dash-1", widgets: [] }),
      });
      return;
    }
    if (route.request().method() === "GET" && url.includes("/widgets")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ widgets: dashboard.widgets }),
      });
      return;
    }
    if (route.request().method() === "DELETE" && url.includes("/widgets/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    if (route.request().method() === "DELETE" && url.includes("/insights/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    if (route.request().method() === "POST" && url.includes("/records")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ record: { id: "rec-2", order_code: "A2", amount: 200 } }),
      });
      return;
    }
    if (route.request().method() === "POST" && url.includes("/insights")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ insight: { id: "ins-1" } }),
      });
      return;
    }
    if (route.request().method() === "POST" && url.includes("/widgets")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ widget: { id: "widget-1" } }),
      });
      return;
    }
    if (route.request().method() === "POST" && url.includes("/tables")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ table: { key: "customers", name: "Customers", fields: [] } }),
      });
      return;
    }
    if (route.request().method() === "PATCH" && url.includes("/tables/orders/rename")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ table: { key: "orders", name: "Orders Updated" } }),
      });
      return;
    }
    if (route.request().method() === "DELETE" && url.includes("/tables/orders")) {
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
      body: JSON.stringify({ dashboard }),
    });
  });

  await page.route("**/api/records**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ records: [{ id: "rec-1", order_code: "A1", amount: 100 }] }),
    });
  });

  await page.route("**/api/dashboards/dash-1/tables/orders/schema**", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ table: { key: "orders", name: "Orders" }, fields: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
        body: JSON.stringify({
          table: { key: "orders", name: "Orders" },
          fields: [
          { key: "order_code", name: "Order Code", type: "string" },
          { key: "amount", name: "Amount", type: "number" },
          ],
        }),
    });
  });

  await page.route("**/api/dashboards/dash-1/records/orders/rec-1/references**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ references: [] }),
    });
  });

  await page.route("**/api/dashboards/dash-1/tables/orders/records/rec-1**", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
      return;
    }
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ record: { id: "rec-1", order_code: "A1", amount: 150 } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ record: { id: "rec-1", order_code: "A1", amount: 100 } }),
    });
  });

  await page.route("**/api/dashboards/dash-1/access**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessMode: "restricted",
        rolePermissions: [
          { role: "Admin", permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true } },
          { role: "Manager", permissions: { view: true, create: true, edit: true, delete: false, manageAccess: false } },
          { role: "Viewer", permissions: { view: true, create: false, edit: false, delete: false, manageAccess: false } },
        ],
        userAssignments: [
          { id: "assign-1", userId: "user-2", fullName: "Le An", email: "lean@example.com", role: "Viewer" },
        ],
      }),
    });
  });

  await page.route("**/api/users?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          { id: "user-3", fullName: "Pham Linh", email: "linh@example.com" },
        ],
      }),
    });
  });

  await page.route("**/api/dashboards/dash-1/users", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessMode: "restricted",
          rolePermissions: [
            { role: "Admin", permissions: { view: true, create: true, edit: true, delete: true, manageAccess: true } },
          ],
          userAssignments: [
            { id: "assign-1", userId: "user-2", fullName: "Le An", email: "lean@example.com", role: "Viewer" },
            { id: "assign-2", userId: "user-3", fullName: "Pham Linh", email: "linh@example.com", role: "Viewer" },
          ],
        }),
      });
      return;
    }
  });

  await page.route("**/api/dashboards/dash-1/users/assign-1", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
  });
};

test("Dashboard detail loads and shows records search", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await expect(page.getByRole("heading", { name: "Demo Dashboard" })).toBeVisible();
  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await expect(page.getByPlaceholder("Search records...")).toBeVisible();
});

test("Dashboard record search filters rows", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  const searchInput = page.getByPlaceholder("Search records...");
  await searchInput.fill("A1");
  await expect(page.getByText("A1")).toBeVisible();

  await searchInput.fill("ZZZ");
  await expect(page.getByText("No records match your search.")).toBeVisible();
});

test("Dashboard add record modal opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await page.getByRole("button", { name: /add record/i }).click();
  await expect(page.getByText(/Add Orders record/i)).toBeVisible();
});

test("Dashboard add chart and widget modals open", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByRole("button", { name: /add widget/i }).click();
  await expect(page.getByRole("heading", { name: "Add widget" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /add chart/i }).click();
  await expect(page.getByRole("heading", { name: "Add chart" })).toBeVisible();
});

test("Dashboard access control tab opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByText("Access control").click();
  await expect(page.getByText("Roles & permissions")).toBeVisible();
});

test("Dashboard create table modal opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByText("Add table").click();
  await expect(page.getByText("Add new table")).toBeVisible();
});

test("Dashboard rename table modal opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.locator(".mdNavGear").first().click({ force: true });
  await page.getByText("Rename table").click();
  await expect(page.getByText("Edit table structure")).toHaveCount(0);
  await expect(page.getByText("Update display name")).toBeVisible();
});

test("Dashboard edit columns modal opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.locator(".mdNavGear").first().click({ force: true });
  await page.getByText("Edit columns").click();
  await expect(page.getByText("Edit table structure")).toBeVisible();
});

test("Dashboard delete record confirmation opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await page.getByTitle("Delete").first().click();
  await expect(page.getByText("Delete record")).toBeVisible();
});

test("Dashboard view record modal opens", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await page.locator(".recordIconBtn.view").first().click();
  await expect(page.getByText("View record")).toBeVisible();
});

test("Dashboard edit record updates via API", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await page.locator(".recordIconBtn.edit").first().click();

  await expect(page.getByText("Update record")).toBeVisible();
  await page.getByPlaceholder("Enter amount").fill("150");

  const updateResponse = page.waitForResponse((res) =>
    res.url().includes("/api/dashboards/dash-1/tables/orders/records/rec-1") && res.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Submit" }).click();
  await updateResponse;

  await expect(page.getByText("Record updated")).toBeVisible();
});

test("Dashboard remove table via UI", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.locator(".mdNavGear").first().click({ force: true });
  await page.getByText("Remove table").click();
  const deleteModal = page.locator(".mdModal.deleteModal");
  await expect(deleteModal.getByText("Remove table")).toBeVisible();

  const removeResponse = page.waitForResponse((res) =>
    res.url().includes("/api/dashboards/dash-1/tables/orders") && res.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Remove" }).click();
  await removeResponse;

  await expect(page.getByRole("button", { name: /^Orders\b/ })).toHaveCount(0);
});

test("Dashboard remove widget via UI", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByText("Total Amount")).toBeVisible();
  await page.getByRole("button", { name: "Remove widget" }).click({ force: true });
  const removeWidgetModal = page.locator(".mdModal", { hasText: "Remove widget?" });
  await expect(removeWidgetModal).toBeVisible();

  const removeResponse = page.waitForResponse((res) =>
    res.url().includes("/api/dashboards/dash-1/widgets/widget-1") && res.request().method() === "DELETE",
  );
  await removeWidgetModal.getByRole("button", { name: "Remove" }).click();
  await removeResponse;

  await expect(page.getByText("Total Amount")).toHaveCount(0);
});

test("Dashboard remove chart via UI", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByRole("button", { name: "Overview" }).click();
  const chartCard = page.locator(".mdChartCard", { hasText: "Orders by status" });
  await expect(chartCard).toBeVisible();
  await chartCard.getByRole("button", { name: "More" }).click({ force: true });
  await page.getByText("Remove chart").click();
  const removeModal = page.locator(".mdModal", { hasText: "Remove insight?" });
  await expect(removeModal).toBeVisible();

  const removeResponse = page.waitForResponse((res) =>
    res.url().includes("/api/dashboards/dash-1/insights/ins-1") && res.request().method() === "DELETE",
  );
  await removeModal.getByRole("button", { name: "Remove" }).click();
  await removeResponse;

  await expect(page.getByText("Orders by status")).toHaveCount(0);
});

test("Dashboard access control can add user", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByText("Access control").click();
  await page.getByRole("button", { name: "Add users" }).click();
  await page.getByPlaceholder("Search users...").fill("linh@example.com");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Pham Linh")).toBeVisible();
  await page.getByText("Pham Linh").click();
  const addResponse = page.waitForResponse((res) =>
    res.url().includes("/api/dashboards/dash-1/users") && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add to dashboard" }).click();
  await addResponse;

  await expect(page.getByText("User added")).toBeVisible();
  await expect(page.locator(".acModal")).toHaveCount(0);
});

test("Dashboard access control can update and remove user", async ({ page }) => {
  await page.addInitScript(seedSession());
  await mockDashboardApi(page);

  await page.goto(`${BASE_URL}/managedash/dash-1`);

  await page.getByText("Access control").click();
  const userRow = page.locator(".dashboard-access-users-row", { hasText: "lean@example.com" });
  await userRow.getByRole("button", { name: "Edit role" }).click();
  await userRow.getByRole("combobox").click();
  const roleOption = page.locator(".mdSelectContent").getByRole("option", { name: "Manager" });
  await expect(roleOption).toBeVisible();
  await roleOption.click();
  await expect(page.getByText("Role updated")).toBeVisible();

  await userRow.getByRole("button", { name: "Remove user" }).click();
  await expect(page.getByText("User removed")).toBeVisible();
});

test.describe("Real API", () => {
  test.skip(!REAL_API_ENABLED, "E2E real API disabled");

  test("Dashboard adds record via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const recordName = `Order ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "amount", label: "Amount", type: "number", required: false },
      { key: "status", label: "Status", type: "string", required: false },
    ],
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);
  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();

  await page.getByRole("button", { name: /add record/i }).click();
  await page.getByPlaceholder("Enter name").fill(recordName);
  await page.getByPlaceholder("Enter amount").fill("150");
  await page.getByPlaceholder("Enter status").fill("New");

  const createResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/records`) && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Submit" }).click();
  await createResponse;

  await expect(page.getByText(recordName)).toBeVisible();

  const records = await listRecordsViaApi(request, { dashboardId, tableKey: "orders", sessionId, userId });
  expect(records.some((row: any) => row?.name === recordName)).toBeTruthy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard adds widget via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const widgetTitle = `Revenue ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "amount", label: "Amount", type: "number", required: false },
      { key: "status", label: "Status", type: "string", required: false },
    ],
  });
  await createRecordViaApi(request, {
    dashboardId,
    userId,
    tableKey: "orders",
    record: { name: "Order A", amount: 120, status: "paid" },
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  const addWidgetBtn = page.getByRole("button", { name: /add widget/i });
  await expect(addWidgetBtn).toBeVisible();
  await addWidgetBtn.click();
  await page.getByPlaceholder("Total revenue").fill(widgetTitle);

  const widgetResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/widgets`) && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: /save widget/i }).click();
  await widgetResponse;

  await expect(page.getByText(widgetTitle)).toBeVisible();

  const widgetsRes = await request.get(
    `${API_URL}/api/dashboards/${dashboardId}/widgets?sessionId=${sessionId}&userId=${userId}`,
  );
  expect(widgetsRes.ok()).toBeTruthy();
  const widgetsBody = await widgetsRes.json();
  const widgets = Array.isArray(widgetsBody?.widgets) ? widgetsBody.widgets : [];
  expect(widgets.some((w: any) => w?.title === widgetTitle)).toBeTruthy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard adds chart via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const chartTitle = `Orders by status ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "amount", label: "Amount", type: "number", required: false },
      { key: "status", label: "Status", type: "string", required: false },
    ],
  });
  await createRecordViaApi(request, {
    dashboardId,
    userId,
    tableKey: "orders",
    record: { name: "Order B", amount: 90, status: "paid" },
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  const addChartBtn = page.getByRole("button", { name: /add chart/i });
  await expect(addChartBtn).toBeVisible();
  await addChartBtn.click();
  await page.getByPlaceholder("Orders by status").fill(chartTitle);

  const chartResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/insights`) && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: /save chart/i }).click();
  await chartResponse;

  await expect(page.getByText(chartTitle)).toBeVisible();

  const dashBody = await getDashboardViaApi(request, { dashboardId, sessionId, userId });
  const insights = Array.isArray(dashBody?.dashboard?.insights) ? dashBody.dashboard.insights : [];
  expect(insights.some((insight: any) => insight?.title === chartTitle)).toBeTruthy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard updates access mode via UI", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  await page.getByText("Access control").click();
  await expect(page.getByText("Roles & permissions")).toBeVisible();

  const publicButton = page.getByRole("button", { name: /public/i });
  await publicButton.click();

  const confirmResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/access-mode`) && res.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: /^Save$/ }).click();
  await confirmResponse;

  await expect(page.getByText("Mode: public")).toBeVisible();

  const accessBody = await getAccessControlViaApi(request, { dashboardId, sessionId, userId });
  expect(accessBody?.accessMode).toBe("public");

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard creates table via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const tableName = `Customers ${Date.now()}`;
  const tableKey = `customers_${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [{ key: "name", label: "Name", type: "string", required: true }],
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  await page.getByText("Add table").click();
  await expect(page.getByText("Add new table")).toBeVisible();

  const createModal = page.locator(".mdModal");
  await createModal.locator('input[placeholder="Customers"]').fill(tableName);
  await createModal.locator('input[placeholder="customers"]').fill(tableKey);

  const createResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/tables`) && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: /create table/i }).click();
  await createResponse;

  await expect(page.getByRole("button", { name: new RegExp(`^${tableName}\\b`) })).toBeVisible();

  const dashBody = await getDashboardViaApi(request, { dashboardId, sessionId, userId });
  const tables = Array.isArray(dashBody?.dashboard?.tables) ? dashBody.dashboard.tables : [];
  expect(tables.some((t: any) => t?.key === tableKey || t?.name === tableName)).toBeTruthy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard renames table via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const nextTableName = `Orders Updated ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [{ key: "name", label: "Name", type: "string", required: true }],
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  await page.locator(".mdNavGear").first().click({ force: true });
  await page.getByText("Rename table").click();
  await expect(page.getByText("Update display name")).toBeVisible();

  const nameInput = page.getByPlaceholder("Sales pipeline");
  await nameInput.fill(nextTableName);

  const renameResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/tables/orders/rename`) && res.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: /^Save$/ }).click();
  await renameResponse;

  await expect(page.getByRole("button", { name: new RegExp(`^${nextTableName}\\b`) })).toBeVisible();

  const dashBody = await getDashboardViaApi(request, { dashboardId, sessionId, userId });
  const tables = Array.isArray(dashBody?.dashboard?.tables) ? dashBody.dashboard.tables : [];
  expect(tables.some((t: any) => t?.key === "orders" && t?.name === nextTableName)).toBeTruthy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard edits columns via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const newFieldKey = `priority_${Date.now()}`;
  const newFieldLabel = "Priority";

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [{ key: "name", label: "Name", type: "string", required: true }],
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  await page.locator(".mdNavGear").first().click({ force: true });
  await page.getByText("Edit columns").click();
  await expect(page.getByText("Edit table structure")).toBeVisible();

  await page.getByRole("button", { name: /add column/i }).click();

  const lastRow = page.locator(".schemaRow").last();
  await lastRow.locator('input[placeholder="status"]').fill(newFieldKey);
  await lastRow.locator('input[placeholder="Status"]').fill(newFieldLabel);

  const saveResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/tables/orders/schema`) && res.request().method() === "PUT",
  );
  await page.getByRole("button", { name: /save changes/i }).click();
  await saveResponse;

  const schemaBody = await getTableSchemaViaApi(request, { dashboardId, tableKey: "orders", sessionId, userId });
  const fields = Array.isArray(schemaBody?.fields) ? schemaBody.fields : [];
  expect(fields.some((f: any) => f?.key === newFieldKey)).toBeTruthy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard deletes record via UI and persists to API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const recordName = `Order ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, {
    dashboardId,
    userId,
    key: "orders",
    name: "Orders",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "amount", label: "Amount", type: "number", required: false },
    ],
  });
  await createRecordViaApi(request, {
    dashboardId,
    userId,
    tableKey: "orders",
    record: { name: recordName, amount: 210 },
  });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);

  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await expect(page.getByText(recordName)).toBeVisible();

  await page.getByTitle("Delete").first().click();
  await expect(page.getByText("Delete record")).toBeVisible();

  const deleteModal = page.locator(".deleteModal");
  const deleteResponse = page.waitForResponse((res) =>
    res.url().includes(`/api/dashboards/${dashboardId}/tables/orders/records/`) && res.request().method() === "DELETE",
  );
  await deleteModal.getByRole("button", { name: /^Delete$/ }).click();
  await deleteResponse;

  await expect(page.getByText(recordName)).toHaveCount(0);

  const records = await listRecordsViaApi(request, { dashboardId, tableKey: "orders", sessionId, userId });
  expect(records.some((row: any) => row?.name === recordName)).toBeFalsy();

  await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });

  test("Dashboard detail loads records from real API", async ({ page, request }) => {
  const sessionId = `e2e-${Date.now()}`;
  const userId = "user-1";
  const dashboardName = `API Dashboard ${Date.now()}`;
  const recordName = `Order ${Date.now()}`;

  const dashboardId = await createDashboardViaApi(request, { sessionId, userId, name: dashboardName });
  expect(dashboardId).toBeTruthy();
  await createTableViaApi(request, { dashboardId, userId, key: "orders", name: "Orders" });
  await createRecordViaApi(request, { dashboardId, userId, tableKey: "orders", record: { name: recordName } });

  await page.addInitScript(seedSessions(sessionId));
  await routeAuth(page);

  await page.goto(`${BASE_URL}/managedash/${dashboardId}`);
  await expect(page.getByRole("heading", { name: dashboardName })).toBeVisible();
  const ordersTab = page.getByRole("button", { name: /^Orders\b/ });
  await expect(ordersTab).toBeVisible();
  await ordersTab.click();
  await expect(page.getByText(recordName)).toBeVisible();

    await request.delete(`${API_URL}/api/dashboards/${dashboardId}?sessionId=${sessionId}&userId=${userId}`);
  });
});
