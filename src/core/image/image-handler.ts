/**
 * ImageHandler — 图片粘贴处理 + 本地存储
 * 将剪贴板图片保存为 data URL 或本地文件
 */

/**
 * 从剪贴板获取图片，返回 data URL
 */
export async function getImageFromClipboard(
  event: ClipboardEvent
): Promise<string | null> {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) {
        return await blobToDataURL(blob);
      }
    }
  }
  return null;
}

/**
 * 从拖拽事件获取图片
 */
export async function getImageFromDrop(
  event: DragEvent
): Promise<string | null> {
  const files = event.dataTransfer?.files;
  if (!files) return null;

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      return await blobToDataURL(file);
    }
  }
  return null;
}

/**
 * Blob 转 data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 获取图片尺寸
 */
export function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
