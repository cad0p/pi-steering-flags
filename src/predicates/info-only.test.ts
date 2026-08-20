// SPDX-License-Identifier: MIT
// Part of pi-steering-flags.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Word } from "@cad0p/pi-steering";
import { testPredicate } from "@cad0p/pi-steering/testing";
import { infoOnly } from "./info-only.ts";

function W(value: string): Word {
  return { value, text: value, pos: 0, end: value.length } as Word;
}

describe("infoOnly", () => {
  it("fires when bare --help is present (bare true form)", async () => {
    const fires = await testPredicate(infoOnly, true, {
      input: {
        tool: "bash",
        command: "gh pr merge --help",
        basename: "gh",
        args: [W("pr"), W("merge"), W("--help")],
      },
    });
    assert.equal(fires, true);
  });

  it("fires when --version is present (bare true form)", async () => {
    const fires = await testPredicate(infoOnly, true, {
      input: {
        tool: "bash",
        command: "cr --version",
        basename: "cr",
        args: [W("--version")],
      },
    });
    assert.equal(fires, true);
  });

  it("does NOT fire when no info-only flag is present (bare true form)", async () => {
    const fires = await testPredicate(infoOnly, true, {
      input: {
        tool: "bash",
        command: "gh pr merge --squash",
        basename: "gh",
        args: [W("pr"), W("merge"), W("--squash")],
      },
    });
    assert.equal(fires, false);
  });

  it("does NOT fire when --help appears only inside a quoted VALUE (issue #13)", async () => {
    // The `--help` is a value of `--subject`, not a flag token — the
    // command is NOT info-only and must NOT be carved out.
    const fires = await testPredicate(infoOnly, true, {
      input: {
        tool: "bash",
        command: 'gh pr merge --squash --subject "see --help"',
        basename: "gh",
        args: [
          W("pr"),
          W("merge"),
          W("--squash"),
          W("--subject"),
          W("see --help"),
        ],
      },
    });
    assert.equal(fires, false);
  });

  it("fires when -h is present with extraFlags: ['-h']", async () => {
    const fires = await testPredicate(
      infoOnly,
      { extraFlags: ["-h"] },
      {
        input: {
          tool: "bash",
          command: "mycli -h",
          basename: "mycli",
          args: [W("-h")],
        },
      },
    );
    assert.equal(fires, true);
  });

  it("does NOT fire when only -v is present even with extraFlags: ['-h']", async () => {
    // `-v` is never in the default set; extra flags are additive.
    const fires = await testPredicate(
      infoOnly,
      { extraFlags: ["-h"] },
      {
        input: {
          tool: "bash",
          command: "curl -v https://example.com",
          basename: "curl",
          args: [W("-v"), W("https://example.com")],
        },
      },
    );
    assert.equal(fires, false);
  });

  it("never fires on the false form, even with info-only args present", async () => {
    const fires = await testPredicate(infoOnly, false, {
      input: {
        tool: "bash",
        command: "cr --help",
        basename: "cr",
        args: [W("--help")],
      },
    });
    assert.equal(fires, false);
  });
});
