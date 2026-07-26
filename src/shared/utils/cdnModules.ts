function importCdnModule<T>(url: string): Promise<T> {
  return import(/* @vite-ignore */ url) as Promise<T>;
}

type Html2Canvas = (
  element: HTMLElement,
  options: {
    scale: number;
    useCORS: boolean;
    backgroundColor: string;
    logging: boolean;
    windowWidth?: number;
    windowHeight?: number;
  },
) => Promise<HTMLCanvasElement>;

type JsPdfDocument = {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  addPage: () => void;
  save: (filename: string) => void;
};

type JsPdfConstructor = new (options: {
  orientation: "portrait" | "landscape";
  unit: "mm";
  format: string;
}) => JsPdfDocument;

const HTML2CANVAS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm";
const JSPDF_CDN_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

export async function loadPdfCdnModules(): Promise<{
  html2canvas: Html2Canvas;
  jsPDF: JsPdfConstructor;
}> {
  const [html2canvasModule, jsPdfModule] = await Promise.all([
    importCdnModule<{ default: Html2Canvas }>(HTML2CANVAS_CDN_URL),
    importCdnModule<{ jsPDF: JsPdfConstructor }>(JSPDF_CDN_URL),
  ]);
  return {
    html2canvas: html2canvasModule.default,
    jsPDF: jsPdfModule.jsPDF,
  };
}
