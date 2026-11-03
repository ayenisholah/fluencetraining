import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";
import { contrastRatio, toHex } from "@/lib/contrast";

const meta = { title: "Foundations", parameters: { layout: "fullscreen" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const scale = ["0", "100", "200", "300", "400", "500", "600", "700", "800", "900", "1000", "1100"];
const accents = ["blue", "green", "emerald", "yellow", "orange", "red", "pink", "fuchsia", "violet", "indigo", "sky"];
const semantic: [string, string][] = [
  ["fg", "surface"], ["fg-muted", "surface"], ["brand-fg", "surface"], ["on-brand", "brand"],
  ["on-dim", "dim"], ["field-placeholder", "field-bg"], ["danger", "danger-soft"],
  ["success", "success-soft"], ["warning", "warning-soft"], ["info", "info-soft"],
];

function useToken(name: string) {
  const [value, setValue] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads computed CSS after mount
    setValue(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim());
  }, [name]);
  return value;
}

function Swatch({ name }: { name: string }) {
  const value = useToken(name);
  return (
    <figure className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-sm border border-line" style={{ background: `var(--${name})` }} />
      <figcaption className="text-description">
        <span className="block font-semibold text-fg">--{name}</span>
        <span className="text-fg-muted">{value}</span>
      </figcaption>
    </figure>
  );
}

function Pair({ fg, bg }: { fg: string; bg: string }) {
  const [ratio, setRatio] = useState<number>();
  useEffect(() => {
    const resolve = (n: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--${n})`;
      document.body.appendChild(probe);
      const c = toHex(getComputedStyle(probe).color);
      probe.remove();
      return c;
    };
    const a = resolve(fg);
    const b = resolve(bg);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads computed CSS after mount
    if (a && b) setRatio(contrastRatio(a, b));
  }, [fg, bg]);
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm px-4 py-3" style={{ background: `var(--${bg})`, color: `var(--${fg})` }}>
      <span className="text-body-bold">
        {fg} on {bg}
      </span>
      <span className="text-description font-semibold tabular-nums">{ratio ? `${ratio.toFixed(2)}:1` : "…"}</span>
    </div>
  );
}

export const Colors: Story = {
  render: () => (
    <div className="space-y-8 p-6">
      <section>
        <h2 className="mb-3 text-h6">Brand and state</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Swatch name="brand-1" />
          <Swatch name="state-focus" />
          <Swatch name="focus-ring" />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-h6">Neutrals (swap per theme)</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {scale.map((s) => <Swatch key={s} name={`neutral-${s}`} />)}
          <Swatch name="neutral-bg" />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-h6">Accents</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {accents.map((a) => <Swatch key={a} name={`accent-${a}`} />)}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-h6">Semantic pairs and contrast</h2>
        <p className="mb-3 text-body text-fg-muted">
          Components use these aliases. Where a Figma value failed WCAG AA, only the alias was adjusted.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {semantic.map(([fg, bg]) => <Pair key={`${fg}-${bg}`} fg={fg} bg={bg} />)}
        </div>
      </section>
    </div>
  ),
};

const type: [string, string][] = [
  ["text-h1", "h1 · 40/60 · 700"], ["text-h2", "h2 · 32/39 · 800"], ["text-h4", "h4 · 28/34 · 600"],
  ["text-h5", "h5 · 24/30 · 700"], ["text-h6", "h6 · 20/24 · 600"], ["text-h7", "h7 · 18/22 · 700"],
  ["text-subtitle", "subtitle · 16/16 · 500"], ["text-subtitle-semibold", "subtitle-semibold · 16/20 · 600"],
  ["text-body", "text · 14 · 400"], ["text-body-bold", "text-bold · 14 · 600"],
  ["text-button-label", "button-label · 16/16 · 700"], ["text-mini-button-label", "mini-button-label · 14/20 · 600"],
  ["text-description", "description · 12/16 · 400"], ["text-mini-description uppercase", "mini-description · 9/11"],
];

export const Typography: Story = {
  render: () => (
    <div className="space-y-4 p-6">
      {type.map(([cls, label]) => (
        <div key={cls} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line pb-3">
          <span className="w-56 shrink-0 text-description text-fg-muted">{label}</span>
          <span className={cls}>Borrow what you need</span>
        </div>
      ))}
    </div>
  ),
};

export const RadiusAndFocus: Story = {
  name: "Radius and focus",
  render: () => (
    <div className="flex flex-wrap gap-6 p-6">
      {["sm", "md", "lg", "pill"].map((r) => (
        <div key={r} className="text-center text-description text-fg-muted">
          <div className={`mb-2 size-20 border border-line-strong bg-surface rounded-${r}`} />
          radius-{r}
        </div>
      ))}
      <div className="text-center text-description text-fg-muted">
        <div className="mb-2 size-20 rounded-lg bg-surface ring-4 ring-focus-ring" />
        focus ring
      </div>
    </div>
  ),
};
