import { readFile, writeFile } from 'node:fs/promises';
import { createCanvas } from 'canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Node canvas factory for pdfjs-dist v5 rendering.
 * We store the real node-canvas Canvas keyed by the wrapper object
 * so drawImage can resolve pdfjs-dist internal canvases.
 */
const realCanvasMap = new WeakMap<object, ReturnType<typeof createCanvas>>();

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(pair: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) {
    pair.canvas.width = width;
    pair.canvas.height = height;
  }

  destroy(pair: { canvas: ReturnType<typeof createCanvas> }) {
    pair.canvas.width = 0;
    pair.canvas.height = 0;
  }
}

/**
 * Render a specific page of a PDF as a PNG thumbnail.
 */
export async function renderThumbnail(
  pdfPath: string,
  pageIndex: number,
  outputPath: string,
  scale: number = 1.0,
): Promise<string> {
  const buffer = await readFile(pdfPath);
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const canvasFactory = new NodeCanvasFactory();

  // Wrap the factory to track pdfjs-dist wrapper → real canvas mapping
  const wrappedFactory = {
    create(width: number, height: number) {
      const result = canvasFactory.create(width, height);
      // Store the real canvas so we can look it up later
      // pdfjs-dist will wrap result.canvas in a proxy; we key by the real canvas
      realCanvasMap.set(result.canvas, result.canvas);
      return result;
    },
    reset: canvasFactory.reset.bind(canvasFactory),
    destroy: canvasFactory.destroy.bind(canvasFactory),
  };

  const pdf = await getDocument({ data, canvasFactory: wrappedFactory }).promise;

  try {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Monkey-patch drawImage to handle pdfjs-dist internal canvas wrappers.
    // pdfjs-dist creates temp canvases via our factory, then passes them to
    // ctx.drawImage(). The wrapper has getContext/width/height but node-canvas
    // doesn't recognize it. We extract pixel data and draw via a real canvas.
    const origDrawImage = context.drawImage.bind(context);
    (context as unknown as Record<string, unknown>).drawImage = function (
      img: unknown,
      ...rest: unknown[]
    ) {
      // Try to use it directly first
      try {
        return origDrawImage(img as Parameters<typeof origDrawImage>[0], ...(rest as [number, number]));
      } catch {
        // Failed — img is probably a pdfjs-dist canvas wrapper
      }

      // Extract pixel data from the wrapper's context and draw via a temp canvas
      const wrapper = img as { width: number; height: number; getContext: (id: string) => { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray; width: number; height: number } } };
      if (wrapper && typeof wrapper.getContext === 'function' && wrapper.width > 0 && wrapper.height > 0) {
        const srcCtx = wrapper.getContext('2d');
        if (srcCtx && typeof srcCtx.getImageData === 'function') {
          const srcData = srcCtx.getImageData(0, 0, wrapper.width, wrapper.height);
          const tmp = createCanvas(wrapper.width, wrapper.height);
          const tmpCtx = tmp.getContext('2d');
          // Create a proper node-canvas ImageData from the raw pixel data
          const nodeImageData = tmpCtx.createImageData(wrapper.width, wrapper.height);
          nodeImageData.data.set(srcData.data);
          tmpCtx.putImageData(nodeImageData, 0, 0);
          return origDrawImage(tmp as Parameters<typeof origDrawImage>[0], ...(rest as [number, number]));
        }
      }

      // Last resort: skip this draw call to avoid crashing
      console.warn('thumbnailService: skipping unrecognized drawImage source');
    };

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const pngBuffer = canvas.toBuffer('image/png');
    await writeFile(outputPath, pngBuffer);

    return outputPath;
  } finally {
    await pdf.destroy();
  }
}
