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
import type * as deployments from "../deployments.js";
import type * as documents from "../documents.js";
import type * as gatewayInstances from "../gatewayInstances.js";
import type * as hostinger from "../hostinger.js";
import type * as http from "../http.js";
import type * as instanceSkills from "../instanceSkills.js";
import type * as knowledge from "../knowledge.js";
import type * as knowledgeProposals from "../knowledgeProposals.js";
import type * as lib_authorization from "../lib/authorization.js";
import type * as lib_modelCatalog from "../lib/modelCatalog.js";
import type * as migrations_migrateVpsToGatewayInstances from "../migrations/migrateVpsToGatewayInstances.js";
import type * as models from "../models.js";
import type * as orgMembers from "../orgMembers.js";
import type * as orgVpsAccess from "../orgVpsAccess.js";
import type * as organizations from "../organizations.js";
import type * as providerCredentials from "../providerCredentials.js";
import type * as providers from "../providers.js";
import type * as seed from "../seed.js";
import type * as sessionContext from "../sessionContext.js";
import type * as skills from "../skills.js";
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
  deployments: typeof deployments;
  documents: typeof documents;
  gatewayInstances: typeof gatewayInstances;
  hostinger: typeof hostinger;
  http: typeof http;
  instanceSkills: typeof instanceSkills;
  knowledge: typeof knowledge;
  knowledgeProposals: typeof knowledgeProposals;
  "lib/authorization": typeof lib_authorization;
  "lib/modelCatalog": typeof lib_modelCatalog;
  "migrations/migrateVpsToGatewayInstances": typeof migrations_migrateVpsToGatewayInstances;
  models: typeof models;
  orgMembers: typeof orgMembers;
  orgVpsAccess: typeof orgVpsAccess;
  organizations: typeof organizations;
  providerCredentials: typeof providerCredentials;
  providers: typeof providers;
  seed: typeof seed;
  sessionContext: typeof sessionContext;
  skills: typeof skills;
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
