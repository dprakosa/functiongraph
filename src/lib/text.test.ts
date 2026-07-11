import { describe, expect, it } from "vitest";
import { capSlug, norm } from "./text";

describe("capSlug (DM-6)", () => {
  it("lowercases and collapses non-alphanumerics to single hyphens", () => {
    expect(capSlug("charges usb-c devices")).toBe("charges-usb-c-devices");
    expect(capSlug("Keeps  Food   Warm")).toBe("keeps-food-warm");
    expect(capSlug("roasts large meals")).toBe("roasts-large-meals");
  });
});

describe("norm (API-3)", () => {
  it("lowercases, spaces punctuation, collapses whitespace", () => {
    expect(norm("  Mini   Camera—Drone ")).toBe("mini camera drone");
  });

  it("strips a trailing price token", () => {
    expect(norm("Convection countertop oven — $129")).toBe(
      "convection countertop oven",
    );
    expect(norm("4th USB-C cable — $15")).toBe("4th usb c cable");
    expect(norm("thing $129.99")).toBe("thing");
    expect(norm("thing A$129.99")).toBe("thing");
    expect(norm("thing — AUD 1,299.95")).toBe("thing");
    expect(norm("thing 129 USD")).toBe("thing");
  });

  it("keeps digits that are part of a product or version name", () => {
    expect(norm("4th usb c cable")).toBe("4th usb c cable");
    expect(norm("Pixel 9")).toBe("pixel 9");
    expect(norm("PlayStation 5")).toBe("playstation 5");
    expect(norm("USB hub v2")).toBe("usb hub v2");
    expect(norm("Camera 129")).toBe("camera 129");
  });
});
