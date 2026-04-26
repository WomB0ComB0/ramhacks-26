import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CareerMatches from "./CareerMatches";

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

const fakeCareerRow = {
  id: "row-1",
  userId: "user-1",
  title: "Full Stack Developer",
  fitReason: "Aligns with your full-stack interest and current skills.",
  requiredSkills: ["javascript", "react"],
  missingSkills: ["devops"],
  suggestedProjects: [
    { name: "Civic Portal", outline: "Build a citizen-services app.", estTimeWeeks: 6 },
  ],
  entryRoles: ["Junior Full Stack Developer"],
  growthPath: ["Senior", "Staff"],
  confidenceScore: 0.7,
  difficulty: "moderate",
  tradeoffs: null,
  aiExplanation: null,
  saved: false,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("CareerMatches", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("renders career cards from /api/careers", async () => {
    mockGet.mockResolvedValueOnce({ recommendations: [fakeCareerRow] });
    render(<CareerMatches />);

    expect(mockGet).toHaveBeenCalledWith("/api/careers");
    await waitFor(() =>
      expect(screen.getByText("Full Stack Developer")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Aligns with your full-stack interest/)).toBeInTheDocument();
  });

  it("shows the empty-state copy when no matches yet", async () => {
    mockGet.mockResolvedValueOnce({ recommendations: [] });
    render(<CareerMatches />);

    await waitFor(() =>
      expect(screen.getByText(/No matches yet/i)).toBeInTheDocument(),
    );
  });
});
