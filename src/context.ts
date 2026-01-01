import { Effect, Layer, ManagedRuntime, LayerMap, Duration } from "effect";
import type { YogaInitialContext } from "graphql-yoga";
import {
	ConnectRpcService,
	ConnectRpcTransportService,
} from "./grpc/ConnectRpcService";
import { DataLoaderConfigService } from "./grpc/DataLoaderConfig";
import { ProductService } from "./grpc/ProductService";
import { RequestContext } from "./grpc/AuthContext";

export type RuntimeContext = ConnectRpcService | ProductService | DataLoaderConfigService;

export class AccessTokenBasedServices extends LayerMap.Service<AccessTokenBasedServices>()("AccessTokenBasedServices", {
	idleTimeToLive: Duration.millis(1000), // how much time the resource is kept alive after not being in use anymore
	lookup: (accessToken: string) => ProductService.Default.pipe( // here we construct a layer that provides all of the services that are based upon the access token (aka per tenant)
		Layer.provideMerge(
			ConnectRpcService.MakeWithRequestContext({
				accessToken: accessToken || ""
			})
		),
		Layer.provideMerge(Layer.succeed(RequestContext, { accessToken: accessToken || "" }))
	)
}){}

export type GraphQLContext = YogaInitialContext & {
	runPromise: <A, E>(effect: Effect.Effect<A, E, RuntimeContext>) => Promise<A>;
};
