<template>
  <div class="flex h-full gap-4">
    <div class="w-52 shrink-0 border-r pr-2">
      <div class="mb-2 text-xs text-gray-500">attempt_id: {{ attemptId }}</div>

      <AttemptQuestionList
        :facts="factsSimple"
        :selectedQuestionId="selectedQuestionId"
        @select="onSelect"
      />
    </div>

    <div class="flex flex-1 flex-col gap-3">
      <div v-if="!finalImageSrc" class="rounded border bg-gray-50 p-3 text-sm text-gray-500">
        OMR 이미지 URL이 없습니다.
        (권장) backend에서 item.meta.omr.image_url 형태로 내려주거나,
        상위에서 imageSrc prop으로 주입하세요.
      </div>

      <AttemptOMRViewer
        v-else
        :imageSrc="finalImageSrc"
        :fact="selectedFact"
        :originalWidth="finalOriginalWidth"
        :displayWidth="displayWidth"
      />

      <AttemptMetaPanel :fact="selectedFact" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import AttemptQuestionList from "./AttemptQuestionList.vue";
import AttemptOMRViewer from "./AttemptOMRViewer.vue";
import AttemptMetaPanel from "./AttemptMetaPanel.vue";

type Fact = {
  question_id: number;
  answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  meta?: any;
};

const props = defineProps<{
  attemptId: number;
  facts: Fact[];
  imageSrc?: string;
  originalWidth?: number;
  displayWidth?: number;
  autoSelectFirst?: boolean;
}>();

const displayWidth = computed(() => props.displayWidth ?? 520);
const autoSelectFirst = computed(() => props.autoSelectFirst ?? true);

const selectedQuestionId = ref<number | null>(null);

const factsSimple = computed(() =>
  props.facts.map((f) => ({
    question_id: f.question_id,
    is_correct: f.is_correct,
    meta: f.meta,
  }))
);

const selectedFact = computed(() => {
  return props.facts.find((f) => f.question_id === selectedQuestionId.value) ?? null;
});

function inferImageSrc(facts: Fact[]): string {
  for (const f of facts) {
    const m = f.meta;
    const cands = [m?.omr?.image_url, m?.omr?.imageUrl, m?.image_url, m?.imageUrl, m?.omr?.page_image_url];
    const hit = cands.find((v) => typeof v === "string" && v.length > 0);
    if (hit) return hit;
  }
  return "";
}

function inferOriginalWidth(facts: Fact[]): number {
  for (const f of facts) {
    const w = f.meta?.omr?.original_width ?? f.meta?.omr?.originalWidth ?? f.meta?.original_width ?? f.meta?.originalWidth;
    const n = Number(w);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1000;
}

const finalImageSrc = computed(() => props.imageSrc || inferImageSrc(props.facts));
const finalOriginalWidth = computed(() => (props.originalWidth && props.originalWidth > 0 ? props.originalWidth : inferOriginalWidth(props.facts)));

function onSelect(qid: number) {
  selectedQuestionId.value = qid;
}

// ✅ 초기 자동 선택
watch(
  () => props.facts,
  (facts) => {
    if (!autoSelectFirst.value) return;
    if (selectedQuestionId.value != null) return;
    if (!facts || facts.length === 0) return;
    selectedQuestionId.value = facts[0].question_id;
  },
  { immediate: true }
);
</script>
