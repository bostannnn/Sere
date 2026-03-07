import { getDatabase } from "src/ts/storage/database.svelte";

export function getGenerationModelString(name?:string){
    const db = getDatabase()
    switch (name ?? db.aiModel){
        case 'openrouter':
            return 'openrouter-' + db.openrouterRequestModel
        default:
            return name ?? db.aiModel
    }
}
