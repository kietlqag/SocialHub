import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SESSION_KEY = "socialhub_auth_session";

const seedSession = () => {
  const payload = {
    user: { id: "user-1", email: "tran.phuong@example.com", fullName: "Tran Phuong", role: "user" },
    token: "test-token",
  };
  return `localStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)})); sessionStorage.setItem("${SESSION_KEY}", JSON.stringify(${JSON.stringify(payload)}));`;
};

test("AI chat loads conversation and sends message", async ({ page }) => {
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
  await page.route("**/ai/conversations", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversation: { id: "conv-1", title: "Dashboard Design Help", createdAt: new Date().toISOString() },
          messages: [],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ conversations: [{ id: "conv-1", title: "Dashboard Design Help", createdAt: new Date().toISOString() }] }),
    });
  });
  await page.route("**/ai/conversations/conv-1/messages", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ conversation: { id: "conv-1", title: "Dashboard Design Help" }, messages: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        userMessage: { id: "m1", role: "user", content: "Hello AI", createdAt: new Date().toISOString() },
        assistantMessage: { id: "m2", role: "assistant", content: "Hi there!", createdAt: new Date().toISOString() },
      }),
    });
  });

  await page.goto(`${BASE_URL}/chat`);

  await expect(page.getByText("SocialHub AI")).toBeVisible();
  await page.getByPlaceholder("Type your message...").fill("Hello AI");
  await page.locator("button.sendBtn").click();
  await expect(page.getByText("Hi there!")).toBeVisible();
});

test("AI chat settings updates reply language", async ({ page }) => {
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
  await page.route("**/ai/conversations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ conversations: [{ id: "conv-1", title: "Dashboard Design Help", createdAt: new Date().toISOString() }] }),
    });
  });
  await page.route("**/ai/conversations/conv-1/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ conversation: { id: "conv-1", title: "Dashboard Design Help" }, messages: [] }),
    });
  });

  await page.goto(`${BASE_URL}/chat`);

  await page.getByLabel("Open settings").click();
  const viButton = page.getByRole("button", { name: "Vietnamese" });
  await viButton.click();
  await expect(viButton).toHaveClass(/segBtnActive/);
});
