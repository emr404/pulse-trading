<template>
  <svg class="sparkline" viewBox="0 0 100 34" aria-hidden="true">
    <polyline
      :points="points"
      fill="none"
      :stroke="positive === false ? '#ed777c' : '#4fcea3'"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ values: number[]; positive?: boolean }>()
const points = computed(() => {
  if (props.values.length < 2) return ''
  const min = Math.min(...props.values),
    max = Math.max(...props.values),
    span = max - min || 1
  return props.values
    .map(
      (v, i) =>
        `${(i / (props.values.length - 1)) * 100},${29 - ((v - min) / span) * 25}`,
    )
    .join(' ')
})
</script>
