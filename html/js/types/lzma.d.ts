export interface LZMA {
    compress(
        str: string | ArrayLike<number>,
        mode: number,
        // The "result" is normal array of numbers - signed byte (from -127 to 128). You can convert with "new Int8Array(result)"
        onFinish: (result: number[] | null, error: Error) => void,
        onProgress?: (progress: number) => void,
    ): void;
  
    decompress(
        byteArray: ArrayLike<number>,
        onFinish: (result: string | number[] | null, error?: Error) => void,
        onProgress?: (progress: number) => void,
    ): void;

    worker() : null|Worker;
}
export declare var LZMA : LZMA;