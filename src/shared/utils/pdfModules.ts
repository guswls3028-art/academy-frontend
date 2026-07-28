// PATH: src/shared/utils/pdfModules.ts

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

export async function loadPdfModules(): Promise<{
  html2canvas: Html2Canvas;
  jsPDF: JsPdfConstructor;
}> {
  const [html2canvasModule, jsPdfModule] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  return {
    html2canvas: html2canvasModule.default as Html2Canvas,
    jsPDF: jsPdfModule.jsPDF as unknown as JsPdfConstructor,
  };
}
