// Cardano metadata limit is 16KB per transaction
// This utility splits large attendance lists into chunks

const MAX_BYTES = 15000; // 15KB to stay safely under 16KB limit

function getByteSize(obj) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

export function buildAttendanceMetadataChunks(baseInfo, attendanceList) {
  const chunks = [];
  let currentChunk = [];

  for (const record of attendanceList) {
    currentChunk.push(record);

    const testMetadata = {
      ...baseInfo,
      chunk: chunks.length + 1,
      total_chunks: "TBD",
      attendance: currentChunk,
    };

    if (getByteSize(testMetadata) > MAX_BYTES) {
      // Remove last record and save current chunk
      currentChunk.pop();
      chunks.push([...currentChunk]);
      // Start new chunk with the record that didn't fit
      currentChunk = [record];
    }
  }

  // Push remaining records
  if (currentChunk.length > 0) chunks.push(currentChunk);

  return chunks;
}

export function buildChunkMetadata(baseInfo, chunk, chunkIndex, totalChunks) {
  return {
    ...baseInfo,
    chunk: chunkIndex + 1,
    total_chunks: totalChunks,
    attendance: chunk,
  };
}
