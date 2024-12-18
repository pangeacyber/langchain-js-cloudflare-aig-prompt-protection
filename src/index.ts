import { CloudflareWorkersAI } from '@langchain/cloudflare';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { PangeaAiGuardRunnable } from './runnables/ai-guard';
import {
  MaliciousPromptError,
  PangeaPromptGuard,
} from './runnables/prompt-guard';

const prompt = ChatPromptTemplate.fromMessages([
  HumanMessagePromptTemplate.fromTemplate('{input}'),
]);

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    if (!env.CLOUDFLARE_ACCOUNT_ID) {
      console.warn(
        'Missing `CLOUDFLARE_ACCOUNT_ID` environment variable. LLM call will not work.'
      );
    }

    if (!env.CLOUDFLARE_API_TOKEN) {
      console.warn(
        'Missing `CLOUDFLARE_API_TOKEN` environment variable. LLM call will not work.'
      );
    }

    let input: string | null = null;
    try {
      input = await request.json();
    } catch (_) {
      return Response.json(
        {
          detail: 'Invalid or malformed JSON input.',
        },
        { status: 400 }
      );
    }

    if (typeof input !== 'string') {
      return Response.json(
        {
          detail: 'Input must be a string.',
        },
        { status: 400 }
      );
    }

    const model = new CloudflareWorkersAI({
      model: '@cf/meta/llama-2-7b-chat-int8',
      cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    });
    const chain = RunnableSequence.from([
      prompt,
      new PangeaAiGuardRunnable(env.PANGEA_AI_GUARD_TOKEN, env.PANGEA_DOMAIN),
      new PangeaPromptGuard(env.PANGEA_PROMPT_GUARD_TOKEN, env.PANGEA_DOMAIN),
      model,
      new StringOutputParser(),
    ]);

    try {
      return new Response(await chain.invoke({ input }));
    } catch (error) {
      if (error instanceof MaliciousPromptError) {
        return Response.json({
          detail: 'The prompt was detected as malicious.',
          parameters: [{ name: 'detector', value: error.detector }],
        });
      }

      return Response.json(
        { detail: 'Service is unavailable.' },
        { status: 503 }
      );
    }
  },
} satisfies ExportedHandler<Env>;
