// SPDX-License-Identifier: MIT
// Part of pi-steering-flags.

/**
 * Low-level helpers for inspecting `ctx.input.args` / `ctx.input.envAssignments`.
 *
 * These compose with the plugin's `requiresFlag` / `allowlistedFlagsOnly`
 * predicates and are exported for rule authors reaching for
 * `when.condition` escape-hatch logic.
 *
 * All helpers are quote-aware: they read `.value` first (the walker's
 * resolved value after quote removal) before falling back to `.text`
 * (the raw source slice).
 */

import type { Word } from "@cad0p/pi-steering";

/**
 * Read a word's resolved value with a fallback to its text form.
 * Handles both forms consistently so callers can ignore the split.
 */
function wordValue(w: Word | undefined): string {
  if (w === undefined) return "";
  return w.value ?? w.text ?? "";
}

/**
 * Read-only iteration over a Word-array that tolerates either an array
 * of Word or undefined. Hoisted so all helpers share the same empty-
 * input handling.
 */
function* iterWords(
  words: readonly Word[] | undefined,
): IterableIterator<Word> {
  if (words === undefined) return;
  for (const w of words) yield w;
}

/**
 * `true` if `args` contains `flag` as a bare token or as the key of an
 * attached-value `flag=value` token.
 *
 * Quote-aware (reads `.value` first, falls back to `.text`).
 *
 * @example
 *   hasFlag([W("--profile"), W("dev")], "--profile");    // true  (bare)
 *   hasFlag([W("--profile=dev")], "--profile");          // true  (attached)
 *   hasFlag([W("--profile-foo")], "--profile");          // false (prefix collision avoided)
 */
export function hasFlag(
  args: readonly Word[] | undefined,
  flag: string,
): boolean {
  const prefix = `${flag}=`;
  for (const w of iterWords(args)) {
    const t = wordValue(w);
    if (t === flag) return true;
    if (t.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Value associated with the LAST occurrence of any listed flag alias
 * in `args`, or `null` if the flag is absent or present-but-valueless.
 *
 * **LAST-flag-wins**: the scan runs RIGHT→LEFT, so the highest-index
 * occurrence wins — the effective value under every real argv parser.
 * This supersedes this helper's 0.1.0 form, which scanned left-to-
 * right (FIRST occurrence won, single flag only): first-wins models
 * no real parser — argparse / cobra / pflag all default to last-flag-
 * wins, and CLIs like gh collapse repeated spellings of one logical
 * flag to its final value.
 *
 * The second parameter accepts a single flag OR an alias SET
 * (`["-t", "--subject"]` — gh treats those spellings as one logical
 * flag). Aliases are OR'd at every scanned position, so the winner is
 * whichever alias occurrence comes last:
 *
 *   // gh pr merge -t "see #13" --subject "closes #12"
 *   getFlagValue([W("-t"), W("see #13"),
 *                 W("--subject"), W("closes #12")],
 *                ["-t", "--subject"]); // "closes #12"
 *
 * Recognizes two forms:
 *   - attached: `--flag=value`  → returns `"value"` (may be `""`)
 *   - separated: `--flag value` → returns the NEXT token's value
 *
 * The separated form does NOT inspect whether the next token looks
 * like a flag — some CLIs accept `--flag --next-flag` and treat
 * `--next-flag` as the value. Callers who want a strict form should
 * post-check the return value.
 *
 * Fail-closed edge: a TRAILING valueless occurrence wins over an
 * earlier valued one — `cmd -t foo --subject` returns `null`, with NO
 * fallback to the overridden `-t foo`. Real pflag rejects that command
 * line anyway.
 *
 * Matching is exact token equality or the `${flag}=` attached prefix,
 * so prefix collisions are safe (`--profile-foo` ≠ `--profile`).
 * Quote-awareness is inherited (`.value` is read before `.text`) —
 * adopters migrating from hand-rolled `.text` + `unquote` scans get
 * correct handling of quoted values for free.
 */
export function getFlagValue(
  args: readonly Word[] | undefined,
  flags: string | readonly string[],
): string | null {
  const flagSet = typeof flags === "string" ? [flags] : flags;
  const argsArr = args ?? [];
  for (let i = argsArr.length - 1; i >= 0; i--) {
    const t = wordValue(argsArr[i]);
    for (const flag of flagSet) {
      const prefix = `${flag}=`;
      if (t.startsWith(prefix)) return t.slice(prefix.length);
      if (t === flag) {
        const next = argsArr[i + 1];
        if (next === undefined) return null;
        const nextVal = wordValue(next);
        return nextVal === "" ? null : nextVal;
      }
    }
  }
  return null;
}

/**
 * `true` if `envAssignments` contains a shell env-var assignment
 * matching `name`. Shell env prefixes (`VAR=value cmd ...`) are
 * extracted by the walker into a separate slot on `ctx.input`; this
 * helper reads them directly without scanning the arg list.
 *
 * The comparison is literal on the variable name \u2014 `hasEnvAssignment`
 * does NOT match partial prefixes (e.g. `AWS_PROFILE=x` does not
 * satisfy `AWS`).
 *
 * @example
 *   // ctx.input.envAssignments for `AWS_PROFILE=dev aws s3 ls`
 *   hasEnvAssignment([W("AWS_PROFILE=dev")], "AWS_PROFILE"); // true
 *   hasEnvAssignment([W("AWS_PROFILE=dev")], "AWS");         // false
 */
export function hasEnvAssignment(
  envAssignments: readonly Word[] | undefined,
  name: string,
): boolean {
  const prefix = `${name}=`;
  for (const w of iterWords(envAssignments)) {
    const t = wordValue(w);
    if (t.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Default set of info-only flags, matching only the long forms
 * `--help` and `--version`.
 *
 * `-h` and `-v` are deliberately EXCLUDED: they are real operations
 * in adversarial commands (`docker run -v /data:/data`, `curl -v`,
 * `kubectl -v 8`, `psql -h host`), so a default info-only set must
 * never treat them as carve-outs. Add them per-CLI via
 * {@link isInfoOnly}'s `extraFlags` when a rule author owns that
 * tradeoff for their own tool.
 */
export const INFO_FLAGS = ["--help", "--version"] as const;

/**
 * `true` if `args` contains any info-only flag (token-level, quote-
 * aware). Checks the default {@link INFO_FLAGS} set plus any additive
 * `extraFlags`.
 *
 * Unlike the old `INFO_ONLY` regex, this matches on TOKENS, so a help
 * string inside a quoted VALUE (`gh pr merge --subject "see --help"`)
 * does NOT count — the token there is a value, not a flag. The
 * attached-value form `--help=x` DOES count (via {@link hasFlag}'s
 * prefix semantics), matching how real CLIs parse it.
 *
 * @example
 *   isInfoOnly([W("--help")]);                    // true
 *   isInfoOnly([W("see --help")]);                // false (a value)
 *   isInfoOnly([W("-v")]);                        // false (not in default set)
 *   isInfoOnly([W("-v")], ["-v"]);               // true  (additive extra)
 */
export function isInfoOnly(
  args: readonly Word[] | undefined,
  extraFlags?: readonly string[],
): boolean {
  const flags = [...INFO_FLAGS, ...(extraFlags ?? [])];
  return flags.some((f) => hasFlag(args, f));
}
