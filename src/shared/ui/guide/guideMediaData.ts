import mediaCatalog from "./content/guide-media.json";

export type GuideMediaSource = {
  title: string;
  screens: { src: string; title: string; description: string; alt: string }[];
  video?: { src: string; captions: string; poster: string; duration: string };
};

export function findGuideMedia(scope: string, topic: string): GuideMediaSource | undefined {
  return (mediaCatalog as Record<string, GuideMediaSource>)[`${scope}/${topic}`];
}
