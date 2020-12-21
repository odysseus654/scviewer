/* fetch.ts

Manages retrieval of CTM files */
import { EventEmitter } from '../../js/types/event-emitter';

class NetworkRequest extends EventEmitter<'load'|'error'> {
    constructor() {
        super();
        this.xhr = new XMLHttpRequest();
        this.configure();
    }
    private xhr : XMLHttpRequest;

    private configure():void {
        const xhr = this.xhr;
        xhr.responseType = 'arraybuffer';
        xhr.addEventListener('load', this.onLoad.bind(this));
        xhr.addEventListener('error', this.onError.bind(this));
    }

    public fetch(loc:string) {
        this.xhr.open('GET', loc);
        this.configure();
        this.xhr.send();
    }

    private onLoad(ev: ProgressEvent<XMLHttpRequestEventTarget>) {
        const xhr = this.xhr;
        if(xhr.status / 100 == 2) {
            this.emit('load', this.xhr.response);
        } else {
            this.emit('error', {
                status: xhr.status,
                statusText: xhr.statusText,
            });
        }
    }

    private onError(ev: ProgressEvent<XMLHttpRequestEventTarget>) {
        const xhr = this.xhr;
        this.emit('error', {
            status: xhr.status,
            statusText: xhr.statusText,
        });
    }
}

export function fetch(loc:string) : Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve:(value:ArrayBuffer)=>void,reject:(reason?:any)=>void) => {
        const req = new NetworkRequest();
        req.on('load', (value:ArrayBuffer) => {
            resolve(value);
        });
        req.on('error', (reason:Record<string,any>) => {
            reject(reason);
        });
        req.fetch(loc);
    });
}