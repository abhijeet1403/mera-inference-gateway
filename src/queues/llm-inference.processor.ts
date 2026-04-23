import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Job } from 'bullmq';
import { ChatService } from '../chat/chat.service';
import {
  InferenceJob,
  InferenceJobDocument,
} from '../inference-jobs/inference-job.schema';
import { LLM_INFERENCE_QUEUE } from './queues.constants';

interface JobData {
  jobId: string;
  requestIndex: number;
}

export interface LlmInferenceResult {
  id: string;
  ok: boolean;
}

@Processor(LLM_INFERENCE_QUEUE)
export class LlmInferenceProcessor extends WorkerHost {
  private readonly logger = new Logger(LlmInferenceProcessor.name);

  constructor(
    private readonly chat: ChatService,
    private readonly config: ConfigService,
    @InjectModel(InferenceJob.name)
    private readonly inferenceJobModel: Model<InferenceJobDocument>,
  ) {
    super();
  }

  get workerConcurrency(): number {
    return this.config.get<number>('LLM_INFERENCE_CONCURRENCY', 4);
  }

  async process(job: Job<JobData>): Promise<LlmInferenceResult> {
    const { jobId, requestIndex } = job.data;

    const doc = await this.inferenceJobModel
      .findById(new Types.ObjectId(jobId))
      .lean()
      .exec();
    if (!doc) {
      throw new Error(`Inference job ${jobId} not found`);
    }
    const request = doc.requests[requestIndex];
    if (!request) {
      throw new Error(
        `Inference job ${jobId} has no request at index ${requestIndex}`,
      );
    }

    const headers: Record<string, string> = {};
    if (doc.e2eeSession) {
      for (const [k, v] of Object.entries(doc.e2eeSession)) {
        if (typeof v === 'string') headers[k] = v;
      }
    }

    let result:
      | { id: string; ok: true; response: unknown }
      | { id: string; ok: false; error: string };

    try {
      const upstream = await this.chat.proxyChat(request.body, headers);
      if (!upstream.ok) {
        const body = await upstream.text();
        this.logger.warn(
          `jobId=${jobId} requestIndex=${requestIndex} id=${request.id} upstream ${upstream.status} body=${body.slice(0, 500)}`,
        );
        result = {
          id: request.id,
          ok: false,
          error: `upstream ${upstream.status}`,
        };
      } else {
        const json = (await upstream.json()) as unknown;
        result = { id: request.id, ok: true, response: json };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `jobId=${jobId} requestIndex=${requestIndex} id=${request.id} failed: ${msg}`,
      );
      result = { id: request.id, ok: false, error: msg };
    }

    // $push the result atomically — each child writes its own row. No read/
    // modify/write race between concurrent children. Response body lives in
    // Mongo, not in BullMQ's returnvalue.
    await this.inferenceJobModel
      .updateOne(
        { _id: new Types.ObjectId(jobId) },
        {
          $push: { results: result },
          $set: { status: 'processing' },
        },
      )
      .exec();

    return { id: result.id, ok: result.ok };
  }
}
