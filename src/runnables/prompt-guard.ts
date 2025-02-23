import type { CallbackManagerForChainRun } from '@langchain/core/callbacks/manager';
import type { BasePromptValueInterface } from '@langchain/core/prompt_values';
import { Runnable, type RunnableConfig } from '@langchain/core/runnables';
import { PangeaConfig, PromptGuardService } from 'pangea-node-sdk';

export class MaliciousPromptError extends Error {
  analyzer: string;

  constructor(analyzer: string) {
    super('One or more messages were detected as malicious.');
    this.name = 'MaliciousPromptError';
    this.analyzer = analyzer;
  }
}

export class PangeaPromptGuard<
  RunInput extends BasePromptValueInterface,
> extends Runnable<RunInput, RunInput> {
  static lc_name() {
    return 'PangeaPromptGuard';
  }

  lc_namespace = ['pangeacyber', 'runnables'];

  private client;

  constructor(token: string, domain = 'aws.us.pangea.cloud') {
    super();
    this.client = new PromptGuardService(token, new PangeaConfig({ domain }));
  }

  async _invoke(
    input: RunInput,
    _config?: Partial<RunnableConfig>,
    _runManager?: CallbackManagerForChainRun
  ): Promise<RunInput> {
    const messages = input.toChatMessages().map((message) => {
      const content = Array.isArray(message.content)
        ? message.content.join('')
        : message.content;

      let role = '';
      switch (message.getType()) {
        case 'human':
          role = 'user';
          break;
        case 'ai':
          role = 'assistant';
          break;
        case 'system':
          role = 'system';
          break;
        case 'function':
          role = 'function';
          break;
        case 'tool':
          role = 'tool';
          break;
        default:
          throw new TypeError(
            `Received unknown message type ${message.getType()}.`
          );
      }

      return { role, content };
    });
    const response = await this.client.guard({ messages });
    if (response.result?.detected) {
      throw new MaliciousPromptError(response.result.analyzer!);
    }

    return input;
  }

  override invoke(
    input: RunInput,
    config: Partial<RunnableConfig> = {}
  ): Promise<RunInput> {
    return this._callWithConfig(this._invoke, input, config);
  }
}
