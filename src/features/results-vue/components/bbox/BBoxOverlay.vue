<template>
  <div class="relative">
    <img :src="src" :style="{ width: width + 'px' }" />
    <BBoxLayer v-for="(b, i) in boxes" :key="i" :meta="b" :scale="scale" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BBoxLayer from "./BBoxLayer.vue";
import type { BBoxMeta } from "./types";

const props = defineProps<{
  src: string;
  width: number;
  originalWidth: number;
  boxes: BBoxMeta[];
}>();

const scale = computed(() => props.width / props.originalWidth);
</script>
