import type { OpenAIChat } from "./index.svelte";
import { getUserName } from "../util";
const stringlizeLog = (..._args: unknown[]) => {};

export function multiChatReplacer(){

}

export function stringlizeChat(formated:OpenAIChat[], char:string, continued:boolean){
    const resultString:string[] = []
    for(const form of formated){
        if(form.memo?.startsWith('inlayImage')){
            continue
        }
        if(form.role === 'system'){
            resultString.push("system: " + form.content)
        }
        else if(form.name){
            resultString.push(form.name + ": " + form.content)
        }
        else{
            resultString.push(form.content)
        }
    }
    let res = resultString.join('\n\n')

    if(!continued){
        res += `\n\n${char}:`
    }
    return res
}

export function unstringlizeChat(text:string, formated:OpenAIChat[], char:string = ''){
    let minIndex = -1

    const chunks = getUnstringlizerChunks(formated, char).chunks


    for(const chunk of chunks){
        const ind = text.indexOf(chunk)
        if(ind === -1){
            continue
        }
        if(minIndex === -1 || minIndex > ind){
            minIndex = ind
        }
    }

    if(minIndex !== -1){
        text = text.substring(0, minIndex).trim()
    }

    return text
}

export function getUnstringlizerChunks(formated:OpenAIChat[], char:string, mode:'ain'|'normal' = 'normal'){
    const chunks:string[] = ["system note:", "system:","system note：", "system："]
    const charNames:string[] = []
    if(char){
        charNames.push(char)
        if(mode === 'ain'){
            chunks.push(`${char} `)
            chunks.push(`${char}\u3000`)
        }
        else{
            chunks.push(`${char}:`)
            chunks.push(`${char}：`)
            chunks.push(`${char}: `)
            chunks.push(`${char}： `) 
        }
    }
    if(getUserName()){
        charNames.push(getUserName())
        if(mode === 'ain'){
            chunks.push(`${getUserName()} `)
            chunks.push(`${getUserName()}\u3000`)
        }
        else{
            chunks.push(`${getUserName()}:`)
            chunks.push(`${getUserName()}：`)
            chunks.push(`${getUserName()}: `)
            chunks.push(`${getUserName()}： `) 
        }
    }

    for(const form of formated){
        if(form.name){
            charNames.push(form.name)
            if(mode === 'ain'){
                if(!chunks.includes(`${form.name} `)){
                    chunks.push(`${form.name} `)
                    chunks.push(`${form.name}\u3000`)
                }
            }
            else{
                if(!chunks.includes(`${form.name}:`)){
                    chunks.push(`${form.name}:`)
                    chunks.push(`${form.name}：`)
                    chunks.push(`${form.name}: `)
                    chunks.push(`${form.name}： `) 
                }
            }
        }
    }
    return {chunks,extChunk:charNames.concat(chunks)}
}

export function stringlizeAINChat(formated:OpenAIChat[], char:string, continued: boolean){
    const resultString:string[] = []

    for(const form of formated){
        stringlizeLog(form)
        if(form.memo && form.memo.startsWith("newChat") || form.content === "[Start a new chat]"){
            resultString.push("[新しいチャットの始まり]")
            continue
        }
        if(form.role === 'system'){
            resultString.push(form.content)
        }
        else if(form.role === 'user'){
            resultString.push(...formatToAIN(getUserName(), form.content))
        }
        else if(form.name || form.role === 'assistant'){
            resultString.push(...formatToAIN(form.name ?? char, form.content))
        }
        else{
            resultString.push(form.content)
        }
    }
    let res = resultString.join('\n\n')
    if(!continued){
        res +=  + `\n\n${char} 「`
    }
    else{
        res += " 「"
    }
    return res
}

function extractAINOutputStrings(inputString:string, characters:string[]) {
    const results:{
        content:string
        character:string
    }[] = [];
    
    let remainingString = inputString;
    
    while (remainingString.length > 0) {
        let characterIndex = -1;
        let character = null;
        for (let i = 0; i < characters.length; i++) {
        const index = remainingString.indexOf(characters[i] + '「');
        if (index >= 0 && (characterIndex == -1 || index < characterIndex)) {
            character = characters[i];
            characterIndex = index;
        }
        }
    
        if (characterIndex > 0) {
        results.push({content: remainingString.substring(0, characterIndex).trim(), character: '[narrator]'});
        }
    
        if (characterIndex == -1 || !character) {
            results.push({content: remainingString.trim(),  character: '[narrator]'});
            break;
        } else {
            const endQuoteIndex = remainingString.indexOf('」', characterIndex + character.length);
            if (endQuoteIndex == -1) {
                results.push({
                character: character, 
                content: remainingString.substring(characterIndex + character.length + 1).trim() // plus 1 to exclude 「
                });
                break;
            } else {
                results.push({
                character: character, 
                content: remainingString.substring(characterIndex + character.length + 1, endQuoteIndex).trim() // plus 1 to exclude 「
                });
                remainingString = remainingString.substring(endQuoteIndex + 1);
            }
        }
    }

    return results;
}

export function unstringlizeAIN(data:string,formated:OpenAIChat[], char:string = ''){

    const chunksResult = getUnstringlizerChunks(formated, char ,'ain')
    const chunks = chunksResult.chunks
    const result:['char'|'user',string][] = []
    data = `${char} 「` + data

    for(const n of chunksResult.extChunk){
        if(data.endsWith(n)){
            data = data.substring(0, data.length - n.length)
            stringlizeLog('trimed')
        }
    }

    const contents = extractAINOutputStrings(data, chunks)
    for(const cont of contents){
        if(cont.character === '[narrator]'){
            if(result.length === 0){
                result[0] = ['char', cont.content]
            }
            else{
                result[result.length - 1][1] += "\n" + cont.content
            }
        }
        else{
            const role = (cont.character.trim() ===  getUserName() ? 'user' : 'char')
            result.push([
                role,
                `「${cont.content}」`
            ])
        }
    }

    return result
}


function formatToAIN(name:string, content:string){
    function extractContent(str:string) {
        const result:{
            type: "outside"|"inside"
           content:string
        }[] = [];
        let lastEndIndex = 0;
        const regex = /「(.*?)」/g;
        let match:RegExpExecArray | null = null;

        
    
        while ((match = regex.exec(str)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            const inside = match[1];
            
            if (start != lastEndIndex) {
                const outside = str.slice(lastEndIndex, start);
                result.push({
                    type: "outside",
                    content: outside
                });
            }
    
            result.push({
                type: "inside",
                content: inside
            });
            
            lastEndIndex = end;
        }
    
        if (lastEndIndex < str.length) {
            const outside = str.slice(lastEndIndex);
            result.push({
                type: "outside",
                content: outside
            });
        }
        
        return result;
    }

    let quoteCounter = 0;
    content = content.replace(/"/g, () => {
        quoteCounter++;
        if (quoteCounter % 2 !== 0) {
            return '「';
        } else {
            return '」';
        }
    });

    const conts = extractContent(content)
    const strs:string[] = []
    for(const cont of conts){
        if(cont.type === 'inside'){
            strs.push(`${name} 「${cont.content}」`)
        }
        else{
            strs.push(cont.content)
        }
    }
    return strs
}
