import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NetworkingPanel from "./NetworkingPanel";

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

describe("NetworkingPanel", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("renders the form fields", () => {
    render(<NetworkingPanel />);
    expect(screen.getByText(/Recipient type/i)).toBeInTheDocument();
    expect(screen.getByText(/Channel/i)).toBeInTheDocument();
    expect(screen.getByText(/Your ask/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Draft message/i }),
    ).toBeInTheDocument();
  });

  it("submits to /api/networking/generate with the entered ask and renders result", async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      message: "Hi Jane — would love 20 min on your calendar.",
      alternatives: [],
      followUps: [],
      questions: ["What surprised you most about ML infra at Stripe?"],
      subjectLine: undefined,
      toneNotes: "Warm matches an engineer-to-peer outreach.",
    });

    render(<NetworkingPanel />);

    const ask = screen.getByPlaceholderText(/20 minutes on their calendar/i);
    await user.clear(ask);
    await user.type(ask, "20 minutes to chat about your work on ML infra");

    await user.click(screen.getByRole("button", { name: /Draft message/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/networking/generate",
        expect.objectContaining({
          ask: "20 minutes to chat about your work on ML infra",
          channel: "linkedin",
          tone: "warm",
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Hi Jane — would love 20 min on your calendar\./i),
      ).toBeInTheDocument(),
    );
  });
});
