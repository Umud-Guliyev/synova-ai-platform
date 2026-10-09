import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { authErrorMessage, guardDecision, isDemoUser, performSignOut, safeRedirect } from "@/lib/auth";

describe("auth guard", () => {
  it("redirects signed-out visitors and keeps the requested page", () => {
    expect(guardDecision(null, "/orders/DEMO-1002")).toEqual({ allow: false, redirectTo: "/orders/DEMO-1002" });
  });
  it("allows signed-in users and demo guests", () => {
    expect(guardDecision({ id: "u1" }, "/")).toEqual({ allow: true });
    expect(guardDecision({ id: "g1", is_anonymous: true }, "/analytics")).toEqual({ allow: true });
  });
  it("protects every platform page under the sign-in gate", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/", "/orders", "/orders/DEMO-1002", "/analytics", "/interventions", "/settings"]) {
      const ids = router.matchRoutes(path).map((m) => m.routeId);
      expect(ids).toContain("/_authenticated");
    }
  });
  it("keeps login and register pages public", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const path of ["/auth", "/register"]) {
      const ids = router.matchRoutes(path).map((m) => m.routeId);
      expect(ids).not.toContain("/_authenticated");
      expect(ids.at(-1)).toBe(path);
    }
  });
});

describe("redirect safety", () => {
  it("rejects external and protocol-relative destinations", () => {
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("/auth")).toBe("/");
    expect(safeRedirect("/orders?risk=high")).toBe("/orders?risk=high");
  });
});

describe("demo access", () => {
  it("recognises guest sessions as demo", () => {
    expect(isDemoUser({ id: "g", is_anonymous: true })).toBe(true);
    expect(isDemoUser({ id: "u", is_anonymous: false })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
  });
  it("explains how to enable demo access when anonymous sign-ins are disabled", () => {
    expect(authErrorMessage({ code: "anonymous_provider_disabled", status: 422 }, "demo")).toMatch(/enable Anonymous Sign-Ins/i);
  });
});

describe("error messages", () => {
  it("covers invalid credentials, existing accounts and provider outages", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400, message: "Invalid login credentials" }, "login")).toBe("Incorrect email or password.");
    expect(authErrorMessage({ code: "user_already_exists", status: 422 }, "register")).toMatch(/already exists/);
    expect(authErrorMessage({ name: "TypeError", message: "Failed to fetch" }, "login")).toMatch(/unavailable/);
    expect(authErrorMessage({ status: 503, message: "x" }, "login")).toMatch(/unavailable/);
    expect(authErrorMessage({ status: 400, message: "something odd" }, "register")).toBe("Registration failed. Please try again.");
  });
});

describe("logout", () => {
  it("cancels queries, clears cache, signs out, then navigates in order", async () => {
    const calls: string[] = [];
    await performSignOut({
      cancelQueries: async () => void calls.push("cancel"),
      clearCache: () => void calls.push("clear"),
      signOut: async () => void calls.push("signOut"),
      navigateToAuth: () => void calls.push("navigate"),
    });
    expect(calls).toEqual(["cancel", "clear", "signOut", "navigate"]);
  });
  it("still leaves the protected area if the provider sign-out fails", async () => {
    const navigateToAuth = vi.fn();
    await expect(performSignOut({ cancelQueries: async () => {}, clearCache: () => {}, signOut: async () => { throw new Error("down"); }, navigateToAuth })).rejects.toThrow();
    expect(navigateToAuth).toHaveBeenCalled();
  });
});
