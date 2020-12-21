/* init.ts

manages main startup of the site */
import { FileLibrary } from '../ctm/lib';
import { parseCTM } from '../ctm/decode';

export function init() {
    const lib = new FileLibrary();
    lib.fetch('aegis/Gladius')
        .then((value:ArrayBuffer) => {
            parseCTM(value);
        });
}
