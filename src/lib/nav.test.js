import { expect, mock, test } from "bun:test";

mock.module("@jianyuelab-org/can-ui", () => ({}));

const { buildNavigation } = await import("./nav");

test("the sidebar is the four controller pages, in spec order", () => {
  expect(buildNavigation((key) => key)).toEqual([
    { name: "controllers.panel", href: "/", icon: "home" },
    { name: "controllers.atis", href: "/atis", icon: "speakerWave" },
    {
      name: "controllers.reservations",
      href: "/reservations",
      icon: "calendarDays",
    },
    { name: "controllers.rules", href: "/rules", icon: "documentText" },
  ]);
});

test("no item links to the portal", () => {
  const hrefs = JSON.stringify(buildNavigation((key) => key));
  expect(hrefs).not.toContain("portal");
  expect(hrefs).not.toContain("/instr/");
  expect(hrefs).not.toContain("/super/");
});
