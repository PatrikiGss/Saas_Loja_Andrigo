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
    /**
     * Rota da gestão: usa a moldura administrativa e exige nível admin.
     *
     * Serve para organizar a navegação, não para proteger nada. Quem recusa
     * cada requisição é o backend, com `EhAdmin`, e continuaria recusando se
     * alguém chegasse aqui de outro jeito.
     */
    admin?: boolean
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
    path: '/catalogo',
    name: 'catalogo',
    component: () => import('@/modules/loja/views/CatalogoView.vue'),
    meta: { titulo: 'Catálogo' },
  },
  {
    path: '/produto/:id',
    name: 'produto',
    component: () => import('@/modules/loja/views/ProdutoView.vue'),
    meta: { titulo: 'Produto' },
  },
  {
    path: '/carrinho',
    name: 'carrinho',
    component: () => import('@/modules/carrinho/views/CarrinhoView.vue'),
    meta: { titulo: 'Carrinho', exigeAutenticacao: true },
  },
  {
    path: '/pedidos',
    name: 'pedidos',
    component: () => import('@/modules/pedidos/views/PedidosView.vue'),
    meta: { titulo: 'Meus pedidos', exigeAutenticacao: true },
  },
  {
    path: '/pedidos/:numero',
    name: 'pedido',
    component: () => import('@/modules/pedidos/views/PedidoView.vue'),
    meta: { titulo: 'Pedido', exigeAutenticacao: true },
  },
  {
    path: '/checkout',
    name: 'checkout',
    component: () => import('@/modules/checkout/views/CheckoutView.vue'),
    meta: { titulo: 'Fechar pedido', exigeAutenticacao: true },
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
    path: '/conta',
    name: 'conta',
    component: () => import('@/modules/perfil/views/PerfilView.vue'),
    meta: { titulo: 'Minha conta', exigeAutenticacao: true },
  },
  {
    path: '/conta/enderecos',
    name: 'conta-enderecos',
    component: () => import('@/modules/perfil/views/EnderecosView.vue'),
    meta: { titulo: 'Meus endereços', exigeAutenticacao: true },
  },
  {
    path: '/conta/senha',
    name: 'alterar-senha',
    component: () => import('@/modules/auth/views/AlterarSenhaView.vue'),
    meta: { titulo: 'Alterar senha', exigeAutenticacao: true },
  },
  {
    path: '/admin/produtos',
    name: 'admin-produtos',
    component: () => import('@/modules/admin/views/ProdutosView.vue'),
    meta: { titulo: 'Produtos', exigeAutenticacao: true, admin: true },
  },
  {
    path: '/admin/produtos/novo',
    name: 'admin-produto-novo',
    component: () => import('@/modules/admin/views/ProdutoFormView.vue'),
    meta: { titulo: 'Cadastrar produto', exigeAutenticacao: true, admin: true },
  },
  {
    path: '/admin/produtos/:id',
    name: 'admin-produto',
    component: () => import('@/modules/admin/views/ProdutoFormView.vue'),
    meta: { titulo: 'Editar produto', exigeAutenticacao: true, admin: true },
  },
  {
    path: '/admin/pedidos',
    name: 'admin-pedidos',
    component: () => import('@/modules/admin/views/PedidosView.vue'),
    meta: { titulo: 'Pedidos', exigeAutenticacao: true, admin: true },
  },
  {
    path: '/admin/usuarios',
    name: 'admin-usuarios',
    component: () => import('@/modules/admin/views/UsuariosView.vue'),
    meta: { titulo: 'Usuários', exigeAutenticacao: true, admin: true },
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
