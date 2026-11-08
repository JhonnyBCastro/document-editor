# Política de segurança

Obrigado por ajudar a manter o **document-editor** seguro. Este documento orienta o relato responsável de possíveis vulnerabilidades na biblioteca.

## Escopo

Recebemos relatos relacionados ao código público da biblioteca, incluindo Core, Presentation, Compose, integrações e dependências relevantes. Ao relatar um problema, indique a versão ou o commit afetado, sempre que possível.

O manifesto atual identifica a versão `0.1.0-rc.4`, mas isso não equivale, por si só, a uma promessa de suporte a versões antigas nem comprova publicação npm. Ainda não há uma matriz formal de versões suportadas. A avaliação de cada relato levará em conta a versão, a possibilidade de reprodução e o impacto.

## Como relatar uma vulnerabilidade

**Não abra uma Issue pública nem uma Pull Request pública contendo detalhes de uma vulnerabilidade ainda não corrigida.**

Use o canal privado de segurança do GitHub quando estiver habilitado:

1. Acesse a [área de segurança do repositório](https://github.com/JhonnyBCastro/document-editor/security).
2. Entre em **Advisories / Security advisories** e escolha **Report a vulnerability**.
3. Informe o impacto, os passos de reprodução e uma prova de conceito mínima. Não inclua senhas, tokens reais ou dados privados.

O formulário de **Private vulnerability reporting** depende de habilitação administrativa no GitHub. Se a opção **Report a vulnerability** não estiver disponível, abra uma Issue **somente para solicitar um meio privado de contato**, sem revelar detalhes da falha, códigos exploráveis ou informações sensíveis. Aguarde a indicação do canal antes de compartilhar essas informações.

## O que informar no relato privado

- Versão, commit ou configuração afetada.
- Descrição do comportamento e impacto potencial.
- Passos mínimos e reproduzíveis, com código de demonstração seguro.
- Limitações conhecidas, pré-condições e possíveis mitigações.

O mantenedor avaliará o relato e poderá solicitar informações adicionais. **Não há prazo de resposta ou correção garantido** neste momento.

## Divulgação responsável

Solicitamos que os detalhes técnicos de uma vulnerabilidade não corrigida permaneçam privados durante a análise e eventual preparação de uma correção. Qualquer divulgação pública ou advisory deverá ser coordenado com o mantenedor, respeitando a segurança das pessoas que utilizam a biblioteca.

Para bugs funcionais sem implicações de segurança, utilize os [templates de Issues](https://github.com/JhonnyBCastro/document-editor/issues/new/choose). Para enviar melhorias, consulte também o [guia de contribuição](CONTRIBUTING.md).
