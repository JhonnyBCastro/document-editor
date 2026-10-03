# CHECKPOINT-FREEZE-001 — Congelamento Canônico do document-editor

**Data:** 03/10/2026  
**Última atividade técnica:** REL-004 — Verificação Final de Publicação da RC.2  
**Estado:** DESENVOLVIMENTO ENCERRADO / DISTRIBUIÇÃO LOCAL CONGELADA  
**Publicação npm:** EXPRESSAMENTE NÃO AUTORIZADA

## 1. Identidade do produto

- Nome: document-editor.
- Natureza: biblioteca TypeScript de paginação visual não destrutiva para Tiptap/ProseMirror.
- Identificador do pacote local: `@jhonny_bcastro/document-editor`.
- Versão congelada: `0.1.0-rc.2`.
- Licença: MIT.
- Repositório: `https://github.com/JhonnyBCastro/document-editor`.
- Visibilidade do GitHub: PRIVADO.
- Distribuição: exclusivamente por tarball local.
- Estado no npm público: NÃO PUBLICADO.

O document-editor é um produto independente conforme ADR-002. O APPE é seu primeiro consumidor, não o proprietário de sua arquitetura.

## 2. Artefato canônico congelado

Arquivo:

`jhonny_bcastro-document-editor-0.1.0-rc.2.tgz`

SHA-256 registrado na REL-003 e reconfirmado na REL-004:

`2be1f33ce9dd5d5c423d4ab8f6ba26f9a0a05b60b4c39b007f6d30fd7df8adfd`

Inventário da distribuição:

- package.json.
- README.md.
- LICENSE.
- dist/document-editor.css.
- dist/index.d.ts.
- dist/pagination.es.js.
- dist/pagination.umd.js.

Total informado: 7 arquivos, aproximadamente 47,9 kB compactados.

É proibido reconstruir, sobrescrever ou modificar esse tarball mantendo a identidade `0.1.0-rc.2`.

A RC.1 histórica também deverá permanecer preservada.

## 3. Arquitetura consolidada

A biblioteca utiliza a Rota B:

- Documento semântico ProseMirror contínuo.
- Uma única instância EditorView no contexto oficialmente suportado.
- Paginação automática representada por Decorations transitórias.
- Paginação tabular baseada em fronteiras de linhas e widgets virtuais.
- ChromeLayer proprietário e independente do documento semântico.
- Quebras manuais persistidas como nós fornecidos pelo consumidor.
- Ausência de persistência das quebras automáticas no JSON.

O backend OpenPDF do APPE interpreta a representação semântica armazenada, incluindo o nó manual `pageBreak`. As Decorations automáticas da interface não são convertidas em instruções de paginação no servidor.

## 4. Contratos públicos consolidados

- PaginationExtension.
- manualBreakNodeName.
- onLayoutStable.
- whenLayoutStable(editor).
- chromeLayerElement.
- preparePrintSession(editor) / restore().
- Importação explícita do CSS público.

O layout padrão utiliza geometria US Letter em pixels CSS.

Na RC.2, o cabeçalho padrão foi neutralizado:

`header.enabled = false`

`header.text = ''`

O rodapé padrão em português permanece como uma decisão conhecida e documentada.

## 5. Evidências técnicas

Conforme CONS-010, REL-002, REL-003 e REL-004:

- Testes unitários Vitest.
- Testes Puppeteer de paginação híbrida e estresse.
- Testes de ownership do ChromeLayer.
- Testes do contrato PrintSession.
- Consumo por aplicação Vanilla independente.
- Compatibilidade ensaiada nas versões de referência Tiptap 2.27.3 e 3.31.3.
- Build e inspeção do tarball RC.2.
- Verificação dos metadados e exports.
- Dry-run de publicação npm.
- Reconfirmação física do SHA-256.

Fixture PE-L, sob as condições geométricas documentadas:

| Métrica | Resultado |
|---|---:|
| DataRows | 151 |
| Páginas virtuais | 10 |
| Quebras automáticas | 7 |
| Espaçadores tabulares | 6 |

Esses valores representam os cenários efetivamente testados, não garantias universais de comportamento.

## 6. Limitações assumidas

- Suporte oficial restrito ao cenário single-instance.
- Dependência do Browser DOM e de medições geométricas.
- Ausência de suporte SSR.
- Fragmentação intralinha universal de tabelas complexas não implementada.
- Uso da classe global body.print-mode durante a impressão.
- Possíveis divergências entre as páginas virtuais e renderizadores PDF externos.
- Ausência de homologação visual operacional completa da RC.2 no APPE.
- Ausência de certificação universal para todas as versões do Tiptap 2 e 3.

## 7. Decisão formal de produto

Por determinação expressa do autor:

**NÃO PUBLICAR O PACOTE NO REGISTRO NPM NESTA ETAPA.**

Ficam suspensos:

- npm publish.
- Abertura pública do repositório GitHub.
- Criação de Releases públicas.
- Promoção para 1.0.0.
- Criação automática de uma RC.3.
- Novas funcionalidades.
- Refatorações do motor geométrico.
- Modificações comportamentais ou de dependências.

O parecer GO da REL-004 é uma avaliação técnica histórica e não constitui autorização de publicação.

## 8. Separação das futuras equipes

### Frente A — Guardiã canônica

Composta pela sessão atual e pelo executor original da biblioteca.

Responsabilidade: preservar o código, as evidências, os contratos e os artefatos congelados.

Nenhuma implementação adicional está autorizada.

### Frente B — Integração visual externa

Será inaugurada em uma nova sessão independente, com um Agente Revisor de Integração e um Agente Construtor Angular.

Seu ambiente de trabalho será exclusivamente o ecossistema consumidor APPE Web/API.

A equipe receberá o tarball RC.2 e deverá tratá-lo como dependência externa, utilizando seus contratos públicos.

É proibido editar diretamente o código-fonte do document-editor, copiar partes internas do motor para o consumidor ou realizar correções silenciosas na biblioteca.

Eventuais defeitos deverão ser documentados com procedimento de reprodução, comportamento esperado e observado, ambiente, logs e evidências visuais.

A reabertura da biblioteca dependerá de autorização expressa do autor.
