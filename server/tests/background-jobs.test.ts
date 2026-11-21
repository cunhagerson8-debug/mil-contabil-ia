import assert from "node:assert/strict";
import { test } from "node:test";
import {
  areBackgroundJobsDisabled,
  startBackgroundJobsIfEnabled,
} from "../src/config/background-jobs.js";

test("DISABLE_BACKGROUND_JOBS suppresses or starts the jobs according to its value", () => {
  let starts = 0;
  const start = () => { starts += 1; };

  startBackgroundJobsIfEnabled(areBackgroundJobsDisabled("true"), start);
  assert.equal(starts, 0);

  startBackgroundJobsIfEnabled(areBackgroundJobsDisabled("false"), start);
  assert.equal(starts, 1);

  startBackgroundJobsIfEnabled(areBackgroundJobsDisabled(undefined), start);
  assert.equal(starts, 2);
});
