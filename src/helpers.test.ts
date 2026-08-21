// SPDX-License-Identifier: MIT
// Part of pi-steering-flags.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Word } from "@cad0p/pi-steering";
import {
  getFlagValue,
  getLastFlagValue,
  hasEnvAssignment,
  hasFlag,
  INFO_FLAGS,
  isInfoOnly,
} from "./helpers.ts";

/** Minimal Word for tests — tests don't exercise the walker, just the helpers. */
function W(value: string): Word {
  return { value, text: value, pos: 0, end: value.length } as Word;
}

describe("hasFlag", () => {
  it("finds bare flag", () => {
    assert.equal(hasFlag([W("--profile"), W("dev")], "--profile"), true);
  });

  it("finds attached-value flag", () => {
    assert.equal(hasFlag([W("--profile=dev")], "--profile"), true);
  });

  it("does not confuse prefix collisions (--profile-foo vs --profile)", () => {
    assert.equal(hasFlag([W("--profile-foo")], "--profile"), false);
  });

  it("handles empty args", () => {
    assert.equal(hasFlag([], "--profile"), false);
  });

  it("handles undefined args", () => {
    assert.equal(hasFlag(undefined, "--profile"), false);
  });

  it("finds short flag", () => {
    assert.equal(hasFlag([W("-p"), W("dev")], "-p"), true);
  });

  it("does not match flag appearing as a positional value", () => {
    // `cmd --profile-unrelated --profile dev` — the first token
    // is a different flag, the second is ours.
    assert.equal(
      hasFlag(
        [W("--profile-unrelated"), W("--profile"), W("dev")],
        "--profile",
      ),
      true,
    );
  });
});

describe("getFlagValue", () => {
  it("returns value for separated form", () => {
    assert.equal(getFlagValue([W("--profile"), W("dev")], "--profile"), "dev");
  });

  it("returns value for attached form", () => {
    assert.equal(getFlagValue([W("--profile=dev")], "--profile"), "dev");
  });

  it("returns empty-string attached form as ''", () => {
    // `--profile=` is a flag with an empty attached value; callers
    // can check against `""` if they need to differentiate.
    assert.equal(getFlagValue([W("--profile=")], "--profile"), "");
  });

  it("returns null when flag is trailing (no value)", () => {
    assert.equal(getFlagValue([W("--profile")], "--profile"), null);
  });

  it("returns null when flag is absent", () => {
    assert.equal(getFlagValue([W("other")], "--profile"), null);
  });

  it("returns null when args is undefined", () => {
    assert.equal(getFlagValue(undefined, "--profile"), null);
  });

  it("returns the next token even if it looks like a flag", () => {
    // Documented behavior: callers who want strict validation
    // should post-check the return.
    assert.equal(
      getFlagValue([W("--profile"), W("--other-flag")], "--profile"),
      "--other-flag",
    );
  });
});

describe("getLastFlagValue", () => {
  it("issue #12 repro: last alias occurrence wins (--subject after -t)", () => {
    // `gh pr merge -t "see #13" --subject "closes #12"` — gh keeps
    // only the --subject value; -t and --subject are one logical flag.
    assert.equal(
      getLastFlagValue(
        [W("-t"), W("see #13"), W("--subject"), W("closes #12")],
        ["-t", "--subject"],
      ),
      "closes #12",
    );
  });

  it("issue #12 repro reversed: -t after --subject wins", () => {
    assert.equal(
      getLastFlagValue(
        [W("--subject"), W("closes #12"), W("-t"), W("see #13")],
        ["-t", "--subject"],
      ),
      "see #13",
    );
  });

  it("repeated same flag: last occurrence wins", () => {
    // Contrast pin: getFlagValue is FIRST-wins — if a future refactor
    // silently flips it to last-wins, this assertion fails and the
    // two helpers' raison d'être collapses.
    assert.equal(
      getFlagValue(
        [W("--profile"), W("a"), W("--profile"), W("b")],
        "--profile",
      ),
      "a",
    );
    assert.equal(
      getLastFlagValue(
        [W("--profile"), W("a"), W("--profile"), W("b")],
        "--profile",
      ),
      "b",
    );
  });

  it("finds an attached form during the reverse scan", () => {
    assert.equal(
      getLastFlagValue(
        [W("--subject=closes #12"), W("-t"), W("x")],
        ["-t", "--subject"],
      ),
      "x",
    );
  });

  it("mixed attached/separated across occurrences: separated-last wins", () => {
    assert.equal(
      getLastFlagValue([W("--subject=a"), W("--subject"), W("b")], "--subject"),
      "b",
    );
  });

  it("mixed attached/separated across occurrences: attached-last wins", () => {
    assert.equal(
      getLastFlagValue([W("--subject"), W("a"), W("--subject=b")], "--subject"),
      "b",
    );
  });

  it("attached-empty value wins regardless of neighbors", () => {
    assert.equal(
      getLastFlagValue([W("a"), W("--subject="), W("b")], "--subject"),
      "",
    );
    assert.equal(
      getLastFlagValue([W("a"), W("b"), W("--subject=")], "--subject"),
      "",
    );
  });

  it("attached-empty alone returns ''", () => {
    assert.equal(getLastFlagValue([W("--subject=")], "--subject"), "");
  });

  it("single-string flags arg is equivalent to the array form", () => {
    const args = [W("--profile"), W("dev")];
    assert.equal(getLastFlagValue(args, "--profile"), "dev");
    assert.equal(getLastFlagValue(args, ["--profile"]), "dev");
  });

  it("trailing flag is fail-closed: null, no fallback", () => {
    assert.equal(getLastFlagValue([W("--subject")], "--subject"), null);
    // The winning occurrence is the trailing valueless --subject;
    // NO fallback to the earlier overridden --profile dev.
    assert.equal(
      getLastFlagValue([W("--profile"), W("dev"), W("--subject")], "--subject"),
      null,
    );
  });

  it("returns null when flag is absent", () => {
    assert.equal(getLastFlagValue([W("other")], "--profile"), null);
  });

  it("returns null when args is undefined", () => {
    assert.equal(getLastFlagValue(undefined, "--profile"), null);
  });

  it("returns null when args is empty", () => {
    assert.equal(getLastFlagValue([], "--profile"), null);
  });

  it("returns the next token even if it looks like a flag (getFlagValue parity)", () => {
    assert.equal(
      getLastFlagValue([W("--profile"), W("--other")], ["--profile"]),
      "--other",
    );
  });

  it("separated form with empty next value returns null", () => {
    assert.equal(getLastFlagValue([W("--subject"), W("")], "--subject"), null);
  });

  it("does not confuse prefix collisions (--profile-unrelated vs --profile)", () => {
    assert.equal(
      getLastFlagValue(
        [W("--profile-unrelated"), W("--profile"), W("dev")],
        "--profile",
      ),
      "dev",
    );
    assert.equal(getLastFlagValue([W("--subject-extra=x")], "--subject"), null);
  });

  it("quote-awareness: reads .value, never unquotes .text", () => {
    // Migration shape: adopters of hand-rolled `.text` + unquote
    // scans get upgraded quote handling for free.
    const quoted = {
      text: '"closes #12"',
      value: "closes #12",
      pos: 0,
      end: 13,
    } as Word;
    assert.equal(
      getLastFlagValue([W("--subject"), quoted], "--subject"),
      "closes #12",
    );
  });

  it("falls back to .text when .value is undefined", () => {
    const rawOnly = {
      text: "--subject=x",
      value: undefined,
      pos: 0,
      end: 11,
    } as unknown as Word;
    assert.equal(getLastFlagValue([rawOnly], "--subject"), "x");
  });

  it("returns null on an empty alias array", () => {
    assert.equal(getLastFlagValue([W("--subject"), W("x")], []), null);
  });

  it("adjacent duplicate bare flags: next token resolves the winner", () => {
    assert.equal(
      getLastFlagValue([W("--subject"), W("--subject"), W("x")], "--subject"),
      "x",
    );
  });

  it("trailing duplicate diverges from getFlagValue (intentional)", () => {
    // `[--subject, --subject]`: the LAST occurrence is trailing-
    // valueless, so last-wins returns null — while first-wins
    // getFlagValue returns the next token "--subject" as the value.
    // Intentional per spec D3; pinned so the divergence is visible.
    const args = [W("--subject"), W("--subject")];
    assert.equal(getLastFlagValue(args, "--subject"), null);
    assert.equal(getFlagValue(args, "--subject"), "--subject");
  });
});

describe("hasEnvAssignment", () => {
  it("finds AWS_PROFILE= prefix in envAssignments", () => {
    assert.equal(hasEnvAssignment([W("AWS_PROFILE=dev")], "AWS_PROFILE"), true);
  });

  it("does not match partial variable names (AWS vs AWS_PROFILE)", () => {
    assert.equal(hasEnvAssignment([W("AWS_PROFILE=dev")], "AWS"), false);
  });

  it("finds one of several assignments", () => {
    assert.equal(
      hasEnvAssignment(
        [W("PATH=/usr/bin"), W("AWS_PROFILE=dev"), W("DEBUG=1")],
        "AWS_PROFILE",
      ),
      true,
    );
  });

  it("returns false on empty envAssignments", () => {
    assert.equal(hasEnvAssignment([], "AWS_PROFILE"), false);
  });

  it("returns false on undefined envAssignments", () => {
    assert.equal(hasEnvAssignment(undefined, "AWS_PROFILE"), false);
  });
});

describe("INFO_FLAGS", () => {
  it("is exactly the minimal safe default set (--help / --version only)", () => {
    assert.deepEqual([...INFO_FLAGS], ["--help", "--version"]);
  });

  it("does NOT include the -h / -v short forms (adversarial ops)", () => {
    const flags = INFO_FLAGS as readonly string[];
    assert.ok(!flags.includes("-h"));
    assert.ok(!flags.includes("-v"));
  });
});

describe("isInfoOnly", () => {
  it("returns true for bare --help", () => {
    assert.equal(isInfoOnly([W("--help")]), true);
  });

  it("returns true for bare --version", () => {
    assert.equal(isInfoOnly([W("--version")]), true);
  });

  it("returns false for -h (not in the default set)", () => {
    assert.equal(isInfoOnly([W("-h")]), false);
  });

  it("returns false for -v (not in the default set)", () => {
    assert.equal(isInfoOnly([W("-v")]), false);
  });

  it("does NOT match --help inside a quoted VALUE (issue #13 repro)", () => {
    // `gh pr merge --squash --subject "see --help"` — the `--help`
    // token here is a VALUE (resolved by the quote-aware walker to a
    // single `see --help` word), not a flag token. Token-level
    // detection must NOT carve it out.
    assert.equal(
      isInfoOnly([W("--squash"), W("--subject"), W("see --help")]),
      false,
    );
  });

  it("does NOT match --helpful (token equality, not substring)", () => {
    assert.equal(isInfoOnly([W("--helpful")]), false);
  });

  it("does NOT match glued short forms like -hx", () => {
    assert.equal(isInfoOnly([W("-hx")]), false);
  });

  it("matches attached-value forms --help=x AND --version=1", () => {
    // `hasFlag`'s prefix semantics treat `--help=...` / `--version=...`
    // as the same flag with an attached value.
    assert.equal(isInfoOnly([W("--help=x")]), true);
    assert.equal(isInfoOnly([W("--version=1")]), true);
  });

  it("extraFlags: ['-h'] makes -h count but -v still does NOT", () => {
    const extra = ["-h"];
    assert.equal(isInfoOnly([W("-h")], extra), true);
    assert.equal(isInfoOnly([W("-v")], extra), false);
  });

  it("returns false on undefined args", () => {
    assert.equal(isInfoOnly(undefined), false);
  });

  it("returns false on empty args", () => {
    assert.equal(isInfoOnly([]), false);
  });
});
