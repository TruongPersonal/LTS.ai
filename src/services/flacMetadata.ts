export interface FlacMetadataInspection {
  totalSamples: number;
  hasAudioFrames: boolean;
}

const FLAC_SIGNATURE = [0x66, 0x4c, 0x61, 0x43] as const;
const STREAMINFO_BLOCK_TYPE = 0;
const STREAMINFO_BLOCK_LENGTH = 34;
const TOTAL_SAMPLES_MASK = 0xfffffffffn;

function read24BitBigEndian(data: Uint8Array, offset: number): number {
  return (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
}

function readStreamInfoTotalSamples(data: Uint8Array, dataOffset: number): number {
  const packedOffset = dataOffset + 10;
  let packed = 0n;
  for (let index = 0; index < 8; index += 1) {
    packed = (packed << 8n) | BigInt(data[packedOffset + index]);
  }
  return Number(packed & TOTAL_SAMPLES_MASK);
}

export function inspectFlacMetadata(data: Uint8Array): FlacMetadataInspection {
  if (
    data.byteLength < 8 ||
    FLAC_SIGNATURE.some((value, index) => data[index] !== value)
  ) {
    throw new Error('FLAC container is invalid.');
  }

  let offset: number = FLAC_SIGNATURE.length;
  let totalSamples: number | null = null;
  let sawLastMetadataBlock = false;

  while (offset + 4 <= data.byteLength) {
    const header = data[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockLength = read24BitBigEndian(data, offset + 1);
    const dataOffset = offset + 4;
    const nextOffset = dataOffset + blockLength;

    if (nextOffset > data.byteLength) {
      throw new Error('FLAC metadata block is truncated.');
    }

    if (blockType === STREAMINFO_BLOCK_TYPE) {
      if (blockLength !== STREAMINFO_BLOCK_LENGTH) {
        throw new Error('FLAC STREAMINFO block is invalid.');
      }
      totalSamples = readStreamInfoTotalSamples(data, dataOffset);
    }

    offset = nextOffset;
    if (isLast) {
      sawLastMetadataBlock = true;
      break;
    }
  }

  if (!sawLastMetadataBlock || totalSamples === null) {
    throw new Error('FLAC metadata is incomplete.');
  }

  return {
    totalSamples,
    hasAudioFrames: offset < data.byteLength,
  };
}
