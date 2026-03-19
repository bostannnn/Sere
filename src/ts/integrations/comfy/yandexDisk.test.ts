import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadReferenceImageToYandexDisk } from "./yandexDisk";

describe("uploadReferenceImageToYandexDisk", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("translates the known Yandex Disk resource lock message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({
        message: "Ресурс заблокирован. Возможно, над ним выполняется другая операция.",
      }),
      {
        status: 423,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )));

    await expect(uploadReferenceImageToYandexDisk(
      {
        provider: "yandex-disk",
        yandexDiskToken: "token",
        yandexDiskFolder: "/Apps/RisuAI/runpod-temp",
      },
      {
        bytes: new Uint8Array([1, 2, 3]),
        extension: "png",
        contentType: "image/png",
      },
    )).rejects.toThrow("Yandex Disk resource is locked. Another operation is likely still in progress. Retry in a moment.");
  });
});
