import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

function* mp4Boxes(bytes: Buffer) {
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const kind = bytes.toString("ascii", offset + 4, offset + 8);
    const header = size === 1 ? 16 : 8;
    const length =
      size === 1
        ? Number(bytes.readBigUInt64BE(offset + 8))
        : size || bytes.length - offset;
    assert.ok(length >= header && offset + length <= bytes.length);
    yield { kind, data: bytes.subarray(offset + header, offset + length) };
    offset += length;
  }
}

test("decorative MP4 assets contain video and no audio track", () => {
  const directory = new URL("../../public/assets/video/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) =>
    name.endsWith(".mp4"),
  )) {
    const bytes = readFileSync(new URL(file, directory));
    let tracks: Buffer[] = [bytes];
    for (const kind of ["moov", "trak", "mdia", "hdlr"])
      tracks = tracks.flatMap((data) =>
        [...mp4Boxes(data)]
          .filter((box) => box.kind === kind)
          .map((box) => box.data),
      );
    const types = tracks.map((track) => track.toString("ascii", 8, 12));
    assert.ok(types.includes("vide"), file);
    assert.ok(!types.includes("soun"), file);
  }
});
