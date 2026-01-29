<template>
  <div v-if="fact" class="rounded border bg-gray-50 p-3 text-sm">
    <div class="mb-1 font-semibold">채점 정보</div>

    <ul class="space-y-1 text-xs">
      <li>감지 답안: {{ fact.answer || "-" }}</li>

      <li v-if="typeof omrConfidence === 'number'">
        신뢰도:
        <span :class="omrConfidence < 0.7 ? 'font-semibold text-red-600' : ''">
          {{ omrConfidence }}
        </span>
      </li>

      <li v-if="invalidReason" class="font-semibold text-red-600">
        처리 사유: {{ invalidReason }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Fact = { meta?: any; answer?: string } | null;

const props = defineProps<{ fact: Fact }>();

const omrConfidence = computed(() => props.fact?.meta?.omr?.confidence);
const invalidReason = computed(() => props.fact?.meta?.grading?.invalid_reason);
</script>
