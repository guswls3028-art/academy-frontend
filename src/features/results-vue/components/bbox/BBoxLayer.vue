<template>
  <div
    class="absolute pointer-events-none border-2 border-red-500 bg-red-200/20"
    :style="styleObj"
  >
    <div
      v-if="meta.label"
      class="absolute -top-5 left-0 rounded bg-red-600 px-1 text-[10px] text-white"
    >
      {{ meta.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BBoxMeta } from "./types";

const props = defineProps<{
  meta: BBoxMeta;
  scale: number;
}>();

const styleObj = computed(() => {
  const b = props.meta.bbox;
  return {
    left: `${b.x * props.scale}px`,
    top: `${b.y * props.scale}px`,
    width: `${b.width * props.scale}px`,
    height: `${b.height * props.scale}px`,
  };
});
</script>
