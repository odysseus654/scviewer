/* lib.ts

Manages retrieved CTM files as requested */
import { fetch } from './fetch';

export class FileLibrary {
    private files : Record<string,ArrayBuffer> = {};

    public fetch(loc:string) : Promise<ArrayBuffer> {
        if(loc in this.files) {
            return Promise.resolve(this.files[loc]);
        }
        return fetch('models/' + loc + '.ctm')
            .then((value:ArrayBuffer)=>{
                this.files[loc] = value;
                return value;
            });
    }
}