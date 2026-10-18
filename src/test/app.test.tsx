import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "../App";

describe("FocusDesk app shell", () => {
  it("renders the dashboard shell and navigation", () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "FocusDesk" })).toBeInTheDocument();
    expect(screen.getByText(/What matters today\?/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });
});
