#!/usr/bin/env node
// Runs a phase's Playwright verification against `vite preview`:
//
//   node scripts/verify/run.cjs --phase p0
//   node scripts/verify/run.cjs p1 --engines webkit --widths 360 --themes dark
//   node scripts/verify/run.cjs --phase p0 --build   (rebuild dist first)
//
// It prints PASS / FAIL / KNOWN lines, saves screenshots to
// verify-output/<phase>/ and exits 1 on any FAIL. See harness.cjs.
const { run } = require("./harness.cjs");

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const list = (name, parse = String) => option(name)?.split(",").map(parse);
const phase =
  option("phase") ?? args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!phase || !/^p\d$/.test(phase)) {
  console.error("usage: node scripts/verify/run.cjs --phase <p0|p1|…|p6> [--engines chromium,webkit] [--widths 360,390,1100] [--themes light,dark] [--build]");
  process.exit(2);
}

run({
  phase,
  engines: list("engines"),
  widths: list("widths", Number),
  themes: list("themes"),
  build: args.includes("--build"),
}).then(
  (ok) => process.exit(ok ? 0 : 1),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
