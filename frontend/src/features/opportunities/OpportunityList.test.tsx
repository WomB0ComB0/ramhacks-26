import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import OpportunityList from "./OpportunityList";

// Mock the api client used inside OpportunityList.
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("@/api/client", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  ApiError: class ApiError extends Error {
    status = 0;
    code = "";
    details?: unknown;
  },
}));

const fakeMatchResponse = {
  profileSnapshot: { tags: ["ml"], skills: ["python"], audience: "undergrad" },
  opportunities: [
    {
      slug: "google-step",
      name: "Google STEP Internship",
      organization: "Google",
      kind: "internship" as const,
      oneLiner: "12-week summer SWE internship.",
      description: "Pair-programming-style entry internship.",
      eligibility: ["Rising sophomore"],
      applicationSteps: ["Apply via careers"],
      applyUrl: "https://example.com/apply",
      remoteOk: false,
      costUsd: 0,
      stipendUsd: 9500,
      tags: ["software"],
      skills: ["python"],
      audience: ["undergrad"],
      score: 5,
      matchedTags: ["software"],
      matchedSkills: ["python"],
    },
  ],
};

describe("OpportunityList", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("fetches matches + saved on mount and renders cards", async () => {
    mockGet
      .mockResolvedValueOnce(fakeMatchResponse) // /match
      .mockResolvedValueOnce({ opportunities: [] }); // /saved

    render(<OpportunityList />);

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/api/opportunities/match"),
    );
    await waitFor(() =>
      expect(screen.getByText(/Google STEP Internship/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Apply/i })).toHaveAttribute(
      "href",
      "https://example.com/apply",
    );
  });

  it("shows the empty-state copy when no opportunities match", async () => {
    mockGet
      .mockResolvedValueOnce({ ...fakeMatchResponse, opportunities: [] })
      .mockResolvedValueOnce({ opportunities: [] });

    render(<OpportunityList />);
    await waitFor(() =>
      expect(screen.getByText(/No opportunities match these filters/i)).toBeInTheDocument(),
    );
  });
});
