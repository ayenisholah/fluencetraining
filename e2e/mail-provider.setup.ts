import { test as setup } from "@playwright/test";
import guard from "./mail-provider-guard";

setup("require Mailpit before tests that can send notifications", () => {
  guard();
});
