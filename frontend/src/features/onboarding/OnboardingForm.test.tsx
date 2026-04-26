import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingForm from "./OnboardingForm";

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

describe("OnboardingForm", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("renders the required fields", () => {
    const onSaved = vi.fn();
    render(<OnboardingForm onSaved={onSaved} />);

    expect(screen.getByText(/Major or focus area/i)).toBeInTheDocument();
    expect(screen.getByText(/Education level/i)).toBeInTheDocument();
    expect(screen.getByText(/Experience level/i)).toBeInTheDocument();
    expect(screen.getByText(/Interests/i)).toBeInTheDocument();
    expect(screen.getByText(/Current skills/i)).toBeInTheDocument();
  });

  it("posts to /api/profile and calls onSaved on a successful submit", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockPost.mockResolvedValueOnce({});

    render(<OnboardingForm onSaved={onSaved} />);

    await user.type(
      screen.getByPlaceholderText(/Computer Science/i),
      "Computer Science",
    );
    await user.type(
      screen.getByPlaceholderText(/ml, education, social impact/i),
      "ml, frontend",
    );
    await user.type(
      screen.getByPlaceholderText(/python, react, sql/i),
      "python, react",
    );
    await user.type(
      screen.getByPlaceholderText(/What you want to do/i),
      "Build software that helps people.",
    );

    await user.click(screen.getByRole("button", { name: /Save profile/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          major: "Computer Science",
          interests: ["ml", "frontend"],
          currentSkills: ["python", "react"],
          careerGoals: "Build software that helps people.",
        }),
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});
