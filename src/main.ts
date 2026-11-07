import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
const app = createApp(App)
if (import.meta.env.DEV && import.meta.env.VITE_PROFILE_RENDER === '1')
  app.config.performance = true
app.use(createPinia()).mount('#app')
