import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHED_VIDEOS_KEY = '@tava_watched_videos';

// Video identifiers
export const VIDEO_IDS = {
  REDDIT_INTRO: 'reddit_intro',
  GETTING_STARTED: 'getting_started',
  LEAD_HUNTING: 'lead_hunting',
  TIPS_TRICKS: 'tips_tricks',
} as const;

export type VideoId = typeof VIDEO_IDS[keyof typeof VIDEO_IDS];

// Video URLs
export const VIDEO_URLS: Record<VideoId, string> = {
  [VIDEO_IDS.REDDIT_INTRO]: 'https://github.com/Ashon-G/tava-assets/raw/main/Captions_44F98F.mp4',
  [VIDEO_IDS.GETTING_STARTED]: '',
  [VIDEO_IDS.LEAD_HUNTING]: '',
  [VIDEO_IDS.TIPS_TRICKS]: '',
};

interface VideoStore {
  watchedVideos: Set<VideoId>;
  isLoading: boolean;

  // Actions
  loadWatchedVideos: () => Promise<void>;
  markVideoAsWatched: (videoId: VideoId) => Promise<void>;
  hasWatchedVideo: (videoId: VideoId) => boolean;
  resetWatchedVideos: () => Promise<void>;
}

const useVideoStore = create<VideoStore>((set, get) => ({
  watchedVideos: new Set(),
  isLoading: true,

  loadWatchedVideos: async () => {
    try {
      const stored = await AsyncStorage.getItem(WATCHED_VIDEOS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as VideoId[];
        set({ watchedVideos: new Set(parsed), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load watched videos:', error);
      set({ isLoading: false });
    }
  },

  markVideoAsWatched: async (videoId: VideoId) => {
    const { watchedVideos } = get();
    const updatedSet = new Set(watchedVideos);
    updatedSet.add(videoId);

    try {
      await AsyncStorage.setItem(
        WATCHED_VIDEOS_KEY,
        JSON.stringify(Array.from(updatedSet)),
      );
      set({ watchedVideos: updatedSet });
    } catch (error) {
      console.error('Failed to save watched video:', error);
    }
  },

  hasWatchedVideo: (videoId: VideoId) => {
    return get().watchedVideos.has(videoId);
  },

  resetWatchedVideos: async () => {
    try {
      await AsyncStorage.removeItem(WATCHED_VIDEOS_KEY);
      set({ watchedVideos: new Set() });
    } catch (error) {
      console.error('Failed to reset watched videos:', error);
    }
  },
}));

export default useVideoStore;
