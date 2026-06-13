import { beforeEach, describe, expect, it } from "vitest";
import {
  consumePasswordRecovery,
  getLoginPath,
  getPasswordRecoveryRedirect,
  getRecoveryAudience,
  markPasswordRecovery,
} from "@/lib/passwordRecovery";

describe("password recovery flow", () => {
  beforeEach(() => {
    consumePasswordRecovery();
    window.history.replaceState({}, "", "/app?ignored=1#/eleve/login");
  });

  it("builds a redirect without the HashRouter route", () => {
    expect(getPasswordRecoveryRedirect("eleve")).toBe(
      "http://localhost:3000/app?auth_audience=eleve",
    );
  });

  it("defaults to the student audience", () => {
    expect(getRecoveryAudience("?auth_audience=unknown")).toBe("eleve");
    expect(getLoginPath("eleve")).toBe("/eleve/login");
  });

  it("grants reset access only after an explicit recovery event", () => {
    expect(consumePasswordRecovery()).toBeNull();
    markPasswordRecovery("formateur");
    expect(consumePasswordRecovery()).toBe("formateur");
    expect(consumePasswordRecovery()).toBeNull();
  });
});
