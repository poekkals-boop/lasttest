import { storage, auth } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";

/**
 * Compresses an image file (or base64 string) using HTML5 Canvas with high-fidelity smoothing to fit within maxDimensions and converts to a clear JPEG base64 string.
 */
export function compressImage(
  fileOrBase64: File | string,
  maxSize: number = 1200,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const processSrc = (src: string) => {
      // If it's not a data URL, just resolve it directly
      if (!src.startsWith("data:image/")) {
        resolve(src);
        return;
      }
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Only downsample if image width or height exceeds maxSize
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(src); // Fallback to raw if canvas context is unavailable
            return;
          }

          // Enable high-quality image interpolation smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } catch (e) {
          console.warn("Image compression failed, using original source.", e);
          resolve(src); // Fallback on exception
        }
      };
      img.onerror = () => {
        resolve(src); // Fallback if image fails to load
      };
      img.src = src;
    };

    if (fileOrBase64 instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          processSrc(reader.result);
        } else {
          resolve("");
        }
      };
      reader.onerror = () => {
        resolve("");
      };
      reader.readAsDataURL(fileOrBase64);
    } else {
      processSrc(fileOrBase64);
    }
  });
}

/**
 * Converts a data URL/base64 string to a Blob object.
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/jpeg';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

export interface UploadImageOptions {
  maxSize?: number;
  quality?: number;
  isBanner?: boolean;
  folder?: string;
}

/**
 * Compresses a File, uploads it to Firebase Storage (or fallback cloud services),
 * and returns the public direct HTTPS URL. Falls back to a high-quality compressed base64 string on failure.
 */
export async function uploadImageToCloud(
  file: File,
  options?: UploadImageOptions
): Promise<string> {
  const isBanner = options?.isBanner || false;
  // Banners need ultra-crisp resolution (1920px max, 0.90 quality) so promotional slides stay sharp across all screen sizes
  const maxSize = options?.maxSize ?? (isBanner ? 1920 : 1000);
  const quality = options?.quality ?? (isBanner ? 0.90 : 0.82);
  const folder = options?.folder ?? (isBanner ? "banners" : "products");

  try {
    // 1. High-quality image compression preserving sharpness and clear details
    const compressedBase64 = await compressImage(file, maxSize, quality);
    if (!compressedBase64 || !compressedBase64.startsWith("data:image/")) {
      return compressedBase64 || "";
    }
    
    // 2. Convert to a Blob for upload
    const blob = base64ToBlob(compressedBase64);
    const filename = file.name || 'image.jpg';
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.]/g, "_");
    
    // 3. Try uploading to official Firebase Storage with a 3.5-second timeout
    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (authErr) {
          console.warn("Auth on-demand failed:", authErr);
        }
      }

      const storageRef = ref(storage, `${folder}/${Date.now()}_${cleanFilename}`);
      
      const uploadWithTimeout = async () => {
        const snapshot = await uploadBytes(storageRef, blob, {
          contentType: "image/jpeg"
        });
        return await getDownloadURL(snapshot.ref);
      };

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Firebase Storage upload timed out")), 3500)
      );

      const downloadUrl = await Promise.race([uploadWithTimeout(), timeoutPromise]);
      if (downloadUrl) {
        console.log("Firebase Storage upload success:", downloadUrl);
        return downloadUrl;
      }
    } catch (firebaseErr) {
      console.warn("Firebase Storage fallback to high-quality compressed image:", firebaseErr);
    }
    
    // 4. Fallback: High-resolution clear base64 image
    return compressedBase64;
  } catch (error) {
    console.error("Upload to cloud failed:", error);
    try {
      return await compressImage(file, isBanner ? 1600 : 800, 0.85);
    } catch (fallbackError) {
      return "";
    }
  }
}
