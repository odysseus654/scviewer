/* init.ts

manages main startup of the site */
import { FileLibrary } from '../ctm/lib';

export function init() {
    const lib = new FileLibrary();
    lib.fetch('argis/Gladius')
        .then((value:ArrayBuffer) => {
            debugger;
        });
}