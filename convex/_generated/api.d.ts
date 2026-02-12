/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as hostinger from "../hostinger.js";
import type * as http from "../http.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as models from "../models.js";
import type * as orgMembers from "../orgMembers.js";
import type * as organizations from "../organizations.js";
import type * as providerCredentials from "../providerCredentials.js";
import type * as providers from "../providers.js";
import type * as seed from "../seed.js";
import type * as systemSettings from "../systemSettings.js";
import type * as users from "../users.js";
import type * as vpsInstances from "../vpsInstances.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  hostinger: typeof hostinger;
  http: typeof http;
  "lib/authorization": typeof lib_authorization;
  models: typeof models;
  orgMembers: typeof orgMembers;
  organizations: typeof organizations;
  providerCredentials: typeof providerCredentials;
  providers: typeof providers;
  seed: typeof seed;
  systemSettings: typeof systemSettings;
  users: typeof users;
  vpsInstances: typeof vpsInstances;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
