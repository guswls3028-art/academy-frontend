<template>
  <ul class="space-y-1 text-sm">
    <li
      v-for="f in facts"
      :key="f.question_id"
      class="cursor-pointer rounded px-2 py-1"
      :class="rowClass(f.question_id)"
      @click="emit('select', f.question_id)"
    >
      Q{{ f.question_id }} {{ f.is_correct ? "✅" : "❌" }}
      <span v-if="invalidReason(f)" class="ml-1 text-xs text-red-600">
        ({{ invalidReason(f) }})
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
type Fact = { question_id: number; is_correct: boolean; meta?: any };

const props = defineProps<{
  facts: Fact[];
  selectedQuestionId: number | null;
}>();

const emit = defineEmits<{
  (e: "select", qid: number): void;
}>();

function invalidReason(f: Fact) {
  return f.meta?.grading?.invalid_reason ?? null;
}

function rowClass(qid: number) {
  return props.selectedQuestionId === qid
    ? "bg-blue-100 font-semibold"
    : "hover:bg-gray-100";
}
</script>
