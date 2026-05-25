import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { getTrackSettingsSummary } from "../track-options.js";
import { parseServerConfig } from "./config.js";
import { JobManager } from "./jobs.js";
import { createPixelsPreview } from "./previews.js";
import { createSafePathResolver } from "./safe-path.js";
import { UiSettingsStore, type PersistedUiSettings } from "./ui-settings.js";
import { getLayoutFile, listLayoutFiles, listVideos } from "./videos.js";

const startServer = async (): Promise<void> => {
  const config = parseServerConfig(process.argv.slice(2));
  const videoPathResolver = await createSafePathResolver(config.videoRoot);
  const outputPathResolver = await createSafePathResolver(config.outputRoot);
  const layoutPathResolver = await createSafePathResolver(config.layoutRoot);

  await mkdir(videoPathResolver.rootDirectory, { recursive: true });
  await mkdir(outputPathResolver.rootDirectory, { recursive: true });

  const uiSettingsStore = new UiSettingsStore(config.settingsPath);
  const jobManager = new JobManager({
    videoPathResolver,
    outputPathResolver,
    layoutPathResolver
  });

  const server = Fastify({
    logger: true
  });

  server.get("/api/health", async () => {
    return { ok: true };
  });

  server.get("/api/settings", async () => {
    return getTrackSettingsSummary();
  });

  server.get("/api/ui-settings", async () => {
    return uiSettingsStore.read();
  });

  server.put<{ Body: PersistedUiSettings }>("/api/ui-settings", async (request, reply) => {
    try {
      return await uiSettingsStore.write(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Invalid UI settings."
      });
    }
  });

  server.get("/api/videos", async () => {
    return {
      videos: await listVideos(videoPathResolver)
    };
  });

  server.get("/api/layouts", async () => {
    return {
      layouts: await listLayoutFiles(layoutPathResolver)
    };
  });

  server.get<{ Params: { layoutFileName: string } }>("/api/layouts/:layoutFileName", async (request, reply) => {
    try {
      return await getLayoutFile(layoutPathResolver, request.params.layoutFileName);
    } catch (error) {
      return reply.status(404).send({
        error: error instanceof Error ? error.message : "Layout file not found."
      });
    }
  });

  server.get("/api/jobs", async () => {
    return {
      jobs: jobManager.listJobs()
    };
  });

  server.get<{ Params: { jobId: string } }>("/api/jobs/:jobId", async (request, reply) => {
    const job = jobManager.getJob(request.params.jobId);

    if (job === undefined) {
      return reply.status(404).send({ error: "Job not found." });
    }

    return job;
  });

  server.post<{ Body: { videoId?: string; settings?: Record<string, unknown> } }>(
    "/api/jobs",
    async (request, reply) => {
      const videoId = request.body.videoId;
      const settings = request.body.settings;

      if (typeof videoId !== "string" || videoId.length === 0) {
        return reply.status(400).send({ error: "videoId is required." });
      }

      if (settings === undefined || typeof settings !== "object") {
        return reply.status(400).send({ error: "settings object is required." });
      }

      try {
        const job = await jobManager.createJob({
          videoId,
          settings
        });

        return reply.status(202).send(job);
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : "Invalid job request."
        });
      }
    }
  );

  server.post<{
    Body: {
      videoId?: string;
      previewSeconds?: number;
      settings?: Record<string, unknown>;
    };
  }>("/api/previews/pixels", async (request, reply) => {
    const videoId = request.body.videoId;
    const previewSeconds = request.body.previewSeconds;
    const settings = request.body.settings;

    if (typeof videoId !== "string" || videoId.length === 0) {
      return reply.status(400).send({ error: "videoId is required." });
    }

    if (typeof previewSeconds !== "number" || !Number.isFinite(previewSeconds) || previewSeconds < 0) {
      return reply.status(400).send({ error: "previewSeconds must be a non-negative number." });
    }

    if (settings === undefined || typeof settings !== "object") {
      return reply.status(400).send({ error: "settings object is required." });
    }

    try {
      return await createPixelsPreview(
        {
          videoPathResolver,
          outputPathResolver,
          layoutPathResolver
        },
        {
          videoId,
          previewSeconds,
          settings
        }
      );
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Could not create pixels preview."
      });
    }
  });

  await server.register(fastifyStatic, {
    root: videoPathResolver.rootDirectory,
    prefix: "/media/",
    decorateReply: false
  });

  await server.register(fastifyStatic, {
    root: outputPathResolver.rootDirectory,
    prefix: "/outputs/",
    decorateReply: false
  });

  const webRootDirectory = join(process.cwd(), "dist-web");

  await server.register(fastifyStatic, {
    root: webRootDirectory,
    prefix: "/",
    decorateReply: false
  });

  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/") || request.url.startsWith("/media/") || request.url.startsWith("/outputs/")) {
      return reply.status(404).send({ error: "Not found." });
    }

    return reply.sendFile("index.html", webRootDirectory);
  });

  await server.listen({
    host: config.host,
    port: config.port
  });

  console.log(`Video root: ${videoPathResolver.rootDirectory}`);
  console.log(`Output root: ${outputPathResolver.rootDirectory}`);
  console.log(`UI settings: ${config.settingsPath}`);
  console.log(`Server listening on http://${config.host}:${config.port}`);
};

startServer().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
