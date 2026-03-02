<script lang="ts">
    import type { HypaModel } from "src/ts/process/memory/hypamemory";
    import OptionInput from "./OptionInput.svelte";
    import SelectInput from "./SelectInput.svelte";

    export let value: HypaModel = "MiniLM";
    export let includeOpenAI = true;
    export let includeCustom = true;
    export let className = "";
</script>

<SelectInput bind:value className={`${className} control-field`.trim()}>
    {#if 'gpu' in navigator}
        <OptionInput value="MiniLMGPU">MiniLM L6 v2 (GPU)</OptionInput>
        <OptionInput value="nomicGPU">Nomic Embed Text v1.5 (GPU)</OptionInput>
        <OptionInput value="bgeSmallEnGPU">BGE Small English (GPU)</OptionInput>
        <OptionInput value="bgeLargeEnGPU">BGE Large English (GPU)</OptionInput>
        <OptionInput value="bgem3GPU">BGE Medium 3 (GPU)</OptionInput>
        <OptionInput value="multiMiniLMGPU">Multilingual MiniLM L12 v2 (GPU)</OptionInput>
        <OptionInput value="bgeM3KoGPU">BGE Medium 3 Korean (GPU)</OptionInput>
    {/if}
    <OptionInput value="MiniLM">MiniLM L6 v2 (CPU)</OptionInput>
    <OptionInput value="nomic">Nomic Embed Text v1.5 (CPU)</OptionInput>
    <OptionInput value="bgeSmallEn">BGE Small English (CPU)</OptionInput>
    <OptionInput value="bgeLargeEn">BGE Large English (CPU)</OptionInput>
    <OptionInput value="bgem3">BGE Medium 3 (CPU)</OptionInput>
    <OptionInput value="multiMiniLM">Multilingual MiniLM L12 v2 (CPU)</OptionInput>
    <OptionInput value="bgeM3Ko">BGE Medium 3 Korean (CPU)</OptionInput>
    {#if includeOpenAI}
        <OptionInput value="openai3small">OpenAI text-embedding-3-small</OptionInput>
        <OptionInput value="openai3large">OpenAI text-embedding-3-large</OptionInput>
        <OptionInput value="ada">OpenAI Ada</OptionInput>
    {/if}
    {#if includeCustom}
        <OptionInput value="custom">Custom (OpenAI-compatible)</OptionInput>
    {/if}
</SelectInput>
