<template>
  <div v-if="!fact" class="flex h-64 items-center justify-center rounded border text-sm text-gray-400">
    문항을 선택하세요
  </div>

  <div v-else-if="!bbox" class="flex h-64 items-center justify-center rounded border text-sm text-gray-400">
    BBox 정보 없음
  </div>

  <div v-else class="rounded border p-2">
    <BBoxOverlay :src="imageSrc" :width="displayWidth" :originalWidth="originalWidth" :boxes="boxes" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BBoxOverlay from "../bbox/BBoxOverlay.vue";
import type { BBoxMeta } from "../bbox/types";

type Fact = { meta?: any } | null;

const props = defineProps<{
  imageSrc: string;
  fact: Fact;
  originalWidth: number;
  displayWidth: number;
}>();

const bbox = computed(() => props.fact?.meta?.omr?.bbox ?? null);
const invalidReason = computed(() => props.fact?.meta?.grading?.invalid_reason ?? null);
const confidence = computed(() => props.fact?.meta?.omr?.confidence);

const boxes = computed<BBoxMeta[]>(() => {
  if (!bbox.value) return [];
  return [
    {
      bbox: bbox.value,
      label: invalidReason.value ?? "OMR",
      confidence: confidence.value,
      invalid_reason: invalidReason.value ?? undefined,
    },
  ];
});
</script>
