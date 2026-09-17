"""Rotas do catálogo."""
from rest_framework.routers import DefaultRouter

from loja.views import ProdutoViewSet, SubtipoViewSet

router = DefaultRouter()
router.register('produtos', ProdutoViewSet, basename='produto')
router.register('subtipos', SubtipoViewSet, basename='subtipo')

urlpatterns = router.urls
