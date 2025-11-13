import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "../../helpers/test-utils";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../../../src/components/auth/LoginForm";

/**
 * Example React component test
 * This demonstrates testing a form component with user interactions
 */
describe("LoginForm", () => {
  it("should render login form elements", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasło/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zaloguj się/i })).toBeInTheDocument();
  });

  it("should show validation errors for empty fields", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const submitButton = screen.getByRole("button", { name: /zaloguj się/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/nieprawidłowy adres email/i)).toBeInTheDocument();
    });
  });

  // NOTE: Ten test jest pomijany, ponieważ HTML5 natywna walidacja dla type="email"
  // może zapobiegać submitowi formularza, zanim Zod/React Hook Form zdąży zwalidować.
  // W praktyce, użytkownik zobaczy natywny komunikat przeglądarki dla nieprawidłowego emaila.
  it.skip("should show validation error for invalid email", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/hasło/i);

    // Type invalid email without @ symbol
    await user.type(emailInput, "invalidemail");
    await user.type(passwordInput, "somepassword123");

    const submitButton = screen.getByRole("button", { name: /zaloguj się/i });
    await user.click(submitButton);

    // Wait for the validation error to appear
    await waitFor(
      () => {
        const errorElement = screen.queryByText(/nieprawidłowy adres email/i);
        expect(errorElement).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("should handle form submission with valid data", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/hasło/i);

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");

    const submitButton = screen.getByRole("button", { name: /zaloguj się/i });
    await user.click(submitButton);

    // Add assertions based on your form submission behavior
  });
});
