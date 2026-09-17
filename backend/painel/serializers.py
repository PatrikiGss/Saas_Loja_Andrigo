"""Serializers de conta, perfil e administração de usuários."""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from painel.models import Nivel, Perfil, nivel_de

Usuario = get_user_model()


class CadastroSerializer(serializers.Serializer):
    """Cadastro público, que cria apenas contas de nível usuário.

    É um `Serializer` e não um `ModelSerializer` de propósito: os únicos campos
    que existem aqui são estes três, então nenhum payload alcança `is_staff`,
    `is_superuser`, `groups` ou `user_permissions`.
    """

    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128, style={'input_type': 'password'})
    nome = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')

    def validate_email(self, valor: str) -> str:
        """O e-mail é o identificador do login, então não pode repetir.

        A busca cobre `username` e `email` porque contas criadas pela linha de
        comando podem ter um nome de usuário diferente do e-mail.
        """
        email = valor.strip().lower()
        if Usuario.objects.filter(Q(username__iexact=email) | Q(email__iexact=email)).exists():
            raise serializers.ValidationError('E-mail já cadastrado.')
        return email

    def validate(self, attrs: dict) -> dict:
        """Aplica os validadores de senha do Django."""
        conta = Usuario(
            username=attrs['email'],
            email=attrs['email'],
            first_name=attrs.get('nome', ''),
        )
        try:
            validate_password(attrs['password'], conta)
        except ErroDeValidacaoDoModelo as erro:
            raise serializers.ValidationError({'password': list(erro.messages)}) from erro
        return attrs

    def create(self, validated_data: dict) -> Usuario:
        """`create_user` guarda a senha com hash e nasce sem privilégio."""
        return Usuario.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['nome'],
        )

    def to_representation(self, instance: Usuario) -> dict:
        """Resposta mínima: nunca devolve a senha nem o hash dela."""
        return {
            'id': instance.pk,
            'email': instance.email,
            'nome': instance.first_name,
            'nivel': nivel_de(instance),
        }


class LoginSerializer(TokenObtainPairSerializer):
    """Login por e-mail, usando o fluxo de token do simplejwt.

    O token não carrega o nível da conta: quem decide autorização é o banco, a
    cada requisição.
    """

    email = serializers.EmailField(write_only=True)

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.fields.pop(self.username_field, None)

    def validate(self, attrs: dict) -> dict:
        attrs[self.username_field] = attrs.pop('email').strip().lower()
        return super().validate(attrs)


class PerfilSerializer(serializers.ModelSerializer):
    """Perfil da própria conta.

    E-mail e nível são somente leitura: o e-mail identifica a conta no login e
    o nível vive em `is_staff`, fora do alcance do cliente.
    """

    email = serializers.EmailField(source='usuario.email', read_only=True)
    nome = serializers.CharField(source='usuario.first_name', max_length=150, required=False, allow_blank=True)
    sobrenome = serializers.CharField(source='usuario.last_name', max_length=150, required=False, allow_blank=True)
    nivel = serializers.CharField(read_only=True)

    class Meta:
        model = Perfil
        fields = ('email', 'nome', 'sobrenome', 'telefone', 'nivel')

    def update(self, instance: Perfil, validated_data: dict) -> Perfil:
        dados_da_conta = validated_data.pop('usuario', {})
        if dados_da_conta:
            for campo, valor in dados_da_conta.items():
                setattr(instance.usuario, campo, valor)
            instance.usuario.save(update_fields=tuple(dados_da_conta))
        return super().update(instance, validated_data)


class UsuarioAdminSerializer(serializers.ModelSerializer):
    """Visão administrativa da conta.

    Só `ativo` é editável por aqui. Nível tem endpoint próprio, e senha e hash
    não aparecem em nenhuma hipótese.
    """

    nome = serializers.CharField(source='first_name', read_only=True)
    sobrenome = serializers.CharField(source='last_name', read_only=True)
    telefone = serializers.CharField(source='perfil.telefone', read_only=True)
    nivel = serializers.SerializerMethodField()
    ativo = serializers.BooleanField(source='is_active', required=False)
    criado_em = serializers.DateTimeField(source='date_joined', read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'email', 'nome', 'sobrenome', 'telefone', 'nivel', 'ativo', 'criado_em')
        read_only_fields = ('id', 'email')

    def get_nivel(self, usuario: Usuario) -> str:
        return nivel_de(usuario)


class AlteracaoNivelSerializer(serializers.Serializer):
    """Entrada da troca de nível, aceita somente de contas admin."""

    nivel = serializers.ChoiceField(choices=Nivel.choices)
