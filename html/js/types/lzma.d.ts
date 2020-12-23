export interface InputStream {
    readByte() : number;
    size : number;
}
export interface OutputStream {
    writeByte(b:number) : void;
}

export interface OutWindow {
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
export declare var OutWindow : OutWindowConstructor;

export interface RangeDecoder {
    setStream(stream:InputStream) : void;
    releaseStream() : void;
    init() : void;
    decodeDirectBits(numTotalBits:number) : number;
    decodeBit(probs:number[], index:number) : 0|1;
}
interface RangeDecoderConstructor {
    new() : RangeDecoder;
}
export declare var RangeDecoder : RangeDecoderConstructor;

export function initBitModels(probs:number[], len:number) : void;

export interface BitTreeDecoder {
    init() : void;
    decode(rangeDecoder:RangeDecoder) : number;
    reverseDecode(rangeDecoder:RangeDecoder) : number;
    reverseDecode2(models:number[], startIndex:number, rangeDecoder:RangeDecoder, numBitLevels:number) : number;
}
interface BitTreeDecoderConstructor {
    new(numBitLevels:number) : BitTreeDecoder;
}
export declare var BitTreeDecoder : BitTreeDecoderConstructor;

export interface LenDecoder {
    create(numPosStates:number) : void;
    init() : void;
    decode(rangeDecoder:RangeDecoder, posState:number) : number;
}
interface LenDecoderConstructor {
    new() : LenDecoder;
}
export declare var LenDecoder : LenDecoderConstructor;

export interface Decoder2 {
    init() : void;
    decodeNormal(rangeDecoder:RangeDecoder) : number;
    decodeWithMatchByte(rangeDecoder:RangeDecoder, matchByte:number) : number;
}
interface Decoder2Constructor {
    new() : Decoder2;
}
export declare var Decoder2 : Decoder2Constructor;

export interface LiteralDecoder {
    create(numPosBits:number, numPrevBits:number) : void;
    init() : void;
    getDecoder(pos:number, prevByte:number) : Decoder2;
}
interface LiteralDecoderConstructor {
    new() : LiteralDecoder;
}
export declare var LiteralDecoder : LiteralDecoderConstructor;

export interface Decoder {
    setDictionarySize(dictionarySize:number) : boolean;
    setLcLpPb(lc:number, lp:number, pb:number) : boolean;
    setProperties(props:{lc:number,lp:number,pb:number,dictionarySize:number}) : void;
    decodeHeader(inStream:InputStream) : {lc:number,lp:number,pb:number,dictionarySize:number,uncompressedSize:number};
    init() : void;
    decodeBody(inStream:InputStream, outStream:InputStream, maxSize:InputStream) : boolean;
    setDecoderProperties(properties:InputStream) : boolean;
}
interface DecoderConstructor {
    new() : Decoder;
}
export declare var Decoder : DecoderConstructor;

export function decompress(properties:InputStream, inStream:InputStream, outStream:OutputStream, outSize:number) : OutputStream;
export function decompressFile(inStream:InputStream|ArrayBuffer, outStream?:OutputStream) : OutputStream;
export function decode(inStream:InputStream|ArrayBuffer, outStream?:OutputStream) : OutputStream; // alias of decompressFile
