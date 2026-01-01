/**
 * YogaApp Effect Service - matching shopen-graphql architecture.
 *
 * Key points:
 * 1. YogaApp is an Effect.Service with scoped lifecycle
 * 2. Dependencies (ConnectRpcTransportService, DataLoaderConfigService) are yielded
 * 3. Bun.serve is managed with acquireRelease for graceful shutdown
 */

import type { Plugin, YogaInitialContext } from "graphql-yoga";
import { createYoga, useExecutionCancellation } from "graphql-yoga";
import { Config, Effect, Layer, Runtime } from "effect";
import { AccessTokenBasedServices, RuntimeContext, type GraphQLContext } from "./context";
import { DataLoaderConfigService } from "./grpc/DataLoaderConfig";
import { schema } from "./schema";

export type { GraphQLContext };


const GraphqlConfig = Config.all({
	port: Config.integer("GRAPHQL_PORT").pipe(Config.withDefault(4000)),
	host: Config.string("GRAPHQL_HOST").pipe(Config.withDefault("0.0.0.0")),
	endpoint: Config.string("GRAPHQL_ENDPOINT").pipe(
		Config.withDefault("/graphql"),
	),
});

export class YogaApp extends Effect.Service<YogaApp>()("YogaApp", {
	scoped: Effect.gen(function* () {
		const config = yield* GraphqlConfig;
		const runtime = yield* Effect.runtime<DataLoaderConfigService | AccessTokenBasedServices>()

		const yoga = createYoga({
			schema,
			maskedErrors: false,
			context: async (initialContext: YogaInitialContext): Promise<GraphQLContext> => {
				const authHeader = initialContext.request.headers.get("authorization") ?? "";
				const accessToken = authHeader.replace("Bearer ", "");
		
				console.log(`\n[Context] Creating context for request with token="${accessToken}"`);		
				
		
				const runPromise = <A, E>(effect: Effect.Effect<A, E, RuntimeContext>) => {
					// Effect.provide should'nt be generally used more than 1 time in your entire application, UNLESS, you use a LayerMap
					return Runtime.runPromise(runtime, effect.pipe(Effect.provide(AccessTokenBasedServices.get(accessToken))));
				};
		
				return {
					...initialContext,
					runPromise
				};
			},
			graphqlEndpoint: config.endpoint,
			plugins: [useExecutionCancellation()],
		});

		yield* Effect.logInfo(
			`GraphQL server starting...\nListening on http://${
				config.host === "0.0.0.0" ? "localhost" : config.host
			}:${config.port}`,
		);

		// Bun.serve with acquireRelease for graceful shutdown
		yield* Effect.acquireRelease(
			Effect.sync(() =>
				Bun.serve({
					port: config.port,
					hostname: config.host,
					idleTimeout: 13,
					fetch: yoga,
				}),
			),
			(server) => Effect.sync(() => server.stop()),
		);

		yield* Effect.logInfo(
			`Server ready at http://${config.host}:${config.port}${config.endpoint}`,
		);

		return { yoga } as const;
	}),
}) {}
