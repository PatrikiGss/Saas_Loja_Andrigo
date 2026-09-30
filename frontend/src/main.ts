import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { instalarSessao } from './modules/auth/instalar'
import { instalarCarrinho } from './modules/carrinho/instalar'
import { instalarVerificacaoDeIdade } from './modules/idade/instalar'
import { router } from './router'
// Archivo servida junto com o site, com os eixos de largura e peso, em vez de
// vir do Google Fonts: nenhum pedido a terceiro para desenhar a primeira
// tela, e nada a declarar sobre isso a quem visita. Sem itálico, que o site
// não usa.
import '@fontsource-variable/archivo/wdth.css'
import './assets/estilos/index.css'

const app = createApp(App)

app.use(createPinia())
// Antes do router: é a instalação que registra o guard de autenticação, e ele
// precisa estar no lugar antes da primeira navegação.
instalarSessao(router)
// Depois da sessão: o carrinho acompanha quem está autenticado.
instalarCarrinho()
// Também depois da sessão: quem não entrou vai primeiro ao login, e só ouve a
// pergunta de idade do carrinho quando chega a ele.
instalarVerificacaoDeIdade(router)
app.use(router)

app.mount('#app')
