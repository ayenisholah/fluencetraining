import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ALL, setup, signIn, type T } from "./test.setup";

const drill = { name: "Cordless drill", category: "power_tools" as const, condition: "good" as const, description: "" };
const png = (bytes = 64) => new Blob([new Uint8Array(bytes)], { type: "image/png" });

async function upload(t: T, blob: Blob): Promise<Id<"_storage">> {
  return await t.run((ctx) => ctx.storage.store(blob));
}
const exists = (t: T, id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null);

describe("tool photos", () => {
  test("upload URLs need a signed-in user", async () => {
    const t = setup();
    await expect(t.mutation(api.tools.generateUploadUrl, {})).rejects.toThrow(/Sign in/);
    const ada = await signIn(t, "Ada");
    await expect(ada.as.mutation(api.tools.generateUploadUrl, {})).resolves.toEqual(expect.any(String));
  });

  test("a PNG attaches to a listing and the board returns its URL", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const bob = await signIn(t, "Bob");
    const imageId = await upload(t, png());
    await ada.as.mutation(api.tools.create, { ...drill, imageId });
    const [row] = (await bob.as.query(api.tools.list, ALL)).page;
    expect(row.imageUrl).toEqual(expect.stringContaining("http"));
    const [mine] = (await ada.as.query(api.tools.mine, ALL)).page;
    expect(mine.imageUrl).toBe(row.imageUrl);
    // The public list never includes photos.
    expect(Object.keys((await t.query(api.tools.listPublic, ALL)).page[0]).sort()).toEqual(["_id", "category", "name"]);
  });

  test.each([
    ["HTML", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), /JPEG, PNG or WebP/],
    [
      "SVG (can carry script)",
      new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/svg+xml" }),
      /JPEG, PNG or WebP/,
    ],
    ["over 5 MB", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" }), /5 MB/],
  ])("refuses %s", async (_name, blob, message) => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const imageId = await upload(t, blob);
    await expect(ada.as.mutation(api.tools.create, { ...drill, imageId })).rejects.toThrow(message);
  });

  test("a photo already on someone's listing can't be reused", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const eve = await signIn(t, "Eve");
    const imageId = await upload(t, png());
    await ada.as.mutation(api.tools.create, { ...drill, imageId });
    await expect(eve.as.mutation(api.tools.create, { ...drill, imageId })).rejects.toThrow(/already used/);
    const eveTool = await eve.as.mutation(api.tools.create, drill);
    await expect(eve.as.mutation(api.tools.update, { toolId: eveTool, ...drill, imageId })).rejects.toThrow(
      /already used/,
    );
  });

  test("replacing, removing, or deleting the listing deletes the old file", async () => {
    const t = setup();
    const ada = await signIn(t, "Ada");
    const first = await upload(t, png());
    const toolId = await ada.as.mutation(api.tools.create, { ...drill, imageId: first });
    // Editing other fields keeps the photo.
    await ada.as.mutation(api.tools.update, { toolId, ...drill, name: "Drill v2" });
    expect(await exists(t, first)).toBe(true);
    // Replace.
    const second = await upload(t, png());
    await ada.as.mutation(api.tools.update, { toolId, ...drill, imageId: second });
    expect(await exists(t, first)).toBe(false);
    // Remove.
    await ada.as.mutation(api.tools.update, { toolId, ...drill, removeImage: true });
    expect(await exists(t, second)).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(toolId)))?.imageId).toBeUndefined();
    // Delete listing.
    const third = await upload(t, png());
    await ada.as.mutation(api.tools.update, { toolId, ...drill, imageId: third });
    await ada.as.mutation(api.tools.remove, { toolId });
    expect(await exists(t, third)).toBe(false);
  });

  test("the daily clean-up deletes only old, unattached uploads", async () => {
    vi.useFakeTimers();
    try {
      const t = setup();
      const ada = await signIn(t, "Ada");
      const attached = await upload(t, png());
      await ada.as.mutation(api.tools.create, { ...drill, imageId: attached });
      const abandoned = await upload(t, png());
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      const fresh = await upload(t, png());
      expect(await t.mutation(internal.images.deleteOrphans, {})).toEqual({ deleted: 1 });
      expect(await exists(t, abandoned)).toBe(false);
      expect(await exists(t, attached)).toBe(true);
      expect(await exists(t, fresh)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
