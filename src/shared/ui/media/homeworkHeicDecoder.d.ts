declare module "@homework-heic-decoder" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(target: ImageData, complete: (result: ImageData | null) => void): void;
    free(): void;
  }
  interface HeifDecoder {
    decoder?: number;
    decode(buffer: ArrayBuffer): HeifImage[];
  }
  export default function buildLibheif(): {
    HeifDecoder: new () => HeifDecoder;
    heif_context_free(context: number): void;
  };
}
