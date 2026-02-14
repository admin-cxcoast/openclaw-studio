/**
 * Naming validation — ported from Agency-AI validation.ts
 */

export const INSTANCE_NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;
export const INSTANCE_NAME_ERROR =
  "invalid name: must match /^[a-z][a-z0-9-]{1,30}$/";

export function isValidInstanceName(name: string): boolean {
  return INSTANCE_NAME_RE.test(name);
}

/**
 * Container naming: openclaw-{orgSlug}-{instanceName}
 * Adapted from Agency-AI's `agency-agent-{name}` prefix.
 */
export function containerName(
  orgSlug: string,
  instanceName: string,
): string {
  return `openclaw-${orgSlug}-${instanceName}`;
}

/**
 * VPS config directory: /opt/openclaw-instances/{orgSlug}-{instanceName}/
 */
export function instanceDir(
  orgSlug: string,
  instanceName: string,
): string {
  return `/opt/openclaw-instances/${orgSlug}-${instanceName}`;
}
