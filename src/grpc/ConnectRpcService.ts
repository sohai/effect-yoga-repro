/**
 * Simplified ConnectRpcService matching shopen-graphql architecture.
 *
 * Key point: RequestContext is read at BUILD TIME (yield* RequestContext)
 * This means the layer must be rebuilt per-request to get fresh auth tokens.
 */

import { Effect, Layer } from "effect";
import { RequestContext } from "./AuthContext";

// Simulated gRPC transport (would be created at startup in real app)
export class ConnectRpcTransportService extends Effect.Service<ConnectRpcTransportService>()(
	"ConnectRpcTransportService",
	{
		effect: Effect.succeed({
			productClient: {
				getProductsByIds: async (
					ids: string[],
					opts: { headers: Record<string, string>; signal: AbortSignal },
				) => {
					console.log(
						`[gRPC] getProductsByIds([${ids.join(",")}]) with token="${opts.headers.accessToken}"`,
					);
					return ids.map((id) => ({ id, name: `Product ${id}` }));
				},
			},
		}),
	},
) {}

// Main RPC service - reads RequestContext at BUILD TIME
export class ConnectRpcService extends Effect.Service<ConnectRpcService>()(
	"ConnectRpcService",
	{
		effect: Effect.gen(function* () {
			const transport = yield* ConnectRpcTransportService;
			// KEY: RequestContext is read at BUILD TIME
			const requestContext = yield* RequestContext;

			return {
				product: {
					getProducts: (ids: string[]) =>
						Effect.tryPromise({
							try: (signal) =>
								transport.productClient.getProductsByIds(ids, {
									headers: { accessToken: requestContext.accessToken },
									signal: signal,
								}),
							catch: (e) => e as Error,
						}),
				},
			};
		}),
	},
) {
	// Static method to create layer with request context - CALLED PER REQUEST
	static MakeWithRequestContext = ({
		accessToken
	}: {
		accessToken: string;
	}) => {
		return Layer.provide(
			ConnectRpcService.Default,
			Layer.succeed(RequestContext, { accessToken }),
		);
	};
}
