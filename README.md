# pi-steering-flags

Declarative flag-presence and flag-allowlist predicates for [pi-steering](https://github.com/cad0p/pi-steering) rules.

First official external plugin for the pi-steering ecosystem. Establishes the precedent pattern for every community plugin that follows.

## Install

```bash
pnpm add pi-steering-flags
```

`pi-steering-flags` declares `@cad0p/pi-steering` as a `peerDependency`; install both together.

## Usage

```ts
// .pi/steering/index.ts
import { defineConfig } from "@cad0p/pi-steering";
import flagsPlugin from "pi-steering-flags";

export default defineConfig({
  plugins: [flagsPlugin],
  rules: [
    // Block `aws` invocations without --profile or AWS_PROFILE env.
    {
      name: "aws-requires-profile",
      tool: "bash",
      field: "command",
      pattern: /^aws\s+[a-z]/,
      unless: /^aws\s+(sts\s+get-caller-identity|configure)\b/,
      when: {
        requiresFlag: { flag: "--profile", env: "AWS_PROFILE" },
      },
      reason: "Always specify --profile (or AWS_PROFILE=) — never rely on the default profile.",
    },
    // Default-deny flag gating for `cr`.
    {
      name: "cr-allowlisted-flags-only",
      tool: "bash",
      field: "command",
      pattern: /^cr\b/,
      when: {
        not: { infoOnly: true },
        allowlistedFlagsOnly: {
          allow: ["--all", "--description", "--reviewers"],
        },
      },
      reason:
        "Only --all, --description, --reviewers are allowed with `cr`. " +
        "Everything else should be inferred from the commit message.",
    },
  ],
});
```

## Predicates

### `when.requiresFlag`

Rule fires (command is BLOCKED) when none of the listed flag / env equivalents appear in the evaluated command.

**Shorthand**: `requiresFlag: "--profile"` is equivalent to `requiresFlag: { flag: "--profile" }`.

**Object form**:

```ts
requiresFlag: {
  flag?: string;              // one required flag
  flags?: readonly string[];  // any one of several (OR)
  env?: string;               // env-var alternative (VAR=value shell prefix)
  envs?: readonly string[];   // any one of several envs (OR)
}
```

At least one of `flag` / `flags` / `env` / `envs` must be specified. A malformed arg (empty object) does not fire — fail-open for the rule author's benefit (better than silent always-block).

**Examples**:

```ts
when: { requiresFlag: "--profile" }

when: { requiresFlag: { flag: "--profile", env: "AWS_PROFILE" } }

when: { requiresFlag: { flags: ["-n", "--namespace"] } }

when: {
  requiresFlag: {
    flag: "--region",
    envs: ["AWS_REGION", "AWS_DEFAULT_REGION"],
  },
}
```

### `when.allowlistedFlagsOnly`

Rule fires when any `-`-prefixed token is present that isn't in the allowlist.

```ts
allowlistedFlagsOnly: {
  allow: readonly string[];
  allowPrefixes?: readonly string[];
}
```

- Flags in `allow` that start with `--` automatically match their `--flag=value` attached-value form.
- Short flags (`-n`, `-h`) don't get auto-prefix — use `allowPrefixes` if you need to allow an attached-value short form (e.g. `-ofoo` via `allowPrefixes: ["-o"]`).
- Positional args (tokens not starting with `-`) are ignored.

**Example**:

```ts
when: {
  allowlistedFlagsOnly: {
    allow: ["--all", "--description", "--reviewers"],
    // Implicitly matches: --description=... and --reviewers=...
  },
}
```

### `when.infoOnly`

Rule fires when the command IS an info-only invocation — `--help` / `--version` by default. Token-level and quote-aware: a help token inside a quoted VALUE (`gh pr merge --subject "see --help"`) does NOT count, so guardrails still apply to real operations that merely mention help text. This is the replacement for the removed `INFO_ONLY` regex, which matched on the normalized string and wrongly exempted such commands.

**Shorthand**: `infoOnly: true` checks the default set. `infoOnly: false` never fires.

**Object form** (additive-only):

```ts
infoOnly: {
  extraFlags?: readonly string[];  // additional flags, checked in ADDITION to the default set
}
```

Nothing can remove the safe core. `-h` and `-v` are deliberately NOT in the default set — they are real operations in adversarial commands (`docker run -v /data:/data`, `curl -v`, `kubectl -v 8`, `psql -h host`). A plugin author who wants `-h` for their own CLI adds it via `extraFlags` and owns that security tradeoff.

**Carve-out idiom**: the `when` clause is an AND — a naive `when: { infoOnly: true }` would BLOCK on help (it requires the command to BE info-only). To ALLOW info-only invocations while everything else still evaluates, negate with `not:`:

```ts
when: { not: { infoOnly: true } }

when: { not: { infoOnly: { extraFlags: ["-h"] } } }
```

## Helpers (escape-hatch)

When the built-in predicates aren't enough, reach for these helpers inside `when.condition`:

```ts
import { getFlagValue, hasEnvAssignment, hasFlag } from "pi-steering-flags";

when: {
  condition: async (ctx) => {
    if (ctx.input.tool !== "bash") return false;
    const path = getFlagValue(ctx.input.args, "--description");
    if (path === null) return false;
    const result = await ctx.exec("test", ["-f", path], { cwd: ctx.cwd });
    return result.exitCode !== 0;
  },
}
```

- `hasFlag(args, flag)` — bare or `flag=value` form.
- `getFlagValue(args, flag)` — separated `flag value` or attached `flag=value`.
- `hasEnvAssignment(envAssignments, name)` — literal env-var name match.
- `INFO_FLAGS` — the default info-only set (`["--help", "--version"]`).
- `isInfoOnly(args, extraFlags?)` — token-level info-only detection: true when any of `INFO_FLAGS` (plus optional additive `extraFlags`) appears in `args`. Quote-aware, so `--help` inside a quoted value does NOT match; the attached form `--help=x` DOES.

All helpers are quote-aware (read `.value` before falling back to `.text`) and handle `undefined` input gracefully.

## Design

### Why a plugin, not engine core?

Flag-presence and allowlist checks are opinionated policy:
- Which flags count as equivalent (short + long + env)?
- How aggressive should default-deny be?
- What counts as a "flag" (every `-`-prefixed token, or just `--long`)?

Reasonable plugins can disagree. Keeping this logic in a plugin lets it iterate on its own release cadence without committing the engine to decisions about every CLI's conventions.

If a second unrelated plugin ends up depending on `hasFlag` / `getFlagValue` / `hasEnvAssignment`, those primitives will be promoted into pi-steering core. For v0.1.0 they stay here.

### Why `Rule.when`, not `Rule.unless`?

Both are valid slots. `Rule.when` is the canonical home for plugin-registered predicates (it's the named-lookup slot); `Rule.unless` is a regex / function slot. Predicates should live where the engine expects them.

Use `Rule.unless` for simple pattern carve-outs that shouldn't trigger predicate evaluation in the first place. For info-only carve-outs, use the `not: { infoOnly: true }` idiom instead (see `when.infoOnly`) — token-level detection beats a regex over the normalized string, which wrongly matches help text inside quoted values.

### Why two predicates instead of one?

`requiresFlag` (must-have) and `allowlistedFlagsOnly` (must-not-have-outside-list) encode opposite intents. One predicate with both modes would be denser but harder to read at the call site — the rule's intent is clearer when the predicate name matches it.

## Ecosystem discovery

Tagged with:

- `"pi-package"` — surfaces alongside every pi extension.
- `"pi-steering-package"` — surfaces specifically in pi-steering plugin listings (once a discovery page exists).

Use the same keywords in your own plugin's `package.json` for discoverability.

## License

MIT
