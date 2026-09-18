import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { instalarSessao } from './modules/auth/instalar'
import { router } from './router'
import './assets/estilos/index.css'

const app = createApp(App)

app.use(createPinia())
// Antes do router: é a instalação que registra o guard de autenticação, e ele
// precisa estar no lugar antes da primeira navegação.
instalarSessao(router)
app.use(router)

app.mount('#app')
