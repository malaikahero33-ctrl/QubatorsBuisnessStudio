/**
 * Test stub for the `server-only` package.
 *
 * The real module throws unless the bundler set the `react-server` condition.
 * Vitest does not, so any test importing a module that guards itself with
 * `server-only` would fail on the guard rather than on the behaviour under
 * test.
 *
 * Aliased in vitest.config.mts. This file must stay empty of behaviour — if
 * something is added here, tests are reading code the app never runs.
 */

export {};
