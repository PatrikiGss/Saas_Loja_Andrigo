/**
 * Rotas da aplicação.
 *
 * Cada etapa do projeto acrescenta as suas rotas aqui, sempre com `import`
 * tardio: quem só abre a vitrine não baixa o código das telas de conta.
 *
 * `exigeAutenticacao` e `apenasVisitante` organizam a navegação e melhoram a
 * experiência — não são segurança. Quem recusa acesso é o backend, em toda
 * requisição, mesmo que alguém digite a rota na barra de endereço.
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { NOME_DA_LOJA } from '@/app/config'

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string
    /** Sem sessão, manda para o login guardando o destino. */
    exigeAutenticacao?: boolean
    /** Com sessão, não faz sentido abrir: login e cadastro. */
    apenasVisitante?: boolean
  }
}

const rotas: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'inicio',
    component: () => import('@/modules/loja/views/InicioView.vue'),
    meta: { titulo: 'Loja' },
  },
  {
    path: '/entrar',
    name: 'entrar',
    component: () => import('@/modules/auth/views/LoginView.vue'),
    meta: { titulo: 'Entrar', apenasVisitante: true },
  },
  {
    path: '/criar-conta',
    name: 'criar-conta',
    component: () => import('@/modules/auth/views/CadastroView.vue'),
    meta: { titulo: 'Criar conta', apenasVisitante: true },
  },
  {
    // Endereço montado pelo backend no e-mail de cadastro.
    path: '/ativar/:uid/:token',
    name: 'ativar-conta',
    component: () => import('@/modules/auth/views/AtivarContaView.vue'),
    meta: { titulo: 'Ativação da conta' },
  },
  {
    path: '/recuperar-senha',
    name: 'recuperar-senha',
    component: () => import('@/modules/auth/views/RecuperarSenhaView.vue'),
    meta: { titulo: 'Recuperar senha', apenasVisitante: true },
  },
  {
    // Endereço montado pelo backend no e-mail de recuperação.
    path: '/redefinir-senha/:uid/:token',
    name: 'redefinir-senha',
    component: () => import('@/modules/auth/views/RedefinirSenhaView.vue'),
    meta: { titulo: 'Nova senha' },
  },
  {
    path: '/conta/senha',
    name: 'alterar-senha',
    component: () => import('@/modules/auth/views/AlterarSenhaView.vue'),
    meta: { titulo: 'Alterar senha', exigeAutenticacao: true },
  },
  {
    path: '/:caminho(.*)*',
    name: 'nao-encontrado',
    component: () => import('@/views/NaoEncontradoView.vue'),
    meta: { titulo: 'Página não encontrada' },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: rotas,
  scrollBehavior(_para, _de, posicaoSalva) {
    return posicaoSalva ?? { top: 0 }
  },
})

/** Mantém o título da aba coerente com a rota, que é o que o histórico mostra. */
router.afterEach((para) => {
  document.title = para.meta.titulo ? `${para.meta.titulo} — ${NOME_DA_LOJA}` : NOME_DA_LOJA
})
