import { expect, mock, test } from "bun:test";

mock.module("@jianyuelab-org/can-ui", () => ({
  RATING_ADMIN: 12,
  RATING_INSTRUCTOR: 8,
  RATING_SUP: 11,
  visibleSites: () => [],
  WORKSPACE_SITE_KEYS: [],
}));

const { buildNavigation } = await import("./nav");

function links(items: ReturnType<typeof buildNavigation>): string[] {
  return items.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children?.flatMap((child) => (child.href ? [child.href] : [])) ??
      []),
  ]);
}

test("SUP rating can see the promotion approval link", () => {
  expect(links(buildNavigation((key) => key, 11))).toContain(
    "https://portal.ceruleanavi.net/super/promotions",
  );
});
