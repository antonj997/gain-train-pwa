import test from "node:test";
import assert from "node:assert/strict";
import {
  TAB_PATHS,
  appRoute,
  pageTransition,
  routeDepth,
  tabIndex,
} from "../src/lib/page-transition.ts";

test("each tab route maps to its place in the bar, left to right", () => {
  assert.deepEqual(TAB_PATHS, ["/", "/history", "/progress", "/library"]);
  assert.equal(tabIndex("/"), 0);
  assert.equal(tabIndex("/history"), 1);
  assert.equal(tabIndex("/history/"), 1);
  assert.equal(tabIndex("/progress"), 2);
  assert.equal(tabIndex("/library"), 3);
  assert.equal(tabIndex("/library/plan"), 3);
  // Not tabs: Train is "/" only, and a name that merely starts alike is another route.
  assert.equal(tabIndex("/settings"), -1);
  assert.equal(tabIndex("/workout/abc"), -1);
  assert.equal(tabIndex("/historyx"), -1);
  assert.equal(tabIndex("/auth"), -1);
});

test("tabs are level 0, Settings 1, Admin 2, and other routes have no level", () => {
  assert.equal(routeDepth("/"), 0);
  assert.equal(routeDepth("/library"), 0);
  assert.equal(routeDepth("/settings"), 1);
  assert.equal(routeDepth("/settings/"), 1);
  assert.equal(routeDepth("/settings/admin"), 2);
  assert.equal(routeDepth("/exercise/builtin%3Asquat"), 1);
  assert.equal(routeDepth("/exercise/"), null);
  assert.equal(routeDepth("/workout/abc"), null);
  assert.equal(routeDepth("/auth"), null);
  assert.equal(routeDepth("/nowhere"), null);
});

test("a tab to the right slides in from the right, one to the left from the left", () => {
  assert.equal(pageTransition("/", "/history"), "right");
  assert.equal(pageTransition("/", "/library"), "right");
  assert.equal(pageTransition("/progress", "/library"), "right");
  assert.equal(pageTransition("/library", "/"), "left");
  assert.equal(pageTransition("/progress", "/history"), "left");
  assert.equal(pageTransition("/history", "/"), "left");
});

test("sub-pages push in and Back pops out, at any depth", () => {
  assert.equal(pageTransition("/", "/settings"), "push");
  assert.equal(pageTransition("/history", "/settings"), "push");
  assert.equal(pageTransition("/settings", "/settings/admin"), "push");
  assert.equal(pageTransition("/progress", "/exercise/abc"), "push");
  assert.equal(pageTransition("/exercise/abc", "/history"), "pop");
  assert.equal(pageTransition("/settings/admin", "/settings"), "pop");
  assert.equal(pageTransition("/settings", "/"), "pop");
  assert.equal(pageTransition("/settings/admin", "/library"), "pop");
});

test("no slide for the same route, the workout, sign-in or an unknown route", () => {
  assert.equal(pageTransition("/history", "/history"), null);
  assert.equal(pageTransition("/history", "/history/"), null);
  assert.equal(pageTransition("/", "/workout/abc"), null);
  assert.equal(pageTransition("/workout/abc", "/"), null);
  assert.equal(pageTransition("/settings", "/auth"), null);
  assert.equal(pageTransition("/nowhere", "/"), null);
});

test("a link's in-app route drops the base path and keeps the query", () => {
  const origin = "https://example.com";
  assert.deepEqual(appRoute("https://example.com/history", origin, "/"), {
    pathname: "/history",
    to: "/history",
  });
  assert.deepEqual(
    appRoute("https://example.com/library?tab=plan#x", origin, "/"),
    { pathname: "/library", to: "/library?tab=plan#x" },
  );
  assert.deepEqual(
    appRoute(
      "https://example.com/gain-train-pwa/settings",
      origin,
      "/gain-train-pwa/",
    ),
    { pathname: "/settings", to: "/settings" },
  );
  assert.deepEqual(
    appRoute("https://example.com/gain-train-pwa", origin, "/gain-train-pwa/"),
    { pathname: "/", to: "/" },
  );
  assert.deepEqual(appRoute("/progress", origin, "/"), {
    pathname: "/progress",
    to: "/progress",
  });
  // Another origin, or outside the app's base, is not an in-app route.
  assert.equal(appRoute("https://other.com/history", origin, "/"), null);
  assert.equal(
    appRoute("https://example.com/elsewhere", origin, "/gain-train-pwa/"),
    null,
  );
  assert.equal(appRoute("http://[bad", origin, "/"), null);
});
