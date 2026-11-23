import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App";

describe("App shell", () => {
  it("renders the title and the fictional-data note", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Social Feed" })).toBeInTheDocument();
    expect(screen.getByText(/fictional example data/i)).toBeInTheDocument();
  });

  it("switches theme and remembers it", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Khaki" }));
    expect(document.documentElement.dataset.theme).toBe("khaki");
    expect(localStorage.getItem("social-feed.v1.theme")).toBe('"khaki"');
  });

  it("switches language to German", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(document.documentElement.lang).toBe("de");
    expect(screen.getByText(/erfundene Beispieldaten/)).toBeInTheDocument();
  });

  it("toggles the animated background", async () => {
    render(<App />);
    const toggle = screen.getByRole("button", { name: "Animated background" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(document.documentElement.dataset.motion).toBe("animated");
  });
});
