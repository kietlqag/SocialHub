import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SESSION_KEY = "socialhub_auth_session";

const seedAdminSession = () => {
  const payload = {
    user: { id: "admin-1", email: "admin@example.com", fullName: "Admin User", role: "admin" },
    token: "admin-token",
  };
  return `localStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)})); sessionStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)}));`;
};

const mockAdminApi = async (page: Page) => {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "admin-1", email: "admin@example.com", fullName: "Admin User", role: "admin" },
      }),
    });
  });

  await page.route("**/admin/users", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        users: [
          {
            id: "user-1",
            full_name: "Tran Phuong",
            email: "tran.phuong@example.com",
            role: "user",
            isVerified: true,
            created_at: "2025-01-01T00:00:00.000Z",
            updated_at: "2025-01-02T00:00:00.000Z",
          },
          {
            id: "user-2",
            full_name: "Le An",
            email: "lean@example.com",
            role: "admin",
            isVerified: false,
            created_at: "2025-01-03T00:00:00.000Z",
            updated_at: "2025-01-04T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/admin/dashboards", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dashboards: [
          {
            id: "dash-1",
            name: "Sales Overview",
            description: "Monthly revenue",
            ownerName: "Tran Phuong",
            tableCount: 2,
            widgetCount: 3,
            insightCount: 2,
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-02T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/admin/activity", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        logs: [
          {
            id: "log-1",
            userName: "Tran Phuong",
            action: "auth.login",
            targetType: "user",
            targetName: "Tran Phuong",
            createdAt: "2025-01-05T00:00:00.000Z",
            metadata: { ip: "127.0.0.1" },
          },
        ],
      }),
    });
  });

  await page.route("**/admin/notifications", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          notification: {
            id: "notif-1",
            title: "System update",
            message: "Maintenance scheduled",
            type: "info",
            created_at: "2025-01-06T00:00:00.000Z",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [
          {
            id: "notif-0",
            title: "Welcome",
            message: "Admin portal ready",
            type: "info",
            created_at: "2025-01-01T00:00:00.000Z",
          },
        ],
      }),
    });
  });
};

test("Admin portal loads users and supports search", async ({ page }) => {
  await page.addInitScript(seedAdminSession());
  await mockAdminApi(page);

  await page.goto(`${BASE_URL}/admin`);

  await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
  await expect(page.getByText("Tran Phuong")).toBeVisible();

  await page.getByPlaceholder("Search by name, email...").fill("Tran");
  await expect(page.getByText("Tran Phuong")).toBeVisible();
});

test("Admin user details dialog opens", async ({ page }) => {
  await page.addInitScript(seedAdminSession());
  await mockAdminApi(page);

  await page.goto(`${BASE_URL}/admin`);

  await page.getByTitle("View Details").first().click();
  await expect(page.getByText("User Details")).toBeVisible();
  await expect(page.getByText("View detailed user information")).toBeVisible();
});

test("Admin dashboards tab renders", async ({ page }) => {
  await page.addInitScript(seedAdminSession());
  await mockAdminApi(page);

  await page.goto(`${BASE_URL}/admin`);
  await page.getByText("Dashboards").click();

  await expect(page.getByText("Sales Overview")).toBeVisible();
});

test("Admin notifications can be sent", async ({ page }) => {
  await page.addInitScript(seedAdminSession());
  await mockAdminApi(page);

  await page.goto(`${BASE_URL}/admin`);
  await page.getByText("Notifications").click();

  await page.getByPlaceholder("Title").fill("System update");
  await page.getByPlaceholder("Message").fill("Maintenance scheduled");
  await page.getByRole("button", { name: /send notification/i }).click();

  await expect(page.getByText("Notification sent")).toBeVisible();
});

test("Admin activity tab shows logs", async ({ page }) => {
  await page.addInitScript(seedAdminSession());
  await mockAdminApi(page);

  await page.goto(`${BASE_URL}/admin`);
  await page.getByText("Activity").click();

  await expect(page.getByText("auth.login")).toBeVisible();
});
