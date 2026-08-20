// SPDX-License-Identifier: MIT
// Part of pi-steering-flags.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Word } from "@cad0p/pi-steering";
import {
  getFlagValue,
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
