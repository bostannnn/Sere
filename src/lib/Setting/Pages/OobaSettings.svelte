<script lang="ts">
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import OptionalInput from "src/lib/UI/GUI/OptionalInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import { language } from "src/lang";
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import ChatFormatSettings from "./ChatFormatSettings.svelte";
    interface Props {
        instructionMode?: boolean;
    }

    const { instructionMode = false }: Props = $props();

    type OobaArgKey =
        | 'mode'
        | 'name1_instruct'
        | 'name2_instruct'
        | 'context_instruct'
        | 'system_message'
        | 'name1'
        | 'name2'
        | 'context'
        | 'greeting'
        | 'chat_instruct_command'
        | 'tokenizer'
        | 'min_p'
        | 'top_k'
        | 'repetition_penalty'
        | 'repetition_penalty_range'
        | 'typical_p'
        | 'tfs'
        | 'top_a'
        | 'epsilon_cutoff'
        | 'eta_cutoff'
        | 'guidance_scale'
        | 'penalty_alpha'
        | 'mirostat_mode'
        | 'mirostat_tau'
        | 'mirostat_eta'
        | 'encoder_repetition_penalty'
        | 'no_repeat_ngram_size'
        | 'min_length'
        | 'num_beams'
        | 'length_penalty'
        | 'truncation_length'
        | 'max_tokens_second'
        | 'negative_prompt'
        | 'custom_token_bans'
        | 'grammar_string'
        | 'temperature_last'
        | 'do_sample'
        | 'early_stopping'
        | 'auto_max_new_tokens'
        | 'ban_eos_token'
        | 'add_bos_token'
        | 'skip_special_tokens';

    type OobaArgs = Record<OobaArgKey, string | number | boolean> & {
        mode: string;
    };

    const defaultOobaArgs: OobaArgs = {
        mode: 'instruct',
        name1_instruct: '',
        name2_instruct: '',
        context_instruct: '',
        system_message: '',
        name1: '',
        name2: '',
        context: '',
        greeting: '',
        chat_instruct_command: '',
        tokenizer: '',
        min_p: 0,
        top_k: 0,
        repetition_penalty: 0,
        repetition_penalty_range: 0,
        typical_p: 0,
        tfs: 0,
        top_a: 0,
        epsilon_cutoff: 0,
        eta_cutoff: 0,
        guidance_scale: 0,
        penalty_alpha: 0,
        mirostat_mode: 0,
        mirostat_tau: 0,
        mirostat_eta: 0,
        encoder_repetition_penalty: 0,
        no_repeat_ngram_size: 0,
        min_length: 0,
        num_beams: 0,
        length_penalty: 0,
        truncation_length: 0,
        max_tokens_second: 0,
        negative_prompt: '',
        custom_token_bans: '',
        grammar_string: '',
        temperature_last: false,
        do_sample: false,
        early_stopping: false,
        auto_max_new_tokens: false,
        ban_eos_token: false,
        add_bos_token: false,
        skip_special_tokens: false,
    };

    function ensureOobaArgs(): OobaArgs {
        const args = DBState.db.reverseProxyOobaArgs as unknown as Record<string, string | number | boolean | undefined>;
        for (const [key, value] of Object.entries(defaultOobaArgs)) {
            if (args[key] === undefined) {
                args[key] = value;
            }
        }
        return args as OobaArgs;
    }

    const oobaArgs = $derived(ensureOobaArgs());
</script>

<Accordion name="Ooba Settings" styled className="ds-settings-section">
    {#if instructionMode}
        <ChatFormatSettings />
    {:else}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Ooba Mode</span>
            <SelectInput bind:value={oobaArgs.mode}>
                <OptionInput value="instruct">Instruct</OptionInput>
                <OptionInput value="chat">Chat</OptionInput>
                <OptionInput value="chat-instruct">Chat-Instruct</OptionInput>
            </SelectInput>
            <!-- name1 = user | name2 = bot --->

            {#if oobaArgs.mode === 'instruct'}
                <span class="ds-settings-label">user prefix</span>
                <OptionalInput bind:value={oobaArgs.name1_instruct} />
                <span class="ds-settings-label">bot prefix</span>
                <OptionalInput bind:value={oobaArgs.name2_instruct} />
                <span class="ds-settings-label">system prefix</span>
                <OptionalInput bind:value={oobaArgs.context_instruct} />
                <span class="ds-settings-label">system message</span>
                <OptionalInput bind:value={oobaArgs.system_message} />
            {/if}
            {#if oobaArgs.mode === 'chat' || oobaArgs.mode === 'chat-instruct'}
                <span class="ds-settings-label">user prefix</span>
                <OptionalInput bind:value={oobaArgs.name1} />
                <span class="ds-settings-label">bot prefix</span>
                <OptionalInput bind:value={oobaArgs.name2} />
                <span class="ds-settings-label">system prefix</span>
                <OptionalInput bind:value={oobaArgs.context} />
                <span class="ds-settings-label">start message</span>
                <OptionalInput bind:value={oobaArgs.greeting} />
            {/if}
            {#if oobaArgs.mode === 'chat-instruct'}
                <span class="ds-settings-label">chat_instruct_command</span>
                <OptionalInput bind:value={oobaArgs.chat_instruct_command} />
            {/if}
        </div>
    {/if}

    <span class="ds-settings-label">tokenizer</span>
    <OptionalInput bind:value={oobaArgs.tokenizer} />
    <span class="ds-settings-label">min_p</span>
    <OptionalInput bind:value={oobaArgs.min_p} numberMode />
    <span class="ds-settings-label">top_k</span>
    <OptionalInput bind:value={oobaArgs.top_k} numberMode />
    <span class="ds-settings-label">repetition_penalty</span>
    <OptionalInput bind:value={oobaArgs.repetition_penalty} numberMode />
    <span class="ds-settings-label">repetition_penalty_range</span>
    <OptionalInput bind:value={oobaArgs.repetition_penalty_range} numberMode />
    <span class="ds-settings-label">typical_p</span>
    <OptionalInput bind:value={oobaArgs.typical_p} numberMode />
    <span class="ds-settings-label">tfs</span>
    <OptionalInput bind:value={oobaArgs.tfs} numberMode />
    <span class="ds-settings-label">top_a</span>
    <OptionalInput bind:value={oobaArgs.top_a} numberMode />
    <span class="ds-settings-label">epsilon_cutoff</span>
    <OptionalInput bind:value={oobaArgs.epsilon_cutoff} numberMode />
    <span class="ds-settings-label">eta_cutoff</span>
    <OptionalInput bind:value={oobaArgs.eta_cutoff} numberMode />
    <span class="ds-settings-label">guidance_scale</span>
    <OptionalInput bind:value={oobaArgs.guidance_scale} numberMode />
    <span class="ds-settings-label">penalty_alpha</span>
    <OptionalInput bind:value={oobaArgs.penalty_alpha} numberMode />
    <span class="ds-settings-label">mirostat_mode</span>
    <OptionalInput bind:value={oobaArgs.mirostat_mode} numberMode />
    <span class="ds-settings-label">mirostat_tau</span>
    <OptionalInput bind:value={oobaArgs.mirostat_tau} numberMode />
    <span class="ds-settings-label">mirostat_eta</span>
    <OptionalInput bind:value={oobaArgs.mirostat_eta} numberMode />
    <span class="ds-settings-label">encoder_repetition_penalty</span>
    <OptionalInput bind:value={oobaArgs.encoder_repetition_penalty} numberMode />
    <span class="ds-settings-label">no_repeat_ngram_size</span>
    <OptionalInput bind:value={oobaArgs.no_repeat_ngram_size} numberMode />
    <span class="ds-settings-label">min_length</span>
    <OptionalInput bind:value={oobaArgs.min_length} numberMode />
    <span class="ds-settings-label">num_beams</span>
    <OptionalInput bind:value={oobaArgs.num_beams} numberMode />
    <span class="ds-settings-label">length_penalty</span>
    <OptionalInput bind:value={oobaArgs.length_penalty} numberMode />
    <span class="ds-settings-label">truncation_length</span>
    <OptionalInput bind:value={oobaArgs.truncation_length} numberMode />
    <span class="ds-settings-label">max_tokens_second</span>
    <OptionalInput bind:value={oobaArgs.max_tokens_second} numberMode />
    <span class="ds-settings-label">negative_prompt</span>
    <OptionalInput bind:value={oobaArgs.negative_prompt} />
    <span class="ds-settings-label">custom_token_bans</span>
    <OptionalInput bind:value={oobaArgs.custom_token_bans} />
    <span class="ds-settings-label">grammar_string</span>
    <OptionalInput bind:value={oobaArgs.grammar_string} />
    
    <span class="ds-settings-label">temperature_last</span>
    <OptionalInput bind:value={oobaArgs.temperature_last} boolMode />
    <span class="ds-settings-label">do_sample</span>
    <OptionalInput bind:value={oobaArgs.do_sample} boolMode />
    <span class="ds-settings-label">early_stopping</span>
    <OptionalInput bind:value={oobaArgs.early_stopping} boolMode />
    <span class="ds-settings-label">auto_max_new_tokens</span>
    <OptionalInput bind:value={oobaArgs.auto_max_new_tokens} boolMode />

    <span class="ds-settings-label">ban_eos_token</span>
    <OptionalInput bind:value={oobaArgs.ban_eos_token} boolMode />
    <span class="ds-settings-label">add_bos_token</span>
    <OptionalInput bind:value={oobaArgs.add_bos_token} boolMode />
    <span class="ds-settings-label">skip_special_tokens</span>
    <OptionalInput bind:value={oobaArgs.skip_special_tokens} boolMode />

    
    {#if instructionMode}
        <div class="ds-settings-row-center">
            <CheckInput check={!!DBState.db.localStopStrings} name={language.customStopWords} onChange={() => {
                if(!DBState.db.localStopStrings){
                    DBState.db.localStopStrings = []
                }
                else{
                    DBState.db.localStopStrings = undefined
                }
            }} />
        </div>
        {#if DBState.db.localStopStrings}
            <div class="ds-settings-section ds-settings-card panel-shell">
                <div class="ds-settings-inline-actions action-rail">
                    <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                        const localStopStrings = DBState.db.localStopStrings ?? []
                        localStopStrings.push('')
                        DBState.db.localStopStrings = localStopStrings
                    }}><PlusIcon /></Button>
                </div>
                {#each DBState.db.localStopStrings as _stopString, i (i)}
                    <div class="ds-settings-inline-actions ds-settings-inline-actions-fluid action-rail">
                        <div class="ds-settings-grow-min">
                            <TextInput bind:value={DBState.db.localStopStrings[i]} fullwidth/>
                        </div>
                        <div>
                            <Button styled="danger" size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                                const localStopStrings = DBState.db.localStopStrings ?? []
                                localStopStrings.splice(i, 1)
                                DBState.db.localStopStrings = localStopStrings
                            }}><TrashIcon /></Button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</Accordion>
