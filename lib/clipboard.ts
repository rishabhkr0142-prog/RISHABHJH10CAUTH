/**
 * Safe client-side clipboard helper.
 * 
 * Works across all environments:
 * - Checks if navigator and navigator.clipboard exist
 * - Checks if navigator.clipboard.writeText is a function
 * - Attempts navigator.clipboard.writeText(text)
 * - If unavailable or fails, gracefully falls back to textarea + document.execCommand('copy')
 * - Never throws runtime errors or crashes the page
 */
export async function copyToClipboardSafe(text: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Try modern navigator.clipboard API
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, attempting execCommand fallback:', err);
  }

  // 2. Fallback using temporary textarea and document.execCommand('copy')
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (fallbackErr) {
    console.error('Fallback clipboard copy failed:', fallbackErr);
    return false;
  }
}
