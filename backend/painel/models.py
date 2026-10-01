"""Contas, perfis e níveis de acesso."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.core.validators import RegexValidator
from django.db import models
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


class Nivel(models.TextChoices):
    """Níveis de acesso da aplicação."""

    USUARIO = 'usuario', 'Usuário'
    ADMIN = 'admin', 'Admin'


def nivel_de(usuario: AbstractBaseUser) -> str:
    """Traduz o estado persistido da conta para o nível de acesso.

    O nível não é um campo próprio: ele é lido de `is_staff`. Como não existe
    coluna `nivel`, nenhum payload tem onde encostar — a única forma de mudar
    privilégio é `definir_nivel`, o admin do Django ou `createsuperuser`.
    """
    return Nivel.ADMIN if usuario.is_staff else Nivel.USUARIO


def definir_nivel(usuario: AbstractBaseUser, nivel: str) -> None:
    """Único ponto do código que altera o privilégio de uma conta.

    `is_superuser` nunca é tocado aqui: superusuário se cria pela linha de
    comando, e a API não promove ninguém a esse patamar.
    """
    usuario.is_staff = nivel == Nivel.ADMIN
    usuario.save(update_fields=('is_staff',))


def invalidar_tokens(usuario: AbstractBaseUser) -> None:
    """Derruba os refresh tokens em circulação da conta.

    O access token já emitido cai junto, mas por outro caminho: com
    `CHECK_REVOKE_TOKEN` ligado, ele carrega a marca da senha e deixa de valer
    quando ela muda.
    """
    for token in OutstandingToken.objects.filter(user=usuario):
        BlacklistedToken.objects.get_or_create(token=token)


def trocar_senha(usuario: AbstractBaseUser, nova_senha: str) -> None:
    """Grava a senha nova e derruba as sessões em circulação.

    É o único caminho de troca de senha — pela própria conta ou pelo link de
    recuperação —, para nenhum deles esquecer a segunda metade: quem tiver
    roubado um refresh token deixa de conseguir renovar o acesso.
    """
    usuario.set_password(nova_senha)
    usuario.save(update_fields=('password',))
    invalidar_tokens(usuario)


validar_telefone = RegexValidator(
    r'^\+?[0-9][0-9 ()-]{7,19}$',
    'Informe um telefone válido, com 8 a 20 caracteres.',
)


class Perfil(models.Model):
    """Dados do usuário que não pertencem à autenticação."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil',
    )
    telefone = models.CharField(max_length=20, blank=True, validators=(validar_telefone,))
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('usuario__username',)

    def __str__(self) -> str:
        return f'Perfil de {self.usuario.get_username()}'

    @property
    def nivel(self) -> str:
        return nivel_de(self.usuario)


#: Tentativas de entrega antes de desistir de uma mensagem.
TENTATIVAS_DE_ENVIO = 5


class EmailPendente(models.Model):
    """Fila de e-mail no banco.

    O envio sai da requisição: quem manda a mensagem só grava a linha, e o
    comando `enviar_emails` entrega depois. SMTP lento ou fora do ar não
    segura o cliente nem desfaz o que ele acabou de fazer.
    """

    destinatario = models.EmailField()
    assunto = models.CharField(max_length=200)
    corpo = models.TextField()
    tentativas = models.PositiveSmallIntegerField(default=0)
    ultimo_erro = models.CharField(max_length=100, blank=True)
    enviado_em = models.DateTimeField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('criado_em',)
        indexes = (
            models.Index(fields=('enviado_em', 'criado_em'), name='email_pendente_fila_idx'),
        )

    def __str__(self) -> str:
        return f'{self.assunto} ({self.pk})'


class EventoAdministrativo(models.Model):
    """Registro de operação administrativa: quem fez, o que fez e em quem.

    Existe para responder "quem mudou isso" depois que a poeira baixa. A
    conta do responsável pode ser apagada; o registro fica.
    """

    ator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='eventos_administrativos',
    )
    acao = models.CharField(max_length=40)
    alvo = models.CharField(max_length=120, blank=True)
    detalhes = models.CharField(max_length=200, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-criado_em',)
        indexes = (models.Index(fields=('-criado_em',), name='evento_admin_data_idx'),)

    def __str__(self) -> str:
        return f'{self.acao} em {self.alvo}'


class UF(models.TextChoices):
    """Unidades da federação, para validar o destino da entrega."""

    AC = 'AC', 'Acre'
    AL = 'AL', 'Alagoas'
    AM = 'AM', 'Amazonas'
    AP = 'AP', 'Amapá'
    BA = 'BA', 'Bahia'
    CE = 'CE', 'Ceará'
    DF = 'DF', 'Distrito Federal'
    ES = 'ES', 'Espírito Santo'
    GO = 'GO', 'Goiás'
    MA = 'MA', 'Maranhão'
    MG = 'MG', 'Minas Gerais'
    MS = 'MS', 'Mato Grosso do Sul'
    MT = 'MT', 'Mato Grosso'
    PA = 'PA', 'Pará'
    PB = 'PB', 'Paraíba'
    PE = 'PE', 'Pernambuco'
    PI = 'PI', 'Piauí'
    PR = 'PR', 'Paraná'
    RJ = 'RJ', 'Rio de Janeiro'
    RN = 'RN', 'Rio Grande do Norte'
    RO = 'RO', 'Rondônia'
    RR = 'RR', 'Roraima'
    RS = 'RS', 'Rio Grande do Sul'
    SC = 'SC', 'Santa Catarina'
    SE = 'SE', 'Sergipe'
    SP = 'SP', 'São Paulo'
    TO = 'TO', 'Tocantins'


#: Campos que descrevem um destino de entrega. O pedido congela uma cópia.
CAMPOS_DE_ENDERECO = ('cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf')

validar_cep = RegexValidator(r'^\d{8}$', 'Informe o CEP com 8 dígitos, apenas números.')


def copiar_endereco(endereco: Endereco) -> dict:
    """Cópia dos campos de entrega, para congelar no pedido."""
    return {campo: getattr(endereco, campo) for campo in CAMPOS_DE_ENDERECO}


class CamposDeEndereco(models.Model):
    """Endereço de entrega.

    É abstrato porque os mesmos campos aparecem em dois lugares: no cadastro
    do cliente e congelados dentro do pedido.
    """

    cep = models.CharField(max_length=8, validators=(validar_cep,))
    logradouro = models.CharField(max_length=120)
    numero = models.CharField(max_length=10)
    complemento = models.CharField(max_length=60, blank=True)
    bairro = models.CharField(max_length=60)
    cidade = models.CharField(max_length=60)
    uf = models.CharField(max_length=2, choices=UF.choices)

    class Meta:
        abstract = True


class Endereco(CamposDeEndereco):
    """Endereço cadastrado por um cliente. Ele pode ter vários."""

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enderecos',
    )
    apelido = models.CharField(max_length=30, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-criado_em',)

    def __str__(self) -> str:
        return f'{self.logradouro}, {self.numero} - {self.cidade}/{self.uf}'
