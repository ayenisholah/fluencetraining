import { execFileSync } from "node:child_process";
import { beforeEach, describe, expect, test, vi } from "vitest";
import guard from "../e2e/mail-provider-guard";
import config from "../playwright.config";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe("email-provider guard", () => {
  test("permits Mailpit", () => {
    vi.mocked(execFileSync).mockReturnValue("mailpit\n");
    expect(() => guard()).not.toThrow();
  });
  test.each(["ses", "importing", "", "unknown"])("rejects provider %j", (provider) => {
    vi.mocked(execFileSync).mockReturnValue(provider);
    expect(() => guard()).toThrow("E2E tests require Mailpit");
  });
  test("fails closed when Docker or the marker is missing", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => guard()).toThrow("Cannot verify local email provider");
  });
  test("only suites that can send notifications depend on the provider check", () => {
    expect(config.globalSetup).toBeUndefined();
    const projects = config.projects!;
    const dependencies = (name: string): string[] => {
      const direct = projects.find((project) => project.name === name)?.dependencies ?? [];
      return [...direct, ...direct.flatMap(dependencies)];
    };
    for (const name of ["public", "public-mobile"]) {
      expect(dependencies(name)).not.toContain("mail-provider-setup");
    }
    for (const project of projects.filter((p) => !p.name!.startsWith("public") && p.name !== "mail-provider-setup")) {
      expect(dependencies(project.name!)).toContain("mail-provider-setup");
    }
  });
});
