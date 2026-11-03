import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Photos uploaded from a form that was never submitted.
crons.daily("delete orphaned tool photos", { hourUTC: 3, minuteUTC: 15 }, internal.images.deleteOrphans, {});

export default crons;
