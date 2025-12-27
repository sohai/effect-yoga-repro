/**
 * Application entry point - matching shopen-graphql architecture.
 *
 * Key points:
 * 1. Layer composition with dependency order (right to left)
 * 2. Layer.launch keeps the app running
 * 3. BunRuntime.runMain for proper Bun integration
 */

import { BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Logger, LogLevel } from "effect";
import { ConnectRpcTransportService } from "./grpc/ConnectRpcService";
import { DataLoaderConfigService } from "./grpc/DataLoaderConfig";
import { YogaApp } from "./yoga-app";
import { AccessTokenBasedServices } from "./context";

// Graceful shutdown handlers
process.on("SIGTERM", () => {
	console.info("[effect-yoga-repro] Received SIGTERM, shutting down...");
	process.exit(0);
});

process.on("SIGINT", () => {
	console.info("[effect-yoga-repro] Received SIGINT, shutting down...");
	process.exit(0);
});

// Provide services in dependency order (right to left)
const AppLayer = YogaApp.Default.pipe(
	Layer.provide(AccessTokenBasedServices.Default),
	Layer.provide(ConnectRpcTransportService.Default),
	Layer.provide(DataLoaderConfigService.Default),
);

// Add logging
const AppWithLogging = AppLayer.pipe(
	Layer.provide(Logger.minimumLogLevel(LogLevel.Info)),
);

// Launch the app - Layer.launch keeps it running
Layer.launch(AppWithLogging).pipe(Effect.scoped, BunRuntime.runMain);
