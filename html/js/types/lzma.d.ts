/*
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
export interface LZMA2 extends LZMA {
    lzma2_compress(
        str: string | ArrayLike<number>,
        mode: number,
        // The "result" is normal array of numbers - signed byte (from -127 to 128). You can convert with "new Int8Array(result)"
        onFinish: (result: number[] | null, error: Error) => void,
        onProgress?: (progress: number) => void,
    ): void;
  
    lzma2_decompress(
        byteArray: ArrayLike<number>,
        onFinish: (result: string | number[] | null, error?: Error) => void,
        onProgress?: (progress: number) => void,
    ): void;
}

export function LZMA(workerPath?:string) : LZMA;
export function LZMA2(workerPath?:string) : LZMA2;
*/

export interface InputStream {
    readByte() : number;
    size : number;
}
export interface OutputStream {
    writeByte(b:number) : void;
}

interface OutWindow {
    create(windowSize:number) : void;
    flush() : void;
    releaseStream() : void;
    setStream(stream:OutputStream) : void;
    init(solid:boolean) : void;
    copyBlock(distance:number, len:number) : void;
    putByte(b:number) : void;
    getByte(distiance:number) : number;
}
interface OutWindowConstructor {
    new() : OutWindow;
}
declare var OutWindow : OutWindowConstructor;

interface RangeDecoder {
    setStream(stream:InputStream) : void;
    releaseStream() : void;
    init() : void;
    decodeDirectBits(numTotalBits:number) : number;
    decodeBit(probs:number[], index:number) : 0|1;
}
interface RangeDecoderConstructor {
    new() : RangeDecoder;
}
declare var RangeDecoder : RangeDecoderConstructor;

//function initBitModels(probs:number[], len:number) : void;

interface BitTreeDecoder {
    init() : void;
    decode(rangeDecoder:RangeDecoder) : number;
    reverseDecode(rangeDecoder:RangeDecoder) : number;
    reverseDecode2(models:number[], startIndex:number, rangeDecoder:RangeDecoder, numBitLevels:number) : number;
}
interface BitTreeDecoderConstructor {
    new(numBitLevels:number) : BitTreeDecoder;
}
declare var BitTreeDecoder : BitTreeDecoderConstructor;

interface LenDecoder {
    create(numPosStates:number) : void;
    init() : void;
    decode(rangeDecoder:RangeDecoder, posState:number) : number;
}
interface LenDecoderConstructor {
    new() : LenDecoder;
}
declare var LenDecoder : LenDecoderConstructor;

interface Decoder2 {
    init() : void;
    decodeNormal(rangeDecoder:RangeDecoder) : number;
    decodeWithMatchByte(rangeDecoder:RangeDecoder, matchByte:number) : number;
}
interface Decoder2Constructor {
    new() : Decoder2;
}
declare var Decoder2 : Decoder2Constructor;

interface LiteralDecoder {
    create(numPosBits:number, numPrevBits:number) : void;
    init() : void;
    getDecoder(pos:number, prevByte:number) : Decoder2;
}
interface LiteralDecoderConstructor {
    new() : LiteralDecoder;
}
declare var LiteralDecoder : LiteralDecoderConstructor;

interface Decoder {
    setDictionarySize(dictionarySize:number) : boolean;
    setLcLpPb(lc:number, lp:number, pb:number) : boolean;
    init() : void;
    decode(inStream:InputStream, outStream:OutputStream, outSize:number) : boolean;
    setDecoderProperties(properties:InputStream) : boolean;
}
interface DecoderConstructor {
    new() : Decoder;
}
declare var Decoder : DecoderConstructor;

export function decompress(properties:InputStream, inStream:InputStream, outStream:OutputStream, outSize:number) : true;
export function decompressFile(inStream:InputStream, outStream:OutputStream) : true;
