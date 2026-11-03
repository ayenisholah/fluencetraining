import axe from "axe-core";

/**
 * Runs axe-core against rendered markup. Colour contrast is skipped because
 * jsdom doesn't compute styles; scripts/contrast-check.mjs and the Storybook
 * a11y addon cover it.
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}
