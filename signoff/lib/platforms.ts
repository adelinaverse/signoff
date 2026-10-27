import type { MediaItem, Platform, PlatformVersion } from './types';

export const PLATFORMS: Platform[] = ['linkedin', 'instagram', 'facebook'];

export const PLATFORM_INFO: Record<Platform, {
  name: string;
  captionLimit: number;
  /** roughly where the feed cuts the caption with "more" */
  foldAt: number;
  maxMedia: number;
}> = {
  // Limits are approximate. Check each platform's current specs if a post gets close.
  linkedin: { name: 'LinkedIn', captionLimit: 3000, foldAt: 210, maxMedia: 20 },
  instagram: { name: 'Instagram', captionLimit: 2200, foldAt: 125, maxMedia: 20 },
  facebook: { name: 'Facebook', captionLimit: 63206, foldAt: 480, maxMedia: 20 },
};

export type CheckLevel = 'error' | 'warning';
export interface Check {
  level: CheckLevel;
  message: string;
}

const hashtagCount = (text: string) => (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;

/** Format checks for one platform version. Errors block sending for approval. */
export function checkPlatform(pv: Pick<PlatformVersion, 'platform' | 'caption' | 'is_reel'>, media: MediaItem[]): Check[] {
  const info = PLATFORM_INFO[pv.platform];
  const checks: Check[] = [];
  const caption = pv.caption.trim();
  const images = media.filter((m) => m.kind === 'image');
  const videos = media.filter((m) => m.kind === 'video');

  if (!caption) checks.push({ level: 'error', message: 'Add a caption.' });
  if (caption.length > info.captionLimit) {
    checks.push({ level: 'error', message: `Caption is ${caption.length.toLocaleString()} characters; ${info.name} allows about ${info.captionLimit.toLocaleString()}.` });
  }
  if (media.length > info.maxMedia) {
    checks.push({ level: 'error', message: `${info.name} allows up to ${info.maxMedia} images or videos in one post.` });
  }

  if (pv.platform === 'instagram') {
    if (media.length === 0) checks.push({ level: 'error', message: 'Instagram posts need at least one image or video.' });
    const tags = hashtagCount(caption);
    if (tags > 30) checks.push({ level: 'error', message: `${tags} hashtags; Instagram allows 30.` });
    if (pv.is_reel) {
      if (videos.length !== 1 || images.length > 0) {
        checks.push({ level: 'error', message: 'A Reel needs exactly one video and nothing else.' });
      } else {
        const v = videos[0];
        if (v.width && v.height && Math.abs(v.width / v.height - 9 / 16) > 0.05) {
          checks.push({ level: 'warning', message: 'Reels look best at 9:16 (portrait). This video will be cropped or letterboxed.' });
        }
      }
    } else {
      for (const [i, m] of media.entries()) {
        if (!m.width || !m.height) continue;
        const r = m.width / m.height;
        if (r < 0.79 || r > 1.92) {
          checks.push({ level: 'warning', message: `Item ${i + 1} is outside Instagram's feed range (4:5 to 1.91:1) and will be cropped.` });
        }
      }
      if (media.length === 1 && videos.length === 1) {
        checks.push({ level: 'warning', message: 'Instagram now posts most single videos as Reels. Consider ticking "Post as a Reel".' });
      }
    }
  }

  if (pv.platform === 'linkedin' && videos.length > 0 && media.length > 1) {
    checks.push({ level: 'error', message: 'LinkedIn posts can have several images or one video, not a mix.' });
  }

  if (pv.platform === 'facebook' && caption.length > 2000) {
    checks.push({ level: 'warning', message: 'Long for Facebook. Most people only read the first few lines.' });
  }

  return checks;
}

export function mediaSummary(media: Pick<MediaItem, 'kind'>[], isReel = false) {
  if (media.length === 0) return 'Text only';
  if (isReel) return 'Reel';
  if (media.length > 1) return `Carousel, ${media.length} items`;
  return media[0].kind === 'video' ? 'Video' : 'Image';
}
