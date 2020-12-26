import { decompress } from '../types/lzma';
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

export interface CTMData {
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

function assert(test:boolean) {
    if(!test) throw new Error('file corrupted');
}

function readString(file:ArrayBuffer, off:number) : {val:string,len:number} {
    const view = new DataView(file, off);
    const strlen = view.getUint32(0, true); assert(strlen+off+4 < file.byteLength);
    off += 4;
    let val = '';
    if(strlen > 0) {
        const textDecoder = new TextDecoder("utf-8");
        val = textDecoder.decode(file.slice(off, off+strlen));
    }
    return { val: val, len:strlen+4 };
}

export function parseCTM(file : ArrayBuffer) : CTMData {
    const hdr = extractCtmHeader(file);
    if(hdr.magic != 0x4d54434f) throw new Error('Not a valid OpenCTM file');
    const offset = 32 + hdr.commentLen;

    switch(hdr.compression) {
        case 0x00574152: // RAW
            return parseCTM_Raw(hdr, offset, file);
        case 0x0031474d: // MG1
            return parseCTM_MG1(hdr, offset, file);
        case 0x0032474d: // MG2
            return parseCTM_MG2(hdr, offset, file);
        default:
            throw new Error('Unsupported compression method');
    }
}

function parseCTM_Raw(hdr:CTMHeader, offset:number, file:ArrayBuffer) : CTMData {
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
                indices = readIndex_RAW(hdr.numTriangle, hdr.numVertex, view, 4);
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

function readIndex_RAW(numTriangle:number, numVertex:number, data:DataView, off:number) : Uint32Array {
    const result = new Uint32Array(numTriangle*3);
    for(let idx=0; idx < numTriangle*3; idx++) {
        result[idx] = data.getUint32(idx*4+off, true); assert(result[idx] < numVertex);
    }
    return result;
}

function readVertex_RAW(numVertex:number, data:DataView, off:number) : Float32Array {
    const result = new Float32Array(numVertex*3);
    for(let idx=0; idx < numVertex*3; idx++) {
        result[idx] = data.getFloat32(idx*4+off, true); assert(!isNaN(result[idx]));
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
        result[idx] = data.getFloat32(idx*4+off, true); assert(!isNaN(result[idx]));
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
        result[idx] = data.getFloat32(idx*4+off, true); assert(!isNaN(result[idx]));
    }
    return {
        blockSize: off + 16*numVertex,
        attrName: attrName.val,
        data: result,
    };
}

function unpack(data:DataView,off:number,numEntry:number,numElem:number) : {size:number, data:ArrayBuffer} {
    const inputLen = data.getUint32(off, true); assert(inputLen+4 < data.byteLength);
    off += 4 + data.byteOffset;
    const input = new Uint8Array(data.buffer.slice(off, off+inputLen));

    let inputOffset = 0;
    const inputStream = {
        readByte() : number {
            return input[inputOffset++];
        },
        size : inputLen,
    };

    const outputBufferSize = numEntry*numElem*4;
    let tempBuffer : ArrayBuffer = new ArrayBuffer(outputBufferSize);
    let tempView = new Uint8Array(tempBuffer);

    let outputOffset = 0;
    const outputStream = {
        writeByte(val:number) : void {
            tempView[outputOffset++] = val;
        }
    }

    decompress(inputStream, inputStream, outputStream, outputBufferSize);

    // de-interlace the data
    let outputBuffer : ArrayBuffer = new ArrayBuffer(outputBufferSize);
    let outputView = new Uint32Array(outputBuffer);

    // copied from the C++ (since I can't really figure this out otherwise)
    for(let i = 0; i < numEntry; i++) {
        for(let k = 0; k < numElem; k++) {
            const value = tempView[i + k * numEntry + 3 * numEntry * numElem] |
                (tempView[i + k * numEntry + 2 * numEntry * numElem] << 8) |
                (tempView[i + k * numEntry + numEntry * numElem] << 16) |
                (tempView[i + k * numEntry] << 24);
            outputView[i * numElem + k] = value;
        }
    }
  
    return {size:inputLen+4+5,data:outputBuffer};
}

function parseCTM_MG1(hdr:CTMHeader, offset:number, file:ArrayBuffer) : CTMData {
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
                unpacked = unpack(view, 4, hdr.numTriangle, 3);
                indices = readIndex_MG1(hdr.numTriangle, hdr.numVertex, unpacked.data);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x54524556: { // VERT
                unpacked = unpack(view, 4, hdr.numVertex, 3);
                vertices = new Float32Array(unpacked.data);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x4d524f4e: { // NORM
                unpacked = unpack(view, 4, hdr.numVertex, 3);
                normals = new Float32Array(hdr.numVertex);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x43584554: { // TEXC
                const map = readMap_MG1(hdr.numVertex, view, 4);
                uvMap.push(map)
                offset += 4 + map.blockSize;
                break;
            }
            case 0x52545441: { // ATTR
                const attrs = readAttr_MG1(hdr.numVertex, view, 4);
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

function readIndex_MG1(numTriangle:number, numVertex:number, arr:ArrayBuffer) : Uint32Array {
    const data = new Uint32Array(arr);
    const result = new Uint32Array(numTriangle*3);

    let firstVal = 0;
    for(let idx=0; idx < numTriangle; idx++) {
        result[idx*3] = firstVal = data[idx*3] + firstVal; assert(firstVal < numVertex);
        result[idx*3+2] = data[idx*3+1] + firstVal; assert(result[idx*3+2] < numVertex);

        result[idx*3+1] = data[idx*3+1] +
            ((idx && (firstVal == result[(idx - 1) * 3])) ? result[(idx - 1) * 3 + 1] : firstVal);
        assert(result[idx*3+1] < numVertex);
    }

    return result;
}

function readMap_MG1(numVertex:number, data:DataView, off:number) : {blockSize:number,mapName:string,mapRef:string,data:Float32Array} {
    off += data.byteOffset;
    const mapName = readString(data.buffer, off);
    off += mapName.len;
    const mapRef = readString(data.buffer, off);
    off += mapRef.len - data.byteOffset;

    const unpacked = unpack(data, off, numVertex, 2);

    const result = new Float32Array(numVertex*2);
    const unpackedView = new DataView(unpacked.data);
    for(let idx=0; idx < numVertex*2; idx++) {
        result[idx] = unpackedView.getFloat32(idx*4, true); assert(!isNaN(result[idx]));
    }

    return {
        blockSize: off + unpacked.size,
        mapName: mapName.val,
        mapRef: mapRef.val,
        data: result,
    };
}

function readAttr_MG1(numVertex:number, data:DataView, off:number) : {blockSize:number,attrName:string,data:Float32Array} {
    off += data.byteOffset;
    const attrName = readString(data.buffer, off);
    off += attrName.len - data.byteOffset;

    const unpacked = unpack(data, off, numVertex, 4);

    const result = new Float32Array(numVertex*4);
    const unpackedView = new DataView(unpacked.data);
    off -= data.byteOffset;
    for(let idx=0; idx < numVertex*4; idx++) {
        result[idx] = unpackedView.getFloat32(idx*4, true); assert(!isNaN(result[idx]));
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
    const vertexPrec = data.getFloat32(off, true); assert(!isNaN(vertexPrec) && vertexPrec >= 0);
    const normPrec = data.getFloat32(off+4, true); assert(!isNaN(normPrec) && normPrec >= 0);
    const LBx = data.getFloat32(off+8, true); assert(!isNaN(LBx));
    const LBy = data.getFloat32(off+12, true); assert(!isNaN(LBy));
    const LBz = data.getFloat32(off+16, true); assert(!isNaN(LBz));
    const HBx = data.getFloat32(off+20, true); assert(!isNaN(HBx) && HBx > LBx);
    const HBy = data.getFloat32(off+24, true); assert(!isNaN(HBy) && HBy > LBy);
    const HBz = data.getFloat32(off+28, true); assert(!isNaN(HBz) && HBz > LBz);
    const divX = data.getUint32(off+32, true); assert(divX > 1);
    const divY = data.getUint32(off+36, true); assert(divY > 1);
    const divZ = data.getUint32(off+40, true); assert(divZ > 1);

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

function parseCTM_MG2(hdr:CTMHeader, offset:number, file:ArrayBuffer) : CTMData {
    const len = file.byteLength;
    let mg2Hdr : null|MG2Header = null;
    let gridIndices : null|Uint32Array = null;
    let indices : null|Uint32Array = null;
    let intVertices : null|Uint32Array = null;
    let intNormals : null|Uint32Array = null;
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
                unpacked = unpack(view, 4, hdr.numVertex, 3);
                intVertices = new Uint32Array(unpacked.data);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x58444947: { // GIDX
                unpacked = unpack(view, 4, hdr.numVertex, 1);
                gridIndices = readGridIndex_MG2(hdr.numVertex, unpacked.data);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x58444e49: { // INDX
                unpacked = unpack(view, 4, hdr.numTriangle, 3);
                indices = readIndex_MG1(hdr.numTriangle, hdr.numVertex, unpacked.data);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x4d524f4e: { // NORM
                unpacked = unpack(view, 4, hdr.numVertex, 3);
                intNormals = new Uint32Array(unpacked.data);
                offset += 4 + unpacked.size;
                break;
            }
            case 0x43584554: { // TEXC
                const map = readMap_MG2(hdr.numVertex, view, 4);
                uvMap.push(map)
                offset += 4 + map.blockSize;
                break;
            }
            case 0x52545441: { // ATTR
                const attrs = readAttr_MG2(hdr.numVertex, view, 4);
                attrList.push(attrs);
                offset += 4 + attrs.blockSize;
                break;
            }
            default:
                throw new Error('Unsupported chunk type or corrupted file');
        }
    }

    const vertices = postProcessVertex_MG2(mg2Hdr!, intVertices!, gridIndices!);
    if(intNormals) normals = postProcessNormals(mg2Hdr!.normPrec, indices!, vertices, intNormals);

    return {
        indices : indices!,
        vertices : vertices!,
        normals : normals || undefined,
        uvMap : uvMap,
        attrList : attrList,
    };
}

function readGridIndex_MG2(numVertex:number, arr:ArrayBuffer) : Uint32Array {
    const data = new Uint32Array(arr);
    const result = new Uint32Array(numVertex);

    let thisVal = 0;
    for(let idx=0; idx < numVertex; idx++) {
        thisVal = result[idx] = data[idx] + thisVal;
    }

    return result;
}

function postProcessVertex_MG2(hdr:MG2Header, intVertices:Uint32Array, gridIndices:Uint32Array) : Float32Array {
    const vertices = new Float32Array(intVertices.length);
    const numVertices = vertices.length / 3;

    const divX = (hdr.HBx - hdr.LBx) / hdr.divX;
    const divY = (hdr.HBy - hdr.LBy) / hdr.divY;
    const divZ = (hdr.HBz - hdr.LBz) / hdr.divZ;
    const vertexPrec = hdr.vertexPrec;

    let prevGridIndex = -1;
    let prevDeltaX = 0;
    for(let idx=0; idx < numVertices; idx++) {
        const gridIndex = gridIndices[idx];

        const gx = gridIndex % hdr.divX;
        const temp1 = (gridIndex / hdr.divX)|0;
        const gy = temp1 % hdr.divY;
        const gz = (temp1 / hdr.divY)|0;

        let deltaX = intVertices[idx*3];
        if(gridIndex == prevGridIndex) deltaX += prevDeltaX;
  
        vertices[idx*3] = hdr.LBx + vertexPrec * deltaX + divX * gx;
        vertices[idx*3+1] = hdr.LBy + vertexPrec * intVertices[idx*3+1] + divY * gy;
        vertices[idx*3+2] = hdr.LBz + vertexPrec * intVertices[idx*3+2] + divZ * gz;

        vertices[idx*3] += hdr.LBx + divX * gx;
        vertices[idx*3+1] += hdr.LBy + divY * gy;
        vertices[idx*3+2] += hdr.LBz + divZ * gz;

        prevGridIndex = gridIndex;
        prevDeltaX = deltaX;
    }
    return vertices;
}

function toSigned(val:number) : number {
    if((val&0) == 0) {
        return val / 2;
    } else {
        return -((val+1) / 2);
    }
}

function postProcessNormals(normPrec:number, indices:Uint32Array, vertices:Float32Array, intNormals:Uint32Array) : Float32Array {

    const normals = new Float32Array(intNormals.length);
    const smooth = new Float32Array(vertices.length);

    const numIndices = indices.length / 3;
    for (let idx = 0; idx < numIndices; idx++) {
        // Get triangle corner indices
        const indx = indices[idx*3];
        const indy = indices[idx*3+1];
        const indz = indices[idx*3+2];

        // Calculate the normalized cross product of two triangle edges (i.e. the flat triangle normal)
        const v1x = vertices[indy*3]     - vertices[indx*3];
        const v2x = vertices[indz*3]     - vertices[indx*3];
        const v1y = vertices[indy*3 + 1] - vertices[indx*3 + 1];
        const v2y = vertices[indz*3 + 1] - vertices[indx*3 + 1];
        const v1z = vertices[indy*3 + 2] - vertices[indx*3 + 2];
        const v2z = vertices[indz*3 + 2] - vertices[indx*3 + 2];

        let nx = v1y * v2z - v1z * v2y;
        let ny = v1z * v2x - v1x * v2z;
        let nz = v1x * v2y - v1y * v2x;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-10){
            nx /= len;
            ny /= len;
            nz /= len;
        }

        // Add the flat normal to all three triangle vertices
        smooth[indx*3]     += nx;
        smooth[indx*3 + 1] += ny;
        smooth[indx*3 + 2] += nz;
        smooth[indy*3]     += nx;
        smooth[indy*3 + 1] += ny;
        smooth[indy*3 + 2] += nz;
        smooth[indz*3]     += nx;
        smooth[indz*3 + 1] += ny;
        smooth[indz*3 + 2] += nz;
    }

    // Normalize the normal sums, which gives the unit length smooth normals
    const numVertices = vertices.length / 3;
    for (let idx = 0; idx < numVertices; idx++){
        const len = Math.sqrt(smooth[idx*3] * smooth[idx*3] + 
            smooth[idx*3 + 1] * smooth[idx*3 + 1] +
            smooth[idx*3 + 2] * smooth[idx*3 + 2]);

        if(len > 1e-10){
            smooth[idx*3]     /= len;
            smooth[idx*3 + 1] /= len;
            smooth[idx*3 + 2] /= len;
        }
    }

    const PI_DIV_2 = Math.PI * 0.5;

    for (let idx=0; idx < numVertices; idx++) {

        // Get the normal magnitude from the first of the three normal elements
        const magN = intNormals[idx*3] * normPrec;

        // Get phi and theta (spherical coordinates, relative to the smooth normal).
        const intPhi = intNormals[idx*3 + 1];

        if (intPhi === 0) {
            normals[idx*3]     = smooth[idx*3]     * magN;
            normals[idx*3 + 1] = smooth[idx*3 + 1] * magN;
            normals[idx*3 + 2] = smooth[idx*3 + 2] * magN;
        } else {
            let theta : number;
            if (intPhi <= 4){
                theta = (intNormals[idx*3 + 2] - 2) * PI_DIV_2;
            }else{
                theta = ((intNormals[idx*3 + 2] * 4 / intPhi) - 2) * PI_DIV_2;
            }

            const phi = intPhi * normPrec * PI_DIV_2;

            // Convert the normal from the angular representation (phi, theta) back to cartesian coordinates
            const sinPhi = magN * Math.sin(phi);
            const nx = sinPhi * Math.cos(theta);
            const ny = sinPhi * Math.sin(theta);
            const nz = magN * Math.cos(phi);

            let bz = smooth[idx*3 + 1];
            let by = smooth[idx*3] - smooth[idx*3 + 2];

            const len = Math.sqrt(2 * bz * bz + by * by);
            if (len > 1e-20){
                by /= len;
                bz /= len;
            }

            normals[idx*3]     = smooth[idx*3]     * nz + (smooth[idx*3 + 1] * bz - smooth[idx*3 + 2] * by) * ny - bz * nx;
            normals[idx*3 + 1] = smooth[idx*3 + 1] * nz - (smooth[idx*3 + 2]      + smooth[idx*3]   ) * bz  * ny + by * nx;
            normals[idx*3 + 2] = smooth[idx*3 + 2] * nz + (smooth[idx*3]     * by + smooth[idx*3 + 1] * bz) * ny + bz * nx;
        }
    }
    return normals;
}

function readMap_MG2(numVertex:number, data:DataView, off:number) : {blockSize:number,mapName:string,mapRef:string,data:Float32Array} {
    off += data.byteOffset;
    const mapName = readString(data.buffer, off);
    off += mapName.len;
    const mapRef = readString(data.buffer, off);
    off += mapRef.len - data.byteOffset;
    const uvPrec = data.getFloat32(off, true); assert(!isNaN(uvPrec));
    off += 4;

    const unpacked = unpack(data, off, numVertex, 2);

    const result = new Float32Array(numVertex*2);
    const unpackedView = new Uint32Array(unpacked.data);

    let thisU = 0;
    let thisV = 0;
    for(let idx = 0; idx < numVertex; idx++) {
        // Calculate inverse delta
        thisU = toSigned(unpackedView[idx*2]) + thisU;
        thisV = toSigned(unpackedView[idx*2+1]) + thisV;

        // Convert to floating point
        result[idx*2] = thisU * uvPrec;
        result[idx*2+1] = thisV * uvPrec;
    }
    
    return {
        blockSize: off + unpacked.size,
        mapName: mapName.val,
        mapRef: mapRef.val,
        data: result,
    };
}

function readAttr_MG2(numVertex:number, data:DataView, off:number) : {blockSize:number,attrName:string,data:Float32Array} {
    off += data.byteOffset;
    const attrName = readString(data.buffer, off);
    off += attrName.len - data.byteOffset;
    const attrPrec = data.getFloat32(off, true); assert(!isNaN(attrPrec));
    off += 4 - data.byteOffset;

    const unpacked = unpack(data, off, numVertex, 4);

    const result = new Float32Array(numVertex*4);
    const unpackedView = new Uint32Array(unpacked.data);

    let valueA = 0;
    let valueB = 0;
    let valueC = 0;
    let valueD = 0;

    for(let idx = 0; idx < numVertex; idx++) {
        // Calculate inverse delta, and convert to floating point
        valueA = unpackedView[idx*4] + valueA;
        result[idx*4] = valueA * attrPrec;

        valueB = unpackedView[idx*4+1] + valueB;
        result[idx*4+1] = valueB * attrPrec;

        valueC = unpackedView[idx*4+2] + valueC;
        result[idx*4+2] = valueC * attrPrec;

        valueD = unpackedView[idx*4+3] + valueD;
        result[idx*4+3] = valueD * attrPrec;
    }
    
    return {
        blockSize: off + unpacked.size,
        attrName: attrName.val,
        data: result,
    };
}
