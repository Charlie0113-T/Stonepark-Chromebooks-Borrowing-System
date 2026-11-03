import { describePasskeyError } from "./passkeys";

jest.mock("@simplewebauthn/browser", () => ({}));
jest.mock("../api", () => ({}));

const domError = (name: string) => Object.assign(new Error(name), { name });

describe("describePasskeyError", () => {
  describe("sign-in (default)", () => {
    test("stays silent when the teacher dismisses the prompt", () => {
      expect(describePasskeyError(domError("NotAllowedError"))).toBeNull();
      expect(describePasskeyError(domError("AbortError"))).toBeNull();
    });

    test("falls back to a sign-in message", () => {
      expect(describePasskeyError(new Error("boom"))).toMatch(/sign-in/i);
    });
  });

  describe("adding a passkey", () => {
    // A school-managed Chromebook that refuses to create a passkey reports the
    // same NotAllowedError as pressing Cancel. Silence here looks like a dead
    // button, so adding must always say something.
    test("explains a refused or cancelled add instead of staying silent", () => {
      const msg = describePasskeyError(domError("NotAllowedError"), "add");
      expect(msg).not.toBeNull();
      expect(msg).toMatch(/no passkey was added/i);
      expect(msg).toMatch(/password still works/i);
    });

    test("generic failure talks about adding, not signing in", () => {
      const msg = describePasskeyError(new Error("boom"), "add");
      expect(msg).not.toMatch(/sign-in/i);
      expect(msg).toMatch(/could not (add|create) a passkey/i);
    });

    test("server messages still win", () => {
      const err = { response: { status: 400, data: { message: "From server" } } };
      expect(describePasskeyError(err, "add")).toBe("From server");
    });

    test("duplicate passkey keeps its specific message", () => {
      expect(describePasskeyError(domError("InvalidStateError"), "add")).toMatch(
        /already has a passkey/i,
      );
    });
  });
});
