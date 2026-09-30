"""Ajustes no esquema OpenAPI depois que o drf-spectacular o monta."""


def respostas_completas(result: dict, generator, request, public: bool) -> dict:
    """Marca como obrigatório todo campo de resposta.

    O drf-spectacular decide o que é obrigatório pela regra de escrita: campo
    com `required=False` sai opcional também na resposta. Só que o DRF escreve
    todo campo do serializer na resposta, e aqui toda resposta sai de
    instância de model, onde o atributo sempre existe. Sem este ajuste, o
    frontend receberia `nome?: string` para um nome que sempre vem, e teria
    de tratar uma ausência que não acontece.

    Opcional continua sendo o que é: entrada (os componentes `*Request`) e
    valor que pode ser nulo, que o esquema já declara como `nullable`.
    """
    for nome, componente in result['components']['schemas'].items():
        if nome.endswith('Request') or 'properties' not in componente:
            continue
        componente['required'] = sorted(componente['properties'])
    return result
