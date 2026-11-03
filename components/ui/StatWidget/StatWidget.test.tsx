import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { deltaTone, StatWidget } from "./StatWidget";

describe("StatWidget", () => {
  test("delta tone depends on whether up is good", () => {
    expect(deltaTone({ value: "+5%", direction: "up" })).toBe("success");
    expect(deltaTone({ value: "-2%", direction: "down" })).toBe("danger");
    expect(deltaTone({ value: "+3", direction: "up", upIsGood: false })).toBe("danger");
    expect(deltaTone({ value: "0", direction: "flat" })).toBe("neutral");
  });
  test("renders label, value and delta", () => {
    render(<StatWidget label="Total cashback" value="$1,531" delta={{ value: "+5.4%", direction: "up" }} />);
    expect(screen.getByText("Total cashback")).toBeInTheDocument();
    expect(screen.getByText("$1,531")).toBeInTheDocument();
    expect(screen.getByText("+5.4%").parentElement?.className).toContain("text-success");
  });
});
