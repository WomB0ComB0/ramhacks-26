import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ActionPlanPanel from "./ActionPlanPanel";

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

const fakeStep = {
  action: "Polish your LinkedIn profile",
  why: "Recruiters search there first",
  estTimeHours: 4,
  difficulty: "easy" as const,
  expectedOutcome: "Profile gets 3+ recruiter views/week",
  successCriteria: "Headline + summary updated, photo refreshed",
};

const fakePlanRow = {
  id: "plan-1",
  userId: "user-1",
  summary: "A roadmap to land an entry-level full-stack role.",
  confidence: 0.7,
  sevenDayPlan: [fakeStep, fakeStep, fakeStep],
  thirtyDayPlan: [fakeStep, fakeStep, fakeStep, fakeStep],
  ninetyDayPlan: [fakeStep, fakeStep, fakeStep],
  sixMonthPlan: [fakeStep, fakeStep],
  longTermPlan: [fakeStep],
  anchorCareerId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("ActionPlanPanel", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("renders the latest plan summary when one exists", async () => {
    mockGet.mockResolvedValueOnce({ plan: fakePlanRow });
    render(<ActionPlanPanel />);

    expect(mockGet).toHaveBeenCalledWith("/api/action-plans/latest");
    await waitFor(() =>
      expect(
        screen.getByText(/roadmap to land an entry-level full-stack role/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows the empty-state copy when no plan exists", async () => {
    mockGet.mockResolvedValueOnce({ plan: null });
    render(<ActionPlanPanel />);

    await waitFor(() =>
      expect(screen.getByText(/No plan yet/i)).toBeInTheDocument(),
    );
  });
});
