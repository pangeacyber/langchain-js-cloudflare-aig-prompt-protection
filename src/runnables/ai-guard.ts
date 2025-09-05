import type { CallbackManagerForChainRun } from '@langchain/core/callbacks/manager';
import { HumanMessage } from '@langchain/core/messages';
import type { BasePromptValueInterface } from '@langchain/core/prompt_values';
import { Runnable, type RunnableConfig } from '@langchain/core/runnables';
import { AIGuardService, PangeaConfig } from 'pangea-node-sdk';

export class PangeaAiGuardRunnable<
  RunInput extends BasePromptValueInterface,
> extends Runnable<RunInput, RunInput> {
  static lc_name() {
    return 'PangeaAiGuardRunnable';
  }

  lc_namespace = ['pangeacyber', 'runnables'];

  private readonly client;

  constructor(token: string, domain = 'aws.us.pangea.cloud') {
    super();
    this.client = new AIGuardService(token, new PangeaConfig({ domain }));
  }

  async _invoke(
    input: RunInput,
    _config?: Partial<RunnableConfig>,
    _runManager?: CallbackManagerForChainRun
  ): Promise<RunInput> {
    // Retrieve latest human message.
    const messages = input.toChatMessages();
    const humanMessages = messages.filter((m) => m instanceof HumanMessage);
    const latestHumanMessage = humanMessages.pop();
    if (!latestHumanMessage) {
      return input;
    }

    const text = latestHumanMessage.content as string;
    if (!text) {
      return input;
    }

    // Run it through AI Guard.
    const redacted = await this.client.guardText({ text });
    if (!redacted.result) {
      throw new Error('Failed to guard text.');
    }

    if (redacted.result.prompt_text) {
      latestHumanMessage.content = redacted.result.prompt_text;
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
