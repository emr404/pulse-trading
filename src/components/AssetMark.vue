<script setup lang="ts">
import type { Asset } from '../../shared/types'
defineProps<{ asset?: Asset; symbol?: string }>()
</script>
<template>
  <span
    class="asset-mark"
    :style="{
      color: '#262626',
      backgroundColor: '#f2f2f2',
    }"
    >{{ (asset?.symbol || symbol || '?').slice(0, 1)
    }}<span v-if="asset?.symbol === 'NVDA'" class="mark-dot"></span
  ></span>
</template>
