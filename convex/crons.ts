import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Photos uploaded from a form that was never submitted.
crons.daily("delete orphaned tool photos", { hourUTC: 3, minuteUTC: 15 }, internal.images.deleteOrphans, {});

// Automation history older than 90 days (privacy page, "How long we keep data").
crons.daily("purge old automation history", { hourUTC: 3, minuteUTC: 30 }, internal.automation.purgeOld, {});

export default crons;
