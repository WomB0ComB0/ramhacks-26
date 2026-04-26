import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonCard, SkeletonGrid } from "./Skeleton";

describe("Skeleton primitives", () => {
  it("renders a single skeleton box with the .skeleton class", () => {
    const { container } = render(<Skeleton width={120} height={20} />);
    const box = container.querySelector(".skeleton");
    expect(box).not.toBeNull();
  });

  it("renders the configured number of cards in a grid", () => {
    const { container } = render(<SkeletonGrid count={4} />);
    // SkeletonCard renders a `.card` wrapper containing many `.skeleton` boxes
    expect(container.querySelectorAll(".card").length).toBe(4);
  });

  it("SkeletonCard renders without crashing and contains skeleton boxes", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });
});
