/* init.ts

manages main startup of the site */
import { FileLibrary } from '../ctm/lib';
import { CTMData, parseCTM } from '../ctm/decode';

export function init() {
    const lib = new FileLibrary();
    lib.fetch('aegis/Gladius')
        .then((value:ArrayBuffer) => {
            return parseCTM(value);
        })
        .then((value:CTMData) => {
            debugger;
            alert(value);
        });
}
