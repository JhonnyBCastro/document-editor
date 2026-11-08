# Como contribuir com o document-editor

Obrigado pelo interesse em melhorar o **document-editor**. Este projeto recebe relatos de problemas, sugestões, correções de documentação, testes e melhorias de código.

O repositório é público, mas a branch **main** é protegida. Toda mudança deve ser proposta por **Pull Request (PR)**, avaliada pelo mantenedor e passar pelo check obrigatório **verify**. Abrir uma Issue ou PR não concede acesso de escrita à main.

## Antes de começar

- Leia o [README](README.md), o [Quick Start](docs/quick-start.md) e as [limitações](docs/limitations.md).
- Pesquise nas [Issues existentes](https://github.com/JhonnyBCastro/document-editor/issues) e nas PRs para evitar duplicações.
- Para **bugs**, abra uma Issue com contexto, passos para reproduzir, resultado esperado e resultado observado.
- Para **melhorias grandes ou mudanças de contrato público**, converse primeiro em uma Issue antes de iniciar uma implementação extensa.
- Não inclua tokens, credenciais, dados pessoais ou outros segredos em Issues, PRs e logs públicos. Vulnerabilidades de segurança não devem ser divulgadas publicamente antes de haver um canal de tratamento privado.

## Enviando uma correção

1. Faça um **fork** do repositório na sua conta GitHub (colaboradores com permissão de escrita também podem usar uma branch própria, conforme combinado com o mantenedor).
2. Crie uma branch de trabalho a partir da main atualizada, por exemplo: `fix/descricao-curta` ou `docs/descricao-curta`.
3. Faça a alteração **somente na branch** e, quando adequado, adicione ou ajuste os testes correspondentes.
4. Antes de enviar, execute os comandos indicados abaixo. Informe na PR o que você executou e o resultado. Não marque como testado aquilo que não foi executado.
5. Faça os commits na branch, envie-a ao GitHub e abra uma **Pull Request para main** usando o modelo fornecido.
6. Aguarde a avaliação e trate os comentários de revisão. A integração é decisão do mantenedor, não é automática.

## Validação local básica

Recomendamos Node.js 24 para acompanhar o ambiente do CI. Na raiz do projeto:

```bash
npm ci
npm test
npm run build
npm run test:types:public
```

A ordem importa: a verificação de tipos públicos depende dos arquivos criados pelo build, em especial da entrada `/compose`.

No GitHub Actions, o job obrigatório **verify** executa esses mesmos comandos em uma PR para a main. Os cenários de navegador e geometria especializados não fazem parte desse job; execute e documente os testes adicionais quando a alteração exigir.

## Cuidados com a arquitetura e o alcance das evidências

- O documento Tiptap/ProseMirror é semanticamente contínuo; as quebras automáticas são transitórias.
- O **Core** calcula a paginação, a **Presentation** desenha as folhas e a composição coordenada integra as camadas.
- Evite transferir responsabilidades de medição e paginação à Presentation ou alterar contratos públicos sem discussão.
- Uma aprovação de testes unitários e build não certifica, por si só, geometria, impressão, tabelas arbitrárias ou todos os navegadores.
- Mantenha o escopo da PR restrito e descreva explicitamente eventuais limitações ou evidências não reproduzidas.

## O que acontece com sua Pull Request?

O GitHub exige uma PR, a aprovação do check `verify` e a resolução das conversas de revisão antes de permitir a integração. A main deve estar atualizada em relação à alteração avaliada. O projeto utiliza **Squash** ou **Rebase**, preservando histórico linear.

O mantenedor pode solicitar alterações, pedir evidências adicionais ou optar por não incorporar uma proposta. Agradecemos o tempo e as informações de cada pessoa que contribui.
