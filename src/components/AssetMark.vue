<script setup lang="ts">
import type { Asset } from '../../shared/types'
defineProps<{ asset?: Asset; symbol?: string }>()
</script>
<template>
  <span
    class="asset-mark"
    :style="{
      color: asset?.color || '#a4b4ce',
      backgroundColor: (asset?.color || '#a4b4ce') + '13',
    }"
    >{{ (asset?.symbol || symbol || '?').slice(0, 1)
    }}<span v-if="asset?.symbol === 'NVDA'" class="mark-dot"></span
  ></span>
</template>
