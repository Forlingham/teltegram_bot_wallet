<script setup>
import TelegramEnvCheck from './components/TelegramEnvCheck.vue'
</script>

<template>
  <TelegramEnvCheck>
    <router-view />
  </TelegramEnvCheck>
</template>