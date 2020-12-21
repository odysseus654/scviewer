import { LZMA } from '../types/lzma';
/* decode.ts

Parse the contents of a CTM file */

interface CTMHeader {
    magic : number;
    version : number;
    compression : number;
    numVertex : number;
    numTriangle : number;
    numUvMap : number;
    numAttrs : number;
    flags : number;
    comment : string;
    commentLen: number;
}

interface CTMData {
    indices : Uint32Array,
    vertices : Float32Array,
    normals? : Float32Array,
    uvMap : {mapName:string,mapRef:string,data:Float32Array}[];
    attrList : {attrName:string,data:Float32Array}[];
}

function extractCtmHeader(file : ArrayBuffer) : CTMHeader {
    const view = new DataView(file);

    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    const compression = view.getUint32(8, true);
    const numVertex = view.getUint32(12, true);
    const numTriangle = view.getUint32(16, true);
    const numUvMap = view.getUint32(20, true);
    const numAttrs = view.getUint32(24, true);
    const flags = view.getUint32(28, true);

    const comment = readString(file, 32);

    return {
        magic: magic,
        version: version,
        compression: compression,
        numVertex: numVertex,
        numTriangle: numTriangle,
        numUvMap: numUvMap,
        numAttrs: numAttrs,
        flags: flags,
        comment: comment.val,
        commentLen: comment.len,
    };
}

function readString(file:ArrayBuffer, off:number) : {val:string,len:number} {
    const view = new DataView(file, off);
    const strlen = view.getUint32(0, true);
    let val = '';
    if(strlen > 0) {
        const textDecoder = new TextDecoder("utf-8");
        val = textDecoder.decode(file.slice(4, 4+strlen));
    }
    return { val: val, len:strlen+4 };
}

export function parseCTM(file : ArrayBuffer) : Promise<CTMData> {
    const hdr = extractCtmHeader(file);
    if(hdr.magic != 0x4d54434f) throw new Error('Not a valid OpenCTM file');
    const offset = 32 + hdr.commentLen + 1;

    switch(hdr.compression) {
        case 0x00574152: // RAW
            return parseCTM_Raw(hdr, offset, file);
        case 0x0031474d: // MG1
            return parseCTM_MG1(hdr, offset, file);
        case 0x0032474d: // MG2
            return parseCTM_MG2(hdr, offset, file);
        default:
            return Promise.reject(new Error('Unsupported compression method'));
    }
}

function parseCTM_Raw(hdr:CTMHeader, offset:number, file:ArrayBuffer) : Promise<CTMData> {
    const len = file.byteLength;
    let indices : null|Uint32Array = null;
    let vertices : null|Float32Array = null;
    let normals : null|Float32Array = null;
    const uvMap : {mapName:string,mapRef:string,data:Float32Array}[] = [];
    const attrList : {attrName:string,data:Float32Array}[] = [];

    while(offset < len) {
        const view = new DataView(file, offset);
        const ident = view.getUint32(0, true);
        switch(ident) {
            case 0x58444e49: { // INDX
                indices = readIndex_RAW(hdr.numTriangle, view, 4);
                offset += 4 + 4*(hdr.numTriangle*3+1);
                break;
            }
            case 0x54524556: { // VERT
                vertices = readVertex_RAW(hdr.numVertex, view, 4);
                offset += 4 + 4*(hdr.numVertex*3+1);
                break;
            }
            case 0x4d524f4e: { // NORM
                normals = readVertex_RAW(hdr.numVertex, view, 4);
                offset += 4 + 4*(hdr.numVertex*3+1);
                break;
            }
            case 0x43584554: { // TEXC
                const map = readMap_RAW(hdr.numVertex, view, 4);
                uvMap.push(map)
                offset += 4 + map.blockSize;
                break;
            }
            case 0x52545441: { // ATTR
                const attrs = readAttr_RAW(hdr.numVertex, view, 4);
                attrList.push(attrs);
                offset += 4 + attrs.blockSize;
                break;
            }
            default:
                return Promise.reject(new Error('Unsupported chunk type or corrupted file'));
        }
    }

    return Promise.resolve<CTMData>({
        indices : indices!,
        vertices : vertices!,
        normals : normals || undefined,
        uvMap : uvMap,
        attrList : attrList,
    });
}

function readIndex_RAW(numTriangle:number, data:DataView, off:number) : Uint32Array {
    const result = new Uint32Array(numTriangle*3);
    for(let idx=0; idx < numTriangle*3; idx++) {
        result[idx] = data.getUint32(idx*4+off, true);
    }
    return result;
}

function readVertex_RAW(numVertex:number, data:DataView, off:number) : Float32Array {
    const result = new Float32Array(numVertex*3);
    for(let idx=0; idx < numVertex*3; idx++) {
        result[idx] = data.getFloat32(idx*4+off, true);
    }
    return result;
}

function readMap_RAW(numVertex:number, data:DataView, off:number) : {blockSize:number,mapName:string,mapRef:string,data:Float32Array} {
    off += data.byteOffset;
    const mapName = readString(data.buffer, off);
    off += mapName.len;
    const mapRef = readString(data.buffer, off);
    off += mapRef.len;

    const result = new Float32Array(numVertex*2);
    off -= data.byteOffset;
    for(let idx=0; idx < numVertex*2; idx++) {
        result[idx] = data.getFloat32(idx*4+off, true);
    }
    return {
        blockSize: off + 8*numVertex,
        mapName: mapName.val,
        mapRef: mapRef.val,
        data: result,
    };
}

function readAttr_RAW(numVertex:number, data:DataView, off:number) : {blockSize:number,attrName:string,data:Float32Array} {
    off += data.byteOffset;
    const attrName = readString(data.buffer, off);
    off += attrName.len;

    const result = new Float32Array(numVertex*4);
    off -= data.byteOffset;
    for(let idx=0; idx < numVertex*4; idx++) {
        result[idx] = data.getFloat32(idx*4+off, true);
    }
    return {
        blockSize: off + 16*numVertex,
        attrName: attrName.val,
        data: result,
    };
}

function unpack(data:DataView,off:number) : Promise<{size:number, data:ArrayBuffer}> {
    if(!off) off = 0;
    const inputLen = data.getUint32(off);
    off += 4 + data.byteOffset;
    const input = new Uint8Array(data.buffer.slice(off));

    return new Promise<{size:number, data:ArrayBuffer}>((resolve, reject) => {
        LZMA.decompress(input, (result,error) => {
            if(!result) {
                reject(error);
            } else {
                // reverse byte interleaving (assuming all elements are 4 bytes long)
                const outputLen = result.length / 4;
                const output = new ArrayBuffer(outputLen*4);
                const outputArr = new Uint8Array(output);
                for(let idx=0; idx < outputLen; idx++) {
                    outputArr[idx] = <number>result[idx*4];
                    outputArr[idx + outputLen] = <number>result[idx*4+1];
                    outputArr[idx + 2*outputLen] = <number>result[idx*4+2];
                    outputArr[idx + 3*outputLen] = <number>result[idx*4+2];
                }
                resolve({size:inputLen,data:output});
            }
        });
    });
}

async function parseCTM_MG1(hdr:CTMHeader, offset:number, file:ArrayBuffer) : Promise<CTMData> {
    const len = file.byteLength;
    let indices : null|Uint32Array = null;
    let vertices : null|Float32Array = null;
    let normals : null|Float32Array = null;
    const uvMap : {mapName:string,mapRef:string,data:Float32Array}[] = [];
    const attrList : {blockSize:number,attrName:string,data:Float32Array}[] = [];
    let unpacked : {size:number, data:ArrayBuffer};

    while(offset < len) {
        const view = new DataView(file, offset);
        const ident = view.getUint32(0, true);
        switch(ident) {
            case 0x58444e49: { // INDX
                unpacked = await unpack(view, 4);
                indices = readIndex_MG1(hdr.numTriangle, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x54524556: { // VERT
                unpacked = await unpack(view, 4);
                vertices = readVertex_RAW(hdr.numVertex, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x4d524f4e: { // NORM
                unpacked = await unpack(view, 4);
                normals = readVertex_RAW(hdr.numVertex, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x43584554: { // TEXC
                const map = await readMap_MG1(hdr.numVertex, view, 4);
                uvMap.push(map)
                offset += 4 + map.blockSize;
                break;
            }
            case 0x52545441: { // ATTR
                const attrs = await readAttr_MG1(hdr.numVertex, view, 4);
                attrList.push(attrs);
                offset += 4 + attrs.blockSize;
                break;
            }
            default:
                throw new Error('Unsupported chunk type or corrupted file');
        }
    }

    return {
        indices : indices!,
        vertices : vertices!,
        normals : normals || undefined,
        uvMap : uvMap,
        attrList : attrList,
    };
}

function readIndex_MG1(numTriangle:number, data:DataView, off:number) : Uint32Array {
    const result = new Uint32Array(numTriangle*3);

    // first vertex
    let thisVal = 0;
    for(let idx=0; idx < numTriangle; idx++) {
        thisVal = result[idx*3] = data.getUint32(idx*4, true) + thisVal;
    }

    // second index
    thisVal = result[0];
    for(let idx=0; idx < numTriangle; idx++) {
        thisVal = result[idx*3+1] = data.getUint32((numTriangle+idx)*4, true) + thisVal;
    }

    // third index
    for(let idx=0; idx < numTriangle; idx++) {
        result[idx*3+2] = data.getUint32((numTriangle*2+idx)*4, true) + result[idx*3];
    }

    return result;
}

async function readMap_MG1(numVertex:number, data:DataView, off:number) : Promise<{blockSize:number,mapName:string,mapRef:string,data:Float32Array}> {
    off += data.byteOffset;
    const mapName = readString(data.buffer, off);
    off += mapName.len;
    const mapRef = readString(data.buffer, off);
    off += mapRef.len - data.byteOffset;

    const unpacked = await unpack(data, off);

    const result = new Float32Array(numVertex*2);
    const unpackedView = new DataView(unpacked.data);
    for(let idx=0; idx < numVertex*2; idx++) {
        result[idx] = unpackedView.getFloat32(idx*4, true);
    }

    return {
        blockSize: off + unpacked.size,
        mapName: mapName.val,
        mapRef: mapRef.val,
        data: result,
    };
}

async function readAttr_MG1(numVertex:number, data:DataView, off:number) : Promise<{blockSize:number,attrName:string,data:Float32Array}> {
    off += data.byteOffset;
    const attrName = readString(data.buffer, off);
    off += attrName.len - data.byteOffset;

    const unpacked = await unpack(data, off);

    const result = new Float32Array(numVertex*4);
    const unpackedView = new DataView(unpacked.data);
    off -= data.byteOffset;
    for(let idx=0; idx < numVertex*4; idx++) {
        result[idx] = unpackedView.getFloat32(idx*4, true);
    }

    return {
        blockSize: off + unpacked.size,
        attrName: attrName.val,
        data: result,
    };
}

interface MG2Header {
    vertexPrec : number;
    normPrec : number;
    LBx : number;
    LBy : number;
    LBz : number;
    HBx : number;
    HBy : number;
    HBz : number;
    divX : number;
    divY : number;
    divZ : number;
}

function extractMg2Header(data:DataView, off:number) : MG2Header {
    const vertexPrec = data.getFloat32(off);
    const normPrec = data.getFloat32(off+4);
    const LBx = data.getFloat32(off+8);
    const LBy = data.getFloat32(off+12);
    const LBz = data.getFloat32(off+16);
    const HBx = data.getFloat32(off+20);
    const HBy = data.getFloat32(off+24);
    const HBz = data.getFloat32(off+28);
    const divX = data.getUint32(off+32);
    const divY = data.getUint32(off+36);
    const divZ = data.getUint32(off+40);

    return {
        vertexPrec: vertexPrec,
        normPrec: normPrec,
        LBx: LBx,
        LBy: LBy,
        LBz: LBz,
        HBx: HBx,
        HBy: HBy,
        HBz: HBz,
        divX: divX,
        divY: divY,
        divZ: divZ,
    };
}

async function parseCTM_MG2(hdr:CTMHeader, offset:number, file:ArrayBuffer) : Promise<CTMData> {
    const len = file.byteLength;
    let mg2Hdr : null|MG2Header = null;
    let gridIndices : null|Uint32Array = null;
    let indices : null|Uint32Array = null;
    let vertices : null|Float32Array = null;
    let normals : null|Float32Array = null;
    const uvMap : {mapName:string,mapRef:string,data:Float32Array}[] = [];
    const attrList : {blockSize:number,attrName:string,data:Float32Array}[] = [];
    let unpacked : {size:number, data:ArrayBuffer};

    while(offset < len) {
        const view = new DataView(file, offset);
        const ident = view.getUint32(0, true);
        switch(ident) {
            case 0x4832474d: { // MG2H
                mg2Hdr = extractMg2Header(view, 4);
                offset += 48;
                break;
            }
            case 0x54524556: { // VERT
                unpacked = await unpack(view, 4);
                vertices = readVertex_MG2(mg2Hdr!.vertexPrec, hdr.numVertex, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x58444e49: { // GIDX
                unpacked = await unpack(view, 4);
                gridIndices = readGridIndex_MG2(hdr.numVertex, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x58444e49: { // INDX
                unpacked = await unpack(view, 4);
                indices = readIndex_MG1(hdr.numTriangle, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x4d524f4e: { // NORM
                unpacked = await unpack(view, 4);
                normals = readNorm_MG2(hdr.numVertex, new DataView(unpacked.data), 0);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x43584554: { // TEXC
                const map = await readMap_MG2(hdr.numVertex, view, 4);
                uvMap.push(map)
                offset += 4 + map.blockSize;
                break;
            }
            case 0x52545441: { // ATTR
                const attrs = await readAttr_MG2(hdr.numVertex, view, 4);
                attrList.push(attrs);
                offset += 4 + attrs.blockSize;
                break;
            }
            default:
                throw new Error('Unsupported chunk type or corrupted file');
        }
    }

    postProcessVertex_MG2(mg2Hdr!, vertices!, gridIndices!)

    return {
        indices : indices!,
        vertices : vertices!,
        normals : normals || undefined,
        uvMap : uvMap,
        attrList : attrList,
    };
}

function readVertex_MG2(vertexPrec:number, numVertex:number, data:DataView, off:number) : Float32Array {
    const result = new Float32Array(numVertex*3);

    // first vertex
    let thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = data.getUint32(idx*4, true) + thisVal;
        result[idx*3] = vertexPrec * thisVal;
    }

    // second index
    for(let idx=0; idx < numVertex; idx++) {
        result[idx*3+1] = vertexPrec * data.getUint32((numVertex+idx)*4, true);
    }

    // third index
    for(let idx=0; idx < numVertex; idx++) {
        result[idx*3+2] = vertexPrec * data.getUint32((numVertex*2+idx)*4, true);
    }

    return result;
}

function postProcessVertex_MG2(hdr:MG2Header, vertices:Float32Array, gridIndices:Uint32Array) : void {
    const numVertices = vertices.length / 3;
    const divX = (hdr.HBx - hdr.LBx) / hdr.divX;
    const divY = (hdr.HBy - hdr.LBy) / hdr.divY;
    const divZ = (hdr.HBz - hdr.LBz) / hdr.divZ;

    for(let idx=0; idx < numVertices; idx++) {
        let gridIndex = gridIndices[idx];
        let temp1 = (gridIndex / hdr.divX)|0;
        const gx = gridIndex - (temp1 * hdr.divX);
        const gz = (temp1  / hdr.divY)|0;
        const gy = temp1 - (gz * hdr.divX);

        vertices[idx*3] += hdr.LBx + divX * gx;
        vertices[idx*3+1] += hdr.LBy + divY * gy;
        vertices[idx*3+2] += hdr.LBz + divZ * gz;
    }
}

function readGridIndex_MG2(numVertex:number, data:DataView, off:number) : Uint32Array {
    const result = new Uint32Array(numVertex);

    let thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = result[idx] = data.getUint32(idx*4, true) + thisVal;
    }

    return result;
}

function toSigned(val:number) : number {
    if((val&0) == 0) {
        return val / 2;
    } else {
        return -((val+1) / 2);
    }
}

async function readMap_MG2(numVertex:number, data:DataView, off:number) : Promise<{blockSize:number,mapName:string,mapRef:string,data:Float32Array}> {
    off += data.byteOffset;
    const mapName = readString(data.buffer, off);
    off += mapName.len;
    const mapRef = readString(data.buffer, off);
    off += mapRef.len;
    const uvPrec = data.getFloat32(off);
    off += 4 - data.byteOffset;

    const unpacked = await unpack(data, off);

    const result = new Float32Array(numVertex*2);
    const unpackedView = new DataView(unpacked.data);

    // first index
    let thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = uvPrec * (toSigned(unpackedView.getUint32(idx*4, true)) + thisVal);
        result[idx*2] = uvPrec * thisVal;
    }

    // second index
    thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = uvPrec * (toSigned(unpackedView.getUint32((numVertex+idx)*4, true)) + thisVal);
        result[idx*2+1] = uvPrec * thisVal;
    }
    
    return {
        blockSize: off + unpacked.size,
        mapName: mapName.val,
        mapRef: mapRef.val,
        data: result,
    };
}

async function readAttr_MG2(numVertex:number, data:DataView, off:number) : Promise<{blockSize:number,attrName:string,data:Float32Array}> {
    off += data.byteOffset;
    const attrName = readString(data.buffer, off);
    off += attrName.len - data.byteOffset;
    const attrPrec = data.getFloat32(off);
    off += 4 - data.byteOffset;

    const unpacked = await unpack(data, off);

    const result = new Float32Array(numVertex*4);
    const unpackedView = new DataView(unpacked.data);

    // first index
    let thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = attrPrec * (toSigned(unpackedView.getUint32(idx*4, true)) + thisVal);
        result[idx*4] = attrPrec * thisVal;
    }

    // second index
    thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = attrPrec * (toSigned(unpackedView.getUint32((numVertex+idx)*4, true)) + thisVal);
        result[idx*4+1] = attrPrec * thisVal;
    }
    
    // third index
    thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = attrPrec * (toSigned(unpackedView.getUint32((numVertex*2+idx)*4, true)) + thisVal);
        result[idx*4+2] = attrPrec * thisVal;
    }
    
    // fourth index
    thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = attrPrec * (toSigned(unpackedView.getUint32((numVertex*3+idx)*4, true)) + thisVal);
        result[idx*4+3] = attrPrec * thisVal;
    }
    
    return {
        blockSize: off + unpacked.size,
        attrName: attrName.val,
        data: result,
    };
}
