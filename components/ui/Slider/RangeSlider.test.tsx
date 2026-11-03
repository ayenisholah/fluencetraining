import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { clampRange, RangeSlider } from "./RangeSlider";

describe("clampRange", () => {
  test("keeps values in bounds and ordered", () => {
    expect(clampRange([-5, 200], 0, 100, 0)).toEqual([0, 100]);
    expect(clampRange([60, 40], 0, 100, 0)).toEqual([40, 40]);
    expect(clampRange([60, 40], 0, 100, 1)).toEqual([60, 60]);
  });
});

function Harness() {
  const [value, setValue] = useState<[number, number]>([14, 83]);
  return <RangeSlider label="Price" min={0} max={100} value={value} onChange={setValue} />;
}

describe("RangeSlider", () => {
  test("two labelled thumbs that can't cross", () => {
    render(<Harness />);
    const lo = screen.getByRole("slider", { name: "Price: minimum" });
    const hi = screen.getByRole("slider", { name: "Price: maximum" });
    expect(lo).toHaveValue("14");
    fireEvent.change(lo, { target: { value: "90" } });
    expect(lo).toHaveValue("83");
    fireEvent.change(hi, { target: { value: "50" } });
    expect(hi).toHaveValue("83");
    expect(screen.getByRole("group", { name: "Price" })).toBeInTheDocument();
  });
});
